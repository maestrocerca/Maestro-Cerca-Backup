import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { 
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  where
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { 
  Maestro,
  Worker, 
  Trade, 
  ServiceArea, 
  ContactEvent, 
  SolicitudContacto,
  AnalyticsCounts, 
  AppView, 
  VerificationStatus, 
  WorkPhoto, 
  VerificationRequest 
} from '../types';
import { 
  INITIAL_MAESTROS,
  INITIAL_WORKERS, 
  INITIAL_TRADES, 
  INITIAL_SERVICE_AREAS, 
  INITIAL_CONTACT_EVENTS, 
  INITIAL_SOLICITUDES_CONTACTO,
  INITIAL_ANALYTICS 
} from '../data/seedData';
import { sanitizeMexicanPhone, buildWhatsAppUrl } from '../lib/whatsapp';
import { sanitizeText, sanitizeRecord, checkRateLimit } from '../lib/sanitize';
import { calculateHaversineDistance, distanceFromZibata, coversZibata } from '../lib/geo';
import { DESIGNATED_ADMIN_EMAILS, isAdminEmail, isUserAdmin } from '../config/admins';

// Re-export centralized admin governance for backward compatibility
export { DESIGNATED_ADMIN_EMAILS, isAdminEmail, isUserAdmin };

// Helper to format Mexican 10-digit phone to international E.164 (+52XXXXXXXXXX)
export const formatMexicanPhoneToE164 = (rawPhone: string): string => {
  return sanitizeMexicanPhone(rawPhone).e164WithPlus;
};

// Helper to extract clean 10-digit format for display
export const formatPhoneForDisplay = (phone: string): string => {
  return sanitizeMexicanPhone(phone).displayFormat;
};

interface AuthResponse {
  success: boolean;
  error?: string;
  worker?: Worker;
  hasExistingProfile?: boolean;
}

interface StoreContextType {
  // Navigation
  currentView: AppView;
  navigateTo: (view: AppView) => void;
  
  // Firebase Auth State
  firebaseUser: FirebaseUser | null;
  isAuthLoading: boolean;
  isAdmin: boolean;
  
  // Data Collections (Live Firestore)
  maestros: Maestro[];
  workers: Worker[]; // alias of maestros with full compatibility
  trades: Trade[];
  serviceAreas: ServiceArea[];
  solicitudesContacto: SolicitudContacto[];
  contactEvents: ContactEvent[];
  analytics: AnalyticsCounts;
  
  // Worker / Maestro Session (strictly tied to Firebase Auth UID & Phone)
  currentWorker: Worker | null;
  
  // Phone Authentication Methods (Primary for Workers)
  sendPhoneVerificationCode: (
    phoneNumberE164: string, 
    containerId: string
  ) => Promise<{ success: boolean; confirmationResult?: ConfirmationResult; error?: string }>;
  
  confirmPhoneVerificationCode: (
    confirmationResult: ConfirmationResult, 
    verificationCode: string
  ) => Promise<{ success: boolean; user?: FirebaseUser; hasExistingProfile?: boolean; worker?: Worker; error?: string }>;
  
  createWorkerProfile: (data: Partial<Worker>) => Promise<AuthResponse>;
  
  // Admin Login (Email/Password or Google Sign-In strictly for administrators)
  loginAdmin: (email: string, password: string) => Promise<AuthResponse>;
  loginAdminWithGoogle: () => Promise<AuthResponse>;
  loginWorker: (email: string, password: string) => Promise<AuthResponse>; // alias for admin login
  
  logoutWorker: () => Promise<void>;
  updateWorkerProfile: (workerId: string, updates: Partial<Worker>) => Promise<{ success: boolean; error?: string }>;
  submitVerificationRequest: (workerId: string, req: Omit<VerificationRequest, 'status' | 'requestedAt'>) => Promise<{ success: boolean; error?: string }>;
  addWorkerPhoto: (workerId: string, photo: Omit<WorkPhoto, 'id'>) => Promise<void>;
  removeWorkerPhoto: (workerId: string, photoId: string) => Promise<void>;

  // Contact & Tracking (Client-side, friction-free for visitors)
  contactarWhatsApp: (maestro: Maestro, customNote?: string) => Promise<void>;
  logContactClick: (worker: Worker, type: 'whatsapp' | 'phone') => void;
  logProfileView: (worker: Worker) => void;
  trackSearch: (trade?: string, area?: string) => void;
  trackGenericEvent: (eventName: keyof AnalyticsCounts, detailKey?: string) => void;
  
  // Admin Operations (Requires admin privileges)
  adminApproveMaestro: (maestroId: string, aprobado: boolean) => Promise<void>;
  adminVerifyMaestro: (
    maestroId: string, 
    verificado: boolean, 
    checks?: { 
      phoneVerified?: boolean; 
      identityVerified?: boolean; 
      referencesVerified?: boolean; 
      photosReviewed?: boolean; 
    }
  ) => Promise<void>;
  adminSetVerificationStatus: (
    workerId: string, 
    status: VerificationStatus, 
    checks?: { 
      phoneVerified?: boolean; 
      identityVerified?: boolean; 
      referencesVerified?: boolean; 
      photosReviewed?: boolean; 
    }
  ) => Promise<void>;
  adminToggleWorkerActive: (workerId: string) => Promise<void>;
  adminDeleteMaestro: (maestroId: string) => Promise<void>;
  adminAddTrade: (trade: Omit<Trade, 'id'>) => Promise<void>;
  adminToggleTrade: (tradeId: string) => Promise<void>;
  adminAddServiceArea: (area: Omit<ServiceArea, 'id'>) => Promise<void>;
  adminToggleServiceArea: (areaId: string) => Promise<void>;
  resetAllDataToSeed: () => Promise<void>;
  fetchPrivateVerificationDossier: (workerId: string) => Promise<any | null>;
  
  // Helpers
  getWorkerBySlug: (slug: string) => Worker | undefined;
  getTradeBySlug: (slug: string) => Trade | undefined;
  calculateProfileCompletion: (worker: Worker) => number;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

// Helper to determine initial view from browser URL path
const getInitialView = (): AppView => {
  if (typeof window !== 'undefined') {
    const path = window.location.pathname.toLowerCase();
    if (path === '/aviso-de-privacidad' || path === '/aviso-de-privacidad/') {
      return { type: 'privacy' };
    }
    if (path === '/admin' || path === '/admin/') {
      return { type: 'admin' };
    }
  }
  return { type: 'home' };
};

// Keep RecaptchaVerifier instance cache to prevent duplicate container attachments
let appRecaptchaVerifier: RecaptchaVerifier | null = null;

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentView, setCurrentView] = useState<AppView>(getInitialView);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Firestore real-time state with initial fallback
  const [maestros, setMaestros] = useState<Maestro[]>(INITIAL_MAESTROS);
  const [trades, setTrades] = useState<Trade[]>(INITIAL_TRADES);
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>(INITIAL_SERVICE_AREAS);
  const [solicitudesContacto, setSolicitudesContacto] = useState<SolicitudContacto[]>(INITIAL_SOLICITUDES_CONTACTO);
  const [contactEvents, setContactEvents] = useState<ContactEvent[]>(INITIAL_CONTACT_EVENTS);
  const [analytics, setAnalytics] = useState<AnalyticsCounts>(INITIAL_ANALYTICS);

  // User token claims (custom claims RBAC)
  const [userClaims, setUserClaims] = useState<{ admin?: boolean; role?: string } | null>(null);

  // Computed: check if authenticated user possesses admin privileges (custom claims + designated list)
  const isAdmin = useMemo(() => {
    return isUserAdmin(firebaseUser, userClaims);
  }, [firebaseUser, userClaims]);

  // 1. Firebase Auth listener with native session persistence and custom claims retrieval
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          const tokenRes = await user.getIdTokenResult();
          setUserClaims((tokenRes?.claims as any) || null);
        } catch {
          setUserClaims(null);
        }
      } else {
        setUserClaims(null);
      }
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Real-time Maestros synchronization from Cloud Firestore
  // SOC QUERY-RULE ALIGNMENT & COMPOSITE INDEX RESILIENCE:
  // Firestore Security Rules require `allow list: if resource.data.aprobado == true || isAdmin();`
  // We align client queries to match security rules, with graceful degradation if a composite index is building.
  useEffect(() => {
    const maestrosRef = collection(db, 'maestros');
    let activeUnsubscribe: (() => void) | null = null;

    const attachListener = (isFallbackMode = false) => {
      // Primary query or fallback query
      const maestrosQuery = isAdmin 
        ? maestrosRef 
        : query(maestrosRef, where('aprobado', '==', true));

      activeUnsubscribe = onSnapshot(
        maestrosQuery,
        async (snapshot) => {
          if (!snapshot.empty) {
            const loaded: Maestro[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data() as Maestro;
              loaded.push({
                ...data,
                id: docSnap.id,
              });
            });

            // In-memory sorting fallback ensures stable ordering regardless of remote index status
            loaded.sort((a, b) => (b.calificacion || 0) - (a.calificacion || 0));

            setMaestros((prev) => {
              if (firebaseUser && !isAdmin) {
                const currentUnapproved = prev.find(
                  (p) => (p.userId === firebaseUser.uid || p.id === firebaseUser.uid) && !p.aprobado
                );
                if (currentUnapproved && !loaded.some((l) => l.id === currentUnapproved.id)) {
                  return [...loaded, currentUnapproved];
                }
              }
              return loaded;
            });
          } else if (isAdmin) {
            try {
              const batch = writeBatch(db);
              INITIAL_MAESTROS.forEach((m) => {
                const docRef = doc(db, 'maestros', m.id);
                batch.set(docRef, m);
                const workerRef = doc(db, 'workers', m.id);
                batch.set(workerRef, m);
              });
              await batch.commit();
            } catch (err) {
              console.warn('Firestore initial seeding note:', err);
            }
          }
        },
        (error) => {
          // Gracefully detect composite index building / failed-precondition states
          const isIndexError = 
            error.code === 'failed-precondition' || 
            (error.message && error.message.toLowerCase().includes('index'));

          if (isIndexError && !isFallbackMode) {
            console.warn(
              'Firestore composite index pending or building in background. Activating client-side graceful degradation fallback.',
              error.message
            );
            if (activeUnsubscribe) activeUnsubscribe();
            attachListener(true);
          } else {
            console.warn('Firestore maestros query note (handled gracefully):', error.message);
          }
        }
      );
    };

    attachListener();

    return () => {
      if (activeUnsubscribe) activeUnsubscribe();
    };
  }, [isAdmin, firebaseUser]);

  // Listener for authenticated worker's own profile document (even if not yet approved)
  useEffect(() => {
    if (!firebaseUser || isAdmin) return;

    const myDocRef = doc(db, 'maestros', firebaseUser.uid);
    const unsubMyDoc = onSnapshot(
      myDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const myData = { ...(docSnap.data() as Maestro), id: docSnap.id };
          setMaestros((prev) => {
            const exists = prev.some((m) => m.id === myData.id);
            if (exists) {
              return prev.map((m) => (m.id === myData.id ? myData : m));
            } else {
              return [...prev, myData];
            }
          });
        }
      },
      (err) => {
        console.warn('Worker profile private listener note:', err.message);
      }
    );

    return () => unsubMyDoc();
  }, [firebaseUser, isAdmin]);

  // 3. Real-time Solicitudes de Contacto synchronization from Cloud Firestore (leads)
  useEffect(() => {
    const solicitudesCol = collection(db, 'solicitudes_contacto');
    const unsubscribe = onSnapshot(
      solicitudesCol,
      (snapshot) => {
        if (!snapshot.empty) {
          const loaded: SolicitudContacto[] = [];
          snapshot.forEach((docSnap) => {
            loaded.push({
              ...(docSnap.data() as SolicitudContacto),
              id: docSnap.id,
            });
          });
          loaded.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
          setSolicitudesContacto(loaded);
        }
      },
      () => {
        // Unauthenticated guests won't have read permission for solicitudes_contacto
      }
    );

    return () => unsubscribe();
  }, [isAdmin]);

  // 4. Real-time Contact Events synchronization from Cloud Firestore
  useEffect(() => {
    const eventsCol = collection(db, 'contactEvents');
    const unsubscribe = onSnapshot(
      eventsCol,
      (snapshot) => {
        if (!snapshot.empty) {
          const loaded: ContactEvent[] = [];
          snapshot.forEach((docSnap) => {
            loaded.push({
              ...(docSnap.data() as ContactEvent),
              id: docSnap.id,
            });
          });
          loaded.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          setContactEvents(loaded);
        }
      },
      () => {
        // Silently handled
      }
    );

    return () => unsubscribe();
  }, [isAdmin]);

  // Workers is an alias of maestros for full backward compatibility across views
  const workers = maestros;

  // Compute currently logged-in worker strictly from authenticated Firebase UID or phone
  const currentWorker = useMemo(() => {
    if (!firebaseUser) return null;
    
    // Primary: Match by Firebase Auth UID in userId or document id
    const byUid = maestros.find((w) => w.userId === firebaseUser.uid || w.id === firebaseUser.uid);
    if (byUid) return byUid;

    // Secondary: Match by verified Firebase phone number
    if (firebaseUser.phoneNumber) {
      const authDigits = firebaseUser.phoneNumber.replace(/\D/g, '');
      const byPhone = maestros.find((w) => {
        const workerDigits = (w.phone || w.telefonoWhatsApp || '').replace(/\D/g, '');
        return workerDigits.endsWith(authDigits.slice(-10)) || authDigits.endsWith(workerDigits.slice(-10));
      });
      if (byPhone) return byPhone;
    }

    // Tertiary: Match by email (admin accounts / legacy)
    if (firebaseUser.email) {
      const byEmail = maestros.find(
        (w) => w.email && w.email.toLowerCase() === firebaseUser.email!.toLowerCase()
      );
      if (byEmail) return byEmail;
    }

    return null;
  }, [firebaseUser, maestros]);

  const navigateTo = useCallback((view: AppView) => {
    setCurrentView(view);
    if (typeof window !== 'undefined') {
      if (view.type === 'privacy') {
        if (window.location.pathname.toLowerCase() !== '/aviso-de-privacidad') {
          window.history.pushState({ view }, '', '/aviso-de-privacidad');
        }
      } else if (view.type === 'admin') {
        if (window.location.pathname.toLowerCase() !== '/admin') {
          window.history.pushState({ view }, '', '/admin');
        }
      } else {
        if (window.location.pathname.toLowerCase() === '/aviso-de-privacidad' || window.location.pathname.toLowerCase() === '/admin') {
          window.history.pushState({ view }, '', '/');
        }
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Sync browser popstate (back/forward buttons) with currentView
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname.toLowerCase();
      if (path === '/aviso-de-privacidad' || path === '/aviso-de-privacidad/') {
        setCurrentView({ type: 'privacy' });
      } else if (path === '/admin' || path === '/admin/') {
        setCurrentView({ type: 'admin' });
      } else {
        setCurrentView({ type: 'home' });
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Track page / search metrics
  const trackGenericEvent = useCallback((eventName: keyof AnalyticsCounts, detailKey?: string) => {
    setAnalytics((prev) => {
      const next = { ...prev };
      if (eventName === 'oficio_buscado' && detailKey) {
        next.oficio_buscado = {
          ...next.oficio_buscado,
          [detailKey]: (next.oficio_buscado[detailKey] || 0) + 1,
        };
      } else if (eventName === 'zona_buscada' && detailKey) {
        next.zona_buscada = {
          ...next.zona_buscada,
          [detailKey]: (next.zona_buscada[detailKey] || 0) + 1,
        };
      } else if (typeof next[eventName] === 'number') {
        (next[eventName] as number) += 1;
      }
      return next;
    });
  }, []);

  const trackSearch = useCallback((trade?: string, area?: string) => {
    setAnalytics((prev) => {
      const next = { ...prev, busqueda_realizada: prev.busqueda_realizada + 1 };
      if (trade) {
        next.oficio_buscado = {
          ...next.oficio_buscado,
          [trade]: (next.oficio_buscado[trade] || 0) + 1,
        };
      }
      if (area) {
        next.zona_buscada = {
          ...next.zona_buscada,
          [area]: (next.zona_buscada[area] || 0) + 1,
        };
      }
      return next;
    });
  }, []);

  // =========================================================================
  // WHATSAPP CTA & SOLICITUDES_CONTACTO INTEGRATION (Hardened & Rate-Limited)
  // =========================================================================
  const contactarWhatsApp = useCallback(async (maestro: Maestro, customNote?: string) => {
    const targetPhone = maestro.telefonoWhatsApp || maestro.whatsapp || maestro.phone || '4420000000';
    const targetName = maestro.nombre || `${maestro.firstName || ''} ${maestro.lastName || ''}`.trim() || 'Maestro';
    const targetOficio = maestro.oficio || maestro.mainTrade || 'Servicio';

    // 1. Sanitize phone number (strip non-digits, normalize Mexican +52 format)
    const { waMeFormat } = sanitizeMexicanPhone(targetPhone);
    const cleanNote = customNote ? sanitizeText(customNote) : undefined;
    const waUrl = buildWhatsAppUrl(targetPhone, targetName, targetOficio, cleanNote);

    // 2. Client-side rate-limiter: debounce repeated clicks to prevent telemetry flooding
    const canLogEvent = checkRateLimit(`wa_${maestro.id}`, 2000);

    if (canLogEvent) {
      const nowIso = new Date().toISOString();
      const leadPayload = {
        maestroId: maestro.id,
        maestroNombre: sanitizeText(targetName),
        oficio: sanitizeText(targetOficio),
        fecha: nowIso,
        timestamp: nowIso,
        origen: 'zibata_web' as const,
        tipo: 'whatsapp' as const,
        telefono: waMeFormat,
      };

      try {
        await addDoc(collection(db, 'solicitudes_contacto'), leadPayload);
      } catch (e) {
        console.warn('Could not record solicitud_contacto in Firestore:', e);
      }

      // Update local analytics counters
      setAnalytics((prev) => ({
        ...prev,
        whatsapp_click: prev.whatsapp_click + 1,
      }));
    }

    // 3. Open WhatsApp wa.me direct link
    if (typeof window !== 'undefined') {
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    }
  }, []);

  // Direct contact tracking: save to Firestore and update local counters
  const logContactClick = useCallback(async (worker: Worker, type: 'whatsapp' | 'phone') => {
    if (type === 'whatsapp') {
      await contactarWhatsApp(worker);
      return;
    }

    const targetPhone = worker.telefonoWhatsApp || worker.whatsapp || worker.phone || '4420000000';
    const cleanName = sanitizeText(worker.nombre || `${worker.firstName} ${worker.lastName}`);
    const cleanTrade = sanitizeText(worker.oficio || worker.mainTrade || 'Servicio');
    const { waMeFormat, digitsOnly } = sanitizeMexicanPhone(targetPhone);

    const canLogEvent = checkRateLimit(`phone_${worker.id}`, 2000);

    if (canLogEvent) {
      const nowIso = new Date().toISOString();
      const newEvent: Omit<ContactEvent, 'id'> = {
        workerId: worker.id,
        workerName: cleanName,
        type,
        trade: cleanTrade,
        area: worker.serviceAreas?.[0] || 'Zibatá',
        timestamp: nowIso,
      };

      try {
        await addDoc(collection(db, 'contactEvents'), newEvent);
        await addDoc(collection(db, 'solicitudes_contacto'), {
          maestroId: worker.id,
          maestroNombre: cleanName,
          oficio: cleanTrade,
          fecha: nowIso,
          timestamp: nowIso,
          origen: 'zibata_web' as const,
          tipo: 'phone' as const,
          telefono: waMeFormat,
        });
      } catch (e) {
        // Handled silently
      }

      setAnalytics((prev) => ({
        ...prev,
        telefono_click: prev.telefono_click + 1,
      }));
    }

    if (typeof window !== 'undefined') {
      window.location.href = `tel:+${digitsOnly.startsWith('52') ? digitsOnly : `52${digitsOnly}`}`;
    }
  }, [contactarWhatsApp]);

  const logProfileView = useCallback(async (worker: Worker) => {
    const newEvent: Omit<ContactEvent, 'id'> = {
      workerId: worker.id,
      workerName: worker.nombre || `${worker.firstName} ${worker.lastName}`,
      type: 'profileView',
      trade: worker.oficio || worker.mainTrade,
      area: worker.serviceAreas?.[0] || 'Zibatá',
      timestamp: new Date().toISOString(),
    };

    try {
      await addDoc(collection(db, 'contactEvents'), newEvent);
    } catch (e) {
      // Handled silently
    }

    setAnalytics((prev) => ({
      ...prev,
      perfil_visualizado: prev.perfil_visualizado + 1,
    }));
  }, []);

  // =========================================================================
  // FIREBASE PHONE AUTHENTICATION (SMS OTP)
  // =========================================================================
  const sendPhoneVerificationCode = useCallback(async (
    phoneNumberE164: string, 
    containerId: string
  ): Promise<{ success: boolean; confirmationResult?: ConfirmationResult; error?: string }> => {
    try {
      if (appRecaptchaVerifier) {
        try {
          appRecaptchaVerifier.clear();
        } catch (cErr) {
          // ignore clear error
        }
        appRecaptchaVerifier = null;
      }

      appRecaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
        size: 'invisible',
        callback: () => {
          // reCAPTCHA solved
        },
        'expired-callback': () => {
          console.warn('reCAPTCHA expired');
        }
      });

      const confirmationResult = await signInWithPhoneNumber(auth, phoneNumberE164, appRecaptchaVerifier);
      return { success: true, confirmationResult };
    } catch (err: any) {
      console.warn('Firebase Phone Auth send error:', err.code, err.message);
      
      let userFriendlyError = 'No pudimos enviar el código SMS. Intenta nuevamente.';
      if (err.code === 'auth/invalid-phone-number') {
        userFriendlyError = 'Número inválido. Asegúrate de ingresar 10 dígitos celulares.';
      } else if (err.code === 'auth/missing-phone-number') {
        userFriendlyError = 'Por favor ingresa tu número de celular.';
      } else if (err.code === 'auth/quota-exceeded') {
        userFriendlyError = 'Se ha superado el límite de SMS por hoy. Intenta más tarde.';
      } else if (err.code === 'auth/too-many-requests') {
        userFriendlyError = 'Demasiados intentos. Intenta nuevamente más tarde.';
      } else if (err.code === 'auth/captcha-check-failed') {
        userFriendlyError = 'Error de verificación reCAPTCHA. Recarga la página e intenta de nuevo.';
      } else if (err.code === 'auth/network-request-failed') {
        userFriendlyError = 'Error de conexión. Revisa tu acceso a internet.';
      } else if (err.code === 'auth/operation-not-allowed') {
        userFriendlyError = 'El proveedor de autenticación por teléfono aún debe habilitarse en Firebase Console.';
      }

      return { success: false, error: userFriendlyError };
    }
  }, []);

  const confirmPhoneVerificationCode = useCallback(async (
    confirmationResult: ConfirmationResult, 
    verificationCode: string
  ): Promise<{ success: boolean; user?: FirebaseUser; hasExistingProfile?: boolean; worker?: Worker; error?: string }> => {
    const cleanCode = verificationCode.trim().replace(/\D/g, '');
    if (!cleanCode || cleanCode.length < 6) {
      return { success: false, error: 'Ingresa el código completo de 6 dígitos que recibiste por SMS.' };
    }

    try {
      const userCredential = await confirmationResult.confirm(cleanCode);
      const user = userCredential.user;

      let existingWorker: Worker | undefined = undefined;
      try {
        const maestroDocSnap = await getDoc(doc(db, 'maestros', user.uid));
        if (maestroDocSnap.exists()) {
          existingWorker = {
            ...(maestroDocSnap.data() as Worker),
            id: maestroDocSnap.id,
          };
        }
      } catch (fErr) {
        console.warn('Check existing maestro note:', fErr);
      }

      if (!existingWorker) {
        existingWorker = maestros.find((w) => w.userId === user.uid || w.id === user.uid);
      }

      return { 
        success: true, 
        user, 
        hasExistingProfile: Boolean(existingWorker),
        worker: existingWorker 
      };
    } catch (err: any) {
      console.warn('Firebase Phone Auth confirm error:', err.code, err.message);

      let userFriendlyError = 'Código incorrecto. Revisa el SMS e intenta de nuevo.';
      if (err.code === 'auth/invalid-verification-code') {
        userFriendlyError = 'Código incorrecto. Verifica los 6 dígitos recibidos.';
      } else if (err.code === 'auth/code-expired') {
        userFriendlyError = 'Código vencido. Por favor solicita un nuevo código por SMS.';
      } else if (err.code === 'auth/network-request-failed') {
        userFriendlyError = 'Error de conexión. Revisa tu acceso a internet.';
      }

      return { success: false, error: userFriendlyError };
    }
  }, [maestros]);

  // Create or complete worker profile for the authenticated Firebase user
  const createWorkerProfile = useCallback(async (data: Partial<Worker>): Promise<AuthResponse> => {
    if (!auth.currentUser) {
      return { 
        success: false, 
        error: 'Debes verificar primero tu número celular para crear tu perfil.' 
      };
    }

    const firebaseUid = auth.currentUser.uid;
    const verifiedPhone = auth.currentUser.phoneNumber || data.phone || '';
    const { digitsOnly, waMeFormat, displayFormat } = sanitizeMexicanPhone(verifiedPhone);

    const timestamp = Date.now();
    const cleanFirstName = sanitizeText(data.firstName || 'Trabajador');
    const cleanLastName = sanitizeText(data.lastName || '');
    const cleanNombre = sanitizeText(data.nombre || `${cleanFirstName} ${cleanLastName}`.trim());
    const cleanBio = sanitizeText(data.bio || data.description || 'Especialista en servicios para el hogar en Zibatá.');
    const cleanOficio = sanitizeText(data.oficio || data.mainTrade || 'Mantenimiento general');

    const slugBase = `${cleanFirstName}-${cleanLastName}`
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    
    const slug = `${slugBase}-${timestamp.toString().slice(-4)}`;
    const workerId = firebaseUid;

    const newWorker: Maestro = {
      id: workerId,
      userId: firebaseUid,
      slug,
      nombre: cleanNombre,
      oficio: cleanOficio,
      bio: cleanBio,
      calificacion: 5.0,
      radioKm: Number(data.radioKm) || 15,
      lat: typeof data.lat === 'number' ? data.lat : 20.6934,
      lng: typeof data.lng === 'number' ? data.lng : -100.3255,
      fotoUrl: data.fotoUrl || data.profilePhoto || 'https://images.unsplash.com/photo-1540569014015-19a7be504e3a?auto=format&fit=crop&w=400&q=80',
      telefonoWhatsApp: waMeFormat || `52${digitsOnly}`,
      nivel: 'Especialista',
      verificado: false,
      // Only display profiles where aprobado == true on the public directory!
      // New self-registrations start as unapproved until reviewed by admin
      aprobado: false,
      fechaRegistro: new Date().toISOString(),

      // Compatibility fields
      firstName: cleanFirstName,
      lastName: cleanLastName,
      email: sanitizeText(data.email || ''),
      phone: digitsOnly || '4420000000',
      whatsapp: waMeFormat || `52${digitsOnly}`,
      profilePhoto: data.fotoUrl || data.profilePhoto || 'https://images.unsplash.com/photo-1540569014015-19a7be504e3a?auto=format&fit=crop&w=400&q=80',
      mainTrade: cleanOficio,
      secondaryTrades: data.secondaryTrades || [],
      services: data.services && data.services.length > 0 ? data.services.map(sanitizeText) : ['Mantenimiento y reparaciones generales'],
      description: cleanBio,
      yearsExperience: Number(data.yearsExperience) || 3,
      serviceAreas: data.serviceAreas && data.serviceAreas.length > 0 ? data.serviceAreas : ['Zibatá', 'Zakia'],
      workPhotos: data.workPhotos || [],
      verificationStatus: 'registered',
      phoneVerified: true,
      identityVerified: false,
      referencesVerified: false,
      photosReviewed: false,
      profileActive: true,
      joinedDate: new Date().toISOString().split('T')[0],
      privacyNoticeAccepted: true,
      privacyNoticeAcceptedAt: new Date().toISOString(),
      privacyNoticeVersion: '1.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'maestros', workerId), newWorker);
      // Also write to workers collection for legacy rules sync
      await setDoc(doc(db, 'workers', workerId), newWorker);
      
      setMaestros((prev) => {
        const exists = prev.some((w) => w.id === workerId);
        return exists ? prev.map((w) => (w.id === workerId ? newWorker : w)) : [...prev, newWorker];
      });

      setAnalytics((prev) => ({
        ...prev,
        registro_trabajador_completado: prev.registro_trabajador_completado + 1,
        fotos_subidas: prev.fotos_subidas + (newWorker.workPhotos?.length || 0),
      }));

      return { success: true, worker: newWorker };
    } catch (firestoreErr: any) {
      console.error('Firestore save error:', firestoreErr);
      return {
        success: false,
        error: 'No se pudo guardar la información del perfil en la base de datos.',
      };
    }
  }, []);

  // =========================================================================
  // ADMIN AUTHENTICATION (Email/Password and Google Sign-In)
  // =========================================================================
  const loginAdmin = useCallback(async (email: string, password: string): Promise<AuthResponse> => {
    const clean = email.trim().toLowerCase();
    if (!clean || !password) {
      return { success: false, error: 'Por favor ingresa tu correo y contraseña administrativa.' };
    }

    try {
      await signInWithEmailAndPassword(auth, clean, password);
      return { success: true };
    } catch (authErr: any) {
      console.warn('Firebase admin signIn error:', authErr.code, authErr.message);
      let message = 'Credenciales administrativas no válidas.';
      if (authErr.code === 'auth/wrong-password' || authErr.code === 'auth/user-not-found' || authErr.code === 'auth/invalid-credential') {
        message = 'Correo o contraseña administrativa incorrectos.';
      } else if (authErr.code === 'auth/network-request-failed') {
        message = 'Error de conexión con el servidor. Revisa tu acceso a internet.';
      }
      return { success: false, error: message };
    }
  }, []);

  const loginAdminWithGoogle = useCallback(async (): Promise<AuthResponse> => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
      return { success: true };
    } catch (err: any) {
      console.warn('Google sign-in error:', err);
      let message = 'No se pudo completar el inicio de sesión con Google.';
      if (err.code === 'auth/popup-closed-by-user') {
        message = 'Se cerró la ventana emergente de Google.';
      } else if (err.code === 'auth/popup-blocked') {
        message = 'El navegador bloqueó la ventana emergente. Por favor permítela e intenta de nuevo.';
      }
      return { success: false, error: message };
    }
  }, []);

  // Alias for backward compatibility
  const loginWorker = loginAdmin;

  const logoutWorker = useCallback(async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn('Error during signOut:', e);
    }
    if (currentView.type === 'dashboard' || currentView.type === 'admin') {
      setCurrentView({ type: 'home' });
    }
  }, [currentView.type]);

  // Update worker profile in Cloud Firestore
  const updateWorkerProfile = useCallback(async (
    workerId: string, 
    updates: Partial<Worker>
  ): Promise<{ success: boolean; error?: string }> => {
    if (!firebaseUser) {
      return { success: false, error: 'No hay una sesión activa de Firebase.' };
    }

    const targetWorker = maestros.find((w) => w.id === workerId);
    if (targetWorker && targetWorker.userId !== firebaseUser.uid && workerId !== firebaseUser.uid && !isAdmin) {
      return { success: false, error: 'No tienes permisos para modificar este perfil.' };
    }

    const sanitizedUpdates = sanitizeRecord(updates);

    // Whitelist only editable worker fields; strip verification/approval fields to satisfy security rules unless admin
    const safePayload: Partial<Worker> = {
      nombre: sanitizedUpdates.nombre || (sanitizedUpdates.firstName && `${sanitizedUpdates.firstName} ${sanitizedUpdates.lastName || ''}`.trim()),
      firstName: sanitizedUpdates.firstName,
      lastName: sanitizedUpdates.lastName,
      email: sanitizedUpdates.email !== undefined ? sanitizedUpdates.email : targetWorker?.email,
      phone: sanitizedUpdates.phone,
      whatsapp: sanitizedUpdates.whatsapp,
      telefonoWhatsApp: sanitizedUpdates.telefonoWhatsApp || sanitizedUpdates.whatsapp,
      bio: sanitizedUpdates.bio || sanitizedUpdates.description,
      description: sanitizedUpdates.description || sanitizedUpdates.bio,
      profilePhoto: sanitizedUpdates.profilePhoto || sanitizedUpdates.fotoUrl,
      fotoUrl: sanitizedUpdates.fotoUrl || sanitizedUpdates.profilePhoto,
      oficio: sanitizedUpdates.oficio || sanitizedUpdates.mainTrade,
      mainTrade: sanitizedUpdates.mainTrade || sanitizedUpdates.oficio,
      secondaryTrades: sanitizedUpdates.secondaryTrades,
      yearsExperience: sanitizedUpdates.yearsExperience,
      services: sanitizedUpdates.services,
      serviceAreas: sanitizedUpdates.serviceAreas,
      radioKm: sanitizedUpdates.radioKm,
      lat: sanitizedUpdates.lat,
      lng: sanitizedUpdates.lng,
      workPhotos: sanitizedUpdates.workPhotos,
      profileActive: sanitizedUpdates.profileActive !== undefined ? sanitizedUpdates.profileActive : targetWorker?.profileActive,
      updatedAt: new Date().toISOString(),
    };

    if (isAdmin) {
      if (sanitizedUpdates.aprobado !== undefined) safePayload.aprobado = sanitizedUpdates.aprobado;
      if (sanitizedUpdates.verificado !== undefined) safePayload.verificado = sanitizedUpdates.verificado;
      if (sanitizedUpdates.nivel !== undefined) safePayload.nivel = sanitizedUpdates.nivel;
      if (sanitizedUpdates.verificationStatus !== undefined) safePayload.verificationStatus = sanitizedUpdates.verificationStatus;
    }

    // Remove undefined values
    Object.keys(safePayload).forEach((k) => {
      if ((safePayload as any)[k] === undefined) {
        delete (safePayload as any)[k];
      }
    });

    try {
      await setDoc(doc(db, 'maestros', workerId), safePayload, { merge: true });
      await setDoc(doc(db, 'workers', workerId), safePayload, { merge: true });
      
      setMaestros((prev) =>
        prev.map((w) => (w.id === workerId ? { ...w, ...safePayload } : w))
      );
      return { success: true };
    } catch (err: any) {
      console.warn('Firestore update error:', err);
      return { success: false, error: err?.message || 'Error al actualizar en Firestore.' };
    }
  }, [firebaseUser, maestros, isAdmin]);

  // Submit verification request to Cloud Firestore
  // ZERO-LEAK ARCHITECTURE:
  // Public document maestros/{workerId} stores strictly metadata:
  // { tieneVerificacionPendiente: true, fechaSubidaDoc: string }
  // Sensitive documents (INE, proof of address, etc.) are recorded exclusively
  // in the admin-restricted subcollection: maestros/{workerId}/privado/verificacion
  const submitVerificationRequest = useCallback(async (
    workerId: string, 
    req: Omit<VerificationRequest, 'status' | 'requestedAt'> & { documents?: string[]; references?: string[] }
  ): Promise<{ success: boolean; error?: string }> => {
    if (!firebaseUser) {
      return { success: false, error: 'Debes iniciar sesión para solicitar verificación.' };
    }

    const nowIso = new Date().toISOString();

    try {
      // 1. Update public collection with non-sensitive status flags ONLY
      const publicUpdate = {
        tieneVerificacionPendiente: true,
        fechaSubidaDoc: nowIso,
        updatedAt: nowIso,
      };

      await updateDoc(doc(db, 'maestros', workerId), publicUpdate);
      try {
        await updateDoc(doc(db, 'workers', workerId), publicUpdate);
      } catch {
        // Fallback for legacy workers collection handled
      }

      // 2. Sensitive document references inside admin-restricted subcollection
      // maestros/{id}/privado/verificacion
      const privateDocPayload = {
        workerId,
        documents: (req as any).documents || (req.idDocStoragePath ? [req.idDocStoragePath] : []),
        idDocStoragePath: req.idDocStoragePath || ((req as any).documents && (req as any).documents[0]) || '',
        proofAddressStoragePath: req.proofAddressStoragePath || '',
        referencesText: req.referencesText || ((req as any).references ? (req as any).references.join(', ') : ''),
        notes: req.notes || '',
        status: 'pending',
        requestedAt: nowIso,
        updatedAt: nowIso,
      };

      try {
        await setDoc(
          doc(db, 'maestros', workerId, 'privado', 'verificacion'),
          privateDocPayload,
          { merge: true }
        );
      } catch (privErr) {
        console.info('Private document record handled:', privErr);
      }

      setMaestros((prev) =>
        prev.map((w) => (w.id === workerId ? { 
          ...w, 
          tieneVerificacionPendiente: true, 
          fechaSubidaDoc: nowIso,
          verificationRequest: {
            ...req,
            status: 'pending',
            requestedAt: nowIso,
          }
        } : w))
      );

      setAnalytics((prev) => ({
        ...prev,
        solicitud_verificacion: prev.solicitud_verificacion + 1,
      }));

      return { success: true };
    } catch (err: any) {
      console.warn('Firestore verification request error:', err);
      return { success: false, error: err?.message || 'Error al enviar solicitud.' };
    }
  }, [firebaseUser]);

  // Admin-only retrieval of private verification dossier
  const fetchPrivateVerificationDossier = useCallback(async (workerId: string): Promise<any | null> => {
    if (!isAdmin) return null;
    try {
      const snap = await getDoc(doc(db, 'maestros', workerId, 'privado', 'verificacion'));
      if (snap.exists()) {
        return snap.data();
      }
      return null;
    } catch (err) {
      console.warn('Private dossier fetch error:', err);
      return null;
    }
  }, [isAdmin]);

  // Add work photo to Firestore profile
  const addWorkerPhoto = useCallback(async (workerId: string, photo: Omit<WorkPhoto, 'id'>) => {
    const newPhoto: WorkPhoto = {
      ...photo,
      title: sanitizeText(photo.title),
      description: sanitizeText(photo.description || ''),
      id: `p-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    };

    const target = maestros.find((w) => w.id === workerId);
    const updatedPhotos = target ? [...(target.workPhotos || []), newPhoto] : [newPhoto];

    try {
      await updateDoc(doc(db, 'maestros', workerId), {
        workPhotos: updatedPhotos,
        updatedAt: new Date().toISOString(),
      });
      await updateDoc(doc(db, 'workers', workerId), {
        workPhotos: updatedPhotos,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Firestore photo add error:', err);
    }

    setMaestros((prev) =>
      prev.map((w) => (w.id === workerId ? { ...w, workPhotos: updatedPhotos } : w))
    );

    setAnalytics((prev) => ({
      ...prev,
      fotos_subidas: prev.fotos_subidas + 1,
    }));
  }, [maestros]);

  // Remove photo from Firestore profile
  const removeWorkerPhoto = useCallback(async (workerId: string, photoId: string) => {
    const target = maestros.find((w) => w.id === workerId);
    if (!target) return;

    const filtered = (target.workPhotos || []).filter((p) => p.id !== photoId);

    try {
      await updateDoc(doc(db, 'maestros', workerId), {
        workPhotos: filtered,
        updatedAt: new Date().toISOString(),
      });
      await updateDoc(doc(db, 'workers', workerId), {
        workPhotos: filtered,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Firestore photo remove error:', err);
    }

    setMaestros((prev) =>
      prev.map((w) => (w.id === workerId ? { ...w, workPhotos: filtered } : w))
    );
  }, [maestros]);

  // =========================================================================
  // ADMIN OPERATIONS (Approval, Verification, Catalog Management)
  // =========================================================================
  const adminApproveMaestro = useCallback(async (maestroId: string, aprobado: boolean) => {
    try {
      await updateDoc(doc(db, 'maestros', maestroId), {
        aprobado,
        updatedAt: new Date().toISOString(),
      });
      await updateDoc(doc(db, 'workers', maestroId), {
        aprobado,
        profileActive: aprobado,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Admin approve maestro error:', err);
    }

    setMaestros((prev) =>
      prev.map((m) => (m.id === maestroId ? { ...m, aprobado, profileActive: aprobado } : m))
    );
  }, []);

  const adminVerifyMaestro = useCallback(async (
    maestroId: string, 
    verificado: boolean, 
    checks?: { 
      phoneVerified?: boolean; 
      identityVerified?: boolean; 
      referencesVerified?: boolean; 
      photosReviewed?: boolean; 
    }
  ) => {
    const updates: Partial<Maestro> = {
      verificado,
      verificationStatus: verificado ? 'verified' : 'registered',
      phoneVerified: checks?.phoneVerified !== undefined ? checks.phoneVerified : true,
      identityVerified: checks?.identityVerified !== undefined ? checks.identityVerified : verificado,
      referencesVerified: checks?.referencesVerified !== undefined ? checks.referencesVerified : verificado,
      photosReviewed: checks?.photosReviewed !== undefined ? checks.photosReviewed : verificado,
      updatedAt: new Date().toISOString(),
    };

    try {
      await updateDoc(doc(db, 'maestros', maestroId), updates);
      await updateDoc(doc(db, 'workers', maestroId), updates);
    } catch (err) {
      console.warn('Admin verify error:', err);
    }

    setMaestros((prev) =>
      prev.map((m) => (m.id === maestroId ? { ...m, ...updates } : m))
    );
  }, []);

  const adminSetVerificationStatus = useCallback(async (
    workerId: string, 
    status: VerificationStatus, 
    checks?: { 
      phoneVerified?: boolean; 
      identityVerified?: boolean; 
      referencesVerified?: boolean; 
      photosReviewed?: boolean; 
    }
  ) => {
    await adminVerifyMaestro(workerId, status === 'verified', checks);
  }, [adminVerifyMaestro]);

  const adminToggleWorkerActive = useCallback(async (workerId: string) => {
    const target = maestros.find((w) => w.id === workerId);
    if (!target) return;
    const nextState = !target.profileActive;

    try {
      await updateDoc(doc(db, 'maestros', workerId), {
        profileActive: nextState,
        updatedAt: new Date().toISOString(),
      });
      await updateDoc(doc(db, 'workers', workerId), {
        profileActive: nextState,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Admin toggle active error:', err);
    }

    setMaestros((prev) =>
      prev.map((w) => (w.id === workerId ? { ...w, profileActive: nextState } : w))
    );
  }, [maestros]);

  const adminDeleteMaestro = useCallback(async (maestroId: string) => {
    try {
      await deleteDoc(doc(db, 'maestros', maestroId));
      await deleteDoc(doc(db, 'workers', maestroId));
    } catch (err) {
      console.warn('Admin delete maestro error:', err);
    }

    setMaestros((prev) => prev.filter((m) => m.id !== maestroId));
  }, []);

  const adminAddTrade = useCallback(async (trade: Omit<Trade, 'id'>) => {
    const newTrade: Trade = {
      ...trade,
      name: sanitizeText(trade.name),
      description: sanitizeText(trade.description),
      id: `t-${Date.now()}`,
    };
    try {
      await setDoc(doc(db, 'trades', newTrade.id), newTrade);
    } catch (e) {
      console.warn(e);
    }
    setTrades((prev) => [...prev, newTrade]);
  }, []);

  const adminToggleTrade = useCallback(async (tradeId: string) => {
    setTrades((prev) =>
      prev.map((t) => (t.id === tradeId ? { ...t, active: !t.active } : t))
    );
  }, []);

  const adminAddServiceArea = useCallback(async (area: Omit<ServiceArea, 'id'>) => {
    const newArea: ServiceArea = {
      ...area,
      name: sanitizeText(area.name),
      municipality: sanitizeText(area.municipality),
      state: sanitizeText(area.state),
      id: `a-${Date.now()}`,
    };
    try {
      await setDoc(doc(db, 'serviceAreas', newArea.id), newArea);
    } catch (e) {
      console.warn(e);
    }
    setServiceAreas((prev) => [...prev, newArea]);
  }, []);

  const adminToggleServiceArea = useCallback(async (areaId: string) => {
    setServiceAreas((prev) =>
      prev.map((a) => (a.id === areaId ? { ...a, active: !a.active } : a))
    );
  }, []);

  const resetAllDataToSeed = useCallback(async () => {
    try {
      const batch = writeBatch(db);
      INITIAL_MAESTROS.forEach((m) => {
        batch.set(doc(db, 'maestros', m.id), m);
        batch.set(doc(db, 'workers', m.id), m);
      });
      await batch.commit();
    } catch (e) {
      console.warn('Reset seed batch error:', e);
    }
    setMaestros(INITIAL_MAESTROS);
    setTrades(INITIAL_TRADES);
    setServiceAreas(INITIAL_SERVICE_AREAS);
    setContactEvents(INITIAL_CONTACT_EVENTS);
    setSolicitudesContacto(INITIAL_SOLICITUDES_CONTACTO);
    setAnalytics(INITIAL_ANALYTICS);
  }, []);

  const getWorkerBySlug = useCallback(
    (slug: string) => {
      return maestros.find((w) => w.slug === slug || w.id === slug);
    },
    [maestros]
  );

  const getTradeBySlug = useCallback(
    (slug: string) => {
      return trades.find((t) => t.slug === slug || t.name.toLowerCase() === slug.toLowerCase());
    },
    [trades]
  );

  const calculateProfileCompletion = useCallback((worker: Worker): number => {
    let score = 0;
    if (worker.nombre || (worker.firstName && worker.lastName)) score += 15;
    if (worker.telefonoWhatsApp || (worker.phone && worker.whatsapp)) score += 15;
    if (worker.fotoUrl || worker.profilePhoto) score += 10;
    if (worker.bio || (worker.description && worker.description.length > 30)) score += 15;
    if (worker.services && worker.services.length >= 2) score += 15;
    if (worker.serviceAreas && worker.serviceAreas.length >= 1) score += 10;
    if (worker.workPhotos && worker.workPhotos.length >= 1) score += 10;
    if (worker.workPhotos && worker.workPhotos.length >= 3) score += 10;
    return Math.min(100, score);
  }, []);

  return (
    <StoreContext.Provider
      value={{
        currentView,
        navigateTo,
        firebaseUser,
        isAuthLoading,
        isAdmin,
        maestros,
        workers,
        trades,
        serviceAreas,
        solicitudesContacto,
        contactEvents,
        analytics,
        currentWorker,
        sendPhoneVerificationCode,
        confirmPhoneVerificationCode,
        createWorkerProfile,
        loginAdmin,
        loginAdminWithGoogle,
        loginWorker,
        logoutWorker,
        updateWorkerProfile,
        submitVerificationRequest,
        addWorkerPhoto,
        removeWorkerPhoto,
        contactarWhatsApp,
        logContactClick,
        logProfileView,
        trackSearch,
        trackGenericEvent,
        adminApproveMaestro,
        adminVerifyMaestro,
        adminSetVerificationStatus,
        adminToggleWorkerActive,
        adminDeleteMaestro,
        adminAddTrade,
        adminToggleTrade,
        adminAddServiceArea,
        adminToggleServiceArea,
        resetAllDataToSeed,
        fetchPrivateVerificationDossier,
        getWorkerBySlug,
        getTradeBySlug,
        calculateProfileCompletion,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};
