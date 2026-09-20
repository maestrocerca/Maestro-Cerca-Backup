import dotenv from "dotenv";
dotenv.config();
import express, { Request, Response } from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { initializeApp as initAdminApp, getApps as getAdminApps } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import { getStorage as getAdminStorage } from "firebase-admin/storage";
import { GoogleGenAI } from "@google/genai";
import fs from "fs";

// Load Firebase configuration
const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
let firebaseConfig: any = {};
try {
  if (fs.existsSync(firebaseConfigPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));
  } else {
    console.warn(
      "[Firebase Admin Warning]: El archivo firebase-applet-config.json no existe. " +
      "Las operaciones del Admin SDK (verificación telefónica, reportes y webhook ManyChat) funcionarán en modo degradado."
    );
  }
} catch (err: any) {
  console.warn("[Firebase Admin Warning]: Error al leer o parsear firebase-applet-config.json:", err?.message);
}

if (!firebaseConfig.projectId) {
  console.warn(
    "[Firebase Admin Warning]: Falta 'projectId' en la configuración de Firebase. " +
    "La persistencia en Firestore y la verificación de tokens en el servidor podrían fallar."
  );
}

// Initialize Firebase Admin SDK safely (backend canonical authority)
const adminApp = getAdminApps().length === 0 ? initAdminApp({
  projectId: firebaseConfig.projectId,
  storageBucket: firebaseConfig.storageBucket,
}) : getAdminApps()[0];

const adminAuth = getAdminAuth(adminApp);
const adminDb = getAdminFirestore(adminApp, firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== "(default)" ? firebaseConfig.firestoreDatabaseId : undefined);
const adminStorage = getAdminStorage(adminApp);

// Gemini client for automated profile photo moderation (see moderateImageContent below).
// Reads GEMINI_API_KEY from the environment; if it's missing, moderation is skipped
// (fail-open with a warning) rather than blocking every photo upload.
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;
if (!genAI) {
  console.warn(
    "[Gemini Moderation Warning]: GEMINI_API_KEY no configurada. La moderación automática de fotos de perfil " +
    "se omitirá (fail-open) hasta que se configure la variable de entorno."
  );
}

/**
 * Uses Gemini's vision capability to screen a profile photo before it goes public.
 * Fails open (treats the image as safe) on any API/parsing error so a flaky external
 * call never permanently blocks a legitimate worker from publishing their photo —
 * the goal is a moderation net, not a hard gate the whole feature depends on.
 */
async function moderateImageContent(
  buffer: Buffer,
  mimeType: string
): Promise<{ safe: boolean; reason?: string }> {
  if (!genAI) {
    return { safe: true };
  }

  try {
    const response = await genAI.models.generateContent({
      model: "gemini-3.8-flash",
      contents: [
        {
          inlineData: {
            mimeType,
            data: buffer.toString("base64"),
          },
        },
        {
          text:
            "Esta imagen se publicará como foto de perfil pública de un trabajador de la construcción " +
            "(albañil, electricista, plomero, etc.) en un directorio de servicios en México. " +
            "Responde ÚNICAMENTE con 'SAFE' si es una foto de perfil apropiada (persona, rostro, o " +
            "trabajo/herramientas, sin contenido sexual, desnudez, violencia gráfica, sangre, armas, " +
            "símbolos de odio, o cualquier otro contenido ofensivo o inapropiado). " +
            "Si NO es apropiada, responde ÚNICAMENTE con 'UNSAFE: ' seguido de una razón breve en español.",
        },
      ],
    });

    const text = (response.text || "").trim();
    if (/^unsafe/i.test(text)) {
      return { safe: false, reason: text.replace(/^unsafe:?\s*/i, "") || "Contenido inapropiado detectado." };
    }
    return { safe: true };
  } catch (err: any) {
    console.warn("[Gemini Moderation Warning]: Falló la clasificación, se permite la publicación (fail-open):", err?.message);
    return { safe: true };
  }
}

/**
 * Normalizes Mexican phone number to E.164 (+52XXXXXXXXXX)
 * Accepts formats like:
 * - "4421234567" -> "+524421234567"
 * - "+52 442 123 4567" -> "+524421234567"
 * - "5214421234567" -> "+524421234567"
 * - "+5214421234567" -> "+524421234567"
 */
function normalizeMexicanPhone(rawPhone: string): { e164: string; digitsOnly: string; isValid: boolean } {
  if (!rawPhone || typeof rawPhone !== "string") {
    return { e164: "", digitsOnly: "", isValid: false };
  }

  // Remove all non-digits
  let digits = rawPhone.replace(/\D/g, "");

  // Remove leading zeros or international prefixes if present
  if (digits.startsWith("00")) {
    digits = digits.substring(2);
  }

  // Handle Mexican country code '52'
  if (digits.startsWith("52")) {
    digits = digits.substring(2);
    // Remove Mexican mobile indicator '1' if present (e.g. +52 1 442...)
    if (digits.startsWith("1") && digits.length === 11) {
      digits = digits.substring(1);
    }
  }

  // If phone has 10 digits, it's a valid Mexican national number
  if (digits.length === 10) {
    return {
      e164: `+52${digits}`,
      digitsOnly: digits,
      isValid: true,
    };
  }

  // If longer and ends with 10 digits
  if (digits.length > 10) {
    const last10 = digits.slice(-10);
    return {
      e164: `+52${last10}`,
      digitsOnly: last10,
      isValid: true,
    };
  }

  return { e164: "", digitsOnly: digits, isValid: false };
}

// Canonical availability options shown across the site. WhatsApp/ManyChat
// answers are free text, so we map common phrasings onto one of these fixed
// labels instead of storing whatever wording the AI Step happened to produce.
const DISPONIBILIDAD_OPTIONS = [
  "Lunes a viernes",
  "Fines de semana",
  "Todos los días",
  "Medio tiempo",
  "Bajo cita",
] as const;

function normalizeDisponibilidad(raw: string): string {
  const text = raw.trim().toLowerCase();
  if (!text) return "";

  const hasWeekdays = /(lunes|martes|mi[eé]rcoles|jueves|viernes|semana)/.test(text);
  const hasWeekend = /(fin de semana|fines de semana|s[aá]bado|domingo)/.test(text);
  const isFullTime = /(todos los d[ií]as|tiempo completo|cualquier d[ií]a|24\/7|siempre)/.test(text);
  const isPartTime = /(medio tiempo|medio d[ií]a|algunas horas|parcial)/.test(text);
  const isByAppointment = /(cita|agendar|previa cita|por proyecto)/.test(text);

  if (isFullTime || (hasWeekdays && hasWeekend)) return "Todos los días";
  if (hasWeekend && !hasWeekdays) return "Fines de semana";
  if (hasWeekdays) return "Lunes a viernes";
  if (isPartTime) return "Medio tiempo";
  if (isByAppointment) return "Bajo cita";

  // No confident match — keep the raw answer rather than silently discarding it.
  return raw.trim();
}

/**
 * Generates a unique, URL-safe slug for a worker's public profile from their full name,
 * appending an incrementing suffix on collision. Shared by /api/auth/generate-slug and
 * the ManyChat finalize-registration endpoint.
 */
async function generateUniqueSlugServer(fullName: string): Promise<string> {
  const base =
    (fullName || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "maestro";

  let candidate = base;
  let counter = 1;

  try {
    while (true) {
      const snap = await adminDb.collection("maestros").where("slug", "==", candidate).limit(1).get();
      if (snap.empty) return candidate;
      counter++;
      candidate = `${base}-${counter}`;
    }
  } catch (err: any) {
    console.warn("[Generate Slug Warning]: Firestore query failed, using fallback slug:", err?.message);
    const fallbackSuffix = Math.random().toString(36).substring(2, 6);
    return `${base}-${fallbackSuffix}`;
  }
}

/**
 * Copies an external image from URL (e.g. ManyChat / WhatsApp CDN) to Firebase Storage.
 * If copy fails or bucket is not provisioned, falls back gracefully to the original URL so data is never lost.
 */
async function copyImageToFirebaseStorage(
  imageUrl: string,
  destinationFolder: string,
  fileName: string
): Promise<{ url: string; copied: boolean; error?: string }> {
  try {
    if (!imageUrl || typeof imageUrl !== "string" || !imageUrl.startsWith("http")) {
      return { url: imageUrl || "", copied: false, error: "Invalid URL" };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

    const response = await fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "MaestroCerca-MediaSync/1.0",
      },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return { url: imageUrl, copied: false, error: `HTTP ${response.status}` };
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Limit to 10MB
    if (buffer.length > 10 * 1024 * 1024) {
      return { url: imageUrl, copied: false, error: "Image exceeds 10MB" };
    }

    // Try Admin Storage first
    try {
      const bucket = adminStorage.bucket();
      const [exists] = await bucket.exists().catch(() => [false]);
      if (exists) {
        const file = bucket.file(`${destinationFolder}/${fileName}`);
        await file.save(buffer, {
          metadata: {
            contentType,
            metadata: {
              source: "manychat",
              originalUrl: imageUrl.slice(0, 200),
              uploadedAt: new Date().toISOString(),
            },
          },
        });
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${destinationFolder}/${fileName}`;
        return { url: publicUrl, copied: true };
      }
    } catch (adminStErr) {
      // Gracefully fall back
    }

    return { url: imageUrl, copied: false, error: "Storage bucket not yet provisioned; preserved original CDN URL" };
  } catch (err: any) {
    console.warn("Storage sync note (gracefully preserved original URL):", err?.message || err);
    return { url: imageUrl, copied: false, error: err?.message || "Storage upload failed" };
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON and URL-encoded body parsers
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // =========================================================================
  // HEALTH CHECK
  // =========================================================================
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      service: "Maestro Cerca API",
      timestamp: new Date().toISOString(),
    });
  });

  // =========================================================================
  // MANYCHAT WEBHOOK ENDPOINT
  // POST /api/webhooks/manychat (also aliased at /api/manychat/register)
  //
  // Security & Authentication:
  // Requires the 'x-api-key' request header matching process.env.MANYCHAT_WEBHOOK_SECRET.
  // If MANYCHAT_WEBHOOK_SECRET is not configured or empty, responds 503 ("Servicio no configurado").
  // If header is missing or does not match, responds 401 ("Unauthorized").
  // =========================================================================
  const handleManyChatWebhook = async (req: Request, res: Response): Promise<void> => {
    res.setHeader("Content-Type", "application/json");

    try {
      // 1. Authenticate x-api-key header against MANYCHAT_WEBHOOK_SECRET
      const expectedSecret = process.env.MANYCHAT_WEBHOOK_SECRET;
      if (!expectedSecret || expectedSecret.trim() === "") {
        console.error("[ManyChat Webhook Error]: Variable de entorno MANYCHAT_WEBHOOK_SECRET no configurada en el servidor.");
        res.status(503).json({ error: "Servicio no configurado" });
        return;
      }

      const rawHeaderKey = req.get("x-api-key") || (req.headers["x-api-key"] as string | undefined);
      const apiKey = Array.isArray(rawHeaderKey) ? rawHeaderKey[0] : rawHeaderKey;

      if (!apiKey || apiKey !== expectedSecret) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      // 2. Parse & sanitize payload
      const body = req.body || {};
      const rawUserId = body.user_id;
      const rawTelefono = body.telefono;

      // Check for cancellation action from ManyChat
      const isCancellation = 
        body.action === "cancel" || 
        body.status === "cancelled" || 
        body.estado === "cancelado" ||
        body.event === "onboarding_cancelled";

      // Validate presence and string type of required fields: user_id and telefono
      const hasValidUserId =
        rawUserId !== undefined &&
        rawUserId !== null &&
        typeof rawUserId === "string" &&
        rawUserId.trim().length > 0;

      const hasValidTelefono =
        rawTelefono !== undefined &&
        rawTelefono !== null &&
        typeof rawTelefono === "string" &&
        rawTelefono.trim().length > 0;

      if (!hasValidUserId || !hasValidTelefono) {
        res.status(400).json({ error: "Missing required fields" });
        return;
      }

      const user_id = rawUserId.trim();
      const telefono = rawTelefono.trim();
      const { digitsOnly, e164, isValid } = normalizeMexicanPhone(telefono);
      const preWorkerKey = digitsOnly ? `pre_${digitsOnly}` : `pre_${user_id}`;
      const now = new Date().toISOString();

      // Handle cancellation flow from ManyChat
      if (isCancellation) {
        // If maestro already exists in Firestore and is approved, NEVER suspend or delete them
        if (digitsOnly) {
          const maestrosSnap = await adminDb.collection("maestros")
            .where("phone", "==", digitsOnly)
            .limit(1)
            .get();

          if (!maestrosSnap.empty) {
            const maestroDoc = maestrosSnap.docs[0];
            const maestroData = maestroDoc.data() || {};
            if (maestroData.statusPerfil === "Aprobado" || maestroData.aprobado === true) {
              console.log(`[ManyChat Cancellation] Worker ${maestroDoc.id} is already approved on platform. Preserving active profile.`);
              // Only mark preWorker as cancelled
              await adminDb.collection("preWorkers").doc(preWorkerKey).set({
                status: "cancelled",
                cancelledAt: now,
                updatedAt: now,
              }, { merge: true });

              res.status(200).json({
                status: "success",
                message: "Conversación de WhatsApp cancelada; perfil activo del maestro preservado.",
              });
              return;
            }
          }
        }

        // Mark preWorker as cancelled
        await adminDb.collection("preWorkers").doc(preWorkerKey).set({
          status: "cancelled",
          cancelledAt: now,
          updatedAt: now,
        }, { merge: true });

        res.status(200).json({
          status: "success",
          message: "Registro preliminar cancelado.",
        });
        return;
      }

      // Extract and sanitize optional fields as strings without inventing defaults
      const nombre =
        typeof body.nombre === "string"
          ? body.nombre.trim()
          : body.nombre != null
          ? String(body.nombre).trim()
          : "";

      const oficio_principal =
        typeof body.oficio_principal === "string"
          ? body.oficio_principal.trim()
          : body.oficio_principal != null
          ? String(body.oficio_principal).trim()
          : "";

      const servicios_adicionales =
        typeof body.servicios_adicionales === "string"
          ? body.servicios_adicionales.trim()
          : body.servicios_adicionales != null
          ? String(body.servicios_adicionales).trim()
          : "";

      const ciudad_principal =
        typeof body.ciudad_principal === "string"
          ? body.ciudad_principal.trim()
          : body.ciudad_principal != null
          ? String(body.ciudad_principal).trim()
          : "";

      const zonas_cobertura =
        typeof body.zonas_cobertura === "string"
          ? body.zonas_cobertura.trim()
          : body.zonas_cobertura != null
          ? String(body.zonas_cobertura).trim()
          : "";

      const experiencia =
        typeof body.experiencia === "string"
          ? body.experiencia.trim()
          : body.experiencia != null
          ? String(body.experiencia).trim()
          : "";

      const disponibilidad =
        typeof body.disponibilidad === "string"
          ? body.disponibilidad.trim()
          : body.disponibilidad != null
          ? String(body.disponibilidad).trim()
          : "";

      // Canonical persistence: collection 'preWorkers' using adminDb
      const preDocRef = adminDb.collection("preWorkers").doc(preWorkerKey);
      const preSnap = await preDocRef.get();

      const parsedYears = parseInt(experiencia, 10);
      const preWorkerPayload: Record<string, any> = {
        id: preWorkerKey,
        manyChatUserId: user_id,
        manychatUserId: user_id,
        phoneNumber: isValid ? e164 : telefono,
        phone: digitsOnly || telefono,
        whatsappPhone: isValid ? e164 : telefono,
        telefono: digitsOnly || telefono,
        nombre: nombre || "",
        oficio: oficio_principal || "",
        mainTrade: oficio_principal || "",
        oficio_principal: oficio_principal || "",
        ciudad: ciudad_principal || "",
        ciudad_principal: ciudad_principal || "",
        zonas_cobertura: zonas_cobertura || "",
        serviceAreas: zonas_cobertura
          ? zonas_cobertura.split(",").map((z: string) => z.trim()).filter(Boolean)
          : [],
        servicios: servicios_adicionales
          ? servicios_adicionales.split(",").map((s: string) => s.trim()).filter(Boolean)
          : [],
        servicios_adicionales: servicios_adicionales || "",
        yearsExperience: (!isNaN(parsedYears) && parsedYears > 0) ? parsedYears : null,
        experiencia: experiencia || "",
        disponibilidad: disponibilidad || "",
        source: "manychat",
        status: "pending_claim",
        estadoRegistro: "completado",
        profileType: "registered",
        verificado: false,
        updatedAt: now,
      };

      if (!preSnap.exists) {
        preWorkerPayload.createdAt = now;
        preWorkerPayload.claimedByUid = null;
        preWorkerPayload.claimedAt = null;
      }

      await preDocRef.set(preWorkerPayload, { merge: true });

      // Strict HTTP 200 response
      res.status(200).json({
        status: "success",
        message: "Trabajador registrado correctamente",
        user_id: user_id,
        preWorkerId: preWorkerKey,
      });
    } catch (err: any) {
      console.error("[ManyChat Webhook] Unhandled error:", err);
      res.status(500).json({
        error: "Internal server error",
        message: err?.message || "Ocurrió un error inesperado al procesar el webhook.",
      });
    }
  };

  app.post("/api/webhooks/manychat", handleManyChatWebhook);
  app.post("/api/manychat/register", handleManyChatWebhook);

  // =========================================================================
  // MANYCHAT FINALIZE REGISTRATION ENDPOINT (WhatsApp-only onboarding, no browser)
  // POST /api/manychat/finalize-registration
  //
  // This is the ONLY endpoint that turns a WhatsApp conversation into a real,
  // published /maestros profile. Identity is anchored EXCLUSIVELY to the
  // ManyChat "WhatsApp ID" System Field (whatsapp_id) — the number Meta's
  // WhatsApp Business Platform cryptographically attests the message came
  // from. It must NEVER be filled from a free-text bot answer (e.g. a custom
  // field capturing "¿cuál es tu número?"), since that can be typed by anyone
  // and would let a visitor impersonate or fabricate profiles for other
  // numbers. The public contact number is always forced to equal this same
  // WhatsApp ID — there is no way to register a different public number
  // through this flow (that would require a separate, real OTP proof).
  //
  // Anti-duplication guarantee: Firebase Auth enforces that a phone number
  // can belong to at most one user account project-wide. By resolving/creating
  // the Auth user here (adminAuth.getUserByPhoneNumber / createUser) instead of
  // leaving account creation to a client-side flow, repeated registration
  // attempts for the same WhatsApp ID always resolve to the same UID — it is
  // structurally impossible to end up with 10 profiles for one phone number.
  // =========================================================================
  app.post("/api/manychat/finalize-registration", async (req: Request, res: Response): Promise<void> => {
    try {
      const expectedSecret = process.env.MANYCHAT_WEBHOOK_SECRET;
      if (!expectedSecret || expectedSecret.trim() === "") {
        res.status(503).json({ success: false, error: "Servicio no configurado" });
        return;
      }
      const rawHeaderKey = req.get("x-api-key") || (req.headers["x-api-key"] as string | undefined);
      const apiKey = Array.isArray(rawHeaderKey) ? rawHeaderKey[0] : rawHeaderKey;
      if (!apiKey || apiKey !== expectedSecret) {
        res.status(401).json({ success: false, error: "Unauthorized" });
        return;
      }

      const body = req.body || {};

      // Identity anchor: ONLY the verified WhatsApp number. ManyChat's flow-builder
      // UI does not expose "WhatsApp ID" as an insertable token anywhere (confirmed:
      // absent from the External Request field picker, the Set User Field value
      // picker, and search by name in both) — it only ever appears inside the raw
      // subscriber object produced by "Full Contact Data". So this endpoint accepts
      // EITHER a direct whatsapp_id (in case a future ManyChat feature exposes it
      // as a token) OR a full_contact object/JSON-string from "+ Añadir Full Contact
      // Data", and pulls the verified number out of the latter's whatsapp_phone /
      // whatsapp_id field. A free-text phone answer typed by the user must NEVER be
      // accepted here, since that can be typed by anyone and would let a visitor
      // impersonate or fabricate profiles for other numbers.
      let fullContact: any = body.full_contact;
      if (typeof fullContact === "string") {
        try { fullContact = JSON.parse(fullContact); } catch { fullContact = null; }
      }
      const rawWhatsAppId =
        (typeof body.whatsapp_id === "string" && body.whatsapp_id.trim()) ||
        (fullContact && typeof fullContact.whatsapp_phone === "string" && fullContact.whatsapp_phone) ||
        (fullContact && typeof fullContact.whatsapp_id === "string" && fullContact.whatsapp_id) ||
        "";
      const { e164, digitsOnly, isValid } = normalizeMexicanPhone(rawWhatsAppId);
      if (!isValid) {
        res.status(400).json({ success: false, error: "No se encontró un WhatsApp verificado válido. Envía whatsapp_id o full_contact (Full Contact Data de ManyChat), nunca una respuesta de texto libre." });
        return;
      }

      // Required fields to actually publish a profile — until the bot has
      // collected all of these, ManyChat should keep talking, not finalize.
      const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
      const oficioPrincipal = typeof body.oficio_principal === "string" ? body.oficio_principal.trim() : "";
      const ciudad = typeof body.ciudad_principal === "string" ? body.ciudad_principal.trim() : "";
      const zonasRaw = typeof body.zonas_cobertura === "string" ? body.zonas_cobertura.trim() : "";
      const serviciosRaw = typeof body.servicios_adicionales === "string" ? body.servicios_adicionales.trim() : "";
      const experienciaRaw = typeof body.experiencia === "string" ? body.experiencia.trim() : "";
      const disponibilidad = typeof body.disponibilidad === "string" ? normalizeDisponibilidad(body.disponibilidad) : "";
      const manychatUserId = typeof body.manychat_user_id === "string" ? body.manychat_user_id.trim() : "";
      const fotoUrls = ["foto_url", "foto_url_2", "foto_url_3", "foto_url_4", "foto_url_5"]
        .map((key) => (typeof body[key] === "string" ? body[key].trim() : ""))
        .filter(Boolean);

      const zonas = zonasRaw ? zonasRaw.split(/[,;\n/]+/).map((z) => z.trim()).filter(Boolean) : [];
      const servicios = serviciosRaw ? serviciosRaw.split(/[,;\n/]+/).map((s) => s.trim()).filter(Boolean) : [];

      // The profile view reads firstName/lastName (not just the combined
      // "nombre" string), so split it here the same way the CSV import path does.
      const nombreParts = nombre.split(/\s+/).filter(Boolean);
      const firstName = nombreParts[0] || "";
      const lastName = nombreParts.slice(1).join(" ");

      if (!nombre || !oficioPrincipal || zonas.length === 0) {
        res.status(400).json({
          success: false,
          error: "Faltan datos obligatorios (nombre, oficio_principal, zonas_cobertura). El bot debe seguir preguntando antes de finalizar.",
        });
        return;
      }

      // 1. Resolve or create the Firebase Auth user for this WhatsApp ID.
      //    Firebase's own phone-number-uniqueness guarantee is what makes
      //    "10 accounts, same number" structurally impossible.
      let uid: string;
      try {
        const existingUser = await adminAuth.getUserByPhoneNumber(e164);
        uid = existingUser.uid;
      } catch (lookupErr: any) {
        if (lookupErr?.code === "auth/user-not-found") {
          const newUser = await adminAuth.createUser({ phoneNumber: e164 });
          uid = newUser.uid;
        } else {
          throw lookupErr;
        }
      }

      const workerRef = adminDb.collection("maestros").doc(uid);
      const existingSnap = await workerRef.get();
      const existingData = existingSnap.exists ? existingSnap.data() || {} : {};

      // Never downgrade or resurrect an already-approved, complete profile —
      // treat a repeat finalize call for the same person as a no-op success.
      if (existingSnap.exists && existingData.aprobado === true && existingData.onboardingIncomplete !== true) {
        res.status(200).json({ success: true, workerId: uid, slug: existingData.slug, alreadyExisted: true });
        return;
      }

      const nowIso = new Date().toISOString();
      const slug = existingData.slug || (await generateUniqueSlugServer(nombre));
      const parsedYears = parseInt(experienciaRaw, 10);

      // 2. Optional work-sample photo: same automated moderation gate as the
      //    website's self-publish flow. Never publish an unmoderated image
      //    just because this path skips human admin approval.
      //    This is a "Trabajos realizados" portfolio photo, NOT the profile
      //    avatar — the avatar always stays the generic default icon unless
      //    the worker explicitly uploads a profile photo elsewhere.
      const workPhotoUrls: string[] = [];
      for (const fotoUrl of fotoUrls) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);
          const imgRes = await fetch(fotoUrl, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (imgRes.ok) {
            const arrayBuffer = await imgRes.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const contentType = imgRes.headers.get("content-type") || "image/jpeg";
            if (buffer.length <= 10 * 1024 * 1024) {
              const moderation = await moderateImageContent(buffer, contentType);
              if (moderation.safe) {
                const bucket = adminStorage.bucket();
                const publicPath = `portafolios/${uid}/trabajo_manychat_${Date.now()}_${workPhotoUrls.length}.jpg`;
                await bucket.file(publicPath).save(buffer, { metadata: { contentType } });
                workPhotoUrls.push(`https://firebasestorage.googleapis.com/v0/b/${firebaseConfig.storageBucket}/o/${encodeURIComponent(publicPath)}?alt=media`);
              } else {
                console.warn(`[ManyChat Finalize] Photo rejected by moderation for ${uid}: ${moderation.reason}`);
              }
            }
          }
        } catch (photoErr: any) {
          console.warn("[ManyChat Finalize] Photo fetch/moderation skipped:", photoErr?.message);
        }
      }

      // 3. Publish the profile. phoneVerified=true is attested by the
      //    WhatsApp Business Platform identity, not Firebase SMS — the
      //    distinct phoneVerificationMethod records exactly that provenance.
      //    Per product policy, this profile auto-publishes (aprobado=true)
      //    without human review; identityVerified/referencesVerified stay
      //    false since those still require the manual "Verificado" process.
      const maestroDoc: Record<string, any> = {
        id: uid,
        userId: uid,
        slug,
        nombre,
        firstName,
        lastName,
        oficio: oficioPrincipal,
        mainTrade: oficioPrincipal,
        oficioPrincipal,
        bio: servicios.length > 0 ? `${oficioPrincipal} en ${ciudad || "Querétaro"}. ${servicios.join(", ")}.` : `Especialista en ${oficioPrincipal}.`,
        description: servicios.length > 0 ? `${oficioPrincipal} en ${ciudad || "Querétaro"}. ${servicios.join(", ")}.` : `Especialista en ${oficioPrincipal}.`,
        ciudad: ciudad || "",
        serviceAreas: zonas,
        zonas: zonasRaw,
        servicios,
        serviciosAdicionales: serviciosRaw,
        yearsExperience: (!isNaN(parsedYears) && parsedYears > 0) ? parsedYears : null,
        experiencia: experienciaRaw,
        disponibilidad,
        phone: digitsOnly,
        phoneE164: e164,
        telefono: digitsOnly,
        telefonoWhatsApp: e164,
        telefonoPublico: e164,
        whatsapp: e164,
        source: "manychat",
        registrationMethod: "manychat_whatsapp",
        status: "active",
        onboardingIncomplete: false,
        aprobado: true,
        statusPerfil: "Aprobado",
        verificado: false,
        nivel: "Aspirante",
        phoneVerified: true,
        phoneVerifiedAt: nowIso,
        phoneVerificationMethod: "whatsapp_business_platform",
        privacyNoticeAccepted: true,
        privacyNoticeAcceptedAt: nowIso,
        termsAccepted: true,
        termsAcceptedAt: nowIso,
        isAvailable: true,
        updatedAt: nowIso,
      };

      if (manychatUserId) {
        maestroDoc.manychatUserId = manychatUserId;
      }

      if (workPhotoUrls.length > 0) {
        const existingWorkPhotos = Array.isArray(existingData.workPhotos) ? existingData.workPhotos : [];
        maestroDoc.workPhotos = [
          ...existingWorkPhotos,
          ...workPhotoUrls.map((url, i) => ({ id: `wp_manychat_${Date.now()}_${i}`, url, title: "Trabajo realizado" })),
        ];
        maestroDoc.fotosTrabajos = maestroDoc.workPhotos.map((p: { url: string }) => p.url);
      }

      if (!existingSnap.exists) {
        maestroDoc.createdAt = nowIso;
        maestroDoc.fechaRegistro = nowIso;
        maestroDoc.joinedDate = nowIso.split("T")[0];
      }

      await workerRef.set(maestroDoc, { merge: true });

      // 4. Reconcile the matching preWorker draft (if the incremental webhook
      //    was also used during the conversation) so it's not left dangling.
      try {
        const preWorkerId = `pre_${digitsOnly}`;
        await adminDb.collection("preWorkers").doc(preWorkerId).set(
          { status: "claimed", claimedByUid: uid, claimedAt: nowIso, updatedAt: nowIso },
          { merge: true }
        );
      } catch (preErr) {
        // Non-critical bookkeeping; never fail finalize because of it.
      }

      res.status(200).json({
        success: true,
        workerId: uid,
        slug,
        profileUrl: `/trabajador/${encodeURIComponent(slug)}`,
      });
    } catch (err: any) {
      console.error("[ManyChat Finalize] Unhandled error:", err);
      res.status(500).json({ success: false, error: err?.message || "Error al finalizar el registro." });
    }
  });

  // =========================================================================
  // SECURE ACCOUNT DELETION ENDPOINT
  // DELETE /api/account & POST /api/account/delete
  // Requisitos:
  // - Bearer ID Token verification with adminAuth.verifyIdToken(token)
  // - Extract authenticated UID from token
  // - Non-admin users can ONLY delete their own verified account (ignore requested workerId)
  // - Verified admins can delete any target account administratively
  // - Backend Authority: adminStorage, adminDb (recursiveDelete), adminAuth exclusively
  // - Absolutely NO Identity Toolkit REST fallback (eliminates CREDENTIAL_TOO_OLD_LOGIN_AGAIN)
  // - Result verification: Auth (user-not-found), Firestore (doc deleted), Storage (clean)
  // =========================================================================
  const handleAccountDeletion = async (req: Request, res: Response): Promise<void> => {
    try {
      const authHeader = req.headers["authorization"] || "";
      const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.substring(7).trim() : "";

      if (!bearerToken) {
        res.status(401).json({ 
          success: false, 
          error: "No autorizado. Token de sesión no proporcionado." 
        });
        return;
      }

      // 1. Verify ID token with Firebase Admin
      let decodedToken: any;
      try {
        decodedToken = await adminAuth.verifyIdToken(bearerToken);
      } catch (verifyErr: any) {
        console.error("[Account Deletion] Token verification failed:", verifyErr?.message);
        res.status(401).json({ 
          success: false, 
          error: "Sesión inválida o expirada. Inicia sesión de nuevo." 
        });
        return;
      }

      const callerUid = decodedToken.uid;
      const isCallerAdmin = decodedToken.admin === true;

      // Strict security rule:
      // - Non-admin users can ONLY delete their own verified UID. Any workerId sent in body/query is strictly ignored.
      // - Only verified admins can provide a target workerId to delete a worker's account administratively.
      const requestedWorkerId = (req.body?.workerId || req.query?.workerId || "").toString().trim();
      const targetUid = isCallerAdmin && requestedWorkerId ? requestedWorkerId : callerUid;

      // Ownership check: only owner or verified admin can delete
      if (targetUid !== callerUid && !isCallerAdmin) {
        res.status(403).json({ 
          success: false, 
          error: "No tienes permisos para eliminar esta cuenta." 
        });
        return;
      }

      console.log(`[Account Deletion] Starting atomic deletion for UID: ${targetUid} (requested by caller: ${callerUid}, isCallerAdmin: ${isCallerAdmin})`);

      // 2. Step A: Delete Storage objects via adminStorage
      const storagePrefixes = [
        `portafolios/${targetUid}/`,
        `verificaciones/${targetUid}/`,
        `profile-photos-pending/${targetUid}/`,
        `profile-photos-public/${targetUid}/`,
        `avatars/${targetUid}/`,
      ];

      const bucket = adminStorage.bucket();
      for (const prefix of storagePrefixes) {
        try {
          await bucket.deleteFiles({ prefix });
        } catch (stErr: any) {
          // If 404 (prefix doesn't exist or no objects), benign
          if (stErr?.code === 404) {
            continue;
          }
          // If 403 (GCP service account lacks bucket object list permission in this environment),
          // log warning and continue with Firestore and Auth deletion so user is not trapped
          if (stErr?.code === 403 || String(stErr?.message).includes("storage.objects.list")) {
            console.warn(`[Account Deletion] Storage prefix ${prefix} skipped due to storage.objects.list permission restriction:`, stErr?.message);
            continue;
          }
          console.error(`[Account Deletion] Storage error deleting prefix ${prefix} for ${targetUid}:`, stErr);
          res.status(500).json({
            success: false,
            step: "delete-storage",
            code: stErr?.code || "storage/delete-failed",
            error: `Error al eliminar archivos de almacenamiento en Storage bajo '${prefix}'.`,
            details: stErr?.message,
          });
          return;
        }
      }

      // 3. Step B: Delete Firestore documents and subcollections via adminDb
      try {
        // Primary profile and all subcollections recursively
        await adminDb.recursiveDelete(adminDb.doc(`maestros/${targetUid}`));

        // Clean preWorkers where claimedByUid == targetUid
        const preWorkersSnap = await adminDb
          .collection("preWorkers")
          .where("claimedByUid", "==", targetUid)
          .get();
        for (const preDoc of preWorkersSnap.docs) {
          await preDoc.ref.delete();
        }

        // Clean solicitudes_contacto where maestroId == targetUid
        const solicitudesSnap = await adminDb
          .collection("solicitudes_contacto")
          .where("maestroId", "==", targetUid)
          .get();
        for (const solDoc of solicitudesSnap.docs) {
          await solDoc.ref.delete();
        }
      } catch (fsErr: any) {
        console.error(`[Account Deletion] Firestore error for UID ${targetUid}:`, fsErr);
        res.status(500).json({
          success: false,
          step: "delete-firestore",
          code: fsErr?.code || "firestore/delete-failed",
          error: "Error al eliminar los datos de perfil y colecciones en Firestore.",
          details: fsErr?.message,
        });
        return;
      }

      // 4. Step C: Delete user from Firebase Authentication via adminAuth exclusively
      try {
        await adminAuth.deleteUser(targetUid);
        console.log(`[Account Deletion] Firebase Auth user ${targetUid} successfully deleted via Admin SDK.`);
      } catch (delErr: any) {
        if (delErr?.code === "auth/user-not-found") {
          console.log(`[Account Deletion] User ${targetUid} was already absent from Firebase Auth.`);
        } else {
          console.error(`[Account Deletion] adminAuth.deleteUser failed for ${targetUid}:`, delErr);
          res.status(500).json({
            success: false,
            step: "delete-auth-user",
            error: delErr?.message || "No se pudo eliminar el usuario de Firebase Authentication.",
            code: delErr?.code || "auth/delete-user-failed",
            details: delErr?.message,
          });
          return;
        }
      }

      // 5. Step D: Strict verification of real deletion state before claiming success
      // A. Verify Firebase Auth user is gone
      try {
        const remainingUser = await adminAuth.getUser(targetUid);
        if (remainingUser) {
          res.status(500).json({
            success: false,
            step: "verify-auth",
            error: `La cuenta ${targetUid} todavía existe en Firebase Authentication tras la eliminación.`,
          });
          return;
        }
      } catch (checkAuthErr: any) {
        if (checkAuthErr?.code !== "auth/user-not-found") {
          res.status(500).json({
            success: false,
            step: "verify-auth",
            code: checkAuthErr?.code || "auth/verification-failed",
            error: "No se pudo verificar el estado de eliminación en Firebase Authentication.",
            details: checkAuthErr?.message,
          });
          return;
        }
      }

      // B. Verify Firestore document is gone
      try {
        const checkDoc = await adminDb.doc(`maestros/${targetUid}`).get();
        if (checkDoc.exists) {
          res.status(500).json({
            success: false,
            step: "verify-firestore",
            error: `El documento /maestros/${targetUid} aún existe en Firestore tras la eliminación.`,
          });
          return;
        }
      } catch (checkFsErr: any) {
        res.status(500).json({
          success: false,
          step: "verify-firestore",
          code: checkFsErr?.code || "firestore/verification-failed",
          error: "No se pudo verificar la eliminación del documento en Firestore.",
          details: checkFsErr?.message,
        });
        return;
      }

      // C. Verify Storage prefixes have no remaining objects
      for (const prefix of storagePrefixes) {
        try {
          const [remainingFiles] = await bucket.getFiles({ prefix, maxResults: 1 });
          if (remainingFiles && remainingFiles.length > 0) {
            res.status(500).json({
              success: false,
              step: "verify-storage",
              error: `Aún existen archivos personales en Storage bajo el prefijo '${prefix}'.`,
            });
            return;
          }
        } catch (stVerifyErr: any) {
          if (stVerifyErr?.code === 403 || String(stVerifyErr?.message).includes("storage.objects.list")) {
            console.warn(`[Account Deletion] Storage verification for prefix ${prefix} skipped due to storage.objects.list permission restriction.`);
            continue;
          }
          if (stVerifyErr?.code !== 404) {
            res.status(500).json({
              success: false,
              step: "verify-storage",
              code: stVerifyErr?.code || "storage/verification-failed",
              error: `Error al verificar la eliminación de archivos en Storage bajo '${prefix}'.`,
              details: stVerifyErr?.message,
            });
            return;
          }
        }
      }

      // All steps passed and verified
      console.log(`[Account Deletion] UID ${targetUid} verified completely deleted across Auth, Firestore, and Storage.`);
      res.status(200).json({
        success: true,
        message: "Cuenta y datos personales eliminados exitosamente.",
        deletedUid: targetUid,
      });
    } catch (err: any) {
      console.error("[Account Deletion] Unexpected error:", err);
      res.status(500).json({
        success: false,
        error: "Ocurrió un error en el servidor al procesar la eliminación de la cuenta.",
        details: err?.message,
      });
    }
  };

  app.delete("/api/account", handleAccountDeletion);
  app.post("/api/account/delete", handleAccountDeletion);

  // =========================================================================
  // ONBOARDING CANCELLATION ENDPOINT (Disposable Incomplete Registrations)
  // POST /api/onboarding/cancel & DELETE /api/onboarding
  //
  // Securely cancels incomplete worker registrations:
  // - Verifies Firebase ID Token
  // - Extracts verified UID directly from token (NEVER accepts from body/query)
  // - CRITICAL PROTECTION: If /maestros/{uid} exists with complete profile, returns 409 Conflict
  // - Otherwise: Cleans provisional Storage objects, deletes incomplete Firestore docs,
  //   reverts preWorkers claims, and deletes Auth user via adminAuth.deleteUser()
  // - Strictly verifies deletion before returning 200 OK
  // =========================================================================
  const handleOnboardingCancellation = async (req: Request, res: Response): Promise<void> => {
    try {
      const authHeader = req.headers["authorization"] || "";
      const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.substring(7).trim() : "";

      if (!bearerToken) {
        res.status(401).json({ 
          success: false, 
          error: "No autorizado. Token de sesión no proporcionado." 
        });
        return;
      }

      // 1. Verify ID token with Firebase Admin SDK
      let decodedToken: any;
      try {
        decodedToken = await adminAuth.verifyIdToken(bearerToken);
      } catch (verifyErr: any) {
        console.error("[Onboarding Cancel] Token verification failed:", verifyErr?.message);
        res.status(401).json({ 
          success: false, 
          error: "Sesión inválida o expirada." 
        });
        return;
      }

      const uid = decodedToken.uid;
      console.log(`[Onboarding Cancel] Request received to cancel provisional onboarding for UID: ${uid}`);

      // 2. CRITICAL PROTECTION RULE: Consult Firestore /maestros/{uid}
      const maestroDoc = await adminDb.doc(`maestros/${uid}`).get();
      if (maestroDoc.exists) {
        const maestroData = maestroDoc.data() || {};
        // If it's an approved profile or complete valid profile: NEVER DELETE OR SUSPEND
        if (maestroData.statusPerfil === "Aprobado" || maestroData.aprobado === true || (maestroData.onboardingIncomplete !== true && maestroData.status !== "draft" && Boolean(maestroData.oficio))) {
          console.warn(`[Onboarding Cancel] Blocked: UID ${uid} already has an approved or completed valid maestro profile. Refusing cancellation.`);
          res.status(409).json({
            success: false,
            reason: "completed_profile",
            error: "No se puede cancelar onboarding: existe un perfil activo o aprobado de maestro.",
          });
          return;
        }
      }

      // 3. Step B1: Storage provisional cleanup
      const provisionalStoragePrefixes = [
        `profile-photos-pending/${uid}/`,
        `portafolios/${uid}/`,
        `verificaciones/${uid}/`,
      ];
      const bucket = adminStorage.bucket();
      for (const prefix of provisionalStoragePrefixes) {
        try {
          await bucket.deleteFiles({ prefix });
        } catch (stErr: any) {
          if (stErr?.code !== 404) {
            console.warn(`[Onboarding Cancel] Storage note on prefix '${prefix}':`, stErr?.message);
          }
        }
      }

      // 4. Step B2: Firestore cleanup
      try {
        if (maestroDoc.exists) {
          await adminDb.recursiveDelete(adminDb.doc(`maestros/${uid}`));
        }

        // Revert preWorker claim if any was claimed by this provisional user (do NOT delete original preWorker)
        const preSnap = await adminDb
          .collection("preWorkers")
          .where("claimedByUid", "==", uid)
          .get();
        for (const doc of preSnap.docs) {
          await doc.ref.update({
            claimedByUid: null,
            claimedAt: null,
            status: "pending",
          });
        }
      } catch (fsErr: any) {
        console.error(`[Onboarding Cancel] Firestore cleanup error for UID ${uid}:`, fsErr);
      }

      // 5. Step B3: Delete user from Firebase Authentication via adminAuth
      try {
        await adminAuth.deleteUser(uid);
        console.log(`[Onboarding Cancel] Provisional Auth User ${uid} deleted via Admin SDK.`);
      } catch (delErr: any) {
        if (delErr?.code === "auth/user-not-found") {
          console.log(`[Onboarding Cancel] User ${uid} was already absent from Firebase Auth.`);
        } else {
          console.error(`[Onboarding Cancel] adminAuth.deleteUser failed for ${uid}:`, delErr);
          res.status(500).json({
            success: false,
            step: "delete-auth-user",
            code: delErr?.code || "auth/delete-user-failed",
            error: "No se pudo eliminar el usuario provisional de Firebase Authentication.",
            details: delErr?.message,
          });
          return;
        }
      }

      // 6. Step B4: Verify real deletion in Auth
      try {
        const remainingUser = await adminAuth.getUser(uid);
        if (remainingUser) {
          console.error(`[Onboarding Cancel] User ${uid} still exists after deleteUser.`);
          res.status(500).json({
            success: false,
            step: "verify-auth",
            error: `El usuario provisional ${uid} aún existe en Firebase Authentication tras la eliminación.`,
          });
          return;
        }
      } catch (checkErr: any) {
        if (checkErr?.code !== "auth/user-not-found") {
          console.error(`[Onboarding Cancel] Verification error for ${uid}:`, checkErr);
          res.status(500).json({
            success: false,
            step: "verify-auth",
            code: checkErr?.code || "auth/verification-failed",
            error: "Error al verificar la eliminación del usuario provisional.",
            details: checkErr?.message,
          });
          return;
        }
      }

      console.log(`[Onboarding Cancel] Successfully canceled and deleted provisional onboarding for UID: ${uid}`);
      res.status(200).json({
        success: true,
        message: "Registro provisional cancelado y eliminado exitosamente.",
        canceledUid: uid,
      });
    } catch (err: any) {
      console.error("[Onboarding Cancel] Unexpected error:", err);
      res.status(500).json({
        success: false,
        error: "Ocurrió un error en el servidor al cancelar el registro provisional.",
        details: err?.message,
      });
    }
  };

  app.post("/api/onboarding/cancel", handleOnboardingCancellation);
  app.delete("/api/onboarding", handleOnboardingCancellation);

  // =========================================================================
  // WORKER PHONE STATUS ENDPOINT (Pre-Login & Pre-Registration Verification)
  // POST /api/auth/phone-status & GET /api/auth/phone-status
  //
  // Securely checks phone availability and ownership using Firebase Admin SDK
  // (adminAuth & adminDb) as the sole backend authority without exposing PII.
  // =========================================================================

  // In-memory sliding window rate limiter for phone status checks (anti-enumeration)
  const phoneStatusRateLimits = new Map<string, { count: number; resetAt: number }>();
  const PHONE_STATUS_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
  const PHONE_STATUS_MAX_REQUESTS = 25; // 25 checks per minute per client

  const checkPhoneStatusRateLimit = (key: string): boolean => {
    const now = Date.now();
    const record = phoneStatusRateLimits.get(key);
    if (!record || now > record.resetAt) {
      phoneStatusRateLimits.set(key, { count: 1, resetAt: now + PHONE_STATUS_LIMIT_WINDOW_MS });
      return true;
    }
    if (record.count >= PHONE_STATUS_MAX_REQUESTS) {
      return false;
    }
    record.count += 1;
    return true;
  };

  // Clean up expired rate limits periodically
  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of phoneStatusRateLimits.entries()) {
      if (now > val.resetAt) {
        phoneStatusRateLimits.delete(key);
      }
    }
  }, 5 * 60 * 1000);

  const handlePhoneStatusCheck = async (req: Request, res: Response): Promise<void> => {
    try {
      // 1. Rate limiting check (anti-enumeration)
      const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown-client";
      if (!checkPhoneStatusRateLimit(clientIp)) {
        res.status(429).json({
          success: false,
          error: "Demasiadas consultas de verificación. Por favor espera un momento antes de reintentar.",
        });
        return;
      }

      const rawPhone = (req.body?.phone || req.query?.phone || "").toString().trim();
      const intent = (req.body?.intent || req.query?.intent || "check").toString().trim().toLowerCase();

      const { e164, digitsOnly, isValid } = normalizeMexicanPhone(rawPhone);

      if (!isValid || !digitsOnly || digitsOnly.length !== 10) {
        res.status(400).json({
          success: false,
          error: "Número de celular no válido. Debe contener 10 dígitos.",
        });
        return;
      }

      // =======================================================================
      // INTENT: LOGIN
      // Only linked if phone exists in Firebase Auth AND has completed maestro profile for THAT UID
      // =======================================================================
      if (intent === "login") {
        let authUid: string | null = null;
        try {
          const userRecord = await adminAuth.getUserByPhoneNumber(e164);
          if (userRecord && userRecord.uid) {
            authUid = userRecord.uid;
          }
        } catch (authErr: any) {
          if (authErr?.code !== "auth/user-not-found") {
            console.warn("[Phone Status Login] adminAuth.getUserByPhoneNumber note:", authErr?.message);
          }
        }

        if (!authUid) {
          res.status(200).json({
            success: true,
            state: "not_linked",
            hasProfile: false,
            available: true,
            usedByOther: false,
            belongsToCurrentUid: false,
            isPhoneRegistered: false,
          });
          return;
        }

        // Check /maestros/{authUid} using adminDb (Admin SDK authority)
        // NOTE: aprobado == true is NOT required. Pending profiles can login to their dashboard!
        let hasCompletedProfile = false;
        try {
          const maestroDoc = await adminDb.doc(`maestros/${authUid}`).get();
          if (maestroDoc.exists) {
            const data = maestroDoc.data();
            const isOnboardingIncomplete = data?.onboardingIncomplete === true;
            const isDraft = data?.status === "draft";
            const hasTrade = Boolean(data?.oficio || data?.mainTrade);
            if (!isOnboardingIncomplete && !isDraft && hasTrade) {
              hasCompletedProfile = true;
            }
          }
        } catch (fsErr) {
          console.error("[Phone Status Login] Firestore lookup error:", fsErr);
          res.status(500).json({
            success: false,
            error: "Error interno al verificar perfil de trabajador.",
          });
          return;
        }

        if (hasCompletedProfile) {
          res.status(200).json({
            success: true,
            state: "linked",
            hasProfile: true,
            available: false,
            usedByOther: false,
            belongsToCurrentUid: true,
            isPhoneRegistered: true,
          });
        } else {
          res.status(200).json({
            success: true,
            state: "not_linked",
            hasProfile: false,
            available: true,
            usedByOther: false,
            belongsToCurrentUid: false,
            isPhoneRegistered: false,
          });
        }
        return;
      }

      // =======================================================================
      // INTENT: REGISTER
      // Checks if phone is already registered to block duplicate registrations
      // =======================================================================
      if (intent === "register") {
        let authUid: string | null = null;
        try {
          const userRecord = await adminAuth.getUserByPhoneNumber(e164);
          if (userRecord && userRecord.uid) {
            authUid = userRecord.uid;
          }
        } catch (authErr: any) {
          if (authErr?.code !== "auth/user-not-found") {
            console.warn("[Phone Status Register] adminAuth error:", authErr?.message);
          }
        }

        let existingProfileFound = false;
        try {
          // 1. Direct check if authUid has a completed profile in /maestros
          if (authUid) {
            const docSnap = await adminDb.doc(`maestros/${authUid}`).get();
            if (docSnap.exists) {
              const d = docSnap.data();
              if (d?.onboardingIncomplete !== true && d?.status !== "draft" && Boolean(d?.oficio || d?.mainTrade)) {
                existingProfileFound = true;
              }
            }
          }

          // 2. Query /maestros by phone fields via adminDb
          if (!existingProfileFound) {
            const [qE164, qWhatsApp, qPhone] = await Promise.all([
              adminDb.collection("maestros").where("phoneE164", "==", e164).get(),
              adminDb.collection("maestros").where("telefonoWhatsApp", "==", e164).get(),
              adminDb.collection("maestros").where("phone", "==", digitsOnly).get(),
            ]);

            const allDocs = [...qE164.docs, ...qWhatsApp.docs, ...qPhone.docs];
            for (const d of allDocs) {
              const data = d.data();
              if (data?.onboardingIncomplete !== true && data?.status !== "draft" && Boolean(data?.oficio || data?.mainTrade)) {
                existingProfileFound = true;
                break;
              }
            }
          }
        } catch (fsErr) {
          console.warn("[Phone Status Register] Firestore lookup warning, proceeding with auth check result:", fsErr);
        }

        if (existingProfileFound) {
          // Phone belongs to an existing Maestro Cerca profile -> Block registration
          res.status(200).json({
            success: true,
            state: "linked",
            available: false,
            usedByOther: true,
            belongsToCurrentUid: false,
            hasProfile: true,
            isPhoneRegistered: true,
          });
          return;
        }

        if (authUid) {
          // Phone exists in Firebase Auth but has NO completed profile (abandoned registration)
          // Allow authenticating with SMS for this same UID to continue registration
          res.status(200).json({
            success: true,
            state: "auth_only",
            available: true,
            usedByOther: false,
            belongsToCurrentUid: false,
            hasProfile: false,
            isPhoneRegistered: false,
          });
          return;
        }

        // Available for new registration
        res.status(200).json({
          success: true,
          state: "not_linked",
          available: true,
          usedByOther: false,
          belongsToCurrentUid: false,
          hasProfile: false,
          isPhoneRegistered: false,
        });
        return;
      }

      // =======================================================================
      // INTENT: LINK
      // Exclusively requires Authorization Bearer token to identify current user
      // =======================================================================
      if (intent === "link") {
        const authHeader = req.headers.authorization || "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

        if (!token) {
          res.status(401).json({
            success: false,
            error: "Token de autorización requerido para verificar vinculación de teléfono.",
          });
          return;
        }

        let currentUid: string;
        try {
          const decodedToken = await adminAuth.verifyIdToken(token);
          currentUid = decodedToken.uid;
        } catch (tokenErr: any) {
          res.status(401).json({
            success: false,
            error: "Token de autorización no válido o expirado.",
          });
          return;
        }

        // 1. Check if phone is claimed in Firebase Auth by ANOTHER UID
        let isUsedByOtherAuth = false;
        let isBelongsToCurrentAuth = false;
        try {
          const userRecord = await adminAuth.getUserByPhoneNumber(e164);
          if (userRecord && userRecord.uid) {
            if (userRecord.uid === currentUid) {
              isBelongsToCurrentAuth = true;
            } else {
              isUsedByOtherAuth = true;
            }
          }
        } catch (authErr: any) {
          if (authErr?.code !== "auth/user-not-found") {
            console.warn("[Phone Status Link] adminAuth.getUserByPhoneNumber note:", authErr?.message);
          }
        }

        if (isUsedByOtherAuth) {
          res.status(200).json({
            success: true,
            state: "linked",
            available: false,
            usedByOther: true,
            belongsToCurrentUid: false,
            hasProfile: false,
            isPhoneRegistered: true,
          });
          return;
        }

        // 2. Check if phone is claimed in /maestros by ANOTHER UID
        let isUsedByOtherMaestro = false;
        let isBelongsToCurrentMaestro = false;
        try {
          const [qE164, qWhatsApp, qPhone] = await Promise.all([
            adminDb.collection("maestros").where("phoneE164", "==", e164).get(),
            adminDb.collection("maestros").where("telefonoWhatsApp", "==", e164).get(),
            adminDb.collection("maestros").where("phone", "==", digitsOnly).get(),
          ]);

          const allDocs = [...qE164.docs, ...qWhatsApp.docs, ...qPhone.docs];
          for (const d of allDocs) {
            const data = d.data();
            const docOwnerUid = data?.userId || d.id;
            if (docOwnerUid === currentUid) {
              isBelongsToCurrentMaestro = true;
            } else {
              // Found a profile belonging to another UID
              isUsedByOtherMaestro = true;
              break;
            }
          }
        } catch (fsErr) {
          console.warn("[Phone Status Link] Firestore lookup warning, proceeding with auth check result:", fsErr);
          // If Firestore query fails or is unavailable in current context, we rely on the successful
          // auth check and do not crash the user linking flow
        }

        if (isUsedByOtherMaestro) {
          res.status(200).json({
            success: true,
            state: "linked",
            available: false,
            usedByOther: true,
            belongsToCurrentUid: false,
            hasProfile: true,
            isPhoneRegistered: true,
          });
          return;
        }

        if (isBelongsToCurrentAuth || isBelongsToCurrentMaestro) {
          res.status(200).json({
            success: true,
            state: "linked",
            available: true,
            usedByOther: false,
            belongsToCurrentUid: true,
            hasProfile: isBelongsToCurrentMaestro,
            isPhoneRegistered: true,
          });
          return;
        }

        // Phone is completely available for linking
        res.status(200).json({
          success: true,
          state: "not_linked",
          available: true,
          usedByOther: false,
          belongsToCurrentUid: false,
          hasProfile: false,
          isPhoneRegistered: false,
        });
        return;
      }

      // Default fallback if no specific intent specified
      res.status(200).json({
        success: true,
        state: "not_linked",
        available: true,
        usedByOther: false,
        belongsToCurrentUid: false,
        hasProfile: false,
        isPhoneRegistered: false,
      });
    } catch (err: any) {
      console.error("[Phone Status] Unexpected error:", err);
      res.status(500).json({
        success: false,
        error: "Error interno al verificar el estado del número.",
      });
    }
  };

  app.post("/api/auth/phone-status", handlePhoneStatusCheck);
  app.get("/api/auth/phone-status", handlePhoneStatusCheck);

  // =========================================================================
  // GENERATE UNIQUE SLUG ENDPOINT (Admin SDK Authority)
  // POST /api/auth/generate-slug
  // =========================================================================
  app.post("/api/auth/generate-slug", async (req: Request, res: Response) => {
    try {
      const { name } = req.body || {};
      const fullName = typeof name === "string" ? name.trim() : "";

      const base =
        fullName
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "") || "maestro";

      let candidate = base;
      let counter = 1;

      while (true) {
        const snap = await adminDb
          .collection("maestros")
          .where("slug", "==", candidate)
          .limit(1)
          .get();

        if (snap.empty) {
          return res.status(200).json({ success: true, slug: candidate });
        }

        counter++;
        candidate = `${base}-${counter}`;
      }
    } catch (err: any) {
      console.warn("[Generate Slug Warning]: Firestore query failed, providing fallback slug:", err?.message);
      // Fallback with timestamp to guarantee uniqueness if Firestore check fails
      const fallbackSuffix = Math.random().toString(36).substring(2, 6);
      return res.status(200).json({
        success: true,
        slug: `maestro-${fallbackSuffix}`,
        warning: "Generado con sufijo único debido a indisponibilidad temporal de consulta.",
      });
    }
  });

  // =========================================================================
  // PHONE VERIFICATION CONFIRMATION ENDPOINT (Cryptographic SMS Authority)
  // POST /api/auth/phone-verified
  // =========================================================================
  app.post("/api/auth/phone-verified", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization || "";
      if (!authHeader.startsWith("Bearer ")) {
        res.status(401).json({ success: false, error: "No autorizado. Token requerido." });
        return;
      }

      const token = authHeader.substring(7).trim();
      let decodedToken: any;
      try {
        decodedToken = await adminAuth.verifyIdToken(token);
      } catch (tokenErr: any) {
        res.status(401).json({ success: false, error: "Token inválido o expirado." });
        return;
      }

      const uid = decodedToken.uid;
      const phoneNumber = decodedToken.phone_number;

      if (!phoneNumber || typeof phoneNumber !== "string" || phoneNumber.trim() === "") {
        res.status(400).json({
          success: false,
          error: "El usuario no cuenta con un número de teléfono verificado en Firebase Authentication.",
        });
        return;
      }

      const now = new Date().toISOString();
      const maestroRef = adminDb.collection("maestros").doc(uid);
      const maestroSnap = await maestroRef.get();

      if (!maestroSnap.exists) {
        res.status(404).json({
          success: false,
          error: "Documento de maestro no encontrado para este usuario.",
        });
        return;
      }

      await maestroRef.update({
        phoneVerified: true,
        phoneVerifiedAt: now,
        phoneVerificationMethod: "firebase_sms",
        updatedAt: now,
      });

      res.status(200).json({
        success: true,
        message: "Teléfono verificado criptográficamente y registrado con éxito.",
        phoneNumber,
        verifiedAt: now,
      });
    } catch (err: any) {
      console.error("[Phone Verified Endpoint Error]:", err);
      res.status(500).json({
        success: false,
        error: err?.message || "Error al registrar la verificación telefónica.",
      });
    }
  });

  // =========================================================================
  // ADMIN IMPORT LEADS ENDPOINT (ManyChat Leads Importer)
  // POST /api/admin/import-leads
  // =========================================================================
  app.post("/api/admin/import-leads", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization || "";
      if (!authHeader.startsWith("Bearer ")) {
        res.status(401).json({ success: false, error: "No autorizado." });
        return;
      }

      const token = authHeader.substring(7).trim();
      let decodedToken: any;
      try {
        decodedToken = await adminAuth.verifyIdToken(token);
      } catch {
        res.status(401).json({ success: false, error: "Token inválido o expirado." });
        return;
      }

      const isUserAdmin = decodedToken.admin === true;

      if (!isUserAdmin) {
        res.status(403).json({ success: false, error: "Acceso denegado. Permisos de administrador requeridos." });
        return;
      }

      const { leads } = req.body || {};
      if (!Array.isArray(leads)) {
        res.status(400).json({ success: false, error: "Formato de leads inválido. Se espera un arreglo." });
        return;
      }

      let imported = 0;
      let skipped = 0;
      let errors = 0;

      // Fetch existing maestros and preWorkers phones and IDs for deduplication
      const existingPhones = new Set<string>();
      const existingDocIds = new Set<string>();

      try {
        const existingMaestrosSnap = await adminDb.collection("maestros").get();
        for (const d of existingMaestrosSnap.docs) {
          existingDocIds.add(d.id);
          const data = d.data();
          const p = data.telefono || data.phone || data.telefonoWhatsApp || data.phoneNumber;
          if (p) {
            existingPhones.add(String(p).replace(/\D/g, "").slice(-10));
          }
        }
      } catch (mErr) {
        console.warn("[Import Leads] Could not pre-fetch maestros, continuing:", mErr);
      }

      const now = new Date().toISOString();
      for (const lead of leads) {
        try {
          const rawPhone = lead.telefono || lead.phone || lead.whatsapp || lead.telefonoWhatsApp || "";
          let cleanDigits = String(rawPhone).trim();

          // Handle scientific notation (e.g. 2.638482e+09)
          if (/^[+-]?\d+(?:\.\d+)?[eE][+-]?\d+$/.test(cleanDigits)) {
            const num = Number(cleanDigits);
            if (!isNaN(num) && isFinite(num)) {
              cleanDigits = BigInt(Math.round(num)).toString();
            }
          }
          cleanDigits = cleanDigits.replace(/\D/g, "");

          if (!cleanDigits || cleanDigits.length < 10) {
            errors++;
            continue;
          }

          const last10 = cleanDigits.slice(-10);
          const e164 = `+52${last10}`;

          // Deterministic ID generation: mc_${manychatId} or mc_${last10}
          const cleanManyChatId = (lead.manychatUserId || lead.manychatId || "").toString().trim();
          const docId = lead.id || (cleanManyChatId ? `mc_${cleanManyChatId.replace(/[^a-zA-Z0-9_-]/g, "")}` : `mc_${last10}`);

          if (existingPhones.has(last10) || existingDocIds.has(docId)) {
            skipped++;
            continue;
          }

          const cleanName = (lead.nombre || lead.firstName || "").trim() || "Maestro";
          const cleanApellidos = (lead.apellidos || lead.lastName || "").trim();
          const cleanOficioPrincipal = (lead.oficioPrincipal || lead.oficio || lead.mainTrade || "Mantenimiento general").trim();
          const cleanServiciosAdicionales = (lead.serviciosAdicionales || (Array.isArray(lead.servicios) ? lead.servicios.join(", ") : "") || "").trim();
          const cleanCiudad = (lead.ciudad || "Querétaro").trim();
          const cleanZonas = (lead.zonas || (Array.isArray(lead.serviceAreas) ? lead.serviceAreas.join(", ") : "") || cleanCiudad).trim();
          const cleanExperiencia = (lead.experiencia || (lead.yearsExperience ? String(lead.yearsExperience) : "") || "").trim();
          const cleanDisponibilidad = (lead.disponibilidad || "").trim();
          const parsedYears = Number(cleanExperiencia);

          // Canonical Maestro object according to the strict specification
          const maestroDoc: Record<string, any> = {
            // Strict output contract
            nombre: cleanName,
            oficioPrincipal: cleanOficioPrincipal,
            serviciosAdicionales: cleanServiciosAdicionales,
            ciudad: cleanCiudad,
            zonas: cleanZonas,
            experiencia: cleanExperiencia,
            telefono: last10,
            whatsapp: last10, // Default to the same sanitized phone
            disponibilidad: cleanDisponibilidad,
            status: "draft", // Imported profile in draft mode pending validation
            onboardingIncomplete: true,
            registrationMethod: "manychat_csv",
            createdAt: lead.createdAt || now,

            // Platform schema & compatibility fields
            id: docId,
            userId: docId,
            slug: lead.slug || `mc-${last10}`,
            oficio: cleanOficioPrincipal,
            mainTrade: cleanOficioPrincipal,
            phone: last10,
            phoneE164: e164,
            telefonoWhatsApp: last10,
            bio: cleanServiciosAdicionales
              ? `${cleanOficioPrincipal} en ${cleanCiudad}. ${cleanServiciosAdicionales}`
              : `Especialista en ${cleanOficioPrincipal} registrado vía ManyChat.`,
            serviceAreas: cleanZonas ? cleanZonas.split(/[,;\n/]+/).map((s: string) => s.trim()).filter(Boolean) : [cleanCiudad],
            servicios: cleanServiciosAdicionales ? cleanServiciosAdicionales.split(/[,;\n/]+/).map((s: string) => s.trim()).filter(Boolean) : [],
            yearsExperience: (!isNaN(parsedYears) && parsedYears > 0) ? parsedYears : null,
            aprobado: false,
            verificado: false,
            nivel: "Aspirante",
            fotoUrl: "",
            fechaRegistro: now,
            updatedAt: now,
            source: "manychat",
          };

          if (cleanApellidos) {
            maestroDoc.apellidos = cleanApellidos;
          }
          if (cleanManyChatId) {
            maestroDoc.manychatUserId = cleanManyChatId;
          }
          if (lead.finishedAt) {
            maestroDoc.finishedAt = lead.finishedAt;
          }

          // Direct persistence into /maestros collection
          await adminDb.collection("maestros").doc(docId).set(maestroDoc, { merge: true });

          // Also save in preWorkers for instant claiming if worker uses phone auth
          try {
            const preWorkerKey = `pre_${last10}`;
            await adminDb.collection("preWorkers").doc(preWorkerKey).set({
              id: preWorkerKey,
              phoneNumber: e164,
              phone: last10,
              whatsappPhone: e164,
              telefono: last10,
              nombre: cleanName,
              oficio: cleanOficioPrincipal,
              mainTrade: cleanOficioPrincipal,
              bio: maestroDoc.bio,
              serviceAreas: maestroDoc.serviceAreas,
              servicios: maestroDoc.servicios,
              yearsExperience: maestroDoc.yearsExperience,
              source: "manychat_csv_import",
              status: "pending_claim",
              profileType: "registered",
              verificado: false,
              createdAt: now,
              updatedAt: now,
              claimedByUid: null,
              claimedAt: null,
            }, { merge: true });
          } catch (preErr) {
            // Ignore preWorkers secondary failure
          }

          existingPhones.add(last10);
          existingDocIds.add(docId);
          imported++;
        } catch (leadErr) {
          console.error("[Import Leads Lead Error]:", leadErr);
          errors++;
        }
      }

      res.status(200).json({ success: true, imported, skipped, errors });
    } catch (err: any) {
      console.error("[Admin Import Leads Error]:", err);
      res.status(500).json({ success: false, error: err?.message || "Error al importar leads." });
    }
  });

  // =========================================================================
  // PROFILE REPORTS (Visitor reporting a worker profile)
  // POST /api/profile-reports
  // =========================================================================
  const reportRateLimitMap = new Map<string, { count: number; resetAt: number }>();
  function isReportRateLimited(clientKey: string): boolean {
    const now = Date.now();
    const entry = reportRateLimitMap.get(clientKey);
    if (!entry || now > entry.resetAt) {
      reportRateLimitMap.set(clientKey, { count: 1, resetAt: now + 60_000 });
      return false;
    }
    if (entry.count >= 5) {
      return true;
    }
    entry.count += 1;
    return false;
  }

  function sanitizeReportText(str: string): string {
    if (!str || typeof str !== "string") return "";
    return str.replace(/<[^>]*>/g, "").trim().substring(0, 1000);
  }

  app.post("/api/profile-reports", async (req: Request, res: Response) => {
    try {
      const clientKey = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "client");
      if (isReportRateLimited(clientKey)) {
        return res.status(429).json({ error: "Has enviado varios reportes recientemente. Por favor espera un momento." });
      }

      const { workerId, reason } = req.body || {};
      if (!workerId || typeof workerId !== "string") {
        return res.status(400).json({ error: "Identificador de perfil requerido." });
      }

      const cleanReason = sanitizeReportText(reason);
      if (cleanReason.length < 10) {
        return res.status(400).json({ error: "Por favor describe el motivo de tu reporte (mínimo 10 caracteres)." });
      }

      // Verify worker exists in Firestore
      let targetWorkerDoc = await adminDb.collection("maestros").doc(workerId).get();
      if (!targetWorkerDoc.exists) {
        const slugQuery = await adminDb.collection("maestros").where("slug", "==", workerId).limit(1).get();
        if (!slugQuery.empty) {
          targetWorkerDoc = slugQuery.docs[0];
        }
      }

      if (!targetWorkerDoc.exists) {
        return res.status(404).json({ error: "El perfil de trabajador no existe." });
      }

      const workerData = targetWorkerDoc.data() || {};
      const targetWorkerId = targetWorkerDoc.id;
      const workerSlug = workerData.slug || targetWorkerId;
      const workerNameSnapshot = workerData.nombre || `${workerData.firstName || ""} ${workerData.lastName || ""}`.trim() || "Trabajador";
      const workerTradeSnapshot = workerData.oficio || workerData.mainTrade || "";

      const reportRef = adminDb.collection("reportes_perfil").doc();
      await reportRef.set({
        id: reportRef.id,
        workerId: targetWorkerId,
        workerSlug,
        workerNameSnapshot,
        workerTradeSnapshot,
        reason: cleanReason,
        status: "pending",
        createdAt: new Date().toISOString(),
      });

      return res.status(200).json({
        success: true,
        message: "Gracias. Recibimos tu reporte y lo revisaremos.",
      });
    } catch (err: any) {
      console.error("[Profile Report Error]:", err);
      return res.status(500).json({ error: "Error al registrar el reporte. Intenta de nuevo más tarde." });
    }
  });

  // =========================================================================
  // ADMIN PROFILE PHOTO REVIEW ENDPOINT
  // POST /api/admin/profile-photo/review
  // =========================================================================
  app.post("/api/admin/profile-photo/review", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "No autorizado. Token de sesión requerido." });
      }

      const token = authHeader.split(" ")[1];
      const decodedToken = await adminAuth.verifyIdToken(token);
      const isUserAdmin = decodedToken.admin === true;

      if (!isUserAdmin) {
        return res.status(403).json({ error: "Acceso denegado. Se requieren permisos de administrador." });
      }

      const { workerId, action, notes } = req.body || {};
      if (!workerId || typeof workerId !== "string") {
        return res.status(400).json({ error: "ID de trabajador requerido." });
      }
      if (action !== "approve" && action !== "reject") {
        return res.status(400).json({ error: "Acción inválida. Debe ser 'approve' o 'reject'." });
      }

      const workerRef = adminDb.collection("maestros").doc(workerId);
      const workerSnap = await workerRef.get();
      if (!workerSnap.exists) {
        return res.status(404).json({ error: "Trabajador no encontrado." });
      }

      const workerData = workerSnap.data() || {};
      const nowIso = new Date().toISOString();

      if (action === "approve") {
        const bucket = adminStorage.bucket();
        const expectedPrefix = `profile-photos-pending/${workerId}/`;
        let pendingPath = workerData.pendingProfilePhotoPath;

        // Security check: If a path is specified, it MUST belong strictly to this worker
        if (pendingPath && !pendingPath.startsWith(expectedPrefix)) {
          return res.status(400).json({
            error: "Ruta de fotografía pendiente inválida.",
          });
        }

        let sourceFile = pendingPath ? bucket.file(pendingPath) : null;
        let fileExists = false;

        if (sourceFile) {
          const [e] = await sourceFile.exists();
          fileExists = e;
        }

        // If file not found at the recorded path, search ONLY within the worker's own pending prefix
        if (!fileExists) {
          const [files] = await bucket.getFiles({ prefix: expectedPrefix });
          if (files.length > 0) {
            sourceFile = files[0];
            pendingPath = files[0].name;
            fileExists = true;
          }
        }

        if (!pendingPath || !pendingPath.startsWith(expectedPrefix) || !fileExists || !sourceFile) {
          return res.status(400).json({ error: "Ruta de fotografía pendiente inválida o no encontrada para este trabajador." });
        }

        const fileName = path.basename(pendingPath);
        const publicPath = `profile-photos-public/${workerId}/${fileName}`;
        const destFile = bucket.file(publicPath);

        // Copy image from pending to public
        await sourceFile.copy(destFile);

        // Construct public URL
        const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${firebaseConfig.storageBucket}/o/${encodeURIComponent(publicPath)}?alt=media`;

        // Delete source pending file
        try {
          await sourceFile.delete();
        } catch (delErr) {
          console.warn("[Admin Photo Review] Could not delete pending source file:", delErr);
        }

        // Update Firestore profile (NOTE: Never alters verificationStatus or verificado!)
        await workerRef.update({
          profilePhoto: publicUrl,
          fotoUrl: publicUrl,
          photoUrl: publicUrl,
          profilePhotoReviewStatus: "approved",
          pendingProfilePhotoPath: null,
          profilePhotoReviewedAt: nowIso,
          updatedAt: nowIso,
        });

        // Update private media subdocument
        await adminDb.collection("maestros").doc(workerId).collection("privado").doc("media").set(
          {
            profilePhotoReviewStatus: "approved",
            pendingProfilePhotoPath: null,
            approvedPublicUrl: publicUrl,
            reviewedAt: nowIso,
          },
          { merge: true }
        );

        return res.status(200).json({
          success: true,
          status: "approved",
          publicUrl,
        });
      } else {
        // action === 'reject'
        await workerRef.update({
          profilePhoto: "",
          fotoUrl: "",
          photoUrl: "",
          profilePhotoReviewStatus: "rejected",
          pendingProfilePhotoPath: null,
          profilePhotoReviewedAt: nowIso,
          updatedAt: nowIso,
        });

        await adminDb.collection("maestros").doc(workerId).collection("privado").doc("media").set(
          {
            profilePhotoReviewStatus: "rejected",
            pendingProfilePhotoPath: null,
            reviewedAt: nowIso,
            rejectNotes: sanitizeReportText(notes || ""),
          },
          { merge: true }
        );

        // Delete pending files if found
        try {
          const bucket = adminStorage.bucket();
          const [files] = await bucket.getFiles({ prefix: `profile-photos-pending/${workerId}/` });
          for (const f of files) {
            await f.delete().catch(() => {});
          }
        } catch (delErr) {
          console.warn("[Admin Photo Review] Cleanup on reject:", delErr);
        }

        return res.status(200).json({
          success: true,
          status: "rejected",
        });
      }
    } catch (err: any) {
      console.error("[Admin Photo Review Error]:", err);
      return res.status(500).json({ error: err?.message || "Error al procesar la revisión de la fotografía." });
    }
  });

  // =========================================================================
  // WORKER SELF-PUBLISH PROFILE PHOTO ENDPOINT (MVP: no admin approval required)
  // POST /api/photos/self-publish
  //
  // Mirrors the "approve" branch of /api/admin/profile-photo/review, but callable
  // by the photo's OWNER instead of an admin: the uid comes from the verified
  // Firebase ID token, never from the request body, and the pending storage path
  // must live under that same uid's own pending prefix. Gated client-side by the
  // AUTO_APPROVE_PROFILE_PHOTOS flag (src/config/featureFlags.ts) so the manual
  // admin-review flow can be restored later without touching this endpoint.
  // =========================================================================
  app.post("/api/photos/self-publish", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "No autorizado. Token de sesión requerido." });
      }

      const token = authHeader.split(" ")[1];
      let decodedToken: any;
      try {
        decodedToken = await adminAuth.verifyIdToken(token);
      } catch {
        return res.status(401).json({ error: "Token de sesión inválido o expirado." });
      }

      const workerId = decodedToken.uid;
      const { pendingStoragePath } = req.body || {};
      const expectedPrefix = `profile-photos-pending/${workerId}/`;

      if (!pendingStoragePath || typeof pendingStoragePath !== "string" || !pendingStoragePath.startsWith(expectedPrefix)) {
        return res.status(400).json({ error: "Ruta de fotografía pendiente inválida para este usuario." });
      }

      const workerRef = adminDb.collection("maestros").doc(workerId);
      const workerSnap = await workerRef.get();
      if (!workerSnap.exists) {
        return res.status(404).json({ error: "Perfil de trabajador no encontrado." });
      }

      const bucket = adminStorage.bucket();
      const sourceFile = bucket.file(pendingStoragePath);
      const [fileExists] = await sourceFile.exists();
      if (!fileExists) {
        return res.status(400).json({ error: "La fotografía pendiente no se encontró en Storage." });
      }

      // Automated moderation gate (Gemini vision): screens the photo before it can ever
      // go public. See moderateImageContent for the fail-open policy on API errors.
      try {
        const [metadata] = await sourceFile.getMetadata();
        const [imageBuffer] = await sourceFile.download();
        const moderation = await moderateImageContent(imageBuffer, metadata.contentType || "image/jpeg");
        if (!moderation.safe) {
          await sourceFile.delete().catch(() => {});
          await adminDb.collection("maestros").doc(workerId).collection("privado").doc("media").set(
            {
              pendingProfilePhotoPath: null,
              profilePhotoReviewStatus: "rejected",
              rejectNotes: `Rechazo automático (Gemini): ${moderation.reason || "Contenido inapropiado."}`,
              reviewedAt: new Date().toISOString(),
              reviewedBy: "gemini_auto_moderation",
            },
            { merge: true }
          );
          await workerRef.update({
            pendingProfilePhotoPath: null,
            profilePhotoReviewStatus: "rejected",
            updatedAt: new Date().toISOString(),
          });
          return res.status(422).json({
            error: "Tu fotografía no cumple con nuestras políticas de contenido. Por favor sube otra foto.",
            reason: moderation.reason,
          });
        }
      } catch (modErr: any) {
        console.warn("[Photo Self-Publish] Moderation step skipped due to error (fail-open):", modErr?.message);
      }

      const fileName = path.basename(pendingStoragePath);
      const publicPath = `profile-photos-public/${workerId}/${fileName}`;
      const destFile = bucket.file(publicPath);

      await sourceFile.copy(destFile);
      const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${firebaseConfig.storageBucket}/o/${encodeURIComponent(publicPath)}?alt=media`;

      try {
        await sourceFile.delete();
      } catch (delErr) {
        console.warn("[Photo Self-Publish] Could not delete pending source file:", delErr);
      }

      const nowIso = new Date().toISOString();
      await workerRef.update({
        profilePhoto: publicUrl,
        fotoUrl: publicUrl,
        photoUrl: publicUrl,
        profilePhotoReviewStatus: "approved",
        pendingProfilePhotoPath: null,
        profilePhotoReviewedAt: nowIso,
        updatedAt: nowIso,
      });

      await adminDb.collection("maestros").doc(workerId).collection("privado").doc("media").set(
        {
          profilePhotoReviewStatus: "approved",
          pendingProfilePhotoPath: null,
          approvedPublicUrl: publicUrl,
          reviewedAt: nowIso,
          reviewedBy: "self_publish_mvp",
        },
        { merge: true }
      );

      return res.status(200).json({ success: true, publicUrl });
    } catch (err: any) {
      console.error("[Photo Self-Publish Error]:", err);
      return res.status(500).json({ error: err?.message || "Error al publicar la fotografía de perfil." });
    }
  });

  // =========================================================================
  // ADMIN GET PROFILE REPORTS
  // GET /api/admin/profile-reports
  // =========================================================================
  app.get("/api/admin/profile-reports", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "No autorizado." });
      }

      const token = authHeader.split(" ")[1];
      const decodedToken = await adminAuth.verifyIdToken(token);
      const isUserAdmin = decodedToken.admin === true;

      if (!isUserAdmin) {
        return res.status(403).json({ error: "Acceso denegado." });
      }

      const snap = await adminDb.collection("reportes_perfil").orderBy("createdAt", "desc").limit(100).get();
      const reports = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      return res.status(200).json({ success: true, reports });
    } catch (err: any) {
      console.error("[Admin Reports Error]:", err);
      return res.status(500).json({ error: err?.message || "Error al obtener los reportes." });
    }
  });

  // =========================================================================
  // ADMIN UPDATE REPORT STATUS
  // POST /api/admin/profile-reports/status
  // =========================================================================
  app.post("/api/admin/profile-reports/status", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "No autorizado." });
      }

      const token = authHeader.split(" ")[1];
      const decodedToken = await adminAuth.verifyIdToken(token);
      const isUserAdmin = decodedToken.admin === true;

      if (!isUserAdmin) {
        return res.status(403).json({ error: "Acceso denegado." });
      }

      const { reportId, status, adminNotes } = req.body || {};
      if (!reportId || !status) {
        return res.status(400).json({ error: "reportId y status son requeridos." });
      }

      await adminDb.collection("reportes_perfil").doc(reportId).update({
        status,
        adminNotes: adminNotes ? sanitizeReportText(adminNotes) : "",
        resolvedAt: new Date().toISOString(),
      });

      return res.status(200).json({ success: true });
    } catch (err: any) {
      console.error("[Admin Report Status Error]:", err);
      return res.status(500).json({ error: err?.message || "Error al actualizar estado del reporte." });
    }
  });

  // =========================================================================
  // ADMIN GET REAL AUTH METHODS FROM FIREBASE AUTH
  // POST /api/admin/auth-methods
  // =========================================================================
  app.post("/api/admin/auth-methods", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "No autorizado. Token de sesión no proporcionado." });
      }

      const token = authHeader.split(" ")[1];
      let decodedToken: any;
      try {
        decodedToken = await adminAuth.verifyIdToken(token);
      } catch (err: any) {
        return res.status(401).json({ error: "Token de sesión inválido o expirado." });
      }

      const isUserAdmin = decodedToken.admin === true;

      if (!isUserAdmin) {
        return res.status(403).json({ error: "Acceso denegado. Se requieren privilegios de administrador." });
      }

      const { uids } = req.body || {};
      if (!Array.isArray(uids)) {
        return res.status(400).json({ error: "El campo uids debe ser un arreglo de strings." });
      }

      // Limit visible UIDs to max 100 for safety and performance
      const validUids = uids
        .filter((id) => typeof id === "string" && id.trim().length > 0)
        .slice(0, 100);

      if (validUids.length === 0) {
        return res.status(200).json({ success: true, authMethods: [] });
      }

      // Query Firebase Auth directly for genuine linked provider accounts
      let usersList: any[] = [];
      try {
        const getUsersResult = await adminAuth.getUsers(validUids.map((uid) => ({ uid })));
        usersList = getUsersResult.users || [];
      } catch (getUsersErr) {
        console.warn("[Admin Auth Methods] getUsers bulk query failed, trying individual getUser calls:", getUsersErr);
        const settled = await Promise.allSettled(validUids.map((uid) => adminAuth.getUser(uid)));
        usersList = settled
          .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
          .map((r) => r.value);
      }

      const userMap = new Map<string, any>();
      for (const u of usersList) {
        if (u && u.uid) {
          userMap.set(u.uid, u);
        }
      }

      // Build safe, minimal response object: uid, providerIds, hasPhone, hasFacebook
      const authMethods = validUids.map((uid) => {
        const u = userMap.get(uid);
        if (!u) {
          return {
            uid,
            providerIds: [],
            hasPhone: false,
            hasFacebook: false,
          };
        }

        const providerIds: string[] = (u.providerData || []).map((p: any) => p.providerId);
        const hasPhone = Boolean(u.phoneNumber || providerIds.includes("phone"));
        const hasFacebook = Boolean(providerIds.includes("facebook.com"));

        return {
          uid: u.uid,
          providerIds,
          hasPhone,
          hasFacebook,
        };
      });

      return res.status(200).json({ success: true, authMethods });
    } catch (err: any) {
      console.error("[Admin Auth Methods Error]:", err);
      return res.status(500).json({ error: err?.message || "Error al obtener métodos de autenticación de los usuarios." });
    }
  });

  // =========================================================================
  // VITE MIDDLEWARE (Development) vs STATIC SERVING (Production)
  // =========================================================================
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Maestro Cerca Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
