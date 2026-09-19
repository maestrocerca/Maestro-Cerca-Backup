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
  FacebookAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  linkWithPopup,
  linkWithCredential,
  PhoneAuthProvider,
  deleteUser,
  getAdditionalUserInfo
} from 'firebase/auth';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  limit,
  arrayUnion,
  arrayRemove,
  writeBatch
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
  ProfileStatus,
  AdminAuthMethodInfo,
  WorkPhoto, 
  VerificationRequest,
  ProfileReport 
} from '../types';
import { 
  INITIAL_TRADES, 
  INITIAL_SERVICE_AREAS 
} from '../data/seedData';

const DEFAULT_ANALYTICS: AnalyticsCounts = {
  visitas_home: 0,
  busqueda_realizada: 0,
  oficio_buscado: {},
  zona_buscada: {},
  perfil_visualizado: 0,
  whatsapp_click: 0,
  telefono_click: 0,
  registro_trabajador_iniciado: 0,
  registro_trabajador_completado: 0,
  fotos_subidas: 0,
  solicitud_verificacion: 0,
};
import { sanitizeMexicanPhone, buildWhatsAppUrl } from '../lib/whatsapp';
import { sanitizeText, sanitizeRecord, checkRateLimit, removeUndefinedFields } from '../lib/sanitize';
import { calculateHaversineDistance, distanceFromZibata, coversZibata } from '../lib/geo';
import { DESIGNATED_ADMIN_EMAILS, isAdminEmail, isUserAdmin } from '../config/admins';
import { AUTO_APPROVE_PROFILE_PHOTOS } from '../config/featureFlags';

// Re-export centralized admin governance for backward compatibility
export { DESIGNATED_ADMIN_EMAILS, isAdminEmail, isUserAdmin };

// Helper to sanitize worker avatar and image URLs
const sanitizeWorkerImages = (m: Maestro): Maestro => {
  let fotoUrl = m.fotoUrl?.trim() || '';
  let profilePhoto = m.profilePhoto?.trim() || '';
  let photoUrl = m.photoUrl?.trim() || '';

  // Clean out legacy broken external URLs
  if (fotoUrl.includes('1541888946425-d0fbb18086f6')) {
    fotoUrl = '';
  }
  if (profilePhoto.includes('1541888946425-d0fbb18086f6')) {
    profilePhoto = '';
  }
  if (photoUrl.includes('1541888946425-d0fbb18086f6')) {
    photoUrl = '';
  }

  const cleanResolvedPhoto = photoUrl || profilePhoto || fotoUrl || '';

  return {
    ...m,
    fotoUrl: cleanResolvedPhoto,
    profilePhoto: cleanResolvedPhoto,
    photoUrl: cleanResolvedPhoto,
  };
};

// Helper to format Mexican 10-digit phone to international E.164 (+52XXXXXXXXXX)
export const formatMexicanPhoneToE164 = (rawPhone: string): string => {
  return sanitizeMexicanPhone(rawPhone).e164WithPlus;
};

// Helper to extract clean 10-digit format for display
export const formatPhoneForDisplay = (phone: string): string => {
  return sanitizeMexicanPhone(phone).displayFormat;
};

// Unique slug generator that calls backend endpoint using Admin SDK with robust client fallback
export const generateUniqueWorkerSlug = async (fullName: string): Promise<string> => {
  const base =
    fullName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'maestro';

  try {
    const res = await fetch('/api/auth/generate-slug', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: fullName }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.success && typeof data?.slug === 'string' && data.slug.trim()) {
        return data.slug.trim();
      }
    }
  } catch (err) {
    console.warn('[Slug Generation] Backend endpoint failed, using client fallback:', err);
  }

  // Safe fallback if backend endpoint fails or network error occurs
  const randomSuffix = Math.random().toString(36).substring(2, 6);
  return `${base}-${randomSuffix}`;
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
  isCatalogLoading: boolean;
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
  
  // Onboarding & Registration State
  isWorkerRegistrationActive: boolean;
  setIsWorkerRegistrationActive: (active: boolean) => void;
  cancelWorkerRegistration: () => Promise<boolean>;

  // Worker & Admin Login
  loginAdmin: (email: string, password: string) => Promise<AuthResponse>;
  loginAdminWithGoogle: () => Promise<AuthResponse>;
  loginWorker: (email: string, password: string) => Promise<AuthResponse>; // alias for admin login
  loginWorkerWithFacebook: () => Promise<{ success: boolean; hasExistingProfile?: boolean; worker?: Worker; error?: string }>;
  registerWorkerWithFacebook: () => Promise<{ success: boolean; hasExistingProfile?: boolean; worker?: Worker; error?: string }>;
  loginWorkerAsDemo: () => void;
  isDemoMode: boolean;
  workerProfileCompleted: boolean;

  // Account Linking (Multi-provider to single Firebase UID)
  linkFacebookAccount: () => Promise<{ success: boolean; error?: string }>;
  sendPhoneLinkVerificationCode: (
    phoneNumberE164: string,
    containerId: string
  ) => Promise<{ success: boolean; confirmationResult?: ConfirmationResult; error?: string }>;
  confirmPhoneLinkCode: (
    confirmationResult: ConfirmationResult,
    verificationCode: string
  ) => Promise<{ success: boolean; error?: string }>;
  
  logoutWorker: () => Promise<void>;
  deleteWorkerAccount: (workerId?: string) => Promise<{ success: boolean; error?: string }>;
  updateWorkerProfile: (workerId: string, updates: Partial<Worker>) => Promise<{ success: boolean; error?: string }>;
  setWorkerAvailability: (workerId: string, isAvailable: boolean) => Promise<{ success: boolean; error?: string }>;
  submitVerificationRequest: (workerId: string, req: Omit<VerificationRequest, 'status' | 'requestedAt'>) => Promise<{ success: boolean; error?: string }>;
  addWorkerPhoto: (workerId: string, photo: Omit<WorkPhoto, 'id'>) => Promise<void>;
  addWorkerPhotosBatch: (workerId: string, photos: Array<{ url: string; title: string }>) => Promise<void>;
  removeWorkerPhoto: (workerId: string, photoId: string) => Promise<void>;
  removeWorkerPhotoByUrl: (workerId: string, photoUrl: string) => Promise<void>;

  // Flash Notifications / Toast
  toastMessage: string | null;
  showToast: (msg: string) => void;
  clearToast: () => void;

  // Contact & Tracking (Client-side, friction-free for visitors)
  contactarWhatsApp: (maestro: Maestro, customNote?: string) => Promise<void>;
  logContactClick: (worker: Worker, type: 'whatsapp' | 'phone') => void;
  logProfileView: (worker: Worker) => void;
  trackSearch: (trade?: string, area?: string) => void;
  trackGenericEvent: (eventName: keyof AnalyticsCounts, detailKey?: string) => void;
  
  // Admin Operations (Requires admin privileges)
  adminApproveMaestro: (maestroId: string, aprobado: boolean) => Promise<{ success: boolean; error?: string }>;
  adminSetProfileStatus: (maestroId: string, status: ProfileStatus) => Promise<{ success: boolean; error?: string }>;
  adminFetchAuthMethods: (uids: string[]) => Promise<Record<string, AdminAuthMethodInfo>>;
  adminUpdateMaestroTier: (maestroId: string, nivel: string) => Promise<void>;
  importManyChatLeads: (leads: Array<Partial<Maestro>>) => Promise<{ imported: number; skipped: number; errors: number }>;
  adminVerifyMaestro: (
    maestroId: string, 
    verificado: boolean, 
    checks?: { 
      identityVerified?: boolean; 
      referencesVerified?: boolean; 
      photosReviewed?: boolean; 
    }
  ) => Promise<void>;
  adminSetVerificationStatus: (
    workerId: string, 
    status: VerificationStatus, 
    checks?: { 
      identityVerified?: boolean; 
      referencesVerified?: boolean; 
      photosReviewed?: boolean; 
    }
  ) => Promise<void>;
  adminDeleteMaestro: (maestroId: string) => Promise<{ success: boolean; error?: string }>;
  adminAddTrade: (trade: Omit<Trade, 'id'>) => Promise<void>;
  adminUpdateTrade: (tradeId: string, updates: Partial<Trade>) => Promise<void>;
  adminDeleteTrade: (tradeId: string) => Promise<void>;
  adminToggleTrade: (tradeId: string) => Promise<void>;
  adminAddServiceArea: (area: Omit<ServiceArea, 'id'>) => Promise<void>;
  adminUpdateServiceArea: (areaId: string, updates: Partial<ServiceArea>) => Promise<void>;
  adminDeleteServiceArea: (areaId: string) => Promise<void>;
  adminToggleServiceArea: (areaId: string) => Promise<void>;
  fetchPrivateVerificationDossier: (workerId: string) => Promise<any | null>;
  
  // Profile Photo Review & Reports
  submitPendingProfilePhoto: (workerId: string, pendingStoragePath: string) => Promise<{ success: boolean; error?: string }>;
  submitProfileReport: (workerId: string, reason: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  adminReviewProfilePhoto: (workerId: string, action: 'approve' | 'reject', notes?: string) => Promise<{ success: boolean; publicUrl?: string; error?: string }>;
  adminFetchProfileReports: () => Promise<ProfileReport[]>;
  adminUpdateReportStatus: (reportId: string, status: string, adminNotes?: string) => Promise<{ success: boolean; error?: string }>;
  
  // Helpers
  getWorkerBySlug: (slug: string) => Worker | undefined;
  getTradeBySlug: (slug: string) => Trade | undefined;
  calculateProfileCompletion: (worker: Worker) => number;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

// Helper to determine initial view from browser URL path
const getInitialView = (): AppView => {
  if (typeof window !== 'undefined') {
    const path = window.location.pathname;
    const workerMatch = path.match(/^\/trabajador\/([^/?#]+)/i);
    if (workerMatch && workerMatch[1]) {
      return { type: 'profile', workerSlug: decodeURIComponent(workerMatch[1]) };
    }
    const lowerPath = path.toLowerCase();
    if (lowerPath === '/aviso-de-privacidad' || lowerPath === '/aviso-de-privacidad/') {
      return { type: 'privacy' };
    }
    if (lowerPath === '/admin' || lowerPath === '/admin/') {
      return { type: 'admin' };
    }
    // Deep links for the ManyChat/WhatsApp handoff: the chatbot sends the worker
    // straight here to confirm their phone by SMS and finish activating the profile
    // it already collected (see preWorker auto-claim in confirmPhoneVerificationCode).
    if (lowerPath === '/registro' || lowerPath === '/registro/') {
      return { type: 'register' };
    }
    if (lowerPath === '/iniciar-sesion' || lowerPath === '/iniciar-sesion/') {
      return { type: 'login' };
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

  // Registration & Onboarding Lifecycle (Disposable Incomplete Registrations)
  const [isWorkerRegistrationActive, setIsWorkerRegistrationActive] = useState<boolean>(false);
  const [authResolved, setAuthResolved] = useState<boolean>(false);
  const [workerProfileResolved, setWorkerProfileResolved] = useState<boolean>(false);

  // Firestore real-time state with pure production baselines
  const [maestros, setMaestros] = useState<Maestro[]>([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);
  const [trades, setTrades] = useState<Trade[]>(INITIAL_TRADES);
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>(INITIAL_SERVICE_AREAS);
  const [solicitudesContacto, setSolicitudesContacto] = useState<SolicitudContacto[]>([]);
  const [contactEvents, setContactEvents] = useState<ContactEvent[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsCounts>(DEFAULT_ANALYTICS);

  // User token claims (custom claims RBAC)
  const [userClaims, setUserClaims] = useState<{ admin?: boolean; role?: string } | null>(null);

  // Flash Notifications / Toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 4500);
  }, []);
  const clearToast = useCallback(() => {
    setToastMessage(null);
  }, []);

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
          const claims = (tokenRes?.claims as any) || null;
          setUserClaims(claims);
          if (isUserAdmin(user, claims)) {
            setWorkerProfileResolved(true);
          }
        } catch {
          setUserClaims(null);
        }
      } else {
        setUserClaims(null);
        setWorkerProfileResolved(true);
      }
      setIsAuthLoading(false);
      setAuthResolved(true);
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
              // Strict filter: Incomplete drafts or profiles without a trade are NEVER loaded into maestros catalog for public visitors
              if (!isAdmin && (data.onboardingIncomplete || data.status === 'draft' || !data.oficio)) {
                return;
              }
              // For administrator view, profiles must have at least an identifier, name, or phone
              if (isAdmin && !data.nombre && !data.oficio && !data.phone && !data.telefono) {
                return;
              }
              loaded.push(sanitizeWorkerImages({
                ...data,
                id: docSnap.id,
              }));
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
          } else {
            // Never auto-seed fake/demo workers. If collection is empty, state is strictly empty.
            setMaestros([]);
          }
          setIsCatalogLoading(false);
        },
        (error) => {
          setIsCatalogLoading(false);
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
    if (!firebaseUser || isAdmin) {
      if (!firebaseUser) setWorkerProfileResolved(true);
      return;
    }

    setWorkerProfileResolved(false);
    const myDocRef = doc(db, 'maestros', firebaseUser.uid);
    const unsubMyDoc = onSnapshot(
      myDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const myData = { ...(docSnap.data() as Maestro), id: docSnap.id };
          if (!myData.onboardingIncomplete && myData.status !== 'draft' && Boolean(myData.oficio)) {
            setMaestros((prev) => {
              const exists = prev.some((m) => m.id === myData.id);
              if (exists) {
                return prev.map((m) => (m.id === myData.id ? myData : m));
              } else {
                return [...prev, myData];
              }
            });
          }
        }
        setWorkerProfileResolved(true);
      },
      (err) => {
        console.warn('Worker profile private listener note:', err.message);
        setWorkerProfileResolved(true);
      }
    );

    return () => unsubMyDoc();
  }, [firebaseUser, isAdmin]);

  // 3. Real-time Solicitudes de Contacto synchronization from Cloud Firestore (canonical leads & events)
  // Protected: Restricted strictly to authenticated administrators
  useEffect(() => {
    if (!isAdmin) {
      setSolicitudesContacto([]);
      setContactEvents([]);
      return;
    }

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

          // Synthesize ContactEvents for UI analytics without maintaining redundant legacy collections
          const synthesizedEvents: ContactEvent[] = loaded.map((s) => ({
            id: s.id,
            workerId: s.maestroId,
            workerName: s.maestroNombre || 'Maestro',
            type: (s.tipo as any) || 'whatsapp',
            trade: s.oficio || '',
            area: 'Zibatá',
            timestamp: s.fecha || new Date().toISOString(),
          }));
          setContactEvents(synthesizedEvents);
        } else {
          setSolicitudesContacto([]);
          setContactEvents([]);
        }
      },
      (err) => {
        console.warn('Solicitudes de contacto listener note:', err.message);
      }
    );

    return () => unsubscribe();
  }, [isAdmin]);

  // 4. Real-time Trades & Service Areas synchronization from Cloud Firestore
  useEffect(() => {
    const unsubTrades = onSnapshot(
      collection(db, 'trades'),
      (snap) => {
        if (!snap.empty) {
          const loaded: Trade[] = [];
          snap.forEach((d) => loaded.push({ ...(d.data() as Trade), id: d.id }));
          setTrades(loaded);
        }
      },
      (err) => console.warn('Trades listener note:', err.message)
    );

    const unsubAreas = onSnapshot(
      collection(db, 'serviceAreas'),
      (snap) => {
        if (!snap.empty) {
          const loaded: ServiceArea[] = [];
          snap.forEach((d) => loaded.push({ ...(d.data() as ServiceArea), id: d.id }));
          setServiceAreas(loaded);
        }
      },
      (err) => console.warn('Service areas listener note:', err.message)
    );

    return () => {
      unsubTrades();
      unsubAreas();
    };
  }, []);

  // Workers is an alias of maestros for full backward compatibility across views
  const workers = maestros;

  // Compute currently logged-in worker strictly from authenticated Firebase session UID (1 UID = 1 Worker Profile)
  // Administrators are NEVER workers and must NEVER have a worker profile.
  // Incomplete drafts or onboarding in-progress records are NEVER treated as currentWorker.
  const currentWorker = useMemo(() => {
    if (!firebaseUser || isAdmin) return null;
    
    // Exact match by Firebase Auth UID in id or userId - NO email/phone adoption fallbacks allowed
    const found = maestros.find(
      (w) => (w.id === firebaseUser.uid || w.userId === firebaseUser.uid) &&
             !w.onboardingIncomplete &&
             w.status !== 'draft' &&
             Boolean(w.oficio)
    );
    return found || null;
  }, [firebaseUser, maestros, isAdmin]);

  const workerProfileCompleted = Boolean(currentWorker);

  // Demo mode is completely disabled in production
  const isDemoMode = false;

  // Disposable Incomplete Registrations: Cancel & Clean Provisional Onboarding
  const cancelWorkerRegistration = useCallback(async (): Promise<boolean> => {
    setIsWorkerRegistrationActive(false);

    // CRITICAL PROTECTION RULE: NEVER delete or cancel if currentWorker exists!
    if (currentWorker) {
      console.warn('[Onboarding Cancel] Blocked: currentWorker exists, refusing to cancel onboarding.');
      return false;
    }

    const currentUser = auth.currentUser;
    let serverSuccess = false;

    if (currentUser) {
      try {
        const token = await currentUser.getIdToken(true);
        const res = await fetch('/api/onboarding/cancel', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
          serverSuccess = true;
          console.log('[Onboarding Cancel] Provisional onboarding user deleted successfully on backend:', currentUser.uid);
        } else {
          console.warn('[Onboarding Cancel] Backend returned non-success:', res.status, data);
          if (data?.reason === 'completed_profile') {
            return false;
          }
        }
      } catch (netErr) {
        console.warn('[Onboarding Cancel] Network error while calling /api/onboarding/cancel:', netErr);
      }

      // Client cleanup: sign out from Firebase Auth regardless to ensure pristine local state
      try {
        await signOut(auth);
      } catch (soErr) {
        console.warn('[Onboarding Cancel] signOut warning:', soErr);
      }
    }

    // Clean any onboarding-related session or local storage
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem('onboarding_step');
        sessionStorage.removeItem('onboarding_worker_data');
        localStorage.removeItem('onboarding_step');
        localStorage.removeItem('onboarding_worker_data');
      } catch {}
    }

    setFirebaseUser(null);
    setCurrentView({ type: 'home' });
    return serverSuccess;
  }, [currentWorker]);

  // Refresh Watchdog: Detect and clean abandoned provisional onboarding sessions
  const [isCleaningAbandoned, setIsCleaningAbandoned] = useState(false);

  useEffect(() => {
    if (!authResolved || !workerProfileResolved) return;
    if (isAdmin) return;
    if (isWorkerRegistrationActive) return;
    if (isCleaningAbandoned) return;

    if (firebaseUser && !currentWorker) {
      let isCancelled = false;
      const verifyAndClean = async () => {
        setIsCleaningAbandoned(true);
        try {
          const docRef = doc(db, 'maestros', firebaseUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data() as Maestro;
            if (!data.onboardingIncomplete && data.status !== 'draft' && Boolean(data.oficio)) {
              console.log('[Onboarding Watchdog] Completed profile found in direct Firestore check. Keeping user session.');
              setIsCleaningAbandoned(false);
              return;
            }
          }

          if (isCancelled) return;
          console.log('[Onboarding Watchdog] Detected abandoned provisional user on refresh:', firebaseUser.uid);
          await cancelWorkerRegistration();
        } catch (err) {
          console.warn('[Onboarding Watchdog] Error checking or canceling abandoned user:', err);
        } finally {
          if (!isCancelled) {
            setIsCleaningAbandoned(false);
          }
        }
      };

      verifyAndClean();
      return () => {
        isCancelled = true;
      };
    }
  }, [authResolved, workerProfileResolved, firebaseUser, currentWorker, isAdmin, isWorkerRegistrationActive, isCleaningAbandoned, cancelWorkerRegistration]);

  const navigateTo = useCallback((view: AppView) => {
    // Top Priority: Administrators are NEVER routed to worker onboarding, login or dashboard
    if (isAdmin && (view.type === 'register' || view.type === 'login' || view.type === 'dashboard')) {
      setCurrentView({ type: 'admin' });
      if (typeof window !== 'undefined' && window.location.pathname.toLowerCase() !== '/admin') {
        window.history.pushState({ view: { type: 'admin' } }, '', '/admin');
      }
      return;
    }

    // Navigation Guard for Active Worker Registration:
    // If user is actively registering and navigates away (e.g. clicks logo, home, search, etc.),
    // automatically cancel the provisional onboarding session before switching views.
    if (isWorkerRegistrationActive && view.type !== 'register') {
      cancelWorkerRegistration().then(() => {
        setCurrentView(view);
      }).catch((e) => {
        console.warn('[Onboarding Nav Guard] Cancel error:', e);
        setCurrentView(view);
      });
      return;
    }

    if (view.type === 'register') {
      setIsWorkerRegistrationActive(true);
    }

    // Worker Profile Completion Guard:
    // If user is authenticated with Firebase but has NOT completed their Maestro profile,
    // they MUST NOT enter the worker dashboard!
    if (!isAdmin && firebaseUser && !currentWorker && view.type === 'dashboard') {
      setCurrentView({ type: 'home' });
      if (typeof window !== 'undefined') {
        window.history.pushState({ view: { type: 'home' } }, '', '/');
      }
      return;
    }

    setCurrentView(view);
    if (typeof window !== 'undefined') {
      if (view.type === 'profile') {
        const canonicalPath = `/trabajador/${encodeURIComponent(view.workerSlug)}`;
        if (window.location.pathname !== canonicalPath) {
          window.history.pushState({ view }, '', canonicalPath);
        }
      } else if (view.type === 'privacy') {
        if (window.location.pathname.toLowerCase() !== '/aviso-de-privacidad') {
          window.history.pushState({ view }, '', '/aviso-de-privacidad');
        }
      } else if (view.type === 'admin') {
        if (window.location.pathname.toLowerCase() !== '/admin') {
          window.history.pushState({ view }, '', '/admin');
        }
      } else if (view.type === 'register') {
        if (window.location.pathname.toLowerCase() !== '/registro') {
          window.history.pushState({ view }, '', '/registro');
        }
      } else if (view.type === 'login') {
        if (window.location.pathname.toLowerCase() !== '/iniciar-sesion') {
          window.history.pushState({ view }, '', '/iniciar-sesion');
        }
      } else {
        if (window.location.pathname !== '/') {
          window.history.pushState({ view }, '', '/');
        }
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [isAdmin, isWorkerRegistrationActive, firebaseUser, currentWorker, cancelWorkerRegistration]);

  // Sync browser popstate (back/forward buttons) with currentView
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (isWorkerRegistrationActive) {
        cancelWorkerRegistration().catch((e) => console.warn('[Onboarding PopState] Cancel error:', e));
      }
      if (event.state?.view) {
        setCurrentView(event.state.view);
        return;
      }
      const path = window.location.pathname;
      const workerMatch = path.match(/^\/trabajador\/([^/?#]+)/i);
      if (workerMatch && workerMatch[1]) {
        setCurrentView({ type: 'profile', workerSlug: decodeURIComponent(workerMatch[1]) });
      } else if (path.toLowerCase() === '/aviso-de-privacidad' || path.toLowerCase() === '/aviso-de-privacidad/') {
        setCurrentView({ type: 'privacy' });
      } else if (path.toLowerCase() === '/admin' || path.toLowerCase() === '/admin/') {
        setCurrentView({ type: 'admin' });
      } else if (path.toLowerCase() === '/registro' || path.toLowerCase() === '/registro/') {
        setCurrentView({ type: 'register' });
      } else if (path.toLowerCase() === '/iniciar-sesion' || path.toLowerCase() === '/iniciar-sesion/') {
        setCurrentView({ type: 'login' });
      } else {
        setCurrentView({ type: 'home' });
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isWorkerRegistrationActive, cancelWorkerRegistration]);

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
    const rawPhone = (maestro.telefonoWhatsApp || maestro.whatsapp || maestro.phone || '').trim();
    const { digitsOnly, waMeFormat } = sanitizeMexicanPhone(rawPhone);

    if (!rawPhone || !digitsOnly || digitsOnly.length < 10) {
      showToast('Este trabajador no tiene un número de contacto disponible por el momento.');
      return;
    }

    const targetName = maestro.nombre || `${maestro.firstName || ''} ${maestro.lastName || ''}`.trim() || 'Maestro';
    const targetOficio = maestro.oficio || maestro.mainTrade || 'Servicio';

    const cleanNote = customNote ? sanitizeText(customNote) : undefined;
    const waUrl = buildWhatsAppUrl(rawPhone, targetName, targetOficio, cleanNote);

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
        origen: 'maestro_cerca_web' as const,
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
  }, [showToast]);

  // Direct contact tracking: save to Firestore and update local counters
  const logContactClick = useCallback(async (worker: Worker, type: 'whatsapp' | 'phone') => {
    if (type === 'whatsapp') {
      await contactarWhatsApp(worker);
      return;
    }

    const rawPhone = (worker.telefonoWhatsApp || worker.whatsapp || worker.phone || '').trim();
    const { waMeFormat, digitsOnly } = sanitizeMexicanPhone(rawPhone);

    if (!rawPhone || !digitsOnly || digitsOnly.length < 10) {
      showToast('Este trabajador no tiene un número de contacto disponible por el momento.');
      return;
    }

    const cleanName = sanitizeText(worker.nombre || `${worker.firstName} ${worker.lastName}`);
    const cleanTrade = sanitizeText(worker.oficio || worker.mainTrade || 'Servicio');

    const canLogEvent = checkRateLimit(`phone_${worker.id}`, 2000);

    if (canLogEvent) {
      const nowIso = new Date().toISOString();

      try {
        await addDoc(collection(db, 'solicitudes_contacto'), {
          maestroId: worker.id,
          maestroNombre: cleanName,
          oficio: cleanTrade,
          fecha: nowIso,
          timestamp: nowIso,
          origen: 'maestro_cerca_web' as const,
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
  }, [contactarWhatsApp, showToast]);

  const logProfileView = useCallback((worker: Worker) => {
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
        userFriendlyError = 'El servicio de verificación telefónica no está disponible en este momento. Intenta más tarde.';
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
      let user: FirebaseUser;

      // IDENTITY INVARIANT FOR FACEBOOK AUTHENTICATED USERS:
      // When an authenticated Facebook user verifies their phone number by SMS,
      // use linkWithCredential(auth.currentUser, credential) exclusively instead of creating a new session with signInWithPhoneNumber / confirmationResult.confirm().
      // This strictly guarantees that the original UID is preserved intact at all times.
      const currentAuthUser = auth.currentUser;
      const isFacebookUser = Boolean(
        currentAuthUser &&
        currentAuthUser.providerData?.some((p) => p.providerId === 'facebook.com')
      );

      if (currentAuthUser && isFacebookUser) {
        const originalUid = currentAuthUser.uid;
        const credential = PhoneAuthProvider.credential(confirmationResult.verificationId, cleanCode);
        try {
          const userCredential = await linkWithCredential(currentAuthUser, credential);
          user = userCredential.user;
          // Invariant verification: original UID must remain identical
          if (user.uid !== originalUid) {
            console.error('[Identity Invariant Broken] UID mismatch after linkWithCredential:', { originalUid, newUid: user.uid });
          }
          setFirebaseUser(user);
        } catch (linkErr: any) {
          console.error('[Phone Linking with Facebook User Error]:', linkErr);
          if (
            linkErr?.code === 'auth/credential-already-in-use' ||
            linkErr?.code === 'auth/account-exists-with-different-credential' ||
            String(linkErr?.message || '').includes('credential-already-in-use')
          ) {
            return {
              success: false,
              error: 'Este número celular ya está vinculado a otra cuenta',
            };
          }
          if (linkErr?.code === 'auth/provider-already-linked') {
            return { success: false, error: 'Este número celular ya se encuentra vinculado a tu perfil.' };
          }
          if (linkErr?.code === 'auth/invalid-verification-code') {
            return { success: false, error: 'Código incorrecto. Verifica los 6 dígitos recibidos por SMS.' };
          }
          return {
            success: false,
            error: linkErr?.message || 'Error al vincular el número celular a tu cuenta.',
          };
        }
      } else {
        const userCredential = await confirmationResult.confirm(cleanCode);
        user = userCredential.user;
      }

      // CRITICAL: Check if authenticated user is an administrator
      const tokenRes = await user.getIdTokenResult().catch(() => null);
      const claims = (tokenRes?.claims as any) || null;
      if (isUserAdmin(user, claims)) {
        console.log('[Auth] Admin user confirmed via Phone SMS. Routing to admin panel without creating maestro profile.');
        setCurrentView({ type: 'admin' });
        return { success: true, user, hasExistingProfile: false };
      }

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

      // =====================================================================
      // MANYCHAT / WHATSAPP PRE-WORKER AUTOMATIC CLAIMING FLOW
      // If no completed profile exists yet, check if a preWorker was submitted
      // from WhatsApp/ManyChat with this verified phone number.
      // =====================================================================
      if (!existingWorker && user.phoneNumber) {
        const authPhoneDigits = user.phoneNumber.replace(/\D/g, '').slice(-10);
        const authE164 = `+52${authPhoneDigits}`;
        const preWorkerId = `pre_${authPhoneDigits}`;

        try {
          let preWorkerDocSnap = await getDoc(doc(db, 'preWorkers', preWorkerId));
          let preWorkerData = preWorkerDocSnap.exists() ? (preWorkerDocSnap.data() as any) : null;

          // Secondary fallback: query by phoneNumber field
          if (!preWorkerData) {
            const preQuery = query(
              collection(db, 'preWorkers'),
              where('phoneNumber', '==', authE164)
            );
            const preQuerySnap = await getDocs(preQuery);
            if (!preQuerySnap.empty) {
              preWorkerDocSnap = preQuerySnap.docs[0];
              preWorkerData = preWorkerDocSnap.data() as any;
            }
          }

          // Tertiary fallback: check directly for imported ManyChat lead in /maestros/mc_${authPhoneDigits}
          if (!preWorkerData) {
            const mcDraftSnap = await getDoc(doc(db, 'maestros', `mc_${authPhoneDigits}`));
            if (mcDraftSnap.exists()) {
              preWorkerDocSnap = mcDraftSnap;
              preWorkerData = mcDraftSnap.data() as any;
            }
          }

          if (preWorkerData) {
            // Anti-hijacking: Never allow another UID to claim an already claimed profile
            if (preWorkerData.status === 'claimed' && preWorkerData.claimedByUid && preWorkerData.claimedByUid !== user.uid) {
              console.warn('PreWorker profile already claimed by another UID:', preWorkerData.claimedByUid);
            } else if (preWorkerData.status === 'pending_claim' || preWorkerData.claimedByUid === user.uid) {
              // Valid claim: instantiate profile from preliminary registration
              const cleanFirstName = sanitizeText(preWorkerData.firstName || preWorkerData.nombre?.split(' ')[0] || '');
              const cleanLastName = sanitizeText(preWorkerData.lastName || preWorkerData.nombre?.split(' ').slice(1).join(' ') || '');
              const cleanNombre = sanitizeText(preWorkerData.nombre || `${cleanFirstName} ${cleanLastName}`.trim() || 'Maestro');
              const cleanOficio = sanitizeText(preWorkerData.oficio || preWorkerData.mainTrade || '');
              const cleanBio = sanitizeText(preWorkerData.bio || preWorkerData.description || '');

              const slug = await generateUniqueWorkerSlug(cleanNombre);

              const rawWhatsapp = preWorkerData.whatsappPhone || preWorkerData.whatsapp || '';
              const { waMeFormat: whatsappWaMe } = rawWhatsapp ? sanitizeMexicanPhone(rawWhatsapp) : { waMeFormat: '' };
              const resolvedWhatsapp = whatsappWaMe || authE164;

              const hasPrivacyConsent = Boolean(preWorkerData.privacyNoticeAccepted);
              const hasTermsConsent = Boolean(preWorkerData.termsAccepted);
              const hasAllConsent = hasPrivacyConsent && hasTermsConsent;
              const nowIso = new Date().toISOString();

              const claimedProfile: Maestro = {
                id: user.uid,
                userId: user.uid,
                slug,
                nombre: cleanNombre,
                oficio: cleanOficio,
                bio: cleanBio,
                radioKm: typeof preWorkerData.radioKm === 'number' ? preWorkerData.radioKm : undefined,
                lat: typeof preWorkerData.lat === 'number' ? preWorkerData.lat : null,
                lng: typeof preWorkerData.lng === 'number' ? preWorkerData.lng : null,
                fotoUrl: preWorkerData.profilePhoto || preWorkerData.fotoUrl || '',
                telefonoWhatsApp: resolvedWhatsapp,
                nivel: 'Aspirante',
                verificado: false, // NEVER auto-verified: strictly unverified upon claim
                aprobado: false, // Standard registration approval lifecycle
                statusPerfil: 'Pendiente',
                isAvailable: true,
                fechaRegistro: nowIso,

                // Compatibility fields
                firstName: cleanFirstName,
                lastName: cleanLastName,
                email: '',
                phone: authPhoneDigits,
                whatsapp: resolvedWhatsapp,
                profilePhoto: preWorkerData.profilePhoto || preWorkerData.fotoUrl || '',
                mainTrade: cleanOficio,
                secondaryTrades: [],
                services: preWorkerData.servicios && preWorkerData.servicios.length > 0 ? preWorkerData.servicios.map(sanitizeText) : [],
                description: cleanBio,
                yearsExperience: typeof preWorkerData.yearsExperience === 'number' ? preWorkerData.yearsExperience : undefined,
                serviceAreas: preWorkerData.serviceAreas && preWorkerData.serviceAreas.length > 0 ? preWorkerData.serviceAreas : [],
                workPhotos: preWorkerData.workPhotos || [],
                fotosTrabajos: preWorkerData.fotosTrabajos || (preWorkerData.workPhotos ? preWorkerData.workPhotos.map((p: any) => typeof p === 'string' ? p : p.url) : []),
                verificationStatus: 'registered',
                phoneVerified: true,
                identityVerified: false,
                referencesVerified: false,
                photosReviewed: false,
                joinedDate: nowIso.split('T')[0],
                privacyNoticeAccepted: hasPrivacyConsent,
                termsAccepted: hasTermsConsent,
                privacyNoticeAcceptedAt: hasPrivacyConsent ? (preWorkerData.privacyNoticeAcceptedAt || nowIso) : undefined,
                privacyNoticeVersion: preWorkerData.privacyNoticeVersion || '1.0',
                onboardingIncomplete: !hasAllConsent,
                source: 'manychat',
                claimedFromPreWorkerId: preWorkerDocSnap.id,
                claimedAt: nowIso,
                disponibilidad: preWorkerData.disponibilidad || '',
                telefonoPublico: preWorkerData.telefonoPublico || authE164,
                createdAt: nowIso,
                updatedAt: nowIso,
              };

              // 1. Create or complete /maestros/{uid} (single source of truth)
              await setDoc(doc(db, 'maestros', user.uid), removeUndefinedFields(claimedProfile));

              // 3. Mark preWorker as claimed, store claimedByUid and claimedAt
              try {
                await updateDoc(doc(db, 'preWorkers', preWorkerDocSnap.id), {
                  status: 'claimed',
                  claimedByUid: user.uid,
                  claimedAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                });
              } catch (upErr) {
                console.warn('Update preWorker claim error:', upErr);
              }

              // 4. Save one-time banner trigger for WorkerDashboardView
              if (typeof window !== 'undefined') {
                sessionStorage.setItem('manychat_claimed_banner_' + user.uid, 'true');
                localStorage.setItem('manychat_claimed_banner_' + user.uid, 'true');
              }

              existingWorker = claimedProfile;
              setMaestros((prev) => {
                const exists = prev.some((w) => w.id === user.uid);
                return exists ? prev.map((w) => (w.id === user.uid ? claimedProfile : w)) : [...prev, claimedProfile];
              });
            }
          }
        } catch (preCheckErr) {
          console.warn('PreWorker claim check error:', preCheckErr);
        }
      }

      if (user.phoneNumber) {
        try {
          const token = await user.getIdToken();
          await fetch('/api/auth/phone-verified', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          });
        } catch (callErr) {
          console.warn('phone-verified endpoint call note:', callErr);
        }
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
      if (
        err.code === 'auth/credential-already-in-use' ||
        err.code === 'auth/account-exists-with-different-credential' ||
        String(err?.message || '').includes('credential-already-in-use')
      ) {
        userFriendlyError = 'Este número celular ya está vinculado a otra cuenta';
      } else if (err.code === 'auth/invalid-verification-code') {
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
  const createWorkerProfile = useCallback(async (data: Partial<Worker> & { pendingProfilePhotoPath?: string; samePhoneForWhatsapp?: boolean; acceptedTermsAndPrivacy?: boolean }): Promise<AuthResponse> => {
    if (!auth.currentUser) {
      return { 
        success: false, 
        error: 'Debes iniciar sesión con tu cuenta o verificar tu número celular para crear tu perfil.' 
      };
    }

    // Role safety: Administrators can NEVER create worker profiles or have a maestro document created for them
    if (isAdmin || isUserAdmin(auth.currentUser, userClaims)) {
      return {
        success: false,
        error: 'Los administradores no pueden registrar perfiles de trabajador.',
      };
    }

    const firebaseUid = auth.currentUser.uid;

    // Strict validation of required fields: NO generic fallbacks
    const cleanFirstName = sanitizeText(data.firstName || '');
    const cleanLastName = sanitizeText(data.lastName || '');
    if (!cleanFirstName) {
      return { success: false, error: 'El nombre es obligatorio para registrar tu perfil.' };
    }
    if (!cleanLastName) {
      return { success: false, error: 'Los apellidos son obligatorios para registrar tu perfil.' };
    }

    const verifiedPhone = auth.currentUser.phoneNumber || data.phone || '';
    const { digitsOnly, waMeFormat, e164WithPlus } = sanitizeMexicanPhone(verifiedPhone);
    const national10 = digitsOnly.slice(-10);
    if (!national10 || national10.length !== 10) {
      return { success: false, error: 'El teléfono celular debe contener exactamente 10 dígitos.' };
    }

    // Resolve WhatsApp number: only set if explicitly indicated or provided
    let resolvedWhatsapp = '';
    if (data.samePhoneForWhatsapp) {
      resolvedWhatsapp = waMeFormat || (national10 ? `52${national10}` : '');
    } else if (data.whatsapp || data.telefonoWhatsApp) {
      const rawWhatsapp = data.whatsapp || data.telefonoWhatsApp || '';
      const { waMeFormat: whatsappWaMe, digitsOnly: whatsappDigits } = sanitizeMexicanPhone(rawWhatsapp);
      resolvedWhatsapp = whatsappWaMe || (whatsappDigits ? `52${whatsappDigits.slice(-10)}` : '');
    }

    const cleanOficio = sanitizeText(data.oficio || data.mainTrade || '');
    if (!cleanOficio) {
      return { success: false, error: 'Debes seleccionar tu oficio o especialidad principal.' };
    }

    const cleanServices = (data.services || []).map(sanitizeText).filter((s) => s.length > 0);
    if (cleanServices.length === 0) {
      return { success: false, error: 'Debes seleccionar al menos un trabajo o servicio que realizas.' };
    }

    const cleanServiceAreas = (data.serviceAreas || []).map(sanitizeText).filter((a) => a.length > 0);
    if (cleanServiceAreas.length === 0) {
      return { success: false, error: 'Debes seleccionar al menos una zona de cobertura en Querétaro.' };
    }

    const privacyAccepted = Boolean(data.privacyNoticeAccepted || (data as any).privacyAccepted);
    const termsAccepted = Boolean(data.termsAccepted || (data as any).termsAccepted);
    if (!privacyAccepted) {
      return { success: false, error: 'Debes aceptar el Aviso de Privacidad para continuar.' };
    }
    if (!termsAccepted) {
      return { success: false, error: 'Debes aceptar los Términos y Condiciones para continuar.' };
    }

    const isFacebookUser = Boolean(
      auth.currentUser.providerData?.some((p) => p.providerId === 'facebook.com')
    );
    const registrationMethod: 'phone' | 'facebook' | 'manychat_csv' | string = data.registrationMethod || (isFacebookUser ? 'facebook' : 'phone');

    const cleanNombre = `${cleanFirstName} ${cleanLastName}`.trim();
    const cleanBio = sanitizeText(data.bio || data.description || '');

    const slug = await generateUniqueWorkerSlug(cleanNombre);
    const workerId = firebaseUid;

    // PRINCIPLE OF TRUTH:
    // phoneVerified is ONLY true if auth.currentUser has verified Phone Auth provider or user.phoneNumber
    const isPhoneAuthVerified = Boolean(
      auth.currentUser.phoneNumber ||
      auth.currentUser.providerData?.some((p) => p.providerId === 'phone')
    );
    const nowIso = new Date().toISOString();

    const newWorker: Maestro = {
      id: workerId,
      userId: firebaseUid,
      slug,
      nombre: cleanNombre,
      oficio: cleanOficio,
      bio: cleanBio,
      radioKm: typeof data.radioKm === 'number' ? data.radioKm : undefined,
      lat: typeof data.lat === 'number' ? data.lat : null,
      lng: typeof data.lng === 'number' ? data.lng : null,
      fotoUrl: '',
      photoUrl: '',
      telefonoWhatsApp: resolvedWhatsapp,
      nivel: 'Aspirante',
      verificado: false,
      // New self-registrations start as Pendiente until reviewed by admin
      aprobado: false,
      statusPerfil: 'Pendiente',
      isAvailable: true,
      fechaRegistro: nowIso,

      // Canonical and compatibility fields
      firstName: cleanFirstName,
      lastName: cleanLastName,
      email: sanitizeText(data.email || auth.currentUser.email || ''),
      phone: national10,
      phoneE164: e164WithPlus || `+52${national10}`,
      whatsapp: resolvedWhatsapp,
      registrationMethod,
      // Strictly empty public photo fields until administrative approval
      profilePhoto: '',
      profilePhotoReviewStatus: data.pendingProfilePhotoPath ? 'pending' : 'none',
      pendingProfilePhotoPath: data.pendingProfilePhotoPath || null,
      mainTrade: cleanOficio,
      secondaryTrades: data.secondaryTrades || [],
      services: cleanServices,
      description: cleanBio,
      yearsExperience: typeof data.yearsExperience === 'number' && !isNaN(data.yearsExperience) ? data.yearsExperience : undefined,
      serviceAreas: cleanServiceAreas,
      workPhotos: data.workPhotos || [],
      fotosTrabajos: data.fotosTrabajos || (data.workPhotos ? data.workPhotos.map((p: any) => typeof p === 'string' ? p : p.url) : []),
      verificationStatus: 'registered',
      status: 'registered',
      onboardingIncomplete: false,
      authProviders: (auth.currentUser?.providerData || []).map((p) => p.providerId).filter(Boolean),
      source: data.source || 'web',
      origen: data.origen || 'web',
      phoneVerified: isPhoneAuthVerified,
      ...(isPhoneAuthVerified
        ? {
            phoneVerifiedAt: nowIso,
            phoneVerificationMethod: 'firebase_sms',
          }
        : {}),
      identityVerified: false,
      referencesVerified: false,
      photosReviewed: false,
      joinedDate: nowIso.split('T')[0],
      privacyNoticeAccepted: true,
      privacyNoticeAcceptedAt: data.privacyNoticeAcceptedAt || nowIso,
      privacyNoticeVersion: data.privacyNoticeVersion || '1.0',
      termsAccepted: true,
      termsAcceptedAt: data.termsAcceptedAt || (data as any).termsAcceptedAt || nowIso,
      termsVersion: data.termsVersion || (data as any).termsVersion || '1.0',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    // Strip any property that has an undefined value before sending to Firestore
    const docPayload = removeUndefinedFields(newWorker);

    try {
      // Primary and sole profile storage: /maestros/{workerId}
      await setDoc(doc(db, 'maestros', workerId), docPayload, { merge: true });

      if (isPhoneAuthVerified) {
        try {
          const token = await auth.currentUser.getIdToken();
          await fetch('/api/auth/phone-verified', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          });
        } catch (callErr) {
          console.warn('phone-verified endpoint call note:', callErr);
        }
      }

      if (data.pendingProfilePhotoPath) {
        try {
          await setDoc(
            doc(db, 'maestros', workerId, 'privado', 'media'),
            {
              pendingProfilePhotoPath: data.pendingProfilePhotoPath,
              profilePhotoReviewStatus: 'pending',
              createdAt: nowIso,
            },
            { merge: true }
          );
        } catch (mediaErr) {
          console.warn('[StoreContext] Private media subdoc write warning:', mediaErr);
        }
      }
      
      setMaestros((prev) => {
        const exists = prev.some((w) => w.id === workerId);
        return exists ? prev.map((w) => (w.id === workerId ? newWorker : w)) : [...prev, newWorker];
      });

      setAnalytics((prev) => ({
        ...prev,
        registro_trabajador_completado: prev.registro_trabajador_completado + 1,
        fotos_subidas: prev.fotos_subidas + (newWorker.workPhotos?.length || 0),
      }));

      setIsWorkerRegistrationActive(false);
      return { success: true, worker: newWorker };
    } catch (firestoreErr: any) {
      console.error('Save error:', firestoreErr);
      return {
        success: false,
        error: 'Ocurrió un error al guardar los cambios. Intenta de nuevo.',
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

  // Worker Facebook Sign-In STRICTLY FOR LOGIN (Only allows access if an active worker profile already exists)
  const loginWorkerWithFacebook = useCallback(async (): Promise<{ 
    success: boolean; 
    hasExistingProfile?: boolean; 
    worker?: Worker;
    error?: string 
  }> => {
    try {
      const provider = new FacebookAuthProvider();
      provider.addScope('public_profile');
      provider.addScope('email');

      let result;
      try {
        result = await signInWithPopup(auth, provider);
      } catch (popupErr: any) {
        // Fallback to signInWithRedirect on restricted mobile webviews if popup was blocked
        if (popupErr.code === 'auth/popup-blocked') {
          try {
            await signInWithRedirect(auth, provider);
            return { success: true };
          } catch (redirectErr) {
            console.warn('Facebook redirect fallback note:', redirectErr);
          }
        }
        throw popupErr;
      }

      const user = result.user;

      // CRITICAL: Check if authenticated user is an administrator
      const tokenRes = await user.getIdTokenResult().catch(() => null);
      const claims = (tokenRes?.claims as any) || null;
      if (isUserAdmin(user, claims)) {
        console.log('[Auth] Admin user detected during Facebook sign-in. Routing to admin panel without creating maestro profile.');
        setCurrentView({ type: 'admin' });
        return { success: true, hasExistingProfile: false };
      }

      // Check if this is a newly created Firebase Auth user
      const additionalInfo = getAdditionalUserInfo(result);
      if (additionalInfo?.isNewUser) {
        // User came through LOGIN, but had no existing account. Delete accidental auth user!
        console.log('[Auth Login] New user attempted login with Facebook. Deleting accidental auth user:', user.uid);
        let deleted = false;
        try {
          await deleteUser(user);
          deleted = true;
        } catch (delErr) {
          console.warn('[Auth Login] Client deleteUser failed, attempting backend fallback:', delErr);
        }

        if (!deleted) {
          try {
            const token = await user.getIdToken(true);
            await fetch('/api/account', {
              method: 'DELETE',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            });
          } catch (backendDelErr) {
            console.warn('[Auth Login] Backend fallback delete error:', backendDelErr);
          }
        }

        await signOut(auth).catch(() => {});
        return {
          success: false,
          error: 'No encontramos una cuenta de trabajador vinculada a este Facebook. Por favor regístrate primero.',
        };
      }

      // Check if worker document already exists in maestros/{uid}
      let existingWorker: Worker | undefined = undefined;
      try {
        const docRef = doc(db, 'maestros', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const docData = docSnap.data() as Worker;
          // Verify that this is actually a completed profile, NOT an incomplete draft
          if (!docData.onboardingIncomplete && docData.status !== 'draft' && Boolean(docData.oficio)) {
            existingWorker = { ...docData, id: docSnap.id };
          }
        }
      } catch (fErr) {
        console.warn('Check existing maestro Facebook doc note:', fErr);
      }

      if (!existingWorker) {
        existingWorker = maestros.find(
          (m) => (m.userId === user.uid || m.id === user.uid) && !m.onboardingIncomplete && m.status !== 'draft' && Boolean(m.oficio)
        );
      }

      // If a completed profile exists, allow login
      if (existingWorker) {
        return { success: true, hasExistingProfile: true, worker: existingWorker };
      }

      // User exists in Firebase Auth, but has NO active worker profile.
      // Sign out immediately so no ghost session remains in the app.
      console.log('[Auth Login] Facebook user exists in Auth but has no complete profile in maestros. Signing out:', user.uid);
      await signOut(auth);
      return {
        success: false,
        error: 'No encontramos un perfil de trabajador activo asociado a esta cuenta de Facebook. Si deseas ofrecer tus servicios, crea tu perfil gratis.',
      };
    } catch (err: any) {
      console.error('[Facebook Worker Sign-In Error]:', {
        code: err?.code,
        message: err?.message,
        customData: err?.customData
      });

      // Specific error code mappings
      let message = 'No se pudo completar el inicio de sesión con Facebook.';
      if (err.code === 'auth/operation-not-allowed') {
        message = 'El inicio de sesión con Facebook no está habilitado en Firebase Authentication (requiere activar el proveedor en la consola y agregar el App ID y App Secret de Meta).';
      } else if (err.code === 'auth/unauthorized-domain') {
        message = 'El dominio actual no está en la lista de Dominios Autorizados de Firebase Authentication.';
      } else if (err.code === 'auth/popup-blocked') {
        message = 'El navegador bloqueó la ventana emergente de Facebook. Por favor permite las ventanas emergentes en tu navegador e intenta de nuevo.';
      } else if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        return { success: false, error: 'La ventana de inicio de sesión con Facebook se cerró antes de completar la autenticación.' };
      } else if (err.code === 'auth/account-exists-with-different-credential') {
        message = 'Ya existe una cuenta asociada a este correo con otro método de acceso (por ejemplo, celular o Google). Por favor inicia sesión con tu método original y vincula Facebook desde tu perfil.';
      } else if (err.code === 'auth/credential-already-in-use') {
        message = 'Esta cuenta de Facebook ya está vinculada a otra cuenta de Maestro Cerca.';
      } else if (err.message) {
        message = err.message;
      }
      return { success: false, error: message };
    }
  }, [maestros]);

  // Worker Facebook Registration (Used ONLY in WorkerRegisterView for onboarding new workers)
  const registerWorkerWithFacebook = useCallback(async (): Promise<{ 
    success: boolean; 
    hasExistingProfile?: boolean; 
    worker?: Worker;
    error?: string 
  }> => {
    try {
      const provider = new FacebookAuthProvider();
      provider.addScope('public_profile');
      provider.addScope('email');

      let result;
      try {
        result = await signInWithPopup(auth, provider);
      } catch (popupErr: any) {
        if (popupErr.code === 'auth/popup-blocked') {
          try {
            await signInWithRedirect(auth, provider);
            return { success: true };
          } catch (redirectErr) {
            console.warn('Facebook redirect fallback note:', redirectErr);
          }
        }
        throw popupErr;
      }

      const user = result.user;

      // Administrator check
      const tokenRes = await user.getIdTokenResult().catch(() => null);
      const claims = (tokenRes?.claims as any) || null;
      if (isUserAdmin(user, claims)) {
        setCurrentView({ type: 'admin' });
        return { success: true, hasExistingProfile: false };
      }

      // Check if user ALREADY has a completed profile in maestros/{uid}
      let existingWorker: Worker | undefined = undefined;
      try {
        const docRef = doc(db, 'maestros', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const docData = docSnap.data() as Worker;
          if (!docData.onboardingIncomplete && docData.status !== 'draft' && Boolean(docData.oficio)) {
            existingWorker = { ...docData, id: docSnap.id };
          }
        }
      } catch (fErr) {
        console.warn('Check existing maestro Facebook doc note in register:', fErr);
      }

      if (!existingWorker) {
        existingWorker = maestros.find(
          (m) => (m.userId === user.uid || m.id === user.uid) && !m.onboardingIncomplete && m.status !== 'draft' && Boolean(m.oficio)
        );
      }

      if (existingWorker) {
        return { success: true, hasExistingProfile: true, worker: existingWorker };
      }

      // New or uncompleted worker: proceed with onboarding registration
      return { success: true, hasExistingProfile: false };
    } catch (err: any) {
      console.error('[Facebook Worker Registration Error]:', err);
      let message = 'No se pudo completar el registro con Facebook.';
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        return { success: false, error: 'La ventana de registro con Facebook se cerró antes de completar.' };
      } else if (err.code === 'auth/account-exists-with-different-credential') {
        message = 'Ya existe una cuenta asociada a este correo. Inicia sesión con tu teléfono o método original.';
      } else if (err.code === 'auth/popup-blocked') {
        message = 'El navegador bloqueó la ventana emergente. Por favor permite las ventanas emergentes e intenta de nuevo.';
      } else if (err.message) {
        message = err.message;
      }
      return { success: false, error: message };
    }
  }, [maestros]);

  // =========================================================================
  // FIREBASE ACCOUNT LINKING (Single Worker UID with multiple auth providers)
  // Maintains exact same auth.currentUser.uid and /maestros/{uid}
  // =========================================================================

  // 1. Link Facebook Account via linkWithPopup
  const linkFacebookAccount = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!auth.currentUser) {
      return { success: false, error: 'No hay una sesión activa para vincular la cuenta.' };
    }

    try {
      const provider = new FacebookAuthProvider();
      provider.addScope('public_profile');
      provider.addScope('email');
      const userCredential = await linkWithPopup(auth.currentUser, provider);

      // Instantly update local state with refreshed Firebase User token & providerData
      setFirebaseUser(userCredential.user);
      showToast('Cuenta de Facebook vinculada exitosamente');
      return { success: true };
    } catch (err: any) {
      console.error('[Firebase Account Linking] Facebook link error:', {
        code: err?.code,
        message: err?.message,
        customData: err?.customData
      });

      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        return { success: false, error: 'La ventana de Facebook se cerró antes de completar la vinculación.' };
      }

      if (
        err.code === 'auth/credential-already-in-use' || 
        err.code === 'auth/account-exists-with-different-credential'
      ) {
        return {
          success: false,
          error: 'Este método de acceso ya está vinculado a otra cuenta de Maestro Cerca. Para proteger tus datos, no podemos vincularlo automáticamente. Inicia sesión con esa cuenta o contacta a Maestro Cerca para resolverlo.'
        };
      }

      if (err.code === 'auth/operation-not-allowed') {
        return {
          success: false,
          error: 'El inicio de sesión con Facebook no está habilitado en Firebase Authentication (requiere activar el proveedor en la consola y agregar el App ID y App Secret de Meta).'
        };
      }

      if (err.code === 'auth/unauthorized-domain') {
        return {
          success: false,
          error: 'El dominio actual no está autorizado en la consola de Firebase Authentication.'
        };
      }

      if (err.code === 'auth/provider-already-linked') {
        return { success: false, error: 'Esta cuenta de Facebook ya se encuentra vinculada a tu perfil.' };
      }

      if (err.code === 'auth/popup-blocked') {
        return { success: false, error: 'El navegador bloqueó la ventana emergente de Facebook. Por favor permite las ventanas emergentes e intenta de nuevo.' };
      }

      return { 
        success: false, 
        error: err?.message || 'No se pudo vincular la cuenta de Facebook. Intenta de nuevo.' 
      };
    }
  }, [showToast]);

  // 3. Send Phone SMS code for Linking (re-uses appRecaptchaVerifier)
  const sendPhoneLinkVerificationCode = useCallback(async (
    phoneNumberE164: string,
    containerId: string
  ): Promise<{ success: boolean; confirmationResult?: ConfirmationResult; error?: string }> => {
    if (!auth.currentUser) {
      return { success: false, error: 'No hay una sesión activa para vincular el número de celular.' };
    }
    return sendPhoneVerificationCode(phoneNumberE164, containerId);
  }, [sendPhoneVerificationCode]);

  // 4. Confirm SMS code & Link Phone Credential to Current User via PhoneAuthProvider + linkWithCredential
  const confirmPhoneLinkCode = useCallback(async (
    confirmationResult: ConfirmationResult,
    verificationCode: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!auth.currentUser) {
      return { success: false, error: 'No hay una sesión activa para vincular el número celular.' };
    }

    if (isAdmin || isUserAdmin(auth.currentUser, userClaims)) {
      return { success: false, error: 'Acción no permitida para cuentas administrativas.' };
    }

    const cleanCode = verificationCode.trim().replace(/\D/g, '');
    if (!cleanCode || cleanCode.length < 6) {
      return { success: false, error: 'Ingresa el código completo de 6 dígitos que recibiste por SMS.' };
    }

    try {
      // Build Phone credential using verificationId from confirmationResult
      const credential = PhoneAuthProvider.credential(confirmationResult.verificationId, cleanCode);

      // Link credential directly to currentUser using linkWithCredential (strictly maintains existing UID!)
      const userCredential = await linkWithCredential(auth.currentUser, credential);

      // Instantly refresh local user state
      setFirebaseUser(userCredential.user);

      // If current worker profile in Firestore exists, update verified phone fields cleanly
      const user = userCredential.user;
      if (user.phoneNumber) {
        const cleanDigits = user.phoneNumber.replace(/\D/g, '').slice(-10);
        const nowIso = new Date().toISOString();

        // Call backend server to set phoneVerified in Firestore with admin privileges
        try {
          const token = await user.getIdToken();
          await fetch('/api/auth/phone-verified', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          });
        } catch (apiErr) {
          console.warn('Backend phone-verified call error:', apiErr);
        }

        const updateData: Partial<Worker> = {
          phone: cleanDigits,
          telefonoWhatsApp: currentWorker?.telefonoWhatsApp || `52${cleanDigits}`,
          whatsapp: currentWorker?.whatsapp || `52${cleanDigits}`,
          phoneVerified: true,
          phoneVerifiedAt: nowIso,
          phoneVerificationMethod: 'firebase_sms',
          updatedAt: nowIso,
        };

        // ONLY update document if currentWorker profile actually exists in Firestore!
        // During registration onboarding, no Firestore doc exists yet and phone will be persisted on final submission.
        if (currentWorker) {
          try {
            await updateDoc(doc(db, 'maestros', user.uid), {
              phone: cleanDigits,
              updatedAt: nowIso,
            });
          } catch (upDocErr) {
            console.warn('Note updating phone in maestro doc after linking:', upDocErr);
          }

          setMaestros((prev) =>
            prev.map((m) => (m.id === user.uid || m.userId === user.uid ? { ...m, ...updateData } : m))
          );
        }
      }

      showToast('Número celular vinculado y verificado por SMS exitosamente');
      return { success: true };
    } catch (err: any) {
      console.error('[Phone Linking Technical Error]:', err?.code, err?.message);

      if (
        err.code === 'auth/credential-already-in-use' || 
        err.code === 'auth/account-exists-with-different-credential' ||
        String(err?.message || '').includes('credential-already-in-use')
      ) {
        return {
          success: false,
          error: 'Este número celular ya está vinculado a otra cuenta',
        };
      }

      if (err.code === 'auth/provider-already-linked') {
        return { success: false, error: 'Este número celular ya se encuentra vinculado a tu perfil.' };
      }

      if (err.code === 'auth/invalid-verification-code') {
        return { success: false, error: 'Código incorrecto. Verifica los 6 dígitos recibidos por SMS.' };
      }

      if (err.code === 'auth/code-expired') {
        return { success: false, error: 'Código vencido. Por favor solicita un nuevo código por SMS.' };
      }

      return { 
        success: false, 
        error: err?.message || 'No se pudo vincular el número celular. Intenta nuevamente.' 
      };
    }
  }, [isAdmin, userClaims, currentWorker, showToast]);

  // 1-Click Sandbox Demo Account Login (deprecated - demo removed in production)
  const loginWorkerAsDemo = useCallback(() => {
    // Demo mode is completely removed in production
  }, []);

  // Alias for backward compatibility
  const loginWorker = loginAdmin;

  const logoutWorker = useCallback(async () => {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem('maestro_cerca_demo_session');
      } catch {
        // ignore
      }
    }
    try {
      await signOut(auth);
    } catch (e) {
      console.warn('Error during signOut:', e);
    }
    if (currentView.type === 'dashboard' || currentView.type === 'admin') {
      setCurrentView({ type: 'home' });
    }
  }, [currentView.type]);

  // Update worker profile in database
  const updateWorkerProfile = useCallback(async (
    workerId: string, 
    updates: Partial<Worker>
  ): Promise<{ success: boolean; error?: string }> => {
    if (!firebaseUser) {
      return { success: false, error: 'No hay una sesión activa. Inicia sesión nuevamente.' };
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
      fotosTrabajos: sanitizedUpdates.fotosTrabajos || (sanitizedUpdates.workPhotos ? sanitizedUpdates.workPhotos.map((p: any) => typeof p === 'string' ? p : p.url) : undefined),
      profileActive: sanitizedUpdates.profileActive !== undefined ? sanitizedUpdates.profileActive : targetWorker?.profileActive,
      isAvailable: sanitizedUpdates.isAvailable !== undefined ? Boolean(sanitizedUpdates.isAvailable) : (targetWorker?.isAvailable !== undefined ? targetWorker.isAvailable : true),
      status: sanitizedUpdates.status !== undefined ? sanitizedUpdates.status : targetWorker?.status,
      onboardingIncomplete: sanitizedUpdates.onboardingIncomplete !== undefined ? sanitizedUpdates.onboardingIncomplete : targetWorker?.onboardingIncomplete,
      authProviders: sanitizedUpdates.authProviders !== undefined ? sanitizedUpdates.authProviders : targetWorker?.authProviders,
      updatedAt: new Date().toISOString(),
    };

    if (isAdmin) {
      if (sanitizedUpdates.aprobado !== undefined) safePayload.aprobado = sanitizedUpdates.aprobado;
      if (sanitizedUpdates.verificado !== undefined) safePayload.verificado = sanitizedUpdates.verificado;
      if (sanitizedUpdates.nivel !== undefined) safePayload.nivel = sanitizedUpdates.nivel;
      if (sanitizedUpdates.verificationStatus !== undefined) safePayload.verificationStatus = sanitizedUpdates.verificationStatus;
    } else {
      // Security check: Phone verification is strictly linked to Firebase Phone Auth.
      // If the phone number is updated by the worker, verify if it still matches the authenticated Firebase Phone number.
      if (sanitizedUpdates.phone !== undefined) {
        const cleanNewPhone = sanitizedUpdates.phone.replace(/\D/g, '').slice(-10);
        const cleanAuthPhone = firebaseUser?.phoneNumber ? firebaseUser.phoneNumber.replace(/\D/g, '').slice(-10) : '';

        if (!cleanAuthPhone || cleanNewPhone !== cleanAuthPhone) {
          // If the new phone does NOT match the verified phone provider in Firebase Auth, revoke phoneVerified
          safePayload.phoneVerified = false;
          safePayload.phoneVerificationMethod = '';
        } else if (cleanNewPhone && cleanNewPhone === cleanAuthPhone) {
          safePayload.phoneVerified = true;
          safePayload.phoneVerificationMethod = 'firebase_sms';
        }
      }
    }

    // Remove undefined values
    Object.keys(safePayload).forEach((k) => {
      if ((safePayload as any)[k] === undefined) {
        delete (safePayload as any)[k];
      }
    });

    try {
      // Primary and sole profile update: /maestros/{workerId}
      await setDoc(doc(db, 'maestros', workerId), safePayload, { merge: true });
      
      setMaestros((prev) =>
        prev.map((w) => (w.id === workerId ? { ...w, ...safePayload } : w))
      );
      return { success: true };
    } catch (err: any) {
      console.warn('Update error:', err);
      return { success: false, error: err?.message || 'Error al actualizar el perfil.' };
    }
  }, [currentWorker, firebaseUser, maestros, isAdmin, showToast]);

  // Worker-controlled availability toggle (distinct from admin approval)
  const setWorkerAvailability = useCallback(async (
    workerId: string, 
    isAvailable: boolean
  ): Promise<{ success: boolean; error?: string }> => {
    if (!firebaseUser) {
      return { success: false, error: 'Debes iniciar sesión para actualizar tu disponibilidad.' };
    }
    const targetWorker = maestros.find((m) => m.id === workerId || m.userId === workerId);
    if (!targetWorker) {
      return { success: false, error: 'Trabajador no encontrado.' };
    }
    if (!isAdmin && targetWorker.userId !== firebaseUser.uid && targetWorker.id !== firebaseUser.uid) {
      return { success: false, error: 'No tienes permiso para modificar la disponibilidad de este perfil.' };
    }

    const payload = {
      isAvailable: Boolean(isAvailable),
      updatedAt: new Date().toISOString(),
    };

    try {
      await updateDoc(doc(db, 'maestros', targetWorker.id), payload);
      setMaestros((prev) =>
        prev.map((w) => (w.id === targetWorker.id ? { ...w, isAvailable: Boolean(isAvailable) } : w))
      );
      return { success: true };
    } catch (err: any) {
      console.error('Error al actualizar disponibilidad:', err);
      return { success: false, error: err?.message || 'Error al actualizar disponibilidad.' };
    }
  }, [firebaseUser, maestros, isAdmin]);

  // Submit verification request to Cloud Firestore
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

      // 2. Sensitive document references inside admin-restricted subcollection
      // maestros/{id}/privado/verificacion
      const privateDocPayload = {
        workerId,
        userId: firebaseUser.uid,
        documents: (req as any).documents || (req.idDocStoragePath ? [req.idDocStoragePath] : []),
        idDocStoragePath: req.idDocStoragePath || ((req as any).documents && (req as any).documents[0]) || '',
        proofAddressStoragePath: req.proofAddressStoragePath || '',
        referencesText: req.referencesText || ((req as any).references ? (req as any).references.join(', ') : ''),
        notes: req.notes || '',
        status: 'pending',
        requestedAt: nowIso,
        updatedAt: nowIso,
      };

      // Explicit write to private dossier with error handling
      await setDoc(
        doc(db, 'maestros', workerId, 'privado', 'verificacion'),
        privateDocPayload,
        { merge: true }
      );

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


  // Worker submitting a newly uploaded pending photo for administrative moderation
  const submitPendingProfilePhoto = useCallback(
    async (workerId: string, pendingStoragePath: string): Promise<{ success: boolean; error?: string }> => {
      // MVP: skip admin moderation and publish the photo immediately (see featureFlags.ts).
      // Routed through a backend endpoint (Admin SDK) rather than a direct client write,
      // because Firestore rules deliberately forbid owners from setting
      // profilePhotoReviewStatus to 'approved' themselves.
      if (AUTO_APPROVE_PROFILE_PHOTOS) {
        try {
          const currentUser = auth.currentUser;
          if (!currentUser) {
            return { success: false, error: 'Debes tener una sesión activa para publicar tu foto.' };
          }
          const token = await currentUser.getIdToken();
          const res = await fetch('/api/photos/self-publish', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ pendingStoragePath }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data.success) {
            return { success: false, error: data?.error || 'No se pudo publicar la fotografía.' };
          }

          setMaestros((prev) =>
            prev.map((w) =>
              w.id === workerId || w.userId === workerId
                ? {
                    ...w,
                    profilePhoto: data.publicUrl,
                    fotoUrl: data.publicUrl,
                    photoUrl: data.publicUrl,
                    profilePhotoReviewStatus: 'approved',
                    pendingProfilePhotoPath: undefined,
                  }
                : w
            )
          );

          return { success: true };
        } catch (err: any) {
          console.error('Error self-publishing profile photo:', err);
          return { success: false, error: err?.message || 'Error al publicar la fotografía.' };
        }
      }

      try {
        const nowIso = new Date().toISOString();
        // 1. Save in private subdocument /maestros/{workerId}/privado/media
        await setDoc(
          doc(db, 'maestros', workerId, 'privado', 'media'),
          {
            pendingProfilePhotoPath: pendingStoragePath,
            profilePhotoReviewStatus: 'pending',
            updatedAt: nowIso,
          },
          { merge: true }
        );

        // 2. Update parent worker profile (does NOT set public photoUrl/profilePhoto/fotoUrl!)
        await updateDoc(doc(db, 'maestros', workerId), {
          pendingProfilePhotoPath: pendingStoragePath,
          profilePhotoReviewStatus: 'pending',
          updatedAt: nowIso,
        });

        setMaestros((prev) =>
          prev.map((w) =>
            w.id === workerId || w.userId === workerId
              ? { ...w, pendingProfilePhotoPath: pendingStoragePath, profilePhotoReviewStatus: 'pending' }
              : w
          )
        );

        return { success: true };
      } catch (err: any) {
        console.error('Error submitting pending profile photo:', err);
        return { success: false, error: err?.message || 'Error al enviar foto para moderación.' };
      }
    },
    []
  );

  // Visitor reporting a worker profile
  const submitProfileReport = useCallback(
    async (workerId: string, reason: string): Promise<{ success: boolean; message?: string; error?: string }> => {
      try {
        const response = await fetch('/api/profile-reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workerId, reason }),
        });
        const data = await response.json();
        if (!response.ok) {
          return { success: false, error: data.error || 'Error al enviar reporte.' };
        }
        return { success: true, message: data.message || 'Gracias. Recibimos tu reporte y lo revisaremos.' };
      } catch (err: any) {
        console.error('Error submitting profile report:', err);
        return { success: false, error: 'Error de conexión al enviar el reporte. Intenta nuevamente.' };
      }
    },
    []
  );

  // Admin approving or rejecting a worker's pending profile photo
  const adminReviewProfilePhoto = useCallback(
    async (
      workerId: string,
      action: 'approve' | 'reject',
      notes?: string
    ): Promise<{ success: boolean; publicUrl?: string; error?: string }> => {
      try {
        if (!auth.currentUser) {
          return { success: false, error: 'Sesión administrativa no iniciada.' };
        }
        const idToken = await auth.currentUser.getIdToken(true);
        const response = await fetch('/api/admin/profile-photo/review', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ workerId, action, notes }),
        });
        const data = await response.json();
        if (!response.ok) {
          return { success: false, error: data.error || 'Error al procesar la revisión de la fotografía.' };
        }

        // Update local state in maestros
        setMaestros((prev) =>
          prev.map((w) => {
            if (w.id === workerId || w.userId === workerId) {
              if (action === 'approve') {
                return {
                  ...w,
                  profilePhoto: data.publicUrl,
                  fotoUrl: data.publicUrl,
                  photoUrl: data.publicUrl,
                  profilePhotoReviewStatus: 'approved',
                  pendingProfilePhotoPath: null,
                };
              } else {
                return {
                  ...w,
                  profilePhoto: '',
                  fotoUrl: '',
                  photoUrl: '',
                  profilePhotoReviewStatus: 'rejected',
                  pendingProfilePhotoPath: null,
                };
              }
            }
            return w;
          })
        );

        return { success: true, publicUrl: data.publicUrl };
      } catch (err: any) {
        console.error('Error in adminReviewProfilePhoto:', err);
        return { success: false, error: err?.message || 'Error de conexión con el servidor.' };
      }
    },
    []
  );

  // Admin fetching user reports
  const adminFetchProfileReports = useCallback(async (): Promise<ProfileReport[]> => {
    try {
      if (!auth.currentUser) return [];
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch('/api/admin/profile-reports', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      return data.reports || [];
    } catch (err) {
      console.error('Error fetching reports:', err);
      return [];
    }
  }, []);

  // Admin updating a report status
  const adminUpdateReportStatus = useCallback(
    async (reportId: string, status: string, adminNotes?: string): Promise<{ success: boolean; error?: string }> => {
      try {
        if (!auth.currentUser) return { success: false, error: 'No autenticado' };
        const idToken = await auth.currentUser.getIdToken();
        const res = await fetch('/api/admin/profile-reports/status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ reportId, status, adminNotes }),
        });
        const data = await res.json();
        if (!res.ok) return { success: false, error: data.error };
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err?.message };
      }
    },
    []
  );

  // Add work photo to Firestore profile (single)
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
        fotosTrabajos: updatedPhotos.map((p) => p.url),
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Photo add error:', err);
    }

    setMaestros((prev) =>
      prev.map((w) => (w.id === workerId ? { ...w, workPhotos: updatedPhotos, fotosTrabajos: updatedPhotos.map((p) => p.url) } : w))
    );

    setAnalytics((prev) => ({
      ...prev,
      fotos_subidas: prev.fotos_subidas + 1,
    }));
  }, [maestros]);

  // Batch add photos with arrayUnion
  const addWorkerPhotosBatch = useCallback(async (
    workerId: string, 
    photos: Array<{ url: string; title: string }>
  ) => {
    if (!photos.length) return;

    const urls = photos.map((p) => p.url);
    const photoObjects: WorkPhoto[] = photos.map((p, idx) => ({
      id: `p-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
      url: p.url,
      title: sanitizeText(p.title),
      description: '',
    }));

    try {
      await updateDoc(doc(db, 'maestros', workerId), {
        fotosTrabajos: arrayUnion(...urls),
        workPhotos: arrayUnion(...photoObjects),
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Photos arrayUnion error:', err);
    }

    setMaestros((prev) =>
      prev.map((w) => {
        if (w.id === workerId) {
          const currentUrls = w.fotosTrabajos || [];
          const currentObj = w.workPhotos || [];
          const newUrls = Array.from(new Set([...currentUrls, ...urls]));
          return {
            ...w,
            fotosTrabajos: newUrls,
            workPhotos: [...currentObj, ...photoObjects],
          };
        }
        return w;
      })
    );

    setAnalytics((prev) => ({
      ...prev,
      fotos_subidas: prev.fotos_subidas + photos.length,
    }));
  }, []);

  // Remove photo from Firestore profile (by photo id)
  const removeWorkerPhoto = useCallback(async (workerId: string, photoId: string) => {
    const target = maestros.find((w) => w.id === workerId);
    if (!target) return;

    const filtered = (target.workPhotos || []).filter((p) => p.id !== photoId);

    try {
      await updateDoc(doc(db, 'maestros', workerId), {
        workPhotos: filtered,
        fotosTrabajos: filtered.map((p) => p.url),
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Photo remove error:', err);
    }

    setMaestros((prev) =>
      prev.map((w) => (w.id === workerId ? { ...w, workPhotos: filtered, fotosTrabajos: filtered.map((p) => p.url) } : w))
    );
  }, [maestros]);

  // Remove photo by URL with arrayRemove
  const removeWorkerPhotoByUrl = useCallback(async (workerId: string, photoUrl: string) => {
    const target = maestros.find((w) => w.id === workerId);
    if (!target) return;

    const matchingPhoto = (target.workPhotos || []).find((p) => p.url === photoUrl);

    try {
      const updates: any = {
        fotosTrabajos: arrayRemove(photoUrl),
        updatedAt: new Date().toISOString(),
      };
      if (matchingPhoto) {
        updates.workPhotos = arrayRemove(matchingPhoto);
      }
      await updateDoc(doc(db, 'maestros', workerId), updates);
    } catch (err) {
      console.warn('Photo arrayRemove error, fallback:', err);
      const filteredUrls = (target.fotosTrabajos || []).filter((u) => u !== photoUrl);
      const filteredObjs = (target.workPhotos || []).filter((p) => p.url !== photoUrl);
      try {
        await updateDoc(doc(db, 'maestros', workerId), {
          fotosTrabajos: filteredUrls,
          workPhotos: filteredObjs,
          updatedAt: new Date().toISOString(),
        });
      } catch (fallbackErr) {
        console.warn('Fallback update error:', fallbackErr);
      }
    }

    setMaestros((prev) =>
      prev.map((w) => {
        if (w.id === workerId) {
          return {
            ...w,
            fotosTrabajos: (w.fotosTrabajos || []).filter((u) => u !== photoUrl),
            workPhotos: (w.workPhotos || []).filter((p) => p.url !== photoUrl),
          };
        }
        return w;
      })
    );
  }, [maestros]);

  // Self-deletion for workers (privacy & account lifecycle)
  const deleteWorkerAccount = useCallback(async (workerId?: string): Promise<{ success: boolean; error?: string }> => {
    if (!firebaseUser) {
      return { success: false, error: 'No hay una sesión activa.' };
    }
    const targetWorkerId = workerId || currentWorker?.id || firebaseUser.uid;
    const isOwner = firebaseUser.uid === targetWorkerId || currentWorker?.userId === firebaseUser.uid || currentWorker?.id === targetWorkerId;
    if (!isOwner && !isAdmin) {
      return { success: false, error: 'No tienes permisos para eliminar esta cuenta.' };
    }

    try {
      // 1. Force refresh of ID token with true to avoid stale credential errors after long sessions
      let idToken = '';
      try {
        idToken = await firebaseUser.getIdToken(true);
      } catch (tokenErr: any) {
        console.error('[Account Deletion] Could not refresh ID token:', tokenErr);
        return { success: false, error: 'No se pudo obtener el token de seguridad. Por favor vuelve a iniciar sesión.' };
      }

      if (!idToken) {
        return { success: false, error: 'Token de autorización ausente.' };
      }

      // 2. Call backend endpoint to delete Auth user, Firestore doc, subcollections & storage
      // Backend handles complete atomic deletion via Firebase Admin SDK
      const apiRes = await fetch('/api/account', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
      });

      const data = await apiRes.json().catch(() => ({}));

      // Strict failure check: If backend deletion failed, DO NOT clear local state, DO NOT fake success
      if (!apiRes.ok || data.success !== true) {
        console.error('[Account Deletion Backend Failure]:', {
          status: apiRes.status,
          data,
        });
        const errorMsg = data?.error || data?.message || 'No se pudo completar la eliminación de tu cuenta en el servidor. Por favor intenta de nuevo.';
        return { success: false, error: errorMsg };
      }

      // 3. Clear local state and session artifacts ONLY after server confirms success
      // NO deleteUser(auth.currentUser) and NO frontend Firestore delete fallback
      setMaestros((prev) => prev.filter((m) => m.id !== targetWorkerId && m.userId !== firebaseUser.uid));
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.removeItem('maestro_cerca_demo_session');
          window.history.pushState({ view: { type: 'home' } }, '', '/');
        } catch {
          // ignore
        }
      }

      // 4. Immediately switch currentView to home to prevent any blank or stale dashboard state
      setCurrentView({ type: 'home' });

      // 5. Sign out from Firebase Auth
      await signOut(auth).catch(() => {});
      setFirebaseUser(null);
      setUserClaims(null);

      // 6. Confirmation message strictly requested
      showToast('Tu cuenta ha sido eliminada.');
      return { success: true };
    } catch (err: any) {
      console.error('[Account Deletion Exception]:', err);
      return { success: false, error: err?.message || 'No se pudo eliminar la cuenta. Intenta de nuevo.' };
    }
  }, [currentWorker, firebaseUser, isAdmin, showToast]);

  // =========================================================================
  // ADMIN OPERATIONS (Approval, Verification, Catalog Management)
  // =========================================================================
  const adminFetchAuthMethods = useCallback(async (
    uids: string[]
  ): Promise<Record<string, AdminAuthMethodInfo>> => {
    try {
      if (!auth.currentUser) return {};
      const validUids = (uids || []).filter((id) => typeof id === 'string' && id.trim().length > 0).slice(0, 100);
      if (validUids.length === 0) return {};

      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch('/api/admin/auth-methods', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ uids: validUids }),
      });

      if (!res.ok) {
        console.warn('Failed to fetch admin auth methods:', res.statusText);
        return {};
      }

      const data = await res.json();
      const map: Record<string, AdminAuthMethodInfo> = {};
      if (Array.isArray(data.authMethods)) {
        for (const item of data.authMethods) {
          if (item && item.uid) {
            map[item.uid] = item;
          }
        }
      }
      return map;
    } catch (err) {
      console.error('Error fetching admin auth methods:', err);
      return {};
    }
  }, []);

  const adminSetProfileStatus = useCallback(async (
    maestroId: string, 
    status: ProfileStatus
  ): Promise<{ success: boolean; error?: string }> => {
    if (!isAdmin) {
      return { success: false, error: 'No autorizado. Se requieren permisos de administrador.' };
    }

    const isApproved = status === 'Aprobado';

    // 4. REGLA TELÉFONO VERIFICADO:
    // NO permitir "Aprobado" si no existe Phone Auth verificado.
    // La fuente real debe venir de Firebase Auth, no sólo de un texto Firestore.
    if (isApproved) {
      try {
        const authMap = await adminFetchAuthMethods([maestroId]);
        const authRecord = authMap[maestroId];
        const targetMaestro = maestros.find((m) => m.id === maestroId);

        // Verification must be grounded in real Firebase Auth providerData / phoneNumber
        let hasVerifiedPhone = false;
        if (authRecord) {
          hasVerifiedPhone = authRecord.hasPhone;
        } else if (targetMaestro) {
          hasVerifiedPhone = Boolean(
            targetMaestro.phoneVerified && 
            targetMaestro.phoneVerificationMethod === 'sms' &&
            (targetMaestro.authProviders?.includes('phone') || targetMaestro.authProviders?.includes('sms'))
          );
        }

        if (!hasVerifiedPhone) {
          return {
            success: false,
            error: 'Este perfil todavía no puede aprobarse porque el teléfono no ha sido verificado por SMS.',
          };
        }
      } catch (checkErr) {
        console.warn('Error checking auth methods before approval:', checkErr);
        return {
          success: false,
          error: 'No se pudo validar el estado de verificación telefónica del maestro. Intenta de nuevo.',
        };
      }
    }

    // Semántica:
    // Pendiente: aprobado = false, statusPerfil = 'Pendiente'
    // Aprobado: aprobado = true, statusPerfil = 'Aprobado'
    // NO modificar isAvailable al cambiar el status administrativo.
    // NO modificar profileActive.
    const updates: Partial<Maestro> = {
      statusPerfil: status,
      aprobado: isApproved,
      updatedAt: new Date().toISOString(),
    };

    try {
      await updateDoc(doc(db, 'maestros', maestroId), updates);
    } catch (err: any) {
      console.warn('Admin set profile status error:', err);
      return { success: false, error: err?.message || 'Error al actualizar status del perfil.' };
    }

    setMaestros((prev) =>
      prev.map((m) => (m.id === maestroId ? { ...m, ...updates } : m))
    );

    return { success: true };
  }, [adminFetchAuthMethods, isAdmin, maestros]);

  const adminApproveMaestro = useCallback(async (
    maestroId: string, 
    aprobado: boolean
  ): Promise<{ success: boolean; error?: string }> => {
    return adminSetProfileStatus(maestroId, aprobado ? 'Aprobado' : 'Pendiente');
  }, [adminSetProfileStatus]);

  const adminUpdateMaestroTier = useCallback(async (maestroId: string, nivel: string) => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, 'maestros', maestroId), {
        nivel,
        updatedAt: new Date().toISOString(),
      });
      setMaestros((prev) =>
        prev.map((m) => (m.id === maestroId ? { ...m, nivel } : m))
      );
    } catch (err) {
      console.warn('Admin update tier error:', err);
    }
  }, [isAdmin]);

  const adminVerifyMaestro = useCallback(async (
    maestroId: string, 
    verificado: boolean, 
    checks?: { 
      identityVerified?: boolean; 
      referencesVerified?: boolean; 
      photosReviewed?: boolean; 
      adminEmail?: string;
    }
  ) => {
    const updates: Partial<Maestro> = {
      verificado,
      verificationStatus: verificado ? 'verified' : 'registered',
      tieneVerificacionPendiente: false,
      identityVerified: checks?.identityVerified !== undefined ? checks.identityVerified : verificado,
      referencesVerified: checks?.referencesVerified !== undefined ? checks.referencesVerified : verificado,
      photosReviewed: checks?.photosReviewed !== undefined ? checks.photosReviewed : verificado,
      ...(verificado
        ? {
            verifiedAt: new Date().toISOString(),
            verifiedBy: checks?.adminEmail || 'admin',
          }
        : {}),
      updatedAt: new Date().toISOString(),
    };

    const cleanUpdates = removeUndefinedFields(updates);

    try {
      await updateDoc(doc(db, 'maestros', maestroId), cleanUpdates);
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
      identityVerified?: boolean; 
      referencesVerified?: boolean; 
      photosReviewed?: boolean; 
    }
  ) => {
    await adminVerifyMaestro(workerId, status === 'verified', checks);
  }, [adminVerifyMaestro]);

  const adminDeleteMaestro = useCallback(async (maestroId: string): Promise<{ success: boolean; error?: string }> => {
    if (!firebaseUser) {
      const msg = 'No hay una sesión administrativa activa.';
      showToast(msg);
      return { success: false, error: msg };
    }
    if (!isAdmin) {
      const msg = 'Se requieren permisos de administrador para eliminar cuentas definitivamente.';
      showToast(msg);
      return { success: false, error: msg };
    }

    try {
      // Force refresh of ID token to ensure fresh admin claims and prevent stale credentials
      const idToken = await firebaseUser.getIdToken(true);
      const apiRes = await fetch('/api/account', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ workerId: maestroId }),
      });

      const data = await apiRes.json().catch(() => ({}));
      if (!apiRes.ok || data.success !== true) {
        console.error('[Admin Delete Maestro Failure]:', { status: apiRes.status, data });
        const errorMsg = data?.error || data?.message || 'No se pudo eliminar la cuenta del maestro.';
        showToast(`Error: ${errorMsg}`);
        return { success: false, error: errorMsg };
      }

      // Remove from local directory state only after confirmed backend deletion
      setMaestros((prev) => prev.filter((m) => m.id !== maestroId && m.userId !== maestroId));
      showToast('La cuenta del maestro ha sido eliminada definitivamente.');
      return { success: true };
    } catch (err: any) {
      console.error('[Admin Delete Maestro Exception]:', err);
      const errorMsg = err?.message || 'Error de conexión al eliminar la cuenta del maestro.';
      showToast(`Error: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  }, [firebaseUser, isAdmin, showToast]);

  // ManyChat CSV Leads Importer directly into /maestros with deterministic IDs and strict contract
  const importManyChatLeads = useCallback(async (leads: Array<Partial<Maestro>>): Promise<{ imported: number; skipped: number; errors: number }> => {
    if (!isAdmin || !auth.currentUser) return { imported: 0, skipped: 0, errors: 0 };
    
    // First attempt: privileged backend endpoint
    try {
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch('/api/admin/import-leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ leads }),
      });

      if (res.ok) {
        const result = await res.json();
        // Optimistically update local maestros state for the admin view
        const newlyImported = leads
          .filter((l) => l.id && l.nombre)
          .map((l) => sanitizeWorkerImages(l as Maestro));
        
        setMaestros((prev) => {
          const map = new Map<string, Maestro>();
          prev.forEach((m) => map.set(m.id, m));
          newlyImported.forEach((m) => {
            if (!map.has(m.id)) map.set(m.id, m);
          });
          return Array.from(map.values());
        });

        return {
          imported: result.imported || 0,
          skipped: result.skipped || 0,
          errors: result.errors || 0,
        };
      }
    } catch (err) {
      console.warn('Backend import-leads API error, attempting direct Firestore batch write:', err);
    }

    // Direct Firestore client-side batch write fallback
    try {
      let imported = 0;
      let skipped = 0;
      let errors = 0;

      const existingIds = new Set(maestros.map((m) => m.id));
      const existingPhones = new Set(
        maestros.map((m) => (m.telefono || m.phone || m.whatsapp || '').replace(/\D/g, '').slice(-10)).filter(Boolean)
      );

      let batch = writeBatch(db);
      let batchOps = 0;
      const addedToLocal: Maestro[] = [];

      for (const lead of leads) {
        if (!lead.id || !lead.nombre) {
          errors++;
          continue;
        }

        const phoneDigits = (lead.telefono || lead.phone || lead.whatsapp || '').replace(/\D/g, '').slice(-10);
        if (existingIds.has(lead.id) || (phoneDigits && existingPhones.has(phoneDigits))) {
          skipped++;
          continue;
        }

        const docRef = doc(db, 'maestros', lead.id);
        const cleanLeadDoc = removeUndefinedFields({
          ...lead,
          status: 'draft',
          onboardingIncomplete: true,
          registrationMethod: 'manychat_csv',
          createdAt: lead.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        batch.set(docRef, cleanLeadDoc, { merge: true });
        batchOps++;
        existingIds.add(lead.id);
        if (phoneDigits) existingPhones.add(phoneDigits);
        addedToLocal.push(cleanLeadDoc as Maestro);
        imported++;

        if (batchOps >= 300) {
          await batch.commit();
          batch = writeBatch(db);
          batchOps = 0;
        }
      }

      if (batchOps > 0) {
        await batch.commit();
      }

      if (addedToLocal.length > 0) {
        setMaestros((prev) => [...prev, ...addedToLocal]);
      }

      return { imported, skipped, errors };
    } catch (fallbackErr) {
      console.error('Direct Firestore batch import error:', fallbackErr);
      return { imported: 0, skipped: 0, errors: leads.length };
    }
  }, [isAdmin, maestros]);

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

  const adminUpdateTrade = useCallback(async (tradeId: string, updates: Partial<Trade>) => {
    try {
      await updateDoc(doc(db, 'trades', tradeId), removeUndefinedFields(updates));
      setTrades((prev) =>
        prev.map((t) => (t.id === tradeId ? { ...t, ...updates } : t))
      );
    } catch (e) {
      console.warn('Update trade error:', e);
    }
  }, []);

  const adminDeleteTrade = useCallback(async (tradeId: string) => {
    try {
      await deleteDoc(doc(db, 'trades', tradeId));
      setTrades((prev) => prev.filter((t) => t.id !== tradeId));
    } catch (e) {
      console.warn('Delete trade error:', e);
    }
  }, []);

  const adminToggleTrade = useCallback(async (tradeId: string) => {
    const target = trades.find((t) => t.id === tradeId);
    if (!target) return;
    const nextActive = !target.active;
    try {
      await updateDoc(doc(db, 'trades', tradeId), { active: nextActive });
    } catch (e) {
      console.warn('Toggle trade error:', e);
    }
    setTrades((prev) =>
      prev.map((t) => (t.id === tradeId ? { ...t, active: nextActive } : t))
    );
  }, [trades]);

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

  const adminUpdateServiceArea = useCallback(async (areaId: string, updates: Partial<ServiceArea>) => {
    try {
      await updateDoc(doc(db, 'serviceAreas', areaId), removeUndefinedFields(updates));
      setServiceAreas((prev) =>
        prev.map((a) => (a.id === areaId ? { ...a, ...updates } : a))
      );
    } catch (e) {
      console.warn('Update service area error:', e);
    }
  }, []);

  const adminDeleteServiceArea = useCallback(async (areaId: string) => {
    try {
      await deleteDoc(doc(db, 'serviceAreas', areaId));
      setServiceAreas((prev) => prev.filter((a) => a.id !== areaId));
    } catch (e) {
      console.warn('Delete service area error:', e);
    }
  }, []);

  const adminToggleServiceArea = useCallback(async (areaId: string) => {
    const target = serviceAreas.find((a) => a.id === areaId);
    if (!target) return;
    const nextActive = !target.active;
    try {
      await updateDoc(doc(db, 'serviceAreas', areaId), { active: nextActive });
    } catch (e) {
      console.warn('Toggle service area error:', e);
    }
    setServiceAreas((prev) =>
      prev.map((a) => (a.id === areaId ? { ...a, active: nextActive } : a))
    );
  }, [serviceAreas]);

  const getWorkerBySlug = useCallback(
    (slug: string) => {
      return maestros.find((w) => w.slug === slug);
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
    // Profile photo only awards points if officially approved by administration
    const hasApprovedPhoto = Boolean(
      (worker.photoUrl || worker.fotoUrl || worker.profilePhoto) &&
      worker.profilePhotoReviewStatus === 'approved'
    );
    if (hasApprovedPhoto) score += 10;
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
        isCatalogLoading,
        trades,
        serviceAreas,
        solicitudesContacto,
        contactEvents,
        analytics,
        currentWorker,
        isWorkerRegistrationActive,
        setIsWorkerRegistrationActive,
        cancelWorkerRegistration,
        sendPhoneVerificationCode,
        confirmPhoneVerificationCode,
        createWorkerProfile,
        loginAdmin,
        loginAdminWithGoogle,
        loginWorker,
        loginWorkerWithFacebook,
        registerWorkerWithFacebook,
        loginWorkerAsDemo,
        isDemoMode,
        workerProfileCompleted,
        linkFacebookAccount,
        sendPhoneLinkVerificationCode,
        confirmPhoneLinkCode,
        logoutWorker,
        deleteWorkerAccount,
        updateWorkerProfile,
        setWorkerAvailability,
        submitVerificationRequest,
        addWorkerPhoto,
        addWorkerPhotosBatch,
        removeWorkerPhoto,
        removeWorkerPhotoByUrl,
        toastMessage,
        showToast,
        clearToast,
        contactarWhatsApp,
        logContactClick,
        logProfileView,
        trackSearch,
        trackGenericEvent,
        adminApproveMaestro,
        adminSetProfileStatus,
        adminFetchAuthMethods,
        adminUpdateMaestroTier,
        importManyChatLeads,
        adminVerifyMaestro,
        adminSetVerificationStatus,
        adminDeleteMaestro,
        adminAddTrade,
        adminUpdateTrade,
        adminDeleteTrade,
        adminToggleTrade,
        adminAddServiceArea,
        adminUpdateServiceArea,
        adminDeleteServiceArea,
        adminToggleServiceArea,
        fetchPrivateVerificationDossier,
        submitPendingProfilePhoto,
        submitProfileReport,
        adminReviewProfilePhoto,
        adminFetchProfileReports,
        adminUpdateReportStatus,
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
