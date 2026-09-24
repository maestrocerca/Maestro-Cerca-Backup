import React, { useState } from 'react';
import { 
  User, 
  Briefcase, 
  MapPin, 
  ImageIcon, 
  ShieldCheck, 
  Shield,
  Award, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle, 
  Plus, 
  Trash2, 
  Upload, 
  MessageCircle, 
  Phone, 
  Eye, 
  Clock, 
  Sparkles,
  Save,
  Camera,
  Mail,
  Send,
  RefreshCw,
  X,
  Link2,
  AlertTriangle,
  PauseCircle,
  PlayCircle
} from 'lucide-react';
import { ConfirmationResult } from 'firebase/auth';
import { useStore } from '../context/StoreContext';
import { cleanMexicanPhoneInput } from '../lib/whatsapp';
import { FACEBOOK_AUTH_ENABLED } from '../config/featureFlags';
import { WorkPhoto } from '../types';
import { WorkerAvatar } from './WorkerAvatar';
import { VerificationRadialProgress, VerificationRequirementItem } from './VerificationRadialProgress';
import { 
  uploadWorkerProfileImage, 
  uploadWorkerWorkPhoto, 
  uploadVerificationDocument, 
  validateImageFile,
  validateVerificationDoc 
} from '../lib/storage';

const WhatsAppGlyph: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.39 1.26 4.81L2 22l5.41-1.42a9.87 9.87 0 0 0 4.63 1.18h.01c5.46 0 9.9-4.45 9.9-9.91C21.96 6.45 17.5 2 12.04 2zm5.81 14.14c-.25.7-1.46 1.34-2.02 1.42-.52.08-1.18.11-1.9-.12-.44-.14-1-.32-1.72-.62-3.03-1.31-5.01-4.36-5.16-4.56-.15-.2-1.23-1.64-1.23-3.12 0-1.49.78-2.22 1.06-2.52.28-.3.6-.37.8-.37.2 0 .4 0 .58.01.19.01.44-.07.68.52.25.6.86 2.08.93 2.23.07.15.12.33.02.53-.1.2-.15.32-.3.5-.15.18-.31.4-.44.53-.15.15-.3.31-.13.6.17.3.75 1.24 1.62 2.01 1.11.99 2.05 1.3 2.34 1.45.29.15.46.13.63-.08.17-.2.72-.84.92-1.13.2-.29.4-.24.66-.14.27.1 1.72.81 2.02.96.29.15.49.22.56.35.07.13.07.75-.18 1.45z" />
  </svg>
);

export const WorkerDashboardView: React.FC = () => {
  const { 
    currentWorker, 
    firebaseUser,
    logoutWorker,
    updateWorkerProfile, 
    setWorkerAvailability,
    submitVerificationRequest, 
    submitPendingProfilePhoto,
    addWorkerPhoto, 
    addWorkerPhotosBatch,
    removeWorkerPhoto, 
    removeWorkerPhotoByUrl,
    deleteWorkerAccount,
    calculateProfileCompletion, 
    trades, 
    serviceAreas, 
    navigateTo,
    contactEvents,
    showToast,
    linkFacebookAccount,
    sendPhoneLinkVerificationCode,
    confirmPhoneLinkCode,
    isAdmin
  } = useStore();

  const [activeTab, setActiveTab] = useState<'profile' | 'photos' | 'stats'>('profile');

  // Local Form state for editing
  const [formData, setFormData] = useState({
    firstName: currentWorker?.firstName || '',
    lastName: currentWorker?.lastName || '',
    email: currentWorker?.email || '',
    phone: currentWorker?.phone || '',
    whatsapp: currentWorker?.whatsapp || '',
    mainTrade: currentWorker?.mainTrade || '',
    secondaryTrades: currentWorker?.secondaryTrades || [],
    description: currentWorker?.description || '',
    yearsExperience: currentWorker?.yearsExperience || 5,
    services: currentWorker?.services || [],
    serviceAreas: currentWorker?.serviceAreas || [],
    profilePhoto: currentWorker?.profilePhoto || '',
  });

  const [newService, setNewService] = useState('');
  const [newPhotoTitle, setNewPhotoTitle] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isUploadingProfilePhoto, setIsUploadingProfilePhoto] = useState(false);
  const [pendingPhotoPreviewUrl, setPendingPhotoPreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ total: number; current: number } | null>(null);
  const [isDraggingPhotos, setIsDraggingPhotos] = useState(false);

  // Gallery photo deletion modal state
  const [photoToDelete, setPhotoToDelete] = useState<{ id: string; url: string; title: string } | null>(null);
  const [isDeletingPhoto, setIsDeletingPhoto] = useState(false);

  // Self-deletion modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState('');

  // Worker availability modal state
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  const [isTogglingAvailability, setIsTogglingAvailability] = useState(false);

  // Verification request form state (optional documents and optional notes, NO references)
  const [verifDocFile, setVerifDocFile] = useState<File | null>(null);
  const [verifDocName, setVerifDocName] = useState('');
  const [verifNotes, setVerifNotes] = useState('');
  const [verifSubmitted, setVerifSubmitted] = useState(false);
  const [isSubmittingVerif, setIsSubmittingVerif] = useState(false);

  // ManyChat / WhatsApp claimed profile one-time banner
  const [showManyChatBanner, setShowManyChatBanner] = useState(() => {
    if (!currentWorker) return false;
    const isFromManyChat = currentWorker.source === 'manychat' || Boolean(currentWorker.claimedFromPreWorkerId);
    if (!isFromManyChat) return false;
    const dismissedKey = `manychat_claimed_dismissed_${currentWorker.id}`;
    if (typeof window !== 'undefined') {
      return localStorage.getItem(dismissedKey) !== 'true';
    }
    return true;
  });

  const handleDismissManyChatBanner = () => {
    if (currentWorker) {
      localStorage.setItem(`manychat_claimed_dismissed_${currentWorker.id}`, 'true');
    }
    setShowManyChatBanner(false);
  };

  // Normalized portfolio photos list from both workPhotos and fotosTrabajos
  const portfolioPhotos = React.useMemo(() => {
    if (!currentWorker) return [];
    const list: Array<{ id: string; url: string; title: string }> = [];
    const seen = new Set<string>();

    if (currentWorker.workPhotos && Array.isArray(currentWorker.workPhotos)) {
      currentWorker.workPhotos.forEach((p, idx) => {
        if (p?.url && !seen.has(p.url)) {
          seen.add(p.url);
          list.push({
            id: p.id || `wp-${idx}`,
            url: p.url,
            title: p.title || 'Trabajo realizado'
          });
        }
      });
    }

    if (currentWorker.fotosTrabajos && Array.isArray(currentWorker.fotosTrabajos)) {
      currentWorker.fotosTrabajos.forEach((url, idx) => {
        if (url && typeof url === 'string' && !seen.has(url)) {
          seen.add(url);
          list.push({
            id: `ft-${idx}`,
            url,
            title: 'Trabajo realizado'
          });
        }
      });
    }

    return list;
  }, [currentWorker?.workPhotos, currentWorker?.fotosTrabajos]);

  // Sync formData whenever currentWorker updates from Firestore
  React.useEffect(() => {
    if (currentWorker) {
      setFormData({
        firstName: currentWorker.firstName || '',
        lastName: currentWorker.lastName || '',
        email: currentWorker.email || '',
        phone: currentWorker.phone || '',
        whatsapp: currentWorker.whatsapp || '',
        mainTrade: currentWorker.mainTrade || '',
        secondaryTrades: currentWorker.secondaryTrades || [],
        description: currentWorker.description || '',
        yearsExperience: currentWorker.yearsExperience || 5,
        services: currentWorker.services || [],
        serviceAreas: currentWorker.serviceAreas || [],
        profilePhoto: currentWorker.profilePhoto || '',
      });
    }
  }, [currentWorker?.id, currentWorker?.updatedAt]);

  if (isAdmin) {
    navigateTo({ type: 'admin' });
    return null;
  }

  if (!firebaseUser) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center bg-[#FAF8F5] py-16 px-4">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-slate-200 shadow-xs text-center space-y-5">
          <div className="w-14 h-14 bg-orange-100 text-[#FF6B00] rounded-2xl flex items-center justify-center mx-auto">
            <User className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Acceso protegido</h2>
            <p className="text-slate-600 text-sm leading-relaxed">
              Debes iniciar sesión con tu cuenta de trabajador para acceder a tu panel de control.
            </p>
          </div>
          <button
            onClick={() => navigateTo({ type: 'login' })}
            className="w-full py-3.5 px-6 bg-[#FF6B00] hover:bg-[#e65f00] active:scale-[0.98] text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            Iniciar sesión
          </button>
        </div>
      </div>
    );
  }

  if (!currentWorker) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center bg-[#FAF8F5] py-16 px-4">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-slate-200 shadow-xs text-center space-y-5">
          <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Registro incompleto</h2>
            <p className="text-slate-600 text-sm leading-relaxed">
              Tu sesión está activa, pero aún no has completado tu perfil de maestro en la plataforma. Completa los pasos para activar tu perfil y acceder a tu panel.
            </p>
          </div>
          <div className="space-y-2.5 pt-2">
            <button
              onClick={() => navigateTo({ type: 'register' })}
              className="w-full py-3.5 px-6 bg-[#FF6B00] hover:bg-[#e65f00] active:scale-[0.98] text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Completar mi registro
            </button>
            <button
              onClick={logoutWorker}
              className="w-full py-2.5 px-4 text-slate-600 hover:text-slate-900 font-medium text-sm transition-colors cursor-pointer"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  const completionScore = calculateProfileCompletion(currentWorker);
  const isVerified = currentWorker.verificationStatus === 'verified' || currentWorker.verificado === true;

  // Real Provider inspection directly from Firebase Authentication
  const providers = firebaseUser?.providerData || [];
  const phoneProvider = providers.find((p) => p.providerId === 'phone');
  const facebookProvider = providers.find((p) => p.providerId === 'facebook.com');

  const authPhoneDigits = (firebaseUser?.phoneNumber || phoneProvider?.phoneNumber || '').replace(/\D/g, '').slice(-10);
  const currentPhoneDigits = (formData.phone || currentWorker.phone || '').replace(/\D/g, '').slice(-10);

  // Phone is truly linked if Firebase Auth has the phone provider AND matches current phone
  const isPhoneLinked = Boolean(
    (phoneProvider || firebaseUser?.phoneNumber) &&
    Boolean(authPhoneDigits) &&
    (!currentPhoneDigits || authPhoneDigits === currentPhoneDigits)
  );

  // Phone is truly verified ONLY if Firebase Auth confirmed SMS and doc has phoneVerified
  const isTrulyPhoneVerified = Boolean(
    currentWorker.phoneVerified &&
    isPhoneLinked
  );

  const isFacebookLinked = Boolean(facebookProvider);
  const isAvailable = currentWorker.isAvailable !== false;

  // Core verification requirements calculation:
  // 1. Nombre y oficio
  const reqNameTrade = Boolean(
    ((formData.firstName && formData.lastName) || (currentWorker.firstName && currentWorker.lastName) || currentWorker.nombre) &&
    (formData.mainTrade || currentWorker.mainTrade || currentWorker.oficio)
  );

  // 2. Teléfono verificado por SMS
  const reqPhone = isTrulyPhoneVerified;

  // 3. Foto aprobada por administración
  const reqPhotoApproved = Boolean(
    (currentWorker.profilePhoto || currentWorker.fotoUrl) &&
    currentWorker.profilePhotoReviewStatus === 'approved'
  );

  // 4. Al menos 3 fotos de trabajos
  const reqWorkPhotos3 = Boolean(
    portfolioPhotos.length >= 3 ||
    (currentWorker.workPhotos && currentWorker.workPhotos.length >= 3) ||
    (currentWorker.fotosTrabajos && currentWorker.fotosTrabajos.length >= 3)
  );

  // 5. Al menos 2 servicios
  const reqServices2 = Boolean(formData.services && formData.services.length >= 2);

  const verificationItems: VerificationRequirementItem[] = [
    {
      id: 'nameTrade',
      label: 'Nombre y oficio',
      isCompleted: reqNameTrade,
      hint: 'Nombre completo y especialidad u oficio principal',
      actionTab: 'profile',
      anchorId: 'section-basic-info',
    },
    {
      id: 'phone',
      label: 'Teléfono verificado',
      isCompleted: reqPhone,
      hint: 'Número de WhatsApp autenticado con SMS',
      actionTab: 'profile',
      anchorId: 'access-methods-section',
    },
    {
      id: 'photo',
      label: 'Foto de perfil aprobada',
      isCompleted: reqPhotoApproved,
      hint: currentWorker.profilePhotoReviewStatus === 'pending'
        ? 'Foto enviada, pendiente de revisión administrativa'
        : currentWorker.profilePhotoReviewStatus === 'rejected'
        ? 'Foto rechazada. Por favor sube una nueva imagen'
        : 'Fotografía personal revisada y aprobada por el equipo',
      actionTab: 'profile',
      anchorId: 'section-profile-header',
    },
    {
      id: 'workPhotos',
      label: 'Al menos 3 fotos de trabajos',
      isCompleted: reqWorkPhotos3,
      hint: `Tienes ${portfolioPhotos.length} de 3 fotos mínimas en tu portafolio`,
      actionTab: 'photos',
    },
    {
      id: 'services',
      label: 'Al menos 2 servicios que realizas',
      isCompleted: reqServices2,
      hint: `Tienes ${formData.services.length} de 2 servicios mínimos registrados`,
      actionTab: 'profile',
      anchorId: 'worker-services-section',
    },
  ];

  const completedVerificationCount = verificationItems.filter((i) => i.isCompleted).length;
  const totalVerificationCount = verificationItems.length;
  const allVerificationRequirementsMet = completedVerificationCount === totalVerificationCount;

  // Metrics for this worker
  const workerEvents = contactEvents.filter((e) => e.workerId === currentWorker.id);
  const whatsappCount = workerEvents.filter((e) => e.type === 'whatsapp').length;
  const phoneCount = workerEvents.filter((e) => e.type === 'phone').length;
  const viewCount = workerEvents.filter((e) => e.type === 'profileView').length;

  const phoneValue = firebaseUser?.phoneNumber || phoneProvider?.phoneNumber || currentWorker?.phone;
  const facebookDisplayName = facebookProvider?.displayName || (isFacebookLinked ? (firebaseUser?.displayName || 'Facebook') : '');

  const formatMaskedPhone = (val?: string | null): string => {
    if (!val) return '';
    const digits = val.replace(/\D/g, '');
    if (digits.length < 4) return val;
    const last4 = digits.slice(-4);
    return `+52 •••• •••• ${last4}`;
  };

  // Account Linking States
  const [isLinkingFacebook, setIsLinkingFacebook] = useState(false);
  const [linkingError, setLinkingError] = useState('');
  const [linkingSuccess, setLinkingSuccess] = useState('');

  // Phone Linking Sub-flow
  const [showPhoneLinkForm, setShowPhoneLinkForm] = useState(false);
  const [linkPhoneDigits, setLinkPhoneDigits] = useState('');
  const [linkSmsCode, setLinkSmsCode] = useState('');
  const [linkConfirmationResult, setLinkConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [isSendingPhoneSms, setIsSendingPhoneSms] = useState(false);
  const [isConfirmingPhoneSms, setIsConfirmingPhoneSms] = useState(false);
  const [linkCooldown, setLinkCooldown] = useState(0);

  React.useEffect(() => {
    let timer: any = null;
    if (linkCooldown > 0) {
      timer = setInterval(() => {
        setLinkCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [linkCooldown]);

  const handleLinkFacebook = async () => {
    setLinkingError('');
    setLinkingSuccess('');
    setIsLinkingFacebook(true);
    try {
      const res = await linkFacebookAccount();
      if (res.success) {
        setLinkingSuccess('Cuenta de Facebook vinculada exitosamente a tu perfil.');
      } else if (res.error) {
        console.error('[Facebook Link Error in View]:', res.error);
        setLinkingError(res.error);
      }
    } catch (err: any) {
      console.error('[Facebook Link Exception in View]:', err?.code, err?.message, err);
      setLinkingError(err?.message || 'Error al vincular cuenta de Facebook.');
    } finally {
      setIsLinkingFacebook(false);
    }
  };

  const handleSendPhoneLinkSms = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLinkingError('');
    setLinkingSuccess('');
    const clean = cleanMexicanPhoneInput(linkPhoneDigits);
    if (clean.length !== 10) {
      setLinkingError('Por favor ingresa los 10 dígitos de tu número celular.');
      return;
    }

    if (!firebaseUser) {
      setLinkingError('Debes tener una sesión activa para vincular un teléfono.');
      return;
    }

    setIsSendingPhoneSms(true);
    const formattedE164 = `+52${clean}`;

    // Pre-check phone availability with backend using intent: 'link' and Bearer token
    try {
      const token = await firebaseUser.getIdToken(true);
      const checkRes = await fetch('/api/auth/phone-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          phone: formattedE164,
          intent: 'link',
        }),
      });

      if (!checkRes.ok) {
        const errorData = await checkRes.json().catch(() => ({}));
        setLinkingError(errorData?.error || 'No pudimos verificar la disponibilidad de este teléfono. Intenta de nuevo.');
        setIsSendingPhoneSms(false);
        return;
      }

      const checkData = await checkRes.json();
      if (!checkData?.success) {
        setLinkingError(checkData?.error || 'No pudimos verificar la disponibilidad de este teléfono. Intenta de nuevo.');
        setIsSendingPhoneSms(false);
        return;
      }

      if (checkData.usedByOther === true) {
        setLinkingError('Este teléfono ya está asociado a otra cuenta de Maestro Cerca.');
        setIsSendingPhoneSms(false);
        return;
      }
    } catch (checkErr: any) {
      setLinkingError('No pudimos verificar la disponibilidad de este teléfono. Intenta de nuevo.');
      setIsSendingPhoneSms(false);
      return;
    }

    try {
      const res = await sendPhoneLinkVerificationCode(formattedE164, 'link-phone-recaptcha-container');
      if (res.success && res.confirmationResult) {
        setLinkConfirmationResult(res.confirmationResult);
        setLinkCooldown(60);
        setLinkingSuccess('Código SMS enviado a tu celular.');
      } else if (res.error) {
        setLinkingError(res.error);
      }
    } catch (err: any) {
      setLinkingError(err?.message || 'Error al enviar código SMS de verificación.');
    } finally {
      setIsSendingPhoneSms(false);
    }
  };

  const handleConfirmPhoneLink = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!linkConfirmationResult) return;
    setLinkingError('');
    setLinkingSuccess('');
    const clean = linkSmsCode.trim().replace(/\D/g, '');
    if (clean.length < 6) {
      setLinkingError('Ingresa el código completo de 6 dígitos recibido por SMS.');
      return;
    }

    setIsConfirmingPhoneSms(true);
    try {
      const res = await confirmPhoneLinkCode(linkConfirmationResult, clean);
      if (res.success) {
        setLinkingSuccess('Número celular vinculado exitosamente a tu cuenta.');
        const cleanDigits = cleanMexicanPhoneInput(linkPhoneDigits);
        if (cleanDigits) {
          setFormData((prev) => ({
            ...prev,
            phone: cleanDigits,
            whatsapp: prev.whatsapp || cleanDigits,
          }));
        }
        setShowPhoneLinkForm(false);
        setLinkPhoneDigits('');
        setLinkSmsCode('');
        setLinkConfirmationResult(null);
      } else if (res.error) {
        setLinkingError(res.error);
      }
    } catch (err: any) {
      setLinkingError(err?.message || 'Error al confirmar código SMS.');
    } finally {
      setIsConfirmingPhoneSms(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveError('');
    try {
      const res = await updateWorkerProfile(currentWorker.id, {
        ...formData,
        yearsExperience: Number(formData.yearsExperience),
      });
      if (res.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3500);
      } else {
        setSaveError(res.error || 'Ocurrió un error al guardar los cambios. Intenta de nuevo.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleProfilePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    const check = validateImageFile(file, 5);
    if (!check.valid) {
      setSaveError(check.error || 'Archivo inválido. Se requiere JPEG, PNG o WebP de hasta 5MB.');
      showToast(check.error || 'Archivo inválido');
      return;
    }

    setIsUploadingProfilePhoto(true);
    setSaveError('');
    try {
      const uploadRes = await uploadWorkerProfileImage(currentWorker.userId || currentWorker.id, file);
      const localUrl = URL.createObjectURL(file);
      setPendingPhotoPreviewUrl(localUrl);

      await submitPendingProfilePhoto(currentWorker.id, uploadRes.storagePath);
      showToast('Foto de perfil subida. Está en revisión de moderación antes de publicarse.');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err: any) {
      console.error('Profile photo upload error:', err);
      const errMsg = 'Ocurrió un error al subir la foto de perfil. Intenta de nuevo.';
      setSaveError(errMsg);
      showToast(errMsg);
    } finally {
      setIsUploadingProfilePhoto(false);
      e.target.value = '';
    }
  };

  const processAndUploadWorkPhotos = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    for (const file of fileArray) {
      const check = validateImageFile(file, 5);
      if (!check.valid) {
        setSaveError(check.error || `El archivo ${file.name} no es una imagen válida (JPG, PNG, WebP máx. 5MB).`);
        showToast(check.error || 'Uno de los archivos no es válido.');
        return;
      }
    }

    setIsUploadingPhoto(true);
    setSaveError('');
    setUploadProgress({ total: fileArray.length, current: 0 });

    try {
      const uploadedResults: Array<{ url: string; title: string }> = [];

      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        setUploadProgress({ total: fileArray.length, current: i + 1 });
        const uploaded = await uploadWorkerWorkPhoto(
          currentWorker.userId || currentWorker.id, 
          file, 
          newPhotoTitle.trim() || undefined,
          i
        );
        uploadedResults.push(uploaded);
      }

      await addWorkerPhotosBatch(currentWorker.id, uploadedResults);
      setNewPhotoTitle('');
      showToast(`Se agregaron ${uploadedResults.length} foto${uploadedResults.length > 1 ? 's' : ''} a tu portafolio.`);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err: any) {
      console.error('Work photo batch upload error:', err);
      const errMsg = 'Ocurrió un error al guardar los cambios. Intenta de nuevo.';
      setSaveError(errMsg);
      showToast(errMsg);
    } finally {
      setIsUploadingPhoto(false);
      setUploadProgress(null);
    }
  };

  const handleWorkPhotosFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processAndUploadWorkPhotos(e.target.files);
      e.target.value = '';
    }
  };

  const handleConfirmDeletePhoto = async () => {
    if (!photoToDelete || !currentWorker) return;
    setIsDeletingPhoto(true);
    try {
      await removeWorkerPhotoByUrl(currentWorker.id, photoToDelete.url);
      if (photoToDelete.id && !photoToDelete.id.startsWith('ft-')) {
        await removeWorkerPhoto(currentWorker.id, photoToDelete.id);
      }
      showToast('Fotografía eliminada del portafolio.');
      setPhotoToDelete(null);
    } catch (err: any) {
      console.error('Error removing photo:', err);
      showToast('Error al eliminar la fotografía.');
    } finally {
      setIsDeletingPhoto(false);
    }
  };

  const TRADE_SERVICE_SUGGESTIONS: Record<string, string[]> = {
    'Albañil': ['Bardas y muros', 'Aplanados y yeso', 'Colocación de piso y azulejo', 'Firme de concreto', 'Remodelaciones', 'Cisterna'],
    'Plomero': ['Reparación de fugas', 'Instalación de tinaco', 'Instalación de calentador / boiler', 'Destape de drenaje', 'Instalación de grifería', 'Bomba de agua'],
    'Electricista': ['Cableado e instalaciones', 'Localización de cortos', 'Instalación de lámparas y luminarias', 'Centro de carga y pastillas', 'Contactos y apagadores', 'Instalación 220V'],
    'Pintor': ['Pintura interior', 'Pintura de fachadas', 'Impermeabilización de techos', 'Esmalte en herrería', 'Texturizados y pastas', 'Barniz en madera'],
    'Carpintero': ['Puertas de madera', 'Closets a medida', 'Cocinas integrales', 'Muebles de baño', 'Reparación y ajuste de muebles', 'Chapas y cerraduras'],
    'Herrero': ['Puertas y portones', 'Protecciones para ventanas', 'Barandales y pasamanos', 'Estructuras metálicas', 'Reparación de herrería', 'Techumbres ligeras'],
    'Tablarroquero': ['Muros de tablaroca', 'Plafones lisos y decorativos', 'Muebles de tablaroca', 'Aislamiento acústico', 'Reparación de grietas y huecos'],
    'Impermeabilizador': ['Impermeabilización con manto asfáltico', 'Impermeabilización acrílica', 'Sellado de grietas', 'Tratamiento de humedad', 'Desagües pluviales'],
    'Instalador de pisos': ['Piso cerámico', 'Porcelanato', 'Piso laminado y vinílico', 'Zoclo y remates', 'Nivelación de firme'],
    'Mantenimiento general': ['Mantenimiento residencial', 'Reparaciones menores del hogar', 'Pintura y retoques', 'Plomería básica', 'Instalaciones eléctricas básicas']
  };

  const handleAddServiceItem = () => {
    if (newService.trim()) {
      const trimmed = newService.trim();
      if (!formData.services.includes(trimmed)) {
        const updated = [...formData.services, trimmed];
        setFormData({ ...formData, services: updated });
        updateWorkerProfile(currentWorker.id, { services: updated });
      }
      setNewService('');
    }
  };

  const handleAddSuggestedService = (serviceText: string) => {
    if (!formData.services.includes(serviceText)) {
      const updated = [...formData.services, serviceText];
      setFormData({ ...formData, services: updated });
      updateWorkerProfile(currentWorker.id, { services: updated });
    }
  };

  const handleRemoveServiceItem = (idx: number) => {
    const updated = formData.services.filter((_, i) => i !== idx);
    setFormData({ ...formData, services: updated });
    updateWorkerProfile(currentWorker.id, { services: updated });
  };

  const handleVerificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorker) return;
    if (!allVerificationRequirementsMet) {
      setSaveError('Completa los requisitos obligatorios antes de solicitar revisión.');
      return;
    }
    setIsSubmittingVerif(true);
    setSaveError('');
    try {
      let finalDocPath = '';
      if (verifDocFile && firebaseUser) {
        const uploadRes = await uploadVerificationDocument(firebaseUser.uid, verifDocFile, 'comprobante');
        finalDocPath = uploadRes.storagePath;
      }

      const res = await submitVerificationRequest(currentWorker.id, {
        documents: finalDocPath ? [finalDocPath] : [],
        notes: verifNotes.trim(),
      });

      if (res.success) {
        setVerifSubmitted(true);
        showToast('Solicitud de revisión enviada exitosamente.');
      } else {
        setSaveError(res.error || 'No se pudo enviar la solicitud.');
      }
    } catch (err: any) {
      console.error('Verification submission error:', err);
      setSaveError(err?.message || 'Error al procesar la solicitud de verificación.');
    } finally {
      setIsSubmittingVerif(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!currentWorker) return;
    setIsDeletingAccount(true);
    setDeleteAccountError('');
    try {
      const res = await deleteWorkerAccount(currentWorker.id);
      if (res.success) {
        setShowDeleteModal(false);
        navigateTo({ type: 'home' });
      } else {
        setDeleteAccountError(res.error || 'No se pudo eliminar la cuenta. Intenta de nuevo.');
        setIsDeletingAccount(false);
      }
    } catch (err: any) {
      setDeleteAccountError(err?.message || 'Ocurrió un error al eliminar tu cuenta.');
      setIsDeletingAccount(false);
    }
  };

  const handleToggleAvailability = async () => {
    if (!currentWorker) return;
    setIsTogglingAvailability(true);
    try {
      const nextVal = !isAvailable;
      const res = await setWorkerAvailability(currentWorker.id, nextVal);
      if (res.success) {
        showToast(
          nextVal
            ? 'Tu perfil vuelve a estar disponible para clientes.'
            : 'Tu disponibilidad ha sido pausada temporalmente.'
        );
        setShowAvailabilityModal(false);
      } else {
        showToast(res.error || 'No se pudo actualizar la disponibilidad.');
      }
    } catch (err: any) {
      console.error('Availability toggle error:', err);
      showToast('Error al actualizar disponibilidad.');
    } finally {
      setIsTogglingAvailability(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8">
        
        {/* One-time ManyChat / WhatsApp claimed profile notification */}
        {showManyChatBanner && (
          <div
            id="manychat-claimed-banner"
            className="relative bg-emerald-50 border border-emerald-200 rounded-3xl p-4 sm:p-5 shadow-xs flex items-center gap-4 animate-in fade-in duration-300"
          >
            <button
              onClick={handleDismissManyChatBanner}
              className="absolute top-3 right-3 p-1.5 text-emerald-700/50 hover:text-emerald-900 hover:bg-emerald-100 rounded-lg transition-colors"
              aria-label="Cerrar aviso"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="w-12 h-12 rounded-2xl bg-[#25D366] text-white flex items-center justify-center shrink-0 shadow-xs">
              <WhatsAppGlyph className="w-7 h-7" />
            </div>
            <h4 className="flex-1 pr-6 text-base sm:text-lg font-black text-emerald-950 leading-tight">
              Registro de WhatsApp completado
            </h4>
            <button
              id="dismiss-manychat-banner-btn"
              onClick={handleDismissManyChatBanner}
              className="shrink-0 px-4 sm:px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-black rounded-xl shadow-xs transition-colors"
            >
              Entendido
            </button>
          </div>
        )}

        {/* High-visibility Warning Banner for Unverified Phone */}
        {!isTrulyPhoneVerified && (
          <div 
            id="dashboard-phone-unverified-alert" 
            className="p-5 sm:p-6 bg-amber-50 border-2 border-amber-300 rounded-3xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in duration-300"
          >
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-base font-black text-amber-950">Teléfono pendiente de verificar</h4>
                  <span className="text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-900 border border-amber-300">
                    Perfil no visible en el directorio
                  </span>
                </div>
                <p className="text-sm text-amber-900 leading-relaxed font-medium">
                  Tu número de teléfono aún no ha sido validado por SMS. Tu perfil permanecerá con estatus <strong>Pendiente</strong> y no será visible para los clientes de Querétaro hasta que confirmes tu celular.
                </p>
              </div>
            </div>
            <button
              type="button"
              id="dashboard-verify-phone-sms-btn"
              onClick={() => {
                setActiveTab('profile');
                setShowPhoneLinkForm(true);
                setTimeout(() => {
                  document.getElementById('access-methods-section')?.scrollIntoView({
                    behavior: 'smooth',
                  });
                }, 100);
              }}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs sm:text-sm rounded-xl shadow-xs transition-colors shrink-0 cursor-pointer"
            >
              <Phone className="w-4 h-4" />
              <span>VERIFICAR POR SMS</span>
            </button>
          </div>
        )}

        {/* Persistent Warning Banner for WhatsApp-registered workers without an approved profile photo */}
        {currentWorker.registrationMethod === 'manychat_whatsapp' && !reqPhotoApproved && (
          <div
            id="dashboard-photo-required-alert"
            className="p-5 sm:p-6 bg-orange-50 border-2 border-orange-300 rounded-3xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in duration-300"
          >
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-orange-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Camera className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-base font-black text-orange-950">Falta tu foto de perfil</h4>
                  <span className="text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-orange-200 text-orange-900 border border-orange-300">
                    Aún apareces como "Registrado"
                  </span>
                </div>
                <p className="text-sm text-orange-900 leading-relaxed font-medium">
                  Sube o toma tu foto de perfil ahora para que los clientes puedan verificar que eres tú. Sin ella, tu perfil se queda en "Registrado" en lugar de avanzar a "Verificado".
                </p>
              </div>
            </div>
            <button
              type="button"
              id="dashboard-upload-photo-btn"
              onClick={() => {
                setActiveTab('profile');
                setTimeout(() => {
                  document.getElementById('section-profile-header')?.scrollIntoView({
                    behavior: 'smooth',
                  });
                }, 100);
              }}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#FF6B00] hover:bg-[#e65f00] active:scale-[0.98] text-white font-black text-xs sm:text-sm rounded-xl shadow-xs transition-colors shrink-0 cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>SUBIR FOTO</span>
            </button>
          </div>
        )}

        {/* Header Profile Card */}
        <div id="section-profile-header" className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Identity block: photo is the dominant visual element */}
          <div className="p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center gap-6">
            <div className="relative group shrink-0 mx-auto sm:mx-0">
              <WorkerAvatar
                worker={currentWorker}
                allowPendingPreview={true}
                previewUrl={pendingPhotoPreviewUrl}
                alt={`${currentWorker.firstName} ${currentWorker.lastName}`}
                size="lg"
                className="!rounded-full"
                imgClassName="rounded-full transition-transform duration-300 group-hover:scale-105"
              >
                {/* Uploading indicator overlay */}
                {isUploadingProfilePhoto && (
                  <div className="absolute inset-0 bg-slate-900/75 flex flex-col items-center justify-center text-white gap-1 p-2 z-20">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span className="text-[10px] font-bold">Subiendo...</span>
                  </div>
                )}

                {/* Desktop hover overlay */}
                {!isUploadingProfilePhoto && (
                  <label
                    className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white cursor-pointer p-1 text-center z-10"
                    title="Cambiar foto de perfil (JPG, PNG, WebP máx. 5MB)"
                  >
                    <Camera className="w-6 h-6 mb-0.5" />
                    <span className="text-xs font-bold leading-tight">Cambiar foto</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleProfilePhotoUpload}
                      disabled={isUploadingProfilePhoto}
                      className="hidden"
                    />
                  </label>
                )}
              </WorkerAvatar>

              {/* Accessible Camera badge on bottom-right corner */}
              <label
                className="absolute -bottom-1.5 -right-1.5 p-2.5 bg-[#FF6B00] hover:bg-[#e65f00] active:scale-[0.98] text-white rounded-xl shadow-md cursor-pointer transition-all hover:scale-110 active:scale-95 z-20 flex items-center justify-center"
                title="Cambiar foto de perfil (JPG, PNG, WebP máx. 5MB)"
              >
                <Camera className="w-4 h-4" />
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleProfilePhotoUpload}
                  disabled={isUploadingProfilePhoto}
                  className="hidden"
                />
              </label>
            </div>

            <div className="flex-1 space-y-2 text-center sm:text-left">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
                {currentWorker.firstName} {currentWorker.lastName}
              </h1>

              <p className="text-lg sm:text-xl font-black text-[#FF6B00]">{currentWorker.mainTrade}</p>

              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border font-black text-[11px] sm:text-xs tracking-wide uppercase shadow-xs w-fit mx-auto sm:mx-0 ${
                isVerified
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-slate-100 text-slate-800 border-slate-300'
              }`}>
                {isVerified ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>VERIFICADO</span>
                  </>
                ) : (
                  <>
                    <Shield className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>REGISTRADO</span>
                  </>
                )}
              </div>

              <p className="text-sm text-slate-500 flex items-center justify-center sm:justify-start gap-1.5">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                <span>{currentWorker.serviceAreas.join(', ')}</span>
              </p>

              {(currentWorker.profilePhotoReviewStatus === 'pending' || currentWorker.profilePhotoReviewStatus === 'rejected') && (
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  {currentWorker.profilePhotoReviewStatus === 'pending' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold">
                      <Clock className="w-3 h-3 text-amber-700" />
                      Foto en moderación
                    </span>
                  )}
                  {currentWorker.profilePhotoReviewStatus === 'rejected' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-900 border border-rose-200 text-xs font-bold">
                      <AlertCircle className="w-3 h-3 text-rose-700" />
                      Foto rechazada (sube otra)
                    </span>
                  )}
                </div>
              )}

              <button
                onClick={() => navigateTo({ type: 'profile', workerSlug: currentWorker.slug })}
                className="mt-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs sm:text-sm font-bold rounded-xl transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Ver perfil público</span>
              </button>
            </div>
          </div>

          <div className="border-t border-slate-100" />

          {/* Disponibilidad */}
          <div
            id="worker-availability-card"
            className={`px-6 sm:px-8 py-6 space-y-3 ${
              isAvailable ? 'bg-emerald-50/40' : 'bg-amber-50/40'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isAvailable ? 'bg-emerald-500 shadow-xs' : 'bg-amber-500'}`} />
              <span className={`text-sm font-black uppercase tracking-wide ${isAvailable ? 'text-emerald-700' : 'text-amber-700'}`}>
                {isAvailable ? 'Activo' : 'Oculto'}
              </span>
            </div>

            {isAvailable ? (
              <button
                type="button"
                id="pause-availability-btn"
                onClick={() => setShowAvailabilityModal(true)}
                className="w-full py-4 px-5 bg-white hover:bg-slate-100 active:scale-[0.99] border border-slate-300 text-slate-700 hover:text-slate-900 font-bold text-sm sm:text-base rounded-2xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <PauseCircle className="w-5 h-5 text-slate-500" />
                <span>Pausar mi disponibilidad</span>
              </button>
            ) : (
              <button
                type="button"
                id="resume-availability-btn"
                disabled={isTogglingAvailability}
                onClick={handleToggleAvailability}
                className="w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-sm sm:text-base rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isTogglingAvailability ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Activando...</span>
                  </>
                ) : (
                  <>
                    <PlayCircle className="w-5 h-5" />
                    <span>Volver a estar disponible</span>
                  </>
                )}
              </button>
            )}
          </div>

          <div className="border-t border-slate-100" />

          {/* Completitud */}
          <div className="px-6 sm:px-8 py-5 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Registro básico</span>
              <span className="text-2xl font-black text-[#FF6B00]">{completionScore}%</span>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Perfil Verificado</span>
            </div>
            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  completionScore >= 80 ? 'bg-green-500' : completionScore >= 50 ? 'bg-orange-500' : 'bg-amber-400'
                }`}
                style={{ width: `${completionScore}%` }}
              />
            </div>
          </div>
        </div>

        {/* Modal de confirmación para pausar disponibilidad */}
        {showAvailabilityModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
              <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto">
                <PauseCircle className="w-6 h-6" />
              </div>

              <div className="text-center space-y-2">
                <h3 className="text-lg font-black text-slate-900">
                  ¿Pausar tu disponibilidad?
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Tu perfil dejará temporalmente de aparecer como disponible para nuevos clientes. Podrás volver a activarlo cuando quieras.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                <button
                  type="button"
                  id="confirm-pause-availability-btn"
                  disabled={isTogglingAvailability}
                  onClick={handleToggleAvailability}
                  className="flex-1 py-3 px-4 bg-amber-600 hover:bg-amber-700 active:scale-[0.99] text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  {isTogglingAvailability ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <span>Pausar disponibilidad</span>
                  )}
                </button>
                <button
                  type="button"
                  disabled={isTogglingAvailability}
                  onClick={() => setShowAvailabilityModal(false)}
                  className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Global Notifications */}
        {saveSuccess && (
          <div className="p-4 bg-green-50 border border-green-200 text-green-800 text-sm rounded-2xl flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
            <span>Los cambios han sido guardados exitosamente.</span>
          </div>
        )}
        {saveError && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <span>{saveError}</span>
          </div>
        )}

        {/* Navigation Tabs (3 tabs strictly) */}
        <div className="flex overflow-x-auto gap-2 border-b border-slate-200 pb-2">
          <button
            onClick={() => setActiveTab('profile')}
            className={`py-2 px-4 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            Mi perfil
          </button>
          <button
            onClick={() => setActiveTab('photos')}
            className={`py-2 px-4 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'photos'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            Galería de fotos ({portfolioPhotos.length})
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`py-2 px-4 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'stats'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            Estadísticas
          </button>
        </div>

        {/* TAB 1: MI PERFIL */}
        {activeTab === 'profile' && (
          <div className="space-y-6">

            {/* SECCIÓN INTEGRADA DE VERIFICACIÓN Y CONFIANZA */}
            <div id="verification-summary-section" className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-orange-100 text-[#FF6B00] flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-black text-slate-900 tracking-tight">
                  Verificación y confianza
                </h2>
              </div>

              {isVerified ? (
                <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-2">
                  <div className="flex items-center gap-2 font-black text-sm sm:text-base">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span>Tu perfil ya cuenta con verificación oficial en Maestro Cerca</span>
                  </div>
                  <p className="text-xs text-emerald-800 leading-relaxed pl-7">
                    Tu identidad, número telefónico y fotografías de trabajos han sido revisados y validados por el equipo administrativo.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Radial circular progress with requirements list */}
                  <VerificationRadialProgress
                    completedCount={completedVerificationCount}
                    totalCount={totalVerificationCount}
                    items={verificationItems}
                    onNavigateTab={(tab, anchorId) => {
                      setActiveTab(tab);
                      if (anchorId) {
                        setTimeout(() => {
                          const el = document.getElementById(anchorId);
                          if (el) {
                            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }
                        }, 100);
                      }
                    }}
                  />

                  {/* Estado: Solicitud en revisión */}
                  {(verifSubmitted || currentWorker.tieneVerificacionPendiente || currentWorker.verificationRequest?.status === 'pending') ? (
                    <div className="p-5 rounded-2xl bg-slate-100 border border-slate-200 text-slate-800 space-y-2">
                      <div className="flex items-center gap-2 font-black text-sm text-slate-900">
                        <Clock className="w-5 h-5 text-[#FF6B00] shrink-0" />
                        <span>Solicitud en revisión</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Hemos recibido tus datos y comprobantes de respaldo. El equipo de administración revisará la información de tu perfil para validar tu insignia de <strong>"Verificado por Maestro Cerca"</strong>.
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={handleVerificationSubmit} className="space-y-4 pt-1">
                      {/* Botón: Solicitar revisión para verificarme */}
                      <div className="pt-2 space-y-2.5">
                        <button
                          type="submit"
                          disabled={!allVerificationRequirementsMet || isSubmittingVerif}
                          className="w-full py-3.5 px-6 bg-[#FF6B00] hover:bg-[#e65f00] active:scale-[0.98] disabled:bg-slate-200 disabled:text-slate-400 text-white font-black text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:cursor-not-allowed"
                        >
                          {isSubmittingVerif ? (
                            <>
                              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              <span>Enviando solicitud...</span>
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="w-5 h-5 shrink-0" />
                              <span>Solicitar revisión para verificarme</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>

            {/* INFORMACIÓN DEL PERFIL */}
            <div id="section-basic-info" className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Información básica del trabajador</h2>
                <p className="text-xs text-slate-500">Mantén tus datos actualizados para que los clientes puedan llamarte.</p>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Nombre</label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Primer apellido</label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold uppercase text-slate-700">Teléfono celular</label>
                    {isTrulyPhoneVerified ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>SMS confirmado</span>
                      </span>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 text-amber-600" />
                          <span>No verificado por SMS</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            document.getElementById('access-methods-section')?.scrollIntoView({ behavior: 'smooth' });
                            setShowPhoneLinkForm(true);
                          }}
                          className="text-[10px] font-bold text-[#FF6B00] hover:text-orange-700 underline cursor-pointer"
                        >
                          Verificar
                        </button>
                      </div>
                    )}
                  </div>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    {isTrulyPhoneVerified 
                      ? 'Número autenticado por SMS. Si cambias este número, deberás validarlo de nuevo por SMS para conservar la verificación.'
                      : 'Número de contacto. Para que aparezca como verificado ante los clientes, debes validarlo con SMS en Métodos de Acceso.'}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Correo electrónico <span className="text-slate-400 font-normal lowercase">(opcional)</span>
                </label>
                <input
                  type="email"
                  placeholder="ejemplo@correo.com (opcional)"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Opcional. Para recibir notificaciones o avisos administrativos.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Oficio principal</label>
                  <select
                    value={trades.some((t) => t.name === formData.mainTrade) || !formData.mainTrade ? formData.mainTrade : 'Otro'}
                    onChange={(e) => setFormData({ ...formData, mainTrade: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold"
                  >
                    {trades.map((t) => (
                      <option key={t.id} value={t.name}>{t.name}</option>
                    ))}
                    <option value="Otro">Otro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Años de experiencia</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={formData.yearsExperience}
                    onChange={(e) => setFormData({ ...formData, yearsExperience: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium"
                  />
                </div>
              </div>

              {/* SERVICIOS ESPECÍFICOS QUE REALIZAS (INTEGRADO EN MI PERFIL) */}
              <div id="worker-services-section" className="pt-2 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <label className="block text-xs font-black uppercase text-slate-900 tracking-wide">
                      Trabajos y servicios que realizas ({formData.services.length})
                    </label>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Agrega tareas específicas para que los clientes te encuentren en las búsquedas (ej. "Instalación de tinaco", "Reparación de fugas", "Aplanados").
                    </p>
                  </div>
                  <span className="text-[11px] font-bold text-orange-700 bg-orange-100/80 px-2 py-0.5 rounded-md">
                    Mínimo 2 recomendados
                  </span>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Escribe un servicio y presiona Enter o Agregar..."
                    value={newService}
                    onChange={(e) => setNewService(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddServiceItem();
                      }
                    }}
                    className="flex-1 p-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-orange-500 outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={handleAddServiceItem}
                    className="px-4 py-2.5 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-black flex items-center gap-1.5 cursor-pointer transition-colors shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Agregar</span>
                  </button>
                </div>

                {/* Quick suggestions based on main trade */}
                {TRADE_SERVICE_SUGGESTIONS[formData.mainTrade] && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Sugerencias para {formData.mainTrade} (toca para agregar):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {TRADE_SERVICE_SUGGESTIONS[formData.mainTrade]
                        .filter(sug => !formData.services.includes(sug))
                        .slice(0, 6)
                        .map((sug, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleAddSuggestedService(sug)}
                            className="text-xs py-1 px-2.5 rounded-lg bg-white hover:bg-orange-50 border border-slate-200 hover:border-orange-300 text-slate-700 hover:text-orange-700 font-medium transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3 h-3 text-orange-500" />
                            <span>{sug}</span>
                          </button>
                        ))}
                    </div>
                  </div>
                )}

                {formData.services.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {formData.services.map((srv, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-2 py-1.5 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 shadow-2xs group hover:border-slate-300 transition-colors"
                      >
                        <span>{srv}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveServiceItem(idx)}
                          className="p-0.5 text-slate-400 hover:text-red-600 rounded-md transition-colors cursor-pointer"
                          title={`Eliminar ${srv}`}
                          aria-label={`Eliminar servicio ${srv}`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Descripción pública</label>
                <textarea
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium"
                />
              </div>

              {/* Zonas selector */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-2">Zonas de trabajo activas</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {serviceAreas.map((area) => {
                    const isChecked = formData.serviceAreas.includes(area.name);
                    return (
                      <button
                        key={area.id}
                        type="button"
                        onClick={() => {
                          const updated = isChecked
                            ? formData.serviceAreas.filter((a) => a !== area.name)
                            : [...formData.serviceAreas, area.name];
                          setFormData({ ...formData, serviceAreas: updated });
                        }}
                        className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition-colors cursor-pointer ${
                          isChecked ? 'bg-orange-600 text-white border-orange-600' : 'bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        {isChecked ? `✓ ${area.name}` : `+ ${area.name}`}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="py-3 px-6 bg-[#FF6B00] hover:bg-[#e65f00] active:scale-[0.98] disabled:bg-orange-400 text-white font-bold text-sm rounded-xl shadow-xs flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed transition-colors"
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Actualizando tu perfil...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Guardar cambios</span>
                    </>
                  )}
                </button>
              </div>
              </form>
            </div>

            {/* SECCIÓN MÉTODOS DE ACCESO (Account Linking) */}
            <div id="access-methods-section" className="mt-8 pt-6 border-t border-slate-200 space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-[#FF6B00]" />
                  <span>Métodos de acceso</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Puedes vincular diferentes formas de iniciar sesión a tu misma cuenta de Maestro Cerca.
                </p>
              </div>

              {/* Feedback Alerts */}
              {linkingError && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-800 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span className="leading-relaxed font-medium">{linkingError}</span>
                </div>
              )}
              {linkingSuccess && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span className="leading-relaxed font-medium">{linkingSuccess}</span>
                </div>
              )}

              {/* Invisible reCAPTCHA container for Phone Linking */}
              <div id="link-phone-recaptcha-container" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* 1. Teléfono */}
                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700">
                        <Phone className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-bold text-slate-900">Teléfono</span>
                    </div>
                    {isPhoneLinked ? (
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Vinculado</span>
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded-full">
                        No vinculado
                      </span>
                    )}
                  </div>

                  <div>
                    {isPhoneLinked ? (
                      <p className="text-xs font-mono text-slate-700 font-semibold tracking-wide">
                        {formatMaskedPhone(phoneValue)}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500">
                        Recibe llamadas e inicia sesión por SMS.
                      </p>
                    )}
                  </div>

                  {!isPhoneLinked && (
                    <div>
                      {!showPhoneLinkForm ? (
                        <button
                          type="button"
                          onClick={() => setShowPhoneLinkForm(true)}
                          className="w-full py-2 px-3 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-xs font-bold rounded-xl shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                        >
                          Vincular teléfono
                        </button>
                      ) : (
                        <div className="space-y-2 pt-2 border-t border-slate-200">
                          {!linkConfirmationResult ? (
                            <form onSubmit={handleSendPhoneLinkSms} className="space-y-2">
                              <div className="relative">
                                <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">+52</span>
                                <input
                                  type="tel"
                                  value={linkPhoneDigits}
                                  onChange={(e) => setLinkPhoneDigits(cleanMexicanPhoneInput(e.target.value))}
                                  placeholder="10 dígitos cel"
                                  className="w-full pl-10 pr-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium"
                                />
                              </div>
                              <div className="flex gap-1.5">
                                <button
                                  type="submit"
                                  disabled={isSendingPhoneSms || linkPhoneDigits.length !== 10}
                                  className="flex-1 py-1.5 bg-[#FF6B00] hover:bg-[#e65f00] active:scale-[0.98] disabled:bg-orange-300 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                                >
                                  {isSendingPhoneSms ? 'Enviando...' : 'Enviar SMS'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setShowPhoneLinkForm(false)}
                                  className="py-1.5 px-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg cursor-pointer"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </form>
                          ) : (
                            <form onSubmit={handleConfirmPhoneLink} className="space-y-2">
                              <input
                                type="text"
                                maxLength={6}
                                value={linkSmsCode}
                                onChange={(e) => setLinkSmsCode(e.target.value.replace(/\D/g, ''))}
                                placeholder="Código de 6 dígitos"
                                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-center tracking-widest"
                              />
                              <div className="flex gap-1.5">
                                <button
                                  type="submit"
                                  disabled={isConfirmingPhoneSms || linkSmsCode.length < 6}
                                  className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                                >
                                  {isConfirmingPhoneSms ? 'Verificando...' : 'Confirmar'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setLinkConfirmationResult(null);
                                    setLinkSmsCode('');
                                  }}
                                  className="py-1.5 px-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg cursor-pointer"
                                >
                                  Atrás
                                </button>
                              </div>
                            </form>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 2. Facebook */}
                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#1877F2">
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                        </svg>
                      </div>
                      <span className="text-sm font-bold text-slate-900">Facebook</span>
                    </div>
                    {isFacebookLinked ? (
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Vinculado</span>
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded-full">
                        No vinculado
                      </span>
                    )}
                  </div>

                  <div>
                    {isFacebookLinked ? (
                      <p className="text-xs text-slate-700 font-medium truncate">
                        {facebookDisplayName || 'Cuenta vinculada'}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500">
                        Accede con tu perfil de Facebook.
                      </p>
                    )}
                  </div>

                  {/* Linking disabled for the MVP (FACEBOOK_AUTH_ENABLED flag) */}
                  {!isFacebookLinked && FACEBOOK_AUTH_ENABLED && (
                    <button
                      type="button"
                      disabled={isLinkingFacebook}
                      onClick={handleLinkFacebook}
                      className="w-full py-2 px-3 bg-white hover:bg-slate-100 disabled:bg-slate-100 border border-slate-300 text-slate-800 text-xs font-bold rounded-xl shadow-2xs transition-colors cursor-pointer flex items-center justify-center gap-2"
                    >
                      {isLinkingFacebook ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
                          <span>Vinculando...</span>
                        </>
                      ) : (
                        <span>Vincular Facebook</span>
                      )}
                    </button>
                  )}
                  {!isFacebookLinked && !FACEBOOK_AUTH_ENABLED && (
                    <p className="text-[11px] text-slate-400 text-center italic">Disponible próximamente</p>
                  )}
                </div>
              </div>

              <p className="text-[11px] text-slate-400 italic pt-1">
                Vincular varios métodos te permite entrar a la misma cuenta de Maestro Cerca de diferentes formas.
              </p>
            </div>

            {/* Danger Zone: Account Deletion */}
            <div className="mt-8 pt-6 border-t border-red-100">
              <div className="p-5 rounded-2xl bg-red-50/60 border border-red-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-red-950 flex items-center gap-2">
                    <Trash2 className="w-4 h-4 text-red-600" />
                    <span>Eliminar mi cuenta de Maestro</span>
                  </h3>
                  <p className="text-xs text-red-800/80 mt-1 max-w-xl leading-relaxed">
                    Si ya no deseas ofrecer tus servicios o deseas retirar tu ficha del directorio de Maestro Cerca, puedes darte de baja definitivamente.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteAccountError('');
                    setShowDeleteModal(true);
                  }}
                  className="py-2.5 px-4 bg-white hover:bg-red-600 hover:text-white text-red-700 border border-red-300 font-bold text-xs rounded-xl shadow-xs transition-colors shrink-0 cursor-pointer"
                >
                  Eliminar mi cuenta
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: GALERÍA DE TRABAJOS */}
        {activeTab === 'photos' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Fotografías de trabajos realizados</h2>
              <p className="text-xs text-slate-500">Sube fotos de tus proyectos y obras para enriquecer tu portafolio público.</p>
            </div>

            {/* Upload form with Drag and Drop */}
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
              <p className="text-xs font-bold uppercase text-slate-700">Subir fotografías a tu portafolio:</p>

              <p className="text-[11px] text-slate-500 leading-relaxed italic bg-white p-3 rounded-xl border border-slate-200">
                Al subir fotografías confirmas que cuentas con autorización para compartirlas y que procurarás no incluir documentos, teléfonos, domicilios u otros datos personales de terceros.
              </p>
              
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Título breve del trabajo (opcional, ej. Instalación de cocina integral)"
                  value={newPhotoTitle}
                  onChange={(e) => setNewPhotoTitle(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium"
                />

                {/* Drag and Drop Zone */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingPhotos(true);
                  }}
                  onDragLeave={() => setIsDraggingPhotos(false)}
                  onDrop={async (e) => {
                    e.preventDefault();
                    setIsDraggingPhotos(false);
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      await processAndUploadWorkPhotos(e.dataTransfer.files);
                    }
                  }}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
                    isDraggingPhotos 
                      ? 'border-orange-500 bg-orange-50/50' 
                      : 'border-slate-300 bg-white hover:border-slate-400'
                  }`}
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-orange-100 text-[#FF6B00] flex items-center justify-center">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        Arrastra tus fotos aquí o haz clic para seleccionar
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Puedes seleccionar múltiples imágenes a la vez (JPG, PNG, WebP máx. 5MB)
                      </p>
                    </div>

                    <label className="cursor-pointer mt-2 inline-flex items-center gap-2 py-2 px-4 bg-[#FF6B00] hover:bg-[#e65f00] active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-xs transition-colors">
                      <Plus className="w-4 h-4" />
                      <span>Seleccionar archivos</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        disabled={isUploadingPhoto}
                        onChange={handleWorkPhotosFileInput}
                        className="hidden"
                      />
                    </label>

                    {isUploadingPhoto && (
                      <div className="flex items-center gap-2 text-xs text-orange-700 font-medium mt-3 bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-200">
                        <div className="w-4 h-4 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" />
                        <span>
                          {uploadProgress 
                            ? `Subiendo imagen ${uploadProgress.current} de ${uploadProgress.total}...` 
                            : 'Subiendo fotografías...'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Current Photos Grid */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Galería actual ({portfolioPhotos.length} fotos)
                </span>
              </div>

              {portfolioPhotos.length === 0 ? (
                <div className="text-center py-10 border border-slate-200 rounded-2xl bg-slate-50/50 p-6">
                  <ImageIcon className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">Aún no tienes fotografías en tu portafolio</p>
                  <p className="text-xs text-slate-500 mt-1">Sube imágenes de trabajos realizados para que los clientes aprecien la calidad de tu oficio.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
                  {portfolioPhotos.map((photo) => (
                    <div key={photo.id} className="relative group rounded-2xl overflow-hidden border border-slate-200 aspect-4/3 bg-slate-100 shadow-2xs">
                      <img src={photo.url} alt={photo.title} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-between text-white">
                        <p className="text-xs font-bold line-clamp-2">{photo.title}</p>
                        <button
                          type="button"
                          onClick={() => setPhotoToDelete(photo)}
                          className="self-end p-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-xs flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                          title="Eliminar fotografía"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Eliminar</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: ESTADÍSTICAS */}
        {activeTab === 'stats' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Métricas de contacto directo</h2>
              <p className="text-xs text-slate-500">Monitorea cuántos clientes han visto tu perfil y te han contactado.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl bg-emerald-50/60 border border-emerald-200">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs mb-1">
                  <MessageCircle className="w-4 h-4" />
                  <span>Clics en WhatsApp</span>
                </div>
                <p className="text-3xl font-black text-emerald-950">{whatsappCount}</p>
                <p className="text-[11px] text-emerald-700 mt-1">Clientes que abrieron conversación directa</p>
              </div>

              <div className="p-5 rounded-2xl bg-blue-50/60 border border-blue-200">
                <div className="flex items-center gap-2 text-blue-800 font-bold text-xs mb-1">
                  <Phone className="w-4 h-4" />
                  <span>Clics en Llamar</span>
                </div>
                <p className="text-3xl font-black text-blue-950">{phoneCount}</p>
                <p className="text-[11px] text-blue-700 mt-1">Llamadas directas iniciadas</p>
              </div>

              <div className="p-5 rounded-2xl bg-purple-50/60 border border-purple-200">
                <div className="flex items-center gap-2 text-purple-800 font-bold text-xs mb-1">
                  <Eye className="w-4 h-4" />
                  <span>Vistas de perfil</span>
                </div>
                <p className="text-3xl font-black text-purple-950">{viewCount}</p>
                <p className="text-[11px] text-purple-700 mt-1">Veces que se ha consultado tu ficha</p>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Confirmation Modal for Photo Deletion */}
      {photoToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-sm w-full shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-11 h-11 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-slate-900">¿Eliminar esta fotografía?</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                La fotografía seleccionada ya no se mostrará en tu portafolio público.
              </p>
            </div>

            <div className="rounded-xl overflow-hidden aspect-16/9 bg-slate-100 border border-slate-200">
              <img src={photoToDelete.url} alt={photoToDelete.title} className="w-full h-full object-cover" />
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                disabled={isDeletingPhoto}
                onClick={() => setPhotoToDelete(null)}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeletingPhoto}
                onClick={handleConfirmDeletePhoto}
                className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isDeletingPhoto ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <span>Eliminar foto</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Account Deletion */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-red-100 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-700 flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-black text-slate-900">¿Seguro que quieres eliminar tu cuenta?</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Tu perfil dejará de estar disponible en Maestro Cerca y perderás el acceso a esta cuenta.
              </p>
            </div>

            {deleteAccountError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
                {deleteAccountError}
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row items-center gap-3 pt-2">
              <button
                type="button"
                disabled={isDeletingAccount}
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteAccountError('');
                }}
                className="w-full sm:w-1/2 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeletingAccount}
                onClick={handleDeleteAccount}
                className="w-full sm:w-1/2 py-3 px-4 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {isDeletingAccount ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <span>Eliminar mi cuenta definitivamente</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
