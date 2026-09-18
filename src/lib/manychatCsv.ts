import { Maestro } from '../types';

export type CanonicalField =
  | 'nombre'
  | 'apellidos'
  | 'oficioPrincipal'
  | 'serviciosAdicionales'
  | 'ciudad'
  | 'zonas'
  | 'experiencia'
  | 'telefono'
  | 'disponibilidad'
  | 'finishedAt'
  | 'manychatId';

export interface HeaderMapping {
  colIndex: number;
  rawHeader: string;
  normalizedHeader: string;
  canonicalField: CanonicalField | null;
  matchedPattern?: string;
}

export interface ManyChatLeadRecord {
  // Exact contract fields requested
  nombre: string;
  apellidos?: string;
  oficioPrincipal: string;
  serviciosAdicionales: string;
  ciudad: string;
  zonas: string;
  experiencia: string;
  telefono: string;
  whatsapp: string; // Inicializado por defecto con el mismo teléfono sanitizado
  disponibilidad: string;
  status: 'draft'; // Perfil importado en borrador hasta que complete validación
  onboardingIncomplete: true;
  registrationMethod: 'manychat_csv';
  createdAt: string;

  // Platform schema & compatibility fields
  id: string;
  userId: string;
  slug?: string;
  oficio: string;
  mainTrade: string;
  firstName?: string;
  lastName?: string;
  phone: string;
  phoneE164: string;
  telefonoWhatsApp: string;
  bio: string;
  serviceAreas: string[];
  servicios: string[];
  yearsExperience?: number;
  aprobado: false;
  verificado: false;
  nivel: string;
  fotoUrl: string;
  fechaRegistro: string;
  source: string;
  manychatUserId?: string;
  finishedAt?: string;
}

export interface ParsedManyChatRow {
  rowIndex: number;
  lead: ManyChatLeadRecord;
  status: 'valid' | 'duplicate' | 'invalid_phone' | 'invalid_name';
  statusReason?: string;
  raw: Record<string, string>;
}

export interface ManyChatParseResult {
  mappings: HeaderMapping[];
  detectedFields: CanonicalField[];
  rows: ParsedManyChatRow[];
  stats: {
    total: number;
    valid: number;
    duplicate: number;
    invalid: number;
  };
  delimiter: string;
  error?: string;
}

/**
 * 1. REGLAS DE NORMALIZACIÓN DE ENCABEZADOS
 * - Convertir a minúsculas.
 * - Eliminar saltos de línea (\n, \r), tabulaciones y espacios dobles.
 * - Remover emojis y caracteres especiales.
 * - Normalizar acentos y tildes (normalize("NFD").replace(/[\u0300-\u036f]/g, "")).
 */
export function normalizeHeader(raw: string): string {
  if (!raw) return '';
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Elimina acentos y diacríticos
    .replace(/[\r\n\t]+/g, ' ') // Saltos de línea y tabs a espacios
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}]/gu, ' ') // Emojis y símbolos
    .replace(/[^a-z0-9]+/g, ' ') // Solo caracteres alfanuméricos
    .replace(/\s+/g, ' ') // Colapsar dobles espacios
    .trim();
}

/**
 * 2. DICCIONARIO DE PATRONES DE DETECCIÓN (Fuzzy / Pattern Matching)
 * Mapea cada propiedad canónica buscando palabras clave dentro del encabezado normalizado.
 * Ordenado por especificidad decreciente para evitar colisiones.
 */
interface PatternRule {
  field: CanonicalField;
  patterns: string[];
}

const CANONICAL_RULES: PatternRule[] = [
  // Zonas de traslado / cobertura (evaluado antes de ciudad para evitar que "ciudades" en "a que zonas o ciudades puedes trasladarte" active ciudad)
  {
    field: 'zonas',
    patterns: [
      'zonas municipios o ciudades',
      'zonas municipios y ciudades',
      'puedes trasladarte',
      'trasladarte',
      'zonas de cobertura',
      'zonas de trabajo',
      'cobertura',
      'que zonas',
      'zonas',
    ],
  },
  // Ciudad o Municipio
  {
    field: 'ciudad',
    patterns: [
      'ciudad o municipio',
      'ciudad y municipio',
      'donde trabajas',
      'donde vives',
      'ciudad vives',
      'municipio vives',
      'ciudad',
      'municipio',
      'city',
      'ubicacion',
    ],
  },
  // Servicios Adicionales (evaluado antes de oficio principal)
  {
    field: 'serviciosAdicionales',
    patterns: [
      'servicios adicionales',
      'otros trabajos',
      'otros servicios',
      'que otros trabajos realizas',
      'que otros servicios realizas',
      'servicios que realizas',
      'servicios extras',
      'trabajos adicionales',
      'servicios',
    ],
  },
  // Oficio Principal
  {
    field: 'oficioPrincipal',
    patterns: [
      'oficio principal',
      'trabajo principal',
      'especialidad principal',
      'oficio o especialidad',
      'profesion',
      'trade',
      'oficio',
    ],
  },
  // Años de Experiencia
  {
    field: 'experiencia',
    patterns: [
      'anos de experiencia',
      'years experience',
      'cuantos anos de experiencia',
      'tiempo de experiencia',
      'experiencia en tu oficio',
      'experiencia',
    ],
  },
  // Teléfono / Celular / WhatsApp
  {
    field: 'telefono',
    patterns: [
      'contactar los clientes',
      'contacten los clientes',
      'telefono celular',
      'numero de celular',
      'numero de telefono',
      'celular',
      'movil',
      'phone number',
      'phone',
      'whatsapp',
      'telefono',
    ],
  },
  // Disponibilidad / Horario
  {
    field: 'disponibilidad',
    patterns: [
      'disponibilidad de horario',
      'disponibilidad',
      'horario o dias',
      'horario',
      'dias',
      'availability',
    ],
  },
  // Finished At / Fecha de finalización
  {
    field: 'finishedAt',
    patterns: [
      'finished at',
      'finished',
      'completado',
      'fecha de finalizacion',
      'fecha de registro',
      'fecha',
    ],
  },
  // Apellidos (si viene separado en columnas de ManyChat)
  {
    field: 'apellidos',
    patterns: [
      'last name',
      'lastname',
      'apellidos',
      'apellido',
      'primer apellido',
    ],
  },
  // Nombre
  {
    field: 'nombre',
    patterns: [
      'nombre completo',
      'escribe tu nombre',
      'tu nombre',
      'first name',
      'firstname',
      'nombre de pila',
      'fullname',
      'name',
      'nombre',
    ],
  },
  // ManyChat User Id / Subscriber ID
  {
    field: 'manychatId',
    patterns: [
      'manychat user id',
      'manychat id',
      'subscriber id',
      'user id',
      'user_id',
    ],
  },
];

export function detectCanonicalField(normalizedHeader: string): { field: CanonicalField; pattern: string } | null {
  if (!normalizedHeader) return null;

  // Exact check for isolated 'id'
  if (normalizedHeader === 'id' || normalizedHeader === 'userid') {
    return { field: 'manychatId', pattern: normalizedHeader };
  }

  // Check explicit discard patterns
  const IGNORE_EXACT = ['user', 'status', 'gender', 'avatar', 'live chat', 'bot'];
  if (IGNORE_EXACT.includes(normalizedHeader)) {
    return null;
  }

  // Iterate rules by precedence
  for (const rule of CANONICAL_RULES) {
    for (const pattern of rule.patterns) {
      if (normalizedHeader.includes(pattern)) {
        return { field: rule.field, pattern };
      }
    }
  }

  return null;
}

/**
 * Sanitización de teléfono:
 * - Limpia formato, espacios, guiones.
 * - Detecta y convierte notación científica de hojas de cálculo (ej. 2.638482e+09).
 * - Extrae los 10 dígitos nacionales mexicanos.
 */
export function sanitizeManyChatPhone(raw: any): {
  digitsOnly: string;
  national10: string;
  e164: string;
  isValid: boolean;
} {
  if (raw === undefined || raw === null) {
    return { digitsOnly: '', national10: '', e164: '', isValid: false };
  }

  let str = String(raw).trim();

  // Detectar y resolver notación científica (ej. 2.638482e+09 o 4.421234567e+09)
  if (/^[+-]?\d+(?:\.\d+)?[eE][+-]?\d+$/.test(str)) {
    const num = Number(str);
    if (!isNaN(num) && isFinite(num)) {
      try {
        str = BigInt(Math.round(num)).toString();
      } catch {
        str = Math.round(num).toString();
      }
    }
  }

  // Extraer exclusivamente dígitos numéricos
  const digitsOnly = str.replace(/\D/g, '');

  if (!digitsOnly || digitsOnly.length < 10) {
    return { digitsOnly, national10: digitsOnly, e164: '', isValid: false };
  }

  // Para México: tomar los últimos 10 dígitos como número nacional
  const national10 = digitsOnly.slice(-10);
  const e164 = `+52${national10}`;

  return {
    digitsOnly,
    national10,
    e164,
    isValid: national10.length === 10,
  };
}

/**
 * Robust RFC-4180 CSV parser:
 * - Soporta saltos de línea (\n, \r\n) dentro de comillas sin romper filas.
 * - Soporta comillas escapadas ("").
 * - Auto-detecta delimitador: coma (,), punto y coma (;), o tab (\t).
 * - Limpia BOM (\uFEFF) de archivos exportados por Excel.
 */
export function parseCSVToRows(text: string): { rows: string[][]; delimiter: string } {
  if (!text) return { rows: [], delimiter: ',' };

  // Eliminar BOM de UTF-8
  const clean = text.replace(/^\uFEFF/, '');

  // Auto-detectar delimitador en la primera fila no vacía
  const firstLine = clean.split(/\r?\n/)[0] || '';
  let delimiter = ',';
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;

  if (tabCount > commaCount && tabCount > semicolonCount) {
    delimiter = '\t';
  } else if (semicolonCount > commaCount) {
    delimiter = ';';
  }

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const nextChar = clean[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        i++; // Saltar comilla escapada
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // Saltar CRLF
      }
      currentRow.push(currentCell.trim());
      currentCell = '';
      if (currentRow.some((c) => c.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentCell += char;
    }
  }

  // Empujar última celda y fila
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  return { rows, delimiter };
}

/**
 * Función principal de procesamiento de CSV de ManyChat.
 * Ejecuta normalización, mapeo difuso, sanitización, deduplicación e idempotencia.
 */
export function parseManyChatCSV(
  csvContent: string,
  options?: { existingMaestros?: Maestro[] }
): ManyChatParseResult {
  const { rows, delimiter } = parseCSVToRows(csvContent);

  if (rows.length < 2) {
    return {
      mappings: [],
      detectedFields: [],
      rows: [],
      stats: { total: 0, valid: 0, duplicate: 0, invalid: 0 },
      delimiter,
      error: 'El archivo o texto CSV debe contener una fila de encabezados y al menos una fila de datos.',
    };
  }

  // 1. Mapeo y normalización de encabezados
  const rawHeaders = rows[0];
  const mappings: HeaderMapping[] = rawHeaders.map((rawHeader, colIndex) => {
    const normalizedHeader = normalizeHeader(rawHeader);
    const match = detectCanonicalField(normalizedHeader);
    return {
      colIndex,
      rawHeader,
      normalizedHeader,
      canonicalField: match?.field || null,
      matchedPattern: match?.pattern,
    };
  });

  const detectedFields = Array.from(
    new Set(mappings.map((m) => m.canonicalField).filter(Boolean) as CanonicalField[])
  );

  const hasName = detectedFields.includes('nombre');
  const hasPhone = detectedFields.includes('telefono');

  if (!hasName && !hasPhone) {
    return {
      mappings,
      detectedFields,
      rows: [],
      stats: { total: 0, valid: 0, duplicate: 0, invalid: 0 },
      delimiter,
      error: 'No se detectaron columnas de Nombre o Teléfono/Celular en los encabezados del CSV. Verifica los encabezados.',
    };
  }

  const existingPhones = new Set<string>();
  const existingIds = new Set<string>();
  if (options?.existingMaestros) {
    for (const m of options.existingMaestros) {
      if (m.id) existingIds.add(m.id);
      const digits = (m.telefono || m.telefonoWhatsApp || m.phone || '').replace(/\D/g, '').slice(-10);
      if (digits) existingPhones.add(digits);
    }
  }

  const seenPhonesInCsv = new Set<string>();
  const parsedRows: ParsedManyChatRow[] = [];
  const nowIso = new Date().toISOString();

  // 2. Procesamiento de filas
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.length === 0 || row.every((c) => !c)) continue;

    const rowValues: Partial<Record<CanonicalField, string>> = {};
    const rawRowMap: Record<string, string> = {};

    mappings.forEach((m) => {
      const cellVal = row[m.colIndex] !== undefined ? row[m.colIndex].trim() : '';
      rawRowMap[m.rawHeader || `col_${m.colIndex}`] = cellVal;
      if (m.canonicalField && cellVal) {
        // En caso de múltiples columnas para el mismo campo, priorizamos el primer valor no vacío
        if (!rowValues[m.canonicalField]) {
          rowValues[m.canonicalField] = cellVal;
        }
      }
    });

    // Regla de split para nombre y apellidos
    let rawNombre = (rowValues.nombre || '').trim();
    let rawApellidos = (rowValues.apellidos || '').trim();
    let cleanFirstName = '';
    let cleanLastName = '';
    let consolidatedNombre = '';

    if (rawApellidos) {
      cleanFirstName = rawNombre;
      cleanLastName = rawApellidos;
      consolidatedNombre = `${cleanFirstName} ${cleanLastName}`.trim();
    } else if (rawNombre) {
      const parts = rawNombre.split(/\s+/);
      cleanFirstName = parts[0] || '';
      cleanLastName = parts.slice(1).join(' ');
      consolidatedNombre = rawNombre;
    } else {
      consolidatedNombre = '';
      cleanFirstName = '';
    }

    // Sanitización de teléfono
    const phoneSanitized = sanitizeManyChatPhone(rowValues.telefono);

    // Campos restantes
    const oficioPrincipal = (rowValues.oficioPrincipal || '').trim() || 'Mantenimiento general';
    const serviciosAdicionales = (rowValues.serviciosAdicionales || '').trim();
    const ciudad = (rowValues.ciudad || '').trim() || 'Querétaro';
    const zonas = (rowValues.zonas || '').trim() || ciudad;
    const experiencia = (rowValues.experiencia || '').trim();
    const disponibilidad = (rowValues.disponibilidad || '').trim();
    const finishedAt = (rowValues.finishedAt || '').trim();
    const manychatId = (rowValues.manychatId || '').trim();

    // ID Determinista para Idempotencia:
    // Si viene ID de ManyChat: mc_${manychatId}
    // Si no: mc_${telefonoLimpio}
    const docId = manychatId
      ? `mc_${manychatId.replace(/[^a-zA-Z0-9_-]/g, '')}`
      : (phoneSanitized.national10 ? `mc_${phoneSanitized.national10}` : `mc_row_${r}`);

    // Validación de estado de la fila
    let status: 'valid' | 'duplicate' | 'invalid_phone' | 'invalid_name' = 'valid';
    let statusReason = '';

    if (!consolidatedNombre) {
      status = 'invalid_name';
      statusReason = 'Nombre no especificado';
    } else if (!phoneSanitized.isValid) {
      status = 'invalid_phone';
      statusReason = 'Teléfono no contiene 10 dígitos numéricos válidos';
    } else if (seenPhonesInCsv.has(phoneSanitized.national10)) {
      status = 'duplicate';
      statusReason = 'Número telefónico duplicado dentro del mismo CSV';
    } else if (existingPhones.has(phoneSanitized.national10) || existingIds.has(docId)) {
      status = 'duplicate';
      statusReason = 'Ya registrado previamente en la plataforma';
    }

    if (status === 'valid') {
      seenPhonesInCsv.add(phoneSanitized.national10);
    }

    const lead: ManyChatLeadRecord = {
      // Contrato estricto requerido
      nombre: consolidatedNombre || `Maestro #${r}`,
      ...(cleanLastName ? { apellidos: cleanLastName } : {}),
      oficioPrincipal,
      serviciosAdicionales,
      ciudad,
      zonas,
      experiencia,
      telefono: phoneSanitized.national10,
      whatsapp: phoneSanitized.national10, // Inicializar por defecto con el mismo teléfono sanitizado
      disponibilidad,
      status: 'draft',
      onboardingIncomplete: true,
      registrationMethod: 'manychat_csv',
      createdAt: nowIso,

      // Campos de compatibilidad y schema unificado de Maestro
      id: docId,
      userId: docId,
      slug: `mc-${phoneSanitized.national10 || r}`,
      oficio: oficioPrincipal,
      mainTrade: oficioPrincipal,
      firstName: cleanFirstName,
      lastName: cleanLastName || undefined,
      phone: phoneSanitized.national10,
      phoneE164: phoneSanitized.e164,
      telefonoWhatsApp: phoneSanitized.national10,
      bio: serviciosAdicionales
        ? `${oficioPrincipal} en ${ciudad}. ${serviciosAdicionales}`
        : `Especialista en ${oficioPrincipal} registrado vía ManyChat.`,
      serviceAreas: zonas ? zonas.split(/[,;\n/]+/).map((s) => s.trim()).filter(Boolean) : [ciudad],
      servicios: serviciosAdicionales ? serviciosAdicionales.split(/[,;\n/]+/).map((s) => s.trim()).filter(Boolean) : [],
      yearsExperience: !isNaN(Number(experiencia)) && Number(experiencia) > 0 ? Number(experiencia) : undefined,
      aprobado: false,
      verificado: false,
      nivel: 'Aspirante',
      fotoUrl: '',
      fechaRegistro: nowIso,
      source: 'manychat',
      manychatUserId: manychatId || undefined,
      finishedAt: finishedAt || undefined,
    };

    parsedRows.push({
      rowIndex: r,
      lead,
      status,
      statusReason,
      raw: rawRowMap,
    });
  }

  const valid = parsedRows.filter((r) => r.status === 'valid').length;
  const duplicate = parsedRows.filter((r) => r.status === 'duplicate').length;
  const invalid = parsedRows.filter((r) => r.status === 'invalid_phone' || r.status === 'invalid_name').length;

  return {
    mappings,
    detectedFields,
    rows: parsedRows,
    stats: {
      total: parsedRows.length,
      valid,
      duplicate,
      invalid,
    },
    delimiter,
  };
}
