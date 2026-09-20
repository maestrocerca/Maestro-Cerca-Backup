import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  CheckCircle2, 
  ShieldCheck, 
  MapPin, 
  Camera, 
  ArrowRight, 
  ArrowLeft, 
  Upload, 
  Plus, 
  X, 
  AlertCircle,
  Clock,
  Phone,
  RotateCcw,
  MessageCircle,
  User,
  ExternalLink,
  AlertTriangle
} from 'lucide-react';
import { ConfirmationResult } from 'firebase/auth';
import { 
  useStore, 
  formatMexicanPhoneToE164, 
  formatPhoneForDisplay 
} from '../context/StoreContext';
import { Worker, WorkPhoto } from '../types';
import { auth } from '../lib/firebase';
import { WorkerAvatar } from './WorkerAvatar';
import { BrandLogoIcon } from './BrandLogo';
import { uploadWorkerProfileImage, uploadWorkerWorkPhoto, validateImageFile } from '../lib/storage';
import { FACEBOOK_AUTH_ENABLED } from '../config/featureFlags';

const FacebookIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5 shrink-0" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

export const WorkerRegisterView: React.FC = () => {
  const { 
    trades, 
    serviceAreas, 
    firebaseUser,
    isWorkerRegistrationActive,
    setIsWorkerRegistrationActive,
    cancelWorkerRegistration,
    sendPhoneVerificationCode, 
    confirmPhoneVerificationCode,
    sendPhoneLinkVerificationCode,
    confirmPhoneLinkCode,
    registerWorkerWithFacebook,
    createWorkerProfile, 
    updateWorkerProfile, 
    submitPendingProfilePhoto,
    showToast,
    navigateTo, 
    trackGenericEvent,
    isAdmin
  } = useStore();

  // Multi-step Architecture (5 Steps + Step 6 Success):
  // Step 1: Crear cuenta (Phone SMS / Facebook) + Terms & Privacy Notice
  // Step 2: Datos personales y de contacto
  // Step 3: Información profesional (oficio, experiencia, trabajos que realiza)
  // Step 4: Ubicación y zonas de trabajo (inicializado vacío [])
  // Step 5: Fotografías, revisión previa y publicar perfil
  // Step 6: Confirmación de registro exitoso
  const [step, setStep] = useState<number>(1);

  // Step 2 is a single-question-per-screen wizard (swipe-style, like the
  // WhatsApp registration flow) instead of one long scrolling form.
  const WIZARD_STEPS = [
    'datos',
    'oficio',
    'experiencia',
    'otros',
    'disponibilidad',
    'trabajos',
    'zonas',
    'fotoPerfil',
    'fotosTrabajo',
    'resumen',
  ] as const;
  const [wizardIndex, setWizardIndex] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<'next' | 'back'>('next');
  const goWizard = (index: number, direction: 'next' | 'back') => {
    setSwipeDirection(direction);
    setWizardIndex(Math.max(0, Math.min(WIZARD_STEPS.length - 1, index)));
  };

  // Active onboarding registration registration flag
  useEffect(() => {
    setIsWorkerRegistrationActive(true);
  }, [setIsWorkerRegistrationActive]);

  // Phone Auth within Step 1
  const [phoneSubStep, setPhoneSubStep] = useState<'phone' | 'code'>('phone');
  const [rawPhone, setRawPhone] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // Loading States
  const [isPhoneLoading, setIsPhoneLoading] = useState(false);
  const [isFacebookLoading, setIsFacebookLoading] = useState(false);
  const [phoneRegisteredRedirect, setPhoneRegisteredRedirect] = useState(false);

  // Terms & Privacy acceptance in Step 1
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Step 2: Personal Details & Contact
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [optionalEmail, setOptionalEmail] = useState('');

  // Step 2 SMS Linking State (for Facebook users)
  const [linkSubStep, setLinkSubStep] = useState<'idle' | 'code'>('idle');
  const [linkSmsCode, setLinkSmsCode] = useState('');
  const [linkConfirmationResult, setLinkConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [isLinkingLoading, setIsLinkingLoading] = useState(false);
  const [linkError, setLinkError] = useState('');

  // Step 3: Professional Info
  const [mainTrade, setMainTrade] = useState('Albañil');
  const [secondaryTrades, setSecondaryTrades] = useState<string[]>([]);
  const [yearsExperience, setYearsExperience] = useState<number>(1);
  const [disponibilidad, setDisponibilidad] = useState('Lunes a viernes');
  const [description, setDescription] = useState('');
  const [services, setServices] = useState<string[]>([]);
  const [customServiceInput, setCustomServiceInput] = useState('');
  const [servicesError, setServicesError] = useState('');
  const servicesSectionRef = useRef<HTMLDivElement>(null);

  // Step 4: Work Areas (EMPTY by default - no Querétaro or Zibatá pre-assigned!)
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);

  // Step 5: Photographs - Resilient Local File State
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('');
  const [pendingProfileFile, setPendingProfileFile] = useState<File | null>(null);
  const [profilePreviewUrl, setProfilePreviewUrl] = useState<string>('');
  const [pendingWorkFiles, setPendingWorkFiles] = useState<{ file: File; previewUrl: string; title: string; failed?: boolean; uploadedUrl?: string }[]>([]);

  // Resilient Upload Failure & Retry State
  const [hasProfileUploadFailed, setHasProfileUploadFailed] = useState(false);
  const [hasWorkPhotosUploadFailed, setHasWorkPhotosUploadFailed] = useState(false);
  const [isRetryingUpload, setIsRetryingUpload] = useState(false);
  const [uploadRetryMessage, setUploadRetryMessage] = useState('');

  // Submission & Status
  const [createdWorker, setCreatedWorker] = useState<Worker | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState('');
  const [generalError, setGeneralError] = useState('');

  // Check if authenticated with Phone SMS
  const isPhoneAuthVerified = Boolean(
    firebaseUser?.phoneNumber || 
    firebaseUser?.providerData?.some((p) => p.providerId === 'phone')
  );

  // Original registration method: strictly represents the method with which onboarding started
  const registrationMethod: 'phone' | 'facebook' = useMemo(() => {
    if (firebaseUser?.providerData?.some((p) => p.providerId === 'facebook.com')) {
      return 'facebook';
    }
    return 'phone';
  }, [firebaseUser]);

  // Populate from Firebase Auth if user already authenticated in Step 1
  useEffect(() => {
    if (isAdmin) {
      navigateTo({ type: 'admin' });
      return;
    }
    if (firebaseUser) {
      if (firebaseUser.displayName) {
        const parts = firebaseUser.displayName.trim().split(/\s+/);
        setFirstName((prev) => prev || parts[0] || '');
        setLastName((prev) => prev || parts.slice(1).join(' ') || '');
      }
      if (firebaseUser.email) {
        setOptionalEmail((prev) => prev || firebaseUser.email || '');
      }
      if (firebaseUser.phoneNumber) {
        const clean = firebaseUser.phoneNumber.replace(/^\+52/, '').replace(/\D/g, '');
        setRawPhone((prev) => prev || clean);
      }
      if (firebaseUser.photoURL && !firebaseUser.photoURL.includes('unsplash')) {
        setProfilePhotoUrl((prev) => prev || firebaseUser.photoURL || '');
        setProfilePreviewUrl((prev) => prev || firebaseUser.photoURL || '');
      }
    }
  }, [firebaseUser, isAdmin, navigateTo]);

  // If administrator, never render worker registration
  if (isAdmin) {
    return null;
  }

  // Resend SMS countdown timer
  useEffect(() => {
    let timer: any = null;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [cooldown]);

  // Track start of registration
  useEffect(() => {
    trackGenericEvent('registro_trabajador_iniciado');
  }, [trackGenericEvent]);

  // Suggestions per trade
  const tradeServiceSuggestions: Record<string, string[]> = {
    'Albañil': ['Pegado de tabique y block', 'Aplanados y repellados', 'Colado de losas y castillos', 'Colocación de pisos y azulejos', 'Ampliaciones y bardas', 'Demolición y retiro de escombro'],
    'Plomero': ['Instalación de tinacos y cisternas', 'Reparación de fugas de agua y gas', 'Instalación de calentadores y boilers', 'Destape de drenajes y tuberías', 'Instalación de muebles de baño', 'Bombas presurizadoras'],
    'Electricista': ['Instalación de centros de carga', 'Cableado y balanceo de cargas', 'Instalación de lámparas y ventiladores', 'Reparación de cortos circuitos', 'Contactos y apagadores', 'Tierras físicas'],
    'Carpintero': ['Fabricación de closets y vestidores', 'Cocinas integrales a la medida', 'Puertas de tambor y sólidas', 'Muebles de baño y repisas', 'Reparación y barnizado de madera'],
    'Pintor': ['Pintura interior y exterior', 'Resane y preparación de muros', 'Esmalte en herrería', 'Acabados decorativos y texturas', 'Impermeabilización de azoteas'],
    'Tablarroquero': ['Muros divisorios de Tablaroca / Durock', 'Plafones falsos y cajillos con luz', 'Muebles empotrados de yeso', 'Aislamiento acústico y térmico'],
    'Herrero': ['Fabricación de portones y zaguanes', 'Protecciones para ventanas', 'Barandales y pasamanos', 'Estructuras ligeras y techumbres', 'Reparación y soldadura'],
    'Impermeabilizador': ['Impermeabilización prefabricada', 'Impermeabilizante acrílico', 'Tratamiento de grietas y filtraciones', 'Protección térmica de azoteas'],
    'Instalador de pisos': ['Colocación de piso cerámico y porcelanato', 'Instalación de piso laminado y vinílico', 'Zoclo y boquillas', 'Nivelación de firmes'],
    'Mantenimiento general': ['Reparaciones rápidas para el hogar', 'Instalaciones básicas', 'Pintura y resanes', 'Plomería y electricidad básica'],
    'Jardinero': ['Poda de pasto y árboles', 'Mantenimiento de jardines y áreas verdes', 'Sistemas de riego', 'Fumigación y abono'],
    'Aluminiero y vidriero': ['Cancelería de aluminio', 'Ventanas y puertas de cristal templado', 'Cancel de baño', 'Mosquiteros y domos'],
  };

  const clean10Digits = rawPhone.replace(/\D/g, '').slice(0, 10);

  // =========================================================================
  // STEP 1 HANDLERS: Phone SMS, Facebook
  // =========================================================================
  const handleSendPhoneSms = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setGeneralError('');
    setPhoneRegisteredRedirect(false);

    if (clean10Digits.length !== 10) {
      setGeneralError('Por favor ingresa los 10 dígitos de tu número celular.');
      return;
    }

    if (!privacyAccepted || !termsAccepted) {
      setGeneralError('Debes aceptar el Aviso de Privacidad y los Términos y Condiciones antes de continuar.');
      return;
    }

    setIsPhoneLoading(true);

    // 1. Backend verification: Check if phone already has an existing profile or is used
    try {
      const checkResp = await fetch('/api/auth/phone-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: clean10Digits,
          intent: 'register',
        }),
      });

      if (!checkResp.ok) {
        const errorData = await checkResp.json().catch(() => ({}));
        setGeneralError(errorData?.error || 'No pudimos comprobar si este número ya está registrado. Intenta nuevamente.');
        setIsPhoneLoading(false);
        return;
      }

      const checkData = await checkResp.json();
      if (!checkData || !checkData.success) {
        setGeneralError(checkData?.error || 'No pudimos comprobar si este número ya está registrado. Intenta nuevamente.');
        setIsPhoneLoading(false);
        return;
      }

      if (checkData.usedByOther || checkData.hasProfile || checkData.available === false) {
        setGeneralError('Este número celular ya tiene una cuenta registrada en Maestro Cerca.');
        setPhoneRegisteredRedirect(true);
        setIsPhoneLoading(false);
        return;
      }
    } catch (checkErr) {
      // FAIL CLOSED: Never allow continuing if check failed!
      setGeneralError('No pudimos comprobar si este número ya está registrado. Intenta nuevamente.');
      setIsPhoneLoading(false);
      return;
    }

    const formattedE164 = formatMexicanPhoneToE164(clean10Digits);

    try {
      const res = await sendPhoneVerificationCode(formattedE164, 'recaptcha-register-container');
      if (res.success && res.confirmationResult) {
        setConfirmationResult(res.confirmationResult);
        setPhoneSubStep('code');
        setCooldown(60);
        setSmsCode('');
      } else {
        setGeneralError(res.error || 'No pudimos enviar el código SMS. Intenta nuevamente.');
      }
    } catch (err: any) {
      setGeneralError(err?.message || 'Error al enviar el código SMS.');
    } finally {
      setIsPhoneLoading(false);
    }
  };

  const handleConfirmPhoneCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError('');

    if (!confirmationResult) {
      setGeneralError('Solicita un nuevo código por SMS.');
      setPhoneSubStep('phone');
      return;
    }

    const cleanCode = smsCode.trim().replace(/\D/g, '');
    if (cleanCode.length < 6) {
      setGeneralError('Ingresa el código de 6 dígitos que recibiste por SMS.');
      return;
    }

    setIsPhoneLoading(true);

    try {
      setIsWorkerRegistrationActive(true);
      const res = await confirmPhoneVerificationCode(confirmationResult, cleanCode);
      if (res.success) {
        if (res.hasExistingProfile) {
          setIsWorkerRegistrationActive(false);
          showToast('Ya tienes una cuenta registrada en Maestro Cerca.');
          navigateTo({ type: 'dashboard' });
        } else {
          setStep(2);
        }
      } else {
        setGeneralError(res.error || 'Código incorrecto. Revisa el SMS e intenta de nuevo.');
      }
    } catch (err: any) {
      setGeneralError(err?.message || 'Error al validar el código SMS.');
    } finally {
      setIsPhoneLoading(false);
    }
  };

  const handleFacebookSignUp = async () => {
    setGeneralError('');
    if (!privacyAccepted || !termsAccepted) {
      setGeneralError('Debes aceptar el Aviso de Privacidad y los Términos y Condiciones antes de continuar.');
      return;
    }

    setIsFacebookLoading(true);
    try {
      setIsWorkerRegistrationActive(true);
      const res = await registerWorkerWithFacebook();
      if (res.success) {
        if (res.hasExistingProfile) {
          setIsWorkerRegistrationActive(false);
          showToast('Ya tienes una cuenta registrada en Maestro Cerca.');
          navigateTo({ type: 'dashboard' });
        } else {
          const user = auth.currentUser;
          if (user?.displayName) {
            const parts = user.displayName.trim().split(' ');
            setFirstName(parts[0] || '');
            setLastName(parts.slice(1).join(' ') || '');
          } else if (res.worker?.firstName) {
            setFirstName(res.worker.firstName);
            if (res.worker.lastName) setLastName(res.worker.lastName);
          }
          if (user?.email) {
            setOptionalEmail(user.email);
          } else if (res.worker?.email) {
            setOptionalEmail(res.worker.email);
          }
          const fbPhoto = user?.photoURL || res.worker?.profilePhoto || '';
          if (fbPhoto && !fbPhoto.includes('unsplash')) {
            setProfilePhotoUrl(fbPhoto);
            setProfilePreviewUrl(fbPhoto);
          }
          setStep(2);
        }
      } else if (res.error) {
        setGeneralError(res.error);
      }
    } catch (err: any) {
      setGeneralError(err?.message || 'Error al conectar con Facebook.');
    } finally {
      setIsFacebookLoading(false);
    }
  };

  // SMS Linking Handlers (Step 2 - for users who started with Facebook)
  const handleSendLinkSms = async () => {
    setLinkError('');
    if (clean10Digits.length !== 10) {
      setLinkError('Por favor ingresa un número celular válido de 10 dígitos.');
      return;
    }

    if (!auth.currentUser) {
      setLinkError('Debes tener una sesión activa para verificar tu teléfono.');
      return;
    }

    setIsLinkingLoading(true);
    const formattedE164 = formatMexicanPhoneToE164(clean10Digits);

    // Pre-check phone availability for linking before sending SMS
    try {
      const token = await auth.currentUser.getIdToken(true);
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
        setLinkError(errorData?.error || 'No pudimos verificar la disponibilidad de este teléfono. Intenta de nuevo.');
        setIsLinkingLoading(false);
        return;
      }

      const checkData = await checkRes.json();
      if (!checkData?.success) {
        setLinkError(checkData?.error || 'No pudimos verificar la disponibilidad de este teléfono. Intenta de nuevo.');
        setIsLinkingLoading(false);
        return;
      }

      if (checkData.usedByOther === true) {
        setLinkError('Este teléfono ya está asociado a otra cuenta de Maestro Cerca.');
        setIsLinkingLoading(false);
        return;
      }
    } catch (checkErr: any) {
      setLinkError('No pudimos verificar la disponibilidad de este teléfono. Intenta de nuevo.');
      setIsLinkingLoading(false);
      return;
    }

    // Only send SMS if phone is available and not used by another account
    try {
      const res = await sendPhoneLinkVerificationCode(formattedE164, 'recaptcha-phone-link-container');
      if (res.success && res.confirmationResult) {
        setLinkConfirmationResult(res.confirmationResult);
        setLinkSubStep('code');
        setCooldown(60);
        showToast('Código SMS enviado a tu teléfono.');
      } else {
        setLinkError(res.error || 'No pudimos enviar el código SMS. Intenta de nuevo.');
      }
    } catch (err: any) {
      setLinkError(err?.message || 'Error al enviar código SMS de verificación.');
    } finally {
      setIsLinkingLoading(false);
    }
  };

  const handleConfirmLinkSms = async () => {
    setLinkError('');
    if (!linkConfirmationResult) return;
    const cleanCode = linkSmsCode.trim().replace(/\D/g, '');
    if (cleanCode.length !== 6) {
      setLinkError('Ingresa el código completo de 6 dígitos que recibiste.');
      return;
    }

    setIsLinkingLoading(true);
    try {
      const res = await confirmPhoneLinkCode(linkConfirmationResult, cleanCode);
      if (res.success) {
        setLinkSubStep('idle');
        setLinkSmsCode('');
        setLinkError('');
      } else {
        setLinkError(res.error || 'Código incorrecto o expirado.');
      }
    } catch (err: any) {
      setLinkError(err?.message || 'Error al validar el código SMS.');
    } finally {
      setIsLinkingLoading(false);
    }
  };

  // =========================================================================
  // FILE & CHIP HANDLERS
  // =========================================================================
  const handleProfilePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      const check = validateImageFile(file, 5);
      if (!check.valid) {
        setGeneralError(check.error || 'Archivo inválido');
        return;
      }
      setPendingProfileFile(file);
      setProfilePreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleWorkFilesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const newItems: { file: File; previewUrl: string; title: string }[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const check = validateImageFile(file, 5);
        if (check.valid) {
          newItems.push({
            file,
            previewUrl: URL.createObjectURL(file),
            title: file.name.replace(/\.[^/.]+$/, ''),
          });
        }
      }
      setPendingWorkFiles((prev) => [...prev, ...newItems]);
    }
  };

  const toggleSecondaryTrade = (tName: string) => {
    setSecondaryTrades((prev) => 
      prev.includes(tName) ? prev.filter((t) => t !== tName) : [...prev, tName]
    );
  };

  const toggleService = (srv: string) => {
    const trimmed = srv.trim();
    if (!trimmed) return;
    setServices((prev) => {
      const next = prev.includes(trimmed) ? prev.filter((s) => s !== trimmed) : [...prev, trimmed];
      if (next.length >= 1) {
        setServicesError('');
      }
      return next;
    });
  };

  const handleAddCustomService = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customServiceInput.trim();
    if (trimmed && !services.includes(trimmed)) {
      setServices((prev) => {
        const next = [...prev, trimmed];
        if (next.length >= 1) {
          setServicesError('');
        }
        return next;
      });
      setCustomServiceInput('');
    }
  };

  const validateServicesAndContinue = () => {
    if (services.length < 1) {
      setServicesError('Agrega al menos un trabajo o servicio que realizas para continuar.');
      if (servicesSectionRef.current) {
        servicesSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        servicesSectionRef.current.focus?.();
      }
      return;
    }
    setServicesError('');
    setGeneralError('');
    goWizard(wizardIndex + 1, 'next');
  };

  const toggleServiceArea = (areaName: string) => {
    setSelectedAreas((prev) =>
      prev.includes(areaName) ? prev.filter((a) => a !== areaName) : [...prev, areaName]
    );
  };

  // =========================================================================
  // STEP 5: Final Submission to Firestore & Storage
  // =========================================================================
  const handleFinishRegistration = async () => {
    setIsSubmitting(true);
    setGeneralError('');
    setUploadStatusText('Creando perfil...');

    const resolvedWhatsapp = clean10Digits;

    try {
      if (!auth.currentUser) {
        setGeneralError('Debes tener una sesión activa para completar tu registro.');
        setIsSubmitting(false);
        return;
      }

      if (!firstName.trim()) {
        setGeneralError('Por favor escribe tu nombre.');
        goWizard(0, 'back');
        setIsSubmitting(false);
        return;
      }

      if (!lastName.trim()) {
        setGeneralError('Por favor escribe tu primer apellido.');
        goWizard(0, 'back');
        setIsSubmitting(false);
        return;
      }

      if (clean10Digits.length !== 10) {
        setGeneralError('Por favor verifica que tu número de celular tenga 10 dígitos.');
        goWizard(0, 'back');
        setIsSubmitting(false);
        return;
      }

      if (!mainTrade.trim()) {
        setGeneralError('Por favor selecciona tu oficio principal.');
        goWizard(1, 'back');
        setIsSubmitting(false);
        return;
      }

      if (services.length === 0) {
        setGeneralError('Por favor selecciona al menos un trabajo que realizas.');
        goWizard(5, 'back');
        setIsSubmitting(false);
        return;
      }

      if (selectedAreas.length === 0) {
        setGeneralError('Por favor selecciona al menos una zona de trabajo.');
        goWizard(6, 'back');
        setIsSubmitting(false);
        return;
      }

      // Pre-check phone status before final profile creation (prevent race conditions)
      const formattedE164 = formatMexicanPhoneToE164(clean10Digits);
      try {
        const token = await auth.currentUser.getIdToken(true);
        const isFbUser = registrationMethod === 'facebook';
        const preCheckRes = await fetch('/api/auth/phone-status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            phone: formattedE164,
            intent: isFbUser ? 'link' : 'register',
          }),
        });

        if (!preCheckRes.ok) {
          const errBody = await preCheckRes.json().catch(() => ({}));
          setGeneralError(errBody?.error || 'No pudimos validar tu teléfono antes de guardar el perfil. Intenta nuevamente.');
          setIsSubmitting(false);
          return;
        }

        const preCheckData = await preCheckRes.json();
        if (!preCheckData?.success) {
          setGeneralError(preCheckData?.error || 'No pudimos validar tu teléfono antes de guardar el perfil.');
          setIsSubmitting(false);
          return;
        }

        if (preCheckData.usedByOther === true) {
          setGeneralError('Este número de celular ya está registrado por otra cuenta en Maestro Cerca.');
          setIsSubmitting(false);
          return;
        }
      } catch (checkErr) {
        setGeneralError('Error de conexión al validar el teléfono. Por favor intenta de nuevo.');
        setIsSubmitting(false);
        return;
      }

      // Create worker profile in Firestore (/maestros/{uid}) without generic fallbacks
      const res = await createWorkerProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: clean10Digits,
        whatsapp: resolvedWhatsapp,
        email: registrationMethod === 'facebook' && optionalEmail.trim() ? optionalEmail.trim() : undefined,
        mainTrade: mainTrade.trim(),
        oficio: mainTrade.trim(),
        secondaryTrades,
        yearsExperience: (yearsExperience !== undefined && yearsExperience !== null && Number(yearsExperience) > 0) ? Number(yearsExperience) : undefined,
        description: description.trim() || undefined,
        disponibilidad,
        services,
        serviceAreas: selectedAreas,
        // Public photo fields are strictly empty until administrative approval
        profilePhoto: '',
        photoUrl: '',
        fotoUrl: '',
        workPhotos: [],
        registrationMethod,
        privacyNoticeAccepted: true,
        privacyNoticeAcceptedAt: new Date().toISOString(),
        privacyNoticeVersion: '1.0',
        termsAccepted: true,
        termsAcceptedAt: new Date().toISOString(),
        termsVersion: '1.0',
      });

      if (res.success && res.worker) {
        const targetUserId = res.worker.userId || auth.currentUser.uid;
        const uploadedWorkPhotos: WorkPhoto[] = [];
        let photoUploadFailed = false;

        // Upload photos if any (Decoupled: storage failure does not block profile completion)
        const hasPhotosToUpload = Boolean(pendingProfileFile || pendingWorkFiles.length > 0);

        if (hasPhotosToUpload) {
          setIsUploading(true);
          setUploadStatusText('Subiendo fotografías...');

          // 1. Upload profile photo to private pending storage if selected
          if (pendingProfileFile) {
            try {
              setUploadStatusText('Subiendo foto de perfil para revisión...');
              const uploadResult = await uploadWorkerProfileImage(targetUserId, pendingProfileFile);
              await submitPendingProfilePhoto(targetUserId, uploadResult.storagePath);
              setHasProfileUploadFailed(false);
            } catch (pErr: any) {
              photoUploadFailed = true;
              setHasProfileUploadFailed(true);
              console.error('[Storage Error - Pending Profile Photo]:', pErr);
            }
          }

          // 2. Upload work photos if selected
          if (pendingWorkFiles.length > 0) {
            const updatedPending = [...pendingWorkFiles];
            for (let i = 0; i < updatedPending.length; i++) {
              const item = updatedPending[i];
              try {
                setUploadStatusText(`Subiendo foto ${i + 1} de ${pendingWorkFiles.length}...`);
                const uploaded = await uploadWorkerWorkPhoto(targetUserId, item.file, item.title, i);
                item.uploadedUrl = uploaded.url;
                item.failed = false;
                uploadedWorkPhotos.push({
                  id: `p-${Date.now()}-${i}`,
                  url: uploaded.url,
                  title: uploaded.title,
                });
              } catch (wErr: any) {
                photoUploadFailed = true;
                item.failed = true;
                setHasWorkPhotosUploadFailed(true);
                console.error(`[Storage Error - Work Photo ${i}]:`, {
                  code: wErr?.code,
                  message: wErr?.message,
                  targetPath: `portafolios/${targetUserId}/trabajos/${item.file.name}`,
                  error: wErr,
                });
              }
            }
            setPendingWorkFiles(updatedPending);
          }

          setIsUploading(false);
        }

        // Update worker with uploaded work photos if any were successfully added
        if (uploadedWorkPhotos.length > 0) {
          setUploadStatusText('Guardando fotografías en tu perfil...');
          try {
            await updateWorkerProfile(res.worker.id, {
              workPhotos: uploadedWorkPhotos,
              fotosTrabajos: uploadedWorkPhotos.map((p) => p.url),
            });
          } catch (updateErr: any) {
            console.warn('[Work Photos Update Warning]:', updateErr);
          }
        }

        setCreatedWorker({
          ...res.worker,
          profilePhoto: '',
          fotoUrl: '',
          photoUrl: '',
          profilePhotoReviewStatus: pendingProfileFile ? 'pending' : 'none',
          workPhotos: uploadedWorkPhotos,
        });

        trackGenericEvent('registro_trabajador_completado');

        if (photoUploadFailed) {
          showToast('Perfil guardado con éxito. Algunas fotografías no se pudieron subir por problemas de conexión; puedes reintentar la subida ahora mismo.');
        }

        setIsWorkerRegistrationActive(false);
        setStep(6); // Step 6: Success Screen (Never blocked by storage!)
      } else {
        setGeneralError(res.error || 'Ocurrió un error al guardar tu perfil. Intenta de nuevo.');
      }
    } catch (err: any) {
      console.error('[Registration Error]:', err);
      setGeneralError('Error al procesar el registro. Verifica tu conexión e intenta de nuevo.');
    } finally {
      setIsUploading(false);
      setIsSubmitting(false);
      setUploadStatusText('');
    }
  };

  // Resilient Retry Upload Function: Re-executes failed uploads without requiring re-selection of files
  const handleRetryUploads = async () => {
    const targetWorker = createdWorker;
    if (!targetWorker || !auth.currentUser) return;
    const targetUserId = targetWorker.userId || auth.currentUser.uid;

    setIsRetryingUpload(true);
    setUploadRetryMessage('Reintentando subir fotografías...');
    let anyStillFailed = false;

    // 1. Retry profile photo if it failed
    if (hasProfileUploadFailed && pendingProfileFile) {
      try {
        setUploadRetryMessage('Subiendo foto de perfil...');
        const uploadResult = await uploadWorkerProfileImage(targetUserId, pendingProfileFile);
        await submitPendingProfilePhoto(targetUserId, uploadResult.storagePath);
        setHasProfileUploadFailed(false);
        setCreatedWorker((prev) => prev ? { ...prev, profilePhotoReviewStatus: 'pending' } : prev);
      } catch (err: any) {
        console.error('[Retry Profile Photo Failed]:', err);
        anyStillFailed = true;
      }
    }

    // 2. Retry work photos that failed
    const hasFailedWorkPhotos = pendingWorkFiles.some((item) => item.failed && !item.uploadedUrl);
    if (hasFailedWorkPhotos) {
      const newlyUploaded: WorkPhoto[] = [];
      const updatedPendingList = [...pendingWorkFiles];

      for (let i = 0; i < updatedPendingList.length; i++) {
        const item = updatedPendingList[i];
        if (item.failed && !item.uploadedUrl) {
          try {
            setUploadRetryMessage(`Subiendo foto ${i + 1}...`);
            const uploaded = await uploadWorkerWorkPhoto(targetUserId, item.file, item.title, i);
            item.uploadedUrl = uploaded.url;
            item.failed = false;
            newlyUploaded.push({
              id: `p-${Date.now()}-${i}`,
              url: uploaded.url,
              title: uploaded.title,
            });
          } catch (err: any) {
            console.error(`[Retry Work Photo ${i} Failed]:`, err);
            anyStillFailed = true;
          }
        }
      }

      setPendingWorkFiles(updatedPendingList);

      if (newlyUploaded.length > 0) {
        const mergedPhotos = [...(targetWorker.workPhotos || []), ...newlyUploaded];
        try {
          await updateWorkerProfile(targetWorker.id, {
            workPhotos: mergedPhotos,
            fotosTrabajos: mergedPhotos.map((p) => p.url),
          });
          setCreatedWorker((prev) => prev ? { ...prev, workPhotos: mergedPhotos } : prev);
        } catch (updateErr) {
          console.warn('Could not update worker profile photos on retry:', updateErr);
        }
      }

      if (!updatedPendingList.some((item) => item.failed)) {
        setHasWorkPhotosUploadFailed(false);
      }
    }

    setIsRetryingUpload(false);
    setUploadRetryMessage('');

    if (!anyStillFailed) {
      showToast('¡Fotografías subidas exitosamente!');
    } else {
      showToast('No se pudieron subir algunos archivos por problemas de red. Puedes volver a intentar.');
    }
  };

  const wizardProgressPct = step === 1
    ? 6
    : step === 6
    ? 100
    : 10 + ((wizardIndex + 1) / WIZARD_STEPS.length) * 84;

  return (
    <div className="min-h-screen bg-[#FAF8F5] py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto space-y-5 sm:space-y-6">

        {/* Logo: always visible during registration */}
        <div className="flex items-center justify-center">
          <BrandLogoIcon size={44} />
        </div>

        {/* Progress Bar & Cancel Link */}
        {step < 6 && (
          <div className="space-y-2.5">
            <div className="w-full bg-slate-200/70 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-[#FF6B00] h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${wizardProgressPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between">
              {step === 2 ? (
                <button
                  type="button"
                  onClick={() => wizardIndex === 0 ? setStep(1) : goWizard(wizardIndex - 1, 'back')}
                  className="text-sm font-bold text-[#0C2340] hover:text-[#FF6B00] transition-colors cursor-pointer flex items-center gap-1 py-1 active:scale-95"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Atrás</span>
                </button>
              ) : <span />}
              <button
                type="button"
                id="btn-cancel-registration"
                onClick={async () => {
                  await cancelWorkerRegistration();
                }}
                className="text-xs text-slate-400 hover:text-slate-700 font-semibold transition-colors cursor-pointer py-1"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Global Error Banner */}
        {generalError && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm rounded-2xl flex items-start gap-2.5 shadow-xs animate-fadeIn">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
            <div className="space-y-2 flex-1">
              <p className="font-bold">{generalError}</p>
              {phoneRegisteredRedirect && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => navigateTo({ type: 'worker-login' })}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    <span>Iniciar sesión con este número</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 1: CREAR CUENTA (TELÉFONO / FACEBOOK + AVISO PRIVACIDAD) */}
        {/* ========================================================================= */}
        {step === 1 && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-black text-[#0C2340] tracking-tight">
                Crea tu cuenta en Maestro Cerca
              </h1>
            </div>

            {/* Aviso breve de privacidad y términos obligatorios */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 text-left">
              <p className="text-xs text-slate-700 leading-relaxed">
                Utilizaremos tu número y la información que proporciones para crear y administrar tu cuenta y perfil público en Maestro Cerca.
              </p>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                <a
                  href="/aviso-de-privacidad"
                  onClick={(e) => {
                    e.preventDefault();
                    navigateTo({ type: 'privacy' });
                  }}
                  className="text-orange-600 font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Aviso de Privacidad</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <a
                  href="/terminos-y-condiciones"
                  onClick={(e) => {
                    e.preventDefault();
                    navigateTo({ type: 'terms' });
                  }}
                  className="text-orange-600 font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Términos y Condiciones</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="pt-2 border-t border-slate-200/80">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    id="register-agreement-checkbox"
                    checked={privacyAccepted && termsAccepted}
                    onChange={(e) => {
                      setPrivacyAccepted(e.target.checked);
                      setTermsAccepted(e.target.checked);
                    }}
                    className="mt-0.5 w-4 h-4 rounded text-orange-600 border-slate-300 focus:ring-orange-500 cursor-pointer shrink-0"
                  />
                  <span className="text-xs font-bold text-slate-800">
                    He leído y acepto el Aviso de Privacidad y los Términos y Condiciones. <span className="text-red-500">*</span>
                  </span>
                </label>
              </div>
            </div>

            {/* Sub-Step A: Phone Input */}
            {phoneSubStep === 'phone' ? (
              <form onSubmit={handleSendPhoneSms} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1.5">
                    Opción 1: Registrar con número celular (SMS)
                  </label>
                  <div className="flex items-center rounded-xl border border-slate-300 bg-slate-50 focus-within:bg-white focus-within:border-orange-600 focus-within:ring-2 focus-within:ring-orange-500/20 transition-all overflow-hidden">
                    <div className="px-3.5 py-3.5 bg-slate-100 border-r border-slate-300 text-slate-700 font-bold text-sm flex items-center gap-1 select-none">
                      <span>🇲🇽</span>
                      <span>+52</span>
                    </div>
                    <input
                      type="tel"
                      id="register-phone-input"
                      inputMode="numeric"
                      placeholder="442 123 4567"
                      value={rawPhone}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setRawPhone(val);
                      }}
                      className="w-full p-3.5 bg-transparent text-slate-900 text-base font-bold tracking-wider placeholder:text-slate-400 placeholder:font-normal focus:outline-hidden"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    Te enviaremos un código SMS de 6 dígitos para validar tu cuenta.
                  </p>
                </div>

                {/* Invisible reCAPTCHA container for registration */}
                <div id="recaptcha-register-container"></div>

                <button
                  type="submit"
                  id="register-send-sms-btn"
                  disabled={isPhoneLoading || clean10Digits.length !== 10 || !privacyAccepted || !termsAccepted}
                  className="w-full py-3.5 px-6 bg-[#FF6B00] hover:bg-[#e65f00] disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-sm sm:text-base rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isPhoneLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Enviando código SMS...</span>
                    </>
                  ) : (
                    <>
                      <Phone className="w-4 h-4" />
                      <span>Enviar código por SMS</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* Sub-Step B: SMS Code Input */
              <form onSubmit={handleConfirmPhoneCode} className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-600">
                    Código enviado a <strong className="text-slate-900">+52 {formatPhoneForDisplay(clean10Digits)}</strong>
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setPhoneSubStep('phone');
                      setGeneralError('');
                    }}
                    className="text-xs font-bold text-orange-600 hover:text-orange-700 underline cursor-pointer shrink-0"
                  >
                    Cambiar número
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1.5">
                    Código de 6 dígitos recibido por SMS
                  </label>
                  <input
                    type="text"
                    id="register-sms-code-input"
                    inputMode="numeric"
                    autoFocus
                    maxLength={6}
                    placeholder="123456"
                    value={smsCode}
                    onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full p-3.5 bg-slate-50 border-2 border-slate-300 focus:bg-white focus:border-orange-600 text-center text-2xl sm:text-3xl font-black tracking-[0.3em] rounded-xl transition-all focus:outline-hidden"
                  />
                </div>

                <button
                  type="submit"
                  id="register-confirm-code-btn"
                  disabled={isPhoneLoading || smsCode.replace(/\D/g, '').length < 6}
                  className="w-full py-3.5 px-6 bg-[#FF6B00] hover:bg-[#e65f00] disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-sm sm:text-base rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isPhoneLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Verificando código...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      <span>Confirmar código y continuar</span>
                    </>
                  )}
                </button>

                <div className="flex items-center justify-center pt-1">
                  {cooldown > 0 ? (
                    <span className="text-xs text-slate-500 font-medium">
                      Reenviar código en <strong className="text-slate-700">{cooldown}s</strong>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendPhoneSms}
                      disabled={isPhoneLoading}
                      className="text-xs text-orange-600 hover:text-orange-700 font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reenviar código por SMS</span>
                    </button>
                  )}
                </div>
              </form>
            )}

            {/* Social Authentication Options: disabled for the MVP (FACEBOOK_AUTH_ENABLED flag) */}
            {FACEBOOK_AUTH_ENABLED && (
              <>
                {/* Divider */}
                <div className="relative flex py-1 items-center">
                  <div className="grow border-t border-slate-200"></div>
                  <span className="shrink mx-4 text-xs font-bold uppercase text-slate-400">
                    O regístrate con
                  </span>
                  <div className="grow border-t border-slate-200"></div>
                </div>

                <div className="space-y-3">
                  {/* Facebook Button */}
                  <button
                    type="button"
                    id="register-facebook-btn"
                    disabled={isFacebookLoading || isPhoneLoading}
                    onClick={handleFacebookSignUp}
                    className="w-full py-3.5 px-4 bg-[#1877F2] hover:bg-[#166FE5] text-white font-bold text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center gap-3 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isFacebookLoading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <FacebookIcon className="w-5 h-5 text-white" />
                        <span>Continuar con Facebook</span>
                      </>
                    )}
                  </button>
                </div>
              </>
            )}

            {/* Existing User Redirect Note */}
            <div className="pt-3 border-t border-slate-100 text-center space-y-1.5">
              <p className="text-xs text-slate-600">
                ¿Ya tienes una cuenta en Maestro Cerca?
              </p>
              <button
                type="button"
                onClick={() => navigateTo({ type: 'worker-login' })}
                className="text-orange-600 hover:text-orange-700 font-bold text-xs hover:underline cursor-pointer"
              >
                Inicia sesión y vincula tus otros métodos de acceso desde tu perfil
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 2: PERFIL PASO A PASO (una pregunta por pantalla, estilo WhatsApp) */}
        {/* ========================================================================= */}
        {step === 2 && (
          <div
            key={wizardIndex}
            className={`bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6 ${
              swipeDirection === 'next' ? 'wizard-slide-next' : 'wizard-slide-back'
            }`}
          >
            {/* --- DATOS PERSONALES --- */}
            {WIZARD_STEPS[wizardIndex] === 'datos' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!firstName.trim()) {
                    setGeneralError('Por favor escribe tu nombre.');
                    return;
                  }
                  if (clean10Digits.length !== 10) {
                    setGeneralError('Por favor ingresa tu número celular de contacto de 10 dígitos.');
                    return;
                  }
                  setGeneralError('');
                  goWizard(wizardIndex + 1, 'next');
                }}
                className="space-y-6"
              >
                <h1 className="text-2xl sm:text-3xl font-black text-[#0C2340] tracking-tight">
                  Tus datos personales
                </h1>

                {!isPhoneAuthVerified && (
                  <div id="phone-unverified-banner" className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-xs space-y-1">
                      <p className="font-bold text-amber-900 text-sm">Teléfono pendiente de verificar</p>
                      <p className="text-amber-800 leading-relaxed">
                        Iniciaste tu registro con Facebook. Puedes verificar tu número celular por SMS ahora o continuar y verificarlo más adelante desde tu panel de trabajador.
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">
                      Nombre <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      autoFocus
                      placeholder="Ej. Roberto"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full p-3.5 bg-slate-50 border border-slate-300 rounded-2xl text-base font-semibold focus:bg-white focus:outline-hidden focus:border-[#FF6B00] focus:ring-2 focus:ring-[#FF6B00]/15 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">
                      Primer apellido <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Sánchez"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full p-3.5 bg-slate-50 border border-slate-300 rounded-2xl text-base font-semibold focus:bg-white focus:outline-hidden focus:border-[#FF6B00] focus:ring-2 focus:ring-[#FF6B00]/15 transition-all"
                    />
                  </div>
                </div>

                {isPhoneAuthVerified && clean10Digits ? (
                  <div className="flex items-center justify-between p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span className="text-sm font-black text-emerald-900">
                        +52 {formatPhoneForDisplay(clean10Digits)}
                      </span>
                    </div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200">
                      ✓ Verificado por SMS
                    </span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">
                        Teléfono celular de contacto (10 dígitos) <span className="text-red-500">*</span>
                      </label>
                      <div className="flex items-center rounded-2xl border border-slate-300 bg-slate-50 focus-within:bg-white focus-within:border-[#FF6B00] overflow-hidden">
                        <div className="px-3.5 py-3 bg-slate-100 border-r border-slate-300 text-slate-700 font-bold text-sm flex items-center gap-1 select-none">
                          <span>🇲🇽</span>
                          <span>+52</span>
                        </div>
                        <input
                          type="tel"
                          inputMode="numeric"
                          required
                          placeholder="442 123 4567"
                          value={rawPhone}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                            setRawPhone(val);
                            if (linkSubStep === 'code') setLinkSubStep('idle');
                          }}
                          className="w-full p-3 bg-transparent text-slate-900 text-base font-bold tracking-wider placeholder:text-slate-400 placeholder:font-normal focus:outline-hidden"
                        />
                      </div>
                    </div>

                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
                      {linkSubStep === 'idle' ? (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          <p className="text-xs font-bold text-slate-700">Verifica este número por SMS</p>
                          <button
                            type="button"
                            disabled={clean10Digits.length !== 10 || isLinkingLoading}
                            onClick={handleSendLinkSms}
                            className="px-4 py-2 bg-[#0C2340] hover:bg-[#153357] disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed shrink-0"
                          >
                            {isLinkingLoading ? (
                              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <>
                                <Phone className="w-3.5 h-3.5" />
                                <span>Verificar por SMS</span>
                              </>
                            )}
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-bold text-slate-800">
                              Código enviado a +52 {formatPhoneForDisplay(clean10Digits)}:
                            </p>
                            <button
                              type="button"
                              onClick={() => { setLinkSubStep('idle'); setLinkSmsCode(''); }}
                              className="text-[11px] text-slate-500 hover:text-slate-700 font-medium underline cursor-pointer"
                            >
                              Cambiar número
                            </button>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              inputMode="numeric"
                              maxLength={6}
                              placeholder="123456"
                              value={linkSmsCode}
                              onChange={(e) => setLinkSmsCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                              className="w-36 p-2.5 text-center text-lg font-black tracking-widest bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:border-[#FF6B00]"
                            />
                            <button
                              type="button"
                              disabled={linkSmsCode.length !== 6 || isLinkingLoading}
                              onClick={handleConfirmLinkSms}
                              className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer disabled:cursor-not-allowed"
                            >
                              {isLinkingLoading ? (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <>
                                  <CheckCircle2 className="w-4 h-4" />
                                  <span>Confirmar SMS</span>
                                </>
                              )}
                            </button>
                          </div>
                          {cooldown > 0 ? (
                            <p className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>Reenviar código en {cooldown}s</span>
                            </p>
                          ) : (
                            <button
                              type="button"
                              onClick={handleSendLinkSms}
                              className="text-[11px] text-[#FF6B00] font-bold hover:underline cursor-pointer"
                            >
                              Reenviar código SMS
                            </button>
                          )}
                        </div>
                      )}
                      {linkError && (
                        <p className="text-xs text-red-600 font-semibold bg-red-50 p-2 rounded-lg border border-red-200">
                          {linkError}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-semibold text-emerald-900">
                  <MessageCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Los clientes te contactarán por llamada o WhatsApp a este mismo número.</span>
                </div>

                {registrationMethod === 'facebook' && (
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">
                      Correo electrónico <span className="text-slate-400 font-normal lowercase">(opcional)</span>
                    </label>
                    <input
                      type="email"
                      placeholder="ejemplo@correo.com"
                      value={optionalEmail}
                      onChange={(e) => setOptionalEmail(e.target.value)}
                      className="w-full p-3.5 bg-slate-50 border border-slate-300 rounded-2xl text-sm font-medium focus:bg-white focus:outline-hidden focus:border-[#FF6B00]"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-4 px-6 bg-[#FF6B00] hover:bg-[#e65f00] active:scale-[0.98] text-white font-extrabold text-base rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Continuar</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </form>
            )}

            {/* --- OFICIO PRINCIPAL --- */}
            {WIZARD_STEPS[wizardIndex] === 'oficio' && (
              <div className="space-y-6">
                <h1 className="text-2xl sm:text-3xl font-black text-[#0C2340] tracking-tight">
                  ¿Cuál es tu oficio principal?
                </h1>
                <div className="grid grid-cols-2 gap-2.5">
                  {trades.map((t) => {
                    const isSelected = mainTrade === t.name;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setMainTrade(t.name)}
                        className={`py-4 px-3 rounded-2xl text-sm font-bold border-2 transition-all cursor-pointer active:scale-[0.97] ${
                          isSelected
                            ? 'bg-[#0C2340] text-white border-[#0C2340] shadow-md'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-[#FF6B00]/50'
                        }`}
                      >
                        {t.name}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => goWizard(wizardIndex + 1, 'next')}
                  className="w-full py-4 px-6 bg-[#FF6B00] hover:bg-[#e65f00] active:scale-[0.98] text-white font-extrabold text-base rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Continuar</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* --- AÑOS DE EXPERIENCIA --- */}
            {WIZARD_STEPS[wizardIndex] === 'experiencia' && (
              <div className="space-y-8">
                <h1 className="text-2xl sm:text-3xl font-black text-[#0C2340] tracking-tight">
                  ¿Cuántos años de experiencia tienes?
                </h1>
                <div className="text-center py-4">
                  <span className="text-6xl font-black text-[#FF6B00]">{yearsExperience}</span>
                  <span className="block text-lg font-bold text-slate-500 mt-1">
                    {yearsExperience === 1 ? 'año' : 'años'}
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="40"
                  value={yearsExperience}
                  onChange={(e) => setYearsExperience(Number(e.target.value))}
                  className="w-full accent-[#FF6B00] cursor-pointer h-2"
                />
                <button
                  type="button"
                  onClick={() => goWizard(wizardIndex + 1, 'next')}
                  className="w-full py-4 px-6 bg-[#FF6B00] hover:bg-[#e65f00] active:scale-[0.98] text-white font-extrabold text-base rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Continuar</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* --- OTROS OFICIOS (OPCIONAL) --- */}
            {WIZARD_STEPS[wizardIndex] === 'otros' && (
              <div className="space-y-6">
                <h1 className="text-2xl sm:text-3xl font-black text-[#0C2340] tracking-tight">
                  ¿Qué otros oficios dominas?
                </h1>
                <div className="flex flex-wrap gap-2">
                  {trades
                    .filter((t) => t.name !== mainTrade)
                    .map((t) => {
                      const isSelected = secondaryTrades.includes(t.name);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => toggleSecondaryTrade(t.name)}
                          className={`px-4 py-2.5 rounded-xl text-sm font-bold border-2 transition-all cursor-pointer active:scale-95 ${
                            isSelected
                              ? 'bg-[#0C2340] text-white border-[#0C2340]'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-[#FF6B00]/50'
                          }`}
                        >
                          {isSelected && '✓ '}
                          {t.name}
                        </button>
                      );
                    })}
                </div>
                <button
                  type="button"
                  onClick={() => goWizard(wizardIndex + 1, 'next')}
                  className="w-full py-4 px-6 bg-[#FF6B00] hover:bg-[#e65f00] active:scale-[0.98] text-white font-extrabold text-base rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Continuar</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* --- DISPONIBILIDAD --- */}
            {WIZARD_STEPS[wizardIndex] === 'disponibilidad' && (
              <div className="space-y-6">
                <h1 className="text-2xl sm:text-3xl font-black text-[#0C2340] tracking-tight">
                  ¿Cuál es tu disponibilidad?
                </h1>
                <div className="grid grid-cols-2 gap-3">
                  {['Lunes a viernes', 'Fines de semana', 'Medio tiempo', 'Bajo cita'].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setDisponibilidad(opt)}
                      className={`py-5 px-3 rounded-2xl text-sm font-bold border-2 transition-all cursor-pointer active:scale-[0.97] ${
                        disponibilidad === opt
                          ? 'bg-[#0C2340] text-white border-[#0C2340] shadow-md'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-[#FF6B00]/50'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => goWizard(wizardIndex + 1, 'next')}
                  className="w-full py-4 px-6 bg-[#FF6B00] hover:bg-[#e65f00] active:scale-[0.98] text-white font-extrabold text-base rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Continuar</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* --- TRABAJOS QUE REALIZAS --- */}
            {WIZARD_STEPS[wizardIndex] === 'trabajos' && (
              <div className="space-y-6">
                <h1 className="text-2xl sm:text-3xl font-black text-[#0C2340] tracking-tight">
                  ¿Qué trabajos específicos realizas?
                </h1>

                <div
                  ref={servicesSectionRef}
                  tabIndex={-1}
                  className={`space-y-3 p-4 rounded-2xl transition-all outline-hidden ${
                    servicesError
                      ? 'border-2 border-red-500 bg-red-50/50 ring-2 ring-red-200'
                      : ''
                  }`}
                >
                  <div className="flex flex-wrap gap-2">
                    {(tradeServiceSuggestions[mainTrade] || []).map((sugg) => {
                      const isSelected = services.includes(sugg);
                      return (
                        <button
                          key={sugg}
                          type="button"
                          onClick={() => toggleService(sugg)}
                          className={`px-3.5 py-2 rounded-xl text-sm font-bold border-2 transition-all cursor-pointer active:scale-95 ${
                            isSelected
                              ? 'bg-[#FF6B00] text-white border-[#FF6B00] shadow-xs'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-[#FF6B00]/50'
                          }`}
                        >
                          {isSelected ? '✓ ' : '+ '}
                          {sugg}
                        </button>
                      );
                    })}
                    {services
                      .filter((srv) => !(tradeServiceSuggestions[mainTrade] || []).includes(srv))
                      .map((customSrv) => (
                        <button
                          key={customSrv}
                          type="button"
                          onClick={() => toggleService(customSrv)}
                          className="px-3.5 py-2 rounded-xl text-sm font-bold border-2 transition-all cursor-pointer active:scale-95 bg-[#FF6B00] text-white border-[#FF6B00] shadow-xs flex items-center gap-1.5"
                        >
                          <span>✓ {customSrv}</span>
                          <span className="text-orange-200 hover:text-white font-black text-xs">✕</span>
                        </button>
                      ))}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Otro trabajo específico"
                      value={customServiceInput}
                      onChange={(e) => setCustomServiceInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCustomService(e as any);
                        }
                      }}
                      className="flex-1 p-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium focus:bg-white focus:outline-hidden focus:border-[#FF6B00]"
                    />
                    <button
                      type="button"
                      onClick={(e) => handleAddCustomService(e as any)}
                      className="px-4 py-2 bg-[#0C2340] text-white text-sm font-bold rounded-xl hover:bg-[#153357] cursor-pointer shrink-0 active:scale-95 transition-all"
                    >
                      Agregar
                    </button>
                  </div>

                  {servicesError && (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-red-600">
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                      <span>{servicesError}</span>
                    </div>
                  )}
                </div>

                <textarea
                  rows={2}
                  placeholder="Breve presentación de tu trabajo (opcional)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-3.5 bg-slate-50 border border-slate-300 rounded-2xl text-sm font-medium focus:bg-white focus:outline-hidden focus:border-[#FF6B00]"
                />

                <button
                  type="button"
                  onClick={validateServicesAndContinue}
                  className="w-full py-4 px-6 bg-[#FF6B00] hover:bg-[#e65f00] active:scale-[0.98] text-white font-extrabold text-base rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Continuar</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* --- ZONAS DE TRABAJO --- */}
            {WIZARD_STEPS[wizardIndex] === 'zonas' && (
              <div className="space-y-6">
                <h1 className="text-2xl sm:text-3xl font-black text-[#0C2340] tracking-tight">
                  ¿En qué zonas trabajas?
                </h1>
                <div className="flex flex-wrap gap-2">
                  {serviceAreas.map((a) => {
                    const isSelected = selectedAreas.includes(a.name);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => toggleServiceArea(a.name)}
                        className={`px-3.5 py-2.5 rounded-xl text-sm font-bold border-2 transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-[#0C2340] text-white border-[#0C2340] shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-[#FF6B00]/50'
                        }`}
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        <span>{a.name}</span>
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedAreas.length === 0) {
                      setGeneralError('Por favor selecciona al menos una zona de trabajo antes de continuar.');
                      return;
                    }
                    setGeneralError('');
                    goWizard(wizardIndex + 1, 'next');
                  }}
                  className="w-full py-4 px-6 bg-[#FF6B00] hover:bg-[#e65f00] active:scale-[0.98] text-white font-extrabold text-base rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Continuar</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* --- FOTO DE PERFIL (avatar-first) --- */}
            {WIZARD_STEPS[wizardIndex] === 'fotoPerfil' && (
              <div className="space-y-6 text-center">
                <h1 className="text-2xl sm:text-3xl font-black text-[#0C2340] tracking-tight">
                  Agrega tu foto de perfil
                </h1>
                <div className="flex flex-col items-center gap-4 py-2">
                  <div className="relative w-40 h-40 sm:w-48 sm:h-48 rounded-full overflow-hidden shrink-0 border-4 border-slate-100 shadow-md">
                    <WorkerAvatar
                      alt="Foto de perfil"
                      allowPendingPreview={true}
                      previewUrl={profilePreviewUrl || profilePhotoUrl}
                      size="custom"
                      className="w-full h-full"
                    />
                  </div>
                  <label className="inline-flex items-center gap-2 px-6 py-3 bg-[#0C2340] hover:bg-[#153357] text-white text-sm font-bold rounded-2xl cursor-pointer transition-all active:scale-95 shadow-xs">
                    <Camera className="w-4 h-4" />
                    <span>{profilePreviewUrl || profilePhotoUrl ? 'Cambiar foto' : 'Subir fotografía'}</span>
                    <input type="file" accept="image/*" onChange={handleProfilePhotoChange} className="hidden" />
                  </label>
                  <p className="text-xs text-slate-500">Opcional — puedes agregarla después.</p>
                </div>
                <button
                  type="button"
                  onClick={() => goWizard(wizardIndex + 1, 'next')}
                  className="w-full py-4 px-6 bg-[#FF6B00] hover:bg-[#e65f00] active:scale-[0.98] text-white font-extrabold text-base rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Continuar</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* --- FOTOS DE TRABAJOS --- */}
            {WIZARD_STEPS[wizardIndex] === 'fotosTrabajo' && (
              <div className="space-y-6">
                <h1 className="text-2xl sm:text-3xl font-black text-[#0C2340] tracking-tight">
                  Fotos de tus trabajos
                </h1>

                {pendingWorkFiles.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {pendingWorkFiles.map((item, idx) => (
                      <div key={idx} className="relative aspect-square rounded-xl overflow-hidden bg-slate-200 border border-slate-300 group">
                        <img src={item.previewUrl} alt={item.title} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setPendingWorkFiles((prev) => prev.filter((_, i) => i !== idx))}
                          className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-red-600 text-white rounded-full transition-colors cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <label className="p-6 border-2 border-dashed border-slate-300 hover:border-[#FF6B00] rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer bg-slate-50 transition-all active:scale-[0.99]">
                  <Upload className="w-7 h-7 text-slate-400" />
                  <span className="text-sm font-bold text-[#FF6B00]">Subir fotos de trabajos</span>
                  <input type="file" multiple accept="image/*" onChange={handleWorkFilesUpload} className="hidden" />
                </label>

                <p className="text-xs text-slate-500 text-center">
                  Evita subir fotos de documentos o que afecten a terceros.
                </p>

                <button
                  type="button"
                  onClick={() => goWizard(wizardIndex + 1, 'next')}
                  className="w-full py-4 px-6 bg-[#FF6B00] hover:bg-[#e65f00] active:scale-[0.98] text-white font-extrabold text-base rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Continuar</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* --- RESUMEN Y CREAR CUENTA --- */}
            {WIZARD_STEPS[wizardIndex] === 'resumen' && (
              <div className="space-y-6">
                <h1 className="text-2xl sm:text-3xl font-black text-[#0C2340] tracking-tight">
                  Revisa tu información
                </h1>

                <div className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                  <div className="w-16 h-16 rounded-full overflow-hidden shrink-0 border-2 border-white shadow-xs">
                    <WorkerAvatar
                      alt="Foto de perfil"
                      allowPendingPreview={true}
                      previewUrl={profilePreviewUrl || profilePhotoUrl}
                      size="custom"
                      className="w-full h-full"
                    />
                  </div>
                  <div>
                    <p className="text-base font-black text-[#0C2340]">{firstName} {lastName}</p>
                    <p className="text-sm font-bold text-[#FF6B00]">{mainTrade} · {yearsExperience} {yearsExperience === 1 ? 'año' : 'años'}</p>
                  </div>
                </div>

                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between p-3 bg-slate-50 rounded-xl">
                    <span className="font-bold text-slate-500">Celular</span>
                    <span className="font-black text-slate-900">+52 {formatPhoneForDisplay(clean10Digits)}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-slate-50 rounded-xl">
                    <span className="font-bold text-slate-500">Disponibilidad</span>
                    <span className="font-black text-slate-900">{disponibilidad}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-slate-50 rounded-xl">
                    <span className="font-bold text-slate-500">Trabajos</span>
                    <span className="font-black text-slate-900 text-right">{services.length} seleccionados</span>
                  </div>
                  <div className="flex justify-between p-3 bg-slate-50 rounded-xl">
                    <span className="font-bold text-slate-500">Zonas</span>
                    <span className="font-black text-slate-900 text-right">{selectedAreas.join(', ')}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-slate-50 rounded-xl">
                    <span className="font-bold text-slate-500">Fotos de trabajo</span>
                    <span className="font-black text-slate-900">{pendingWorkFiles.length}</span>
                  </div>
                </div>

                <button
                  type="button"
                  id="submit-worker-profile-btn"
                  disabled={isSubmitting || isUploading}
                  onClick={handleFinishRegistration}
                  className="w-full py-5 px-6 bg-[#FF6B00] hover:bg-[#e65f00] disabled:bg-orange-300 active:scale-[0.98] text-white font-extrabold text-lg rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isSubmitting || isUploading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>{uploadStatusText || 'Creando cuenta...'}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      <span>Crear cuenta</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 6: CONFIRMACIÓN EXITOSA */}
        {/* ========================================================================= */}
        {step === 6 && createdWorker && (
          <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-xs text-center space-y-6 animate-fadeIn">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                ¡Registro completado!
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-[#0C2340] tracking-tight">
                ¡Bienvenido a Maestro Cerca, {createdWorker.firstName}!
              </h1>
              <p className="text-slate-600 text-sm max-w-md mx-auto leading-relaxed">
                Tu perfil de <strong>{createdWorker.mainTrade}</strong> ha sido guardado exitosamente y se encuentra en estado <strong>Pendiente de revisión</strong>.
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Nuestro equipo revisará la información de tu perfil. Mientras tanto, puedes acceder a tu panel de trabajador para gestionar tus datos y verificar tus requisitos.
              </p>
            </div>

            {/* Unverified phone alert in Step 6 if applicable */}
            {!createdWorker.phoneVerified && (
              <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-2xl text-left max-w-md mx-auto flex items-start gap-2.5 text-xs text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Teléfono pendiente de verificación por SMS</p>
                  <p className="text-amber-800 mt-0.5">
                    Para que tu perfil pueda ser activado en el directorio público, deberás validar tu número celular mediante código SMS desde tu panel de trabajador.
                  </p>
                </div>
              </div>
            )}

            {/* Resilient File Upload Retry Card if uploads failed */}
            {(hasProfileUploadFailed || hasWorkPhotosUploadFailed || pendingWorkFiles.some((f) => f.failed)) && (
              <div className="p-4 sm:p-5 bg-amber-50 border-2 border-amber-300 rounded-2xl text-left max-w-md mx-auto space-y-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-amber-100 text-amber-800 rounded-xl shrink-0 mt-0.5">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-amber-950">
                      Falla al subir fotografías por conexión o tiempo de espera
                    </h4>
                    <p className="text-xs text-amber-800 leading-relaxed">
                      Tus archivos siguen en memoria. La subida a Storage falló temporalmente, pero puedes reintentar ahora mismo sin volver a buscarlos ni abrir el explorador de archivos.
                    </p>
                  </div>
                </div>

                {/* Thumbnails of pending files */}
                <div className="flex items-center gap-2 overflow-x-auto py-1">
                  {hasProfileUploadFailed && profilePreviewUrl && (
                    <div className="relative w-12 h-12 rounded-xl overflow-hidden border-2 border-amber-400 shrink-0">
                      <img src={profilePreviewUrl} alt="Foto perfil" className="w-full h-full object-cover" />
                      <span className="absolute bottom-0 inset-x-0 bg-black/60 text-[9px] text-white text-center font-bold">Perfil</span>
                    </div>
                  )}
                  {pendingWorkFiles.filter((f) => f.failed).map((wf, idx) => (
                    <div key={idx} className="relative w-12 h-12 rounded-xl overflow-hidden border-2 border-amber-400 shrink-0">
                      <img src={wf.previewUrl} alt={wf.title} className="w-full h-full object-cover" />
                      <span className="absolute bottom-0 inset-x-0 bg-black/60 text-[9px] text-white text-center font-bold">Trabajo</span>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  id="btn-retry-upload"
                  disabled={isRetryingUpload}
                  onClick={handleRetryUploads}
                  className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isRetryingUpload ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>{uploadRetryMessage || 'Reintentando subida...'}</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-4 h-4" />
                      <span>Reintentar subida</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Quick Profile Snapshot Card */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-left max-w-md mx-auto space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">Teléfono de contacto:</span>
                <span className="text-xs font-black text-slate-900">+52 {formatPhoneForDisplay(createdWorker.phone)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">Oficio:</span>
                <span className="text-xs font-black text-orange-600">{createdWorker.mainTrade}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">Estatus:</span>
                <span className="text-xs font-extrabold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">Pendiente de revisión</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">Zonas de cobertura:</span>
                <span className="text-xs font-semibold text-slate-700">{createdWorker.serviceAreas.join(', ')}</span>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
              <button
                type="button"
                id="go-to-dashboard-btn"
                onClick={() => navigateTo({ type: 'dashboard' })}
                className="py-3.5 px-6 bg-[#FF6B00] hover:bg-[#e65f00] text-white font-bold text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <User className="w-4 h-4" />
                <span>Ir a mi panel de trabajador</span>
              </button>
              <button
                type="button"
                id="view-public-profile-btn"
                onClick={() => navigateTo({ type: 'profile', workerSlug: createdWorker.slug })}
                className="py-3.5 px-6 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold text-sm rounded-xl transition-colors cursor-pointer"
              >
                <span>Ver vista previa de mi perfil</span>
              </button>
            </div>
          </div>
        )}

        {/* Hidden reCAPTCHA container for SMS linking in Step 2 */}
        <div id="recaptcha-phone-link-container"></div>
      </div>
    </div>
  );
};
