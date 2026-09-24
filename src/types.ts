export type VerificationStatus = 'registered' | 'verified';
export type ProfileStatus = 'Pendiente' | 'Aprobado' | 'Activo';

export interface AdminAuthMethodInfo {
  uid: string;
  providerIds: string[];
  hasPhone: boolean;
  hasFacebook: boolean;
}

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
// Default fallback avatar URL for workers without custom approved photo
export const DEFAULT_AVATAR_URL = '/images/default-avatar.png';

/**
 * Returns the valid photo URL for a worker, strictly adhering to the public moderation rules:
 * - If profilePhotoReviewStatus is NOT 'approved', it returns the generic default worker avatar image.
 * - Authenticated owners/admins can pass allowPendingPreview: true with an in-memory/authenticated previewUrl.
 */
export const getWorkerAvatarSrc = (
  worker?: { 
    photoUrl?: string | null; 
    fotoUrl?: string | null; 
    profilePhoto?: string | null;
    profilePhotoReviewStatus?: 'none' | 'pending' | 'approved' | 'rejected' | string;
    verificado?: boolean;
    aprobado?: boolean;
  } | null,
  options?: { allowPendingPreview?: boolean; previewUrl?: string | null }
): string => {
  if (!worker) return DEFAULT_AVATAR_URL;
  if (options?.allowPendingPreview && options?.previewUrl) {
    return options.previewUrl;
  }
  // Public privacy rule: ONLY display real photo if officially approved by admin
  if (worker.profilePhotoReviewStatus !== 'approved') {
    return DEFAULT_AVATAR_URL;
  }
  const raw = worker.profilePhoto?.trim() || worker.fotoUrl?.trim() || worker.photoUrl?.trim();
  return raw || DEFAULT_AVATAR_URL;
};

export interface ProfileReport {
  id: string;
  workerId: string;
  workerSlug?: string;
  workerNameSnapshot?: string;
  workerTradeSnapshot?: string;
  reason: string;
  status: 'pending' | 'reviewed' | 'dismissed' | 'resolved';
  createdAt: string;
  adminNotes?: string;
}

export interface Maestro {
  id: string;
  nombre: string;
  oficio: string;
  bio: string;
  calificacion?: number;
  radioKm?: number;
  lat?: number | null;
  lng?: number | null;
  fotoUrl: string;
  telefonoWhatsApp: string;
  nivel: 'Aspirante' | 'Master' | 'Oficial' | 'Especialista' | string;
  verificado: boolean;
  aprobado: boolean;
  statusPerfil?: ProfileStatus;
  verifiedAt?: string;
  verifiedBy?: string;
  fechaRegistro: string;
  tieneVerificacionPendiente?: boolean;
  fechaSubidaDoc?: string;
  origen?: string;
  isDemoAccount?: boolean;

  // Additional optional and relational properties for UI richness & compatibility
  userId?: string;
  slug?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  phoneE164?: string;
  whatsapp?: string;
  telefono?: string;
  apellidos?: string;
  oficioPrincipal?: string;
  serviciosAdicionales?: string;
  ciudad?: string;
  zonas?: string;
  experiencia?: string;
  finishedAt?: string;
  manychatId?: string;
  registrationMethod?: 'phone' | 'facebook' | 'manychat_csv' | string;
  profilePhoto?: string;
  photoUrl?: string;
  profilePhotoReviewStatus?: 'none' | 'pending' | 'approved' | 'rejected' | string;
  pendingProfilePhotoPath?: string | null;
  profilePhotoReviewedAt?: string;
  mainTrade?: string;
  secondaryTrades?: string[];
  services?: string[];
  description?: string;
  yearsExperience?: number;
  serviceAreas?: string[];
  workPhotos?: WorkPhoto[];
  fotosTrabajos?: string[];
  verificationStatus?: VerificationStatus;
  phoneVerified?: boolean;
  phoneVerifiedAt?: string;
  phoneVerificationMethod?: 'sms' | string;
  identityVerified?: boolean;
  referencesVerified?: boolean;
  photosReviewed?: boolean;
  /** @deprecated Legacy field. Do NOT use as source of truth. Use `aprobado`, `statusPerfil`, and `isAvailable`. */
  profileActive?: boolean;
  isAvailable?: boolean;
  joinedDate?: string;
  privacyNoticeAccepted?: boolean;
  privacyNoticeAcceptedAt?: string;
  privacyNoticeVersion?: string;
  termsAccepted?: boolean;
  termsAcceptedAt?: string;
  termsVersion?: string;
  status?: 'draft' | 'registered' | 'active' | 'suspended' | string;
  onboardingIncomplete?: boolean;
  authProviders?: string[];
  verificationRequest?: VerificationRequest;
  source?: 'web' | 'manychat' | string;
  claimedFromPreWorkerId?: string;
  claimedAt?: string;
  disponibilidad?: string;
  telefonoPublico?: string;
  createdAt?: string;
  updatedAt?: string;
  /** Public vanity counter: how many times visitors tapped WhatsApp/phone on this profile. */
  contactCount?: number;
}

// Worker type is synonymous with Maestro for seamless UI compatibility
export type Worker = Maestro;

export interface PreWorker {
  id: string;
  phoneNumber: string; // E.164 +52XXXXXXXXXX
  phone: string; // 10 digits
  whatsappPhone: string;
  nombre: string;
  firstName?: string;
  lastName?: string;
  ciudad?: string;
  serviceAreas?: string[];
  oficio: string;
  mainTrade?: string;
  servicios?: string[];
  yearsExperience?: number;
  disponibilidad?: string;
  telefonoPublico?: string;
  profilePhoto?: string;
  fotoUrl?: string;
  workPhotos?: WorkPhoto[];
  fotosTrabajos?: string[];
  manychatUserId?: string;
  manyChatUserId?: string;
  oficio_principal?: string;
  servicios_adicionales?: string;
  ciudad_principal?: string;
  zonas_cobertura?: string;
  experiencia?: string;
  estadoRegistro?: string;
  privacyNoticeAccepted?: boolean;
  privacyNoticeAcceptedAt?: string;
  privacyNoticeVersion?: string;
  source: 'manychat';
  status: 'pending_claim' | 'claimed';
  profileType: 'registered';
  verificado: boolean;
  claimedByUid?: string | null;
  claimedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Lead and Contact Analytics Entity:
 * Collection: `solicitudes_contacto`
 * Schema: { id, maestroId, fecha, timestamp, origen: "maestro_cerca_web" }
 */
export interface SolicitudContacto {
  id: string;
  maestroId: string;
  fecha: string;
  timestamp?: string;
  origen: 'maestro_cerca_web' | 'zibata_web' | string;
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
  | { type: 'dashboard'; tab?: 'profile' | 'photos' | 'stats' }
  | { type: 'admin'; tab?: 'maestros' | 'workers' | 'requests' | 'leads' | 'trades' | 'areas' | 'analytics' | 'import' }
  | { type: 'how-it-works' }
  | { type: 'privacy' }
  | { type: 'terms' };

/**
 * Canonical helper for public profile visibility.
 * Returns true if and only if:
 * - Profile exists
 * - Status (statusPerfil or aprobado) is approved
 * - isAvailable !== false (defaults to true if undefined)
 * - onboardingIncomplete !== true
 * - status !== 'draft'
 */
export function isPubliclyVisible(worker: Maestro | Worker | null | undefined): boolean {
  if (!worker) return false;
  const isApproved =
    worker.statusPerfil === 'Aprobado' ||
    worker.statusPerfil === 'Activo' ||
    worker.aprobado === true;
  if (!isApproved) return false;

  const hasVerifiedPhone =
    worker.phoneVerified === true &&
    (worker.phoneVerifiedAt != null ||
      worker.phoneVerificationMethod === 'firebase_sms' ||
      worker.phoneVerificationMethod === 'sms');
  if (!hasVerifiedPhone) return false;

  if (worker.isAvailable === false) return false;
  if (worker.onboardingIncomplete === true) return false;
  if (worker.status === 'draft') return false;
  return true;
}

