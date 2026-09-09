export type VerificationStatus = 'registered' | 'verified';

export interface WorkPhoto {
  id: string;
  url: string;
  title: string;
  description?: string;
  trade?: string;
}

export interface VerificationRequest {
  requestedAt: string;
  idDocName?: string;
  idDocStoragePath?: string;
  proofAddressStoragePath?: string;
  referencesText?: string;
  notes?: string;
  status: 'pending' | 'approved' | 'rejected';
}

/**
 * Core Maestro entity as specified for production Firestore:
 * Collections needed: `maestros`
 * Fields: { id, nombre, oficio, bio, calificacion, radioKm, lat, lng, fotoUrl, telefonoWhatsApp, nivel, verificado, aprobado, fechaRegistro, ... }
 */
export interface Maestro {
  id: string;
  nombre: string;
  oficio: string;
  bio: string;
  calificacion: number;
  radioKm: number;
  lat: number;
  lng: number;
  fotoUrl: string;
  telefonoWhatsApp: string;
  nivel: 'Master' | 'Oficial' | 'Especialista' | string;
  verificado: boolean;
  aprobado: boolean;
  fechaRegistro: string;
  tieneVerificacionPendiente?: boolean;
  fechaSubidaDoc?: string;

  // Additional optional and relational properties for UI richness & compatibility
  userId?: string;
  slug?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  profilePhoto?: string;
  mainTrade?: string;
  secondaryTrades?: string[];
  services?: string[];
  description?: string;
  yearsExperience?: number;
  serviceAreas?: string[];
  workPhotos?: WorkPhoto[];
  verificationStatus?: VerificationStatus;
  phoneVerified?: boolean;
  identityVerified?: boolean;
  referencesVerified?: boolean;
  photosReviewed?: boolean;
  profileActive?: boolean;
  joinedDate?: string;
  privacyNoticeAccepted?: boolean;
  privacyNoticeAcceptedAt?: string;
  privacyNoticeVersion?: string;
  verificationRequest?: VerificationRequest;
  createdAt?: string;
  updatedAt?: string;
}

// Worker type is synonymous with Maestro for seamless UI compatibility
export type Worker = Maestro;

/**
 * Lead and Contact Analytics Entity:
 * Collection: `solicitudes_contacto`
 * Schema: { id, maestroId, fecha, origen: "zibata_web" }
 */
export interface SolicitudContacto {
  id: string;
  maestroId: string;
  fecha: string;
  origen: 'zibata_web';
  maestroNombre?: string;
  oficio?: string;
  telefono?: string;
  tipo?: 'whatsapp' | 'phone';
}

export interface Trade {
  id: string;
  name: string;
  slug: string;
  iconName: string;
  description: string;
  popular: boolean;
  active: boolean;
}

export interface ServiceArea {
  id: string;
  name: string;
  municipality: string;
  state: string;
  active: boolean;
}

export type ContactEventType = 'whatsapp' | 'phone' | 'profileView';

export interface ContactEvent {
  id: string;
  workerId: string;
  workerName: string;
  type: ContactEventType;
  trade: string;
  area: string;
  timestamp: string;
}

export interface AnalyticsCounts {
  visitas_home: number;
  busqueda_realizada: number;
  oficio_buscado: Record<string, number>;
  zona_buscada: Record<string, number>;
  perfil_visualizado: number;
  whatsapp_click: number;
  telefono_click: number;
  registro_trabajador_iniciado: number;
  registro_trabajador_completado: number;
  fotos_subidas: number;
  solicitud_verificacion: number;
}

export type AppView = 
  | { type: 'home' }
  | { type: 'search'; trade?: string; area?: string; verifiedOnly?: boolean }
  | { type: 'profile'; workerSlug: string }
  | { type: 'register'; step?: number }
  | { type: 'login' }
  | { type: 'dashboard'; tab?: 'profile' | 'services' | 'photos' | 'verification' | 'stats' }
  | { type: 'admin'; tab?: 'maestros' | 'workers' | 'requests' | 'leads' | 'trades' | 'areas' | 'analytics' }
  | { type: 'how-it-works' }
  | { type: 'privacy' }
  | { type: 'terms' };
