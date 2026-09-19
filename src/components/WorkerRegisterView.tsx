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
  Check,
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
  const [isSameWhatsapp, setIsSameWhatsapp] = useState(true);
  const [customWhatsapp, setCustomWhatsapp] = useState('');
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

  const validateStep3AndContinue = () => {
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
    setStep(4);
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

    const resolvedWhatsapp = isSameWhatsapp 
      ? clean10Digits 
      : customWhatsapp.replace(/\D/g, '') || clean10Digits;

    try {
      if (!auth.currentUser) {
        setGeneralError('Debes tener una sesión activa para completar tu registro.');
        setIsSubmitting(false);
        return;
      }

      if (!firstName.trim()) {
        setGeneralError('Por favor escribe tu nombre.');
        setStep(2);
        setIsSubmitting(false);
        return;
      }

      if (!lastName.trim()) {
        setGeneralError('Por favor escribe tu primer apellido.');
        setStep(2);
        setIsSubmitting(false);
        return;
      }

      if (clean10Digits.length !== 10) {
        setGeneralError('Por favor verifica que tu número de celular tenga 10 dígitos.');
        setStep(2);
        setIsSubmitting(false);
        return;
      }

      if (!mainTrade.trim()) {
        setGeneralError('Por favor selecciona tu oficio principal.');
        setStep(3);
        setIsSubmitting(false);
        return;
      }

      if (services.length === 0) {
        setGeneralError('Por favor selecciona al menos un trabajo que realizas.');
        setStep(3);
        setIsSubmitting(false);
        return;
      }

      if (selectedAreas.length === 0) {
        setGeneralError('Por favor selecciona al menos una zona de trabajo.');
        setStep(4);
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

  return (
    <div className="min-h-screen bg-[#FAFAFA] py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto space-y-6 sm:space-y-8">
        
        {/* Progress Bar & Cancel Link (Steps 1 to 5) */}
        {step < 6 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                id="btn-cancel-registration"
                onClick={async () => {
                  await cancelWorkerRegistration();
                }}
                className="text-sm text-slate-500 hover:text-slate-900 font-medium transition-colors cursor-pointer flex items-center gap-1.5 py-1"
              >
                <span className="text-[14px] text-[#353643]">← Cancelar registro y volver al inicio</span>
              </button>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
                <span>Paso {step} de 5</span>
              </div>
              <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                <div 
                  className="bg-orange-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${(step / 5) * 100}%` }}
                />
              </div>
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
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Crea tu cuenta en Maestro Cerca
              </h1>
              <p className="text-slate-600 text-sm leading-relaxed">
                Crea tu cuenta de acceso a Maestro Cerca. Elige cómo quieres registrarte:
              </p>
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

              <div className="pt-2 border-t border-slate-200/80 space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    id="register-privacy-checkbox"
                    checked={privacyAccepted}
                    onChange={(e) => setPrivacyAccepted(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-orange-600 border-slate-300 focus:ring-orange-500 cursor-pointer shrink-0"
                  />
                  <span className="text-xs font-bold text-slate-800">
                    He leído y acepto el Aviso de Privacidad. <span className="text-red-500">*</span>
                  </span>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    id="register-terms-checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-orange-600 border-slate-300 focus:ring-orange-500 cursor-pointer shrink-0"
                  />
                  <span className="text-xs font-bold text-slate-800">
                    Acepto los Términos y Condiciones. <span className="text-red-500">*</span>
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
                  className="w-full py-3.5 px-6 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-sm sm:text-base rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
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
                <div className="p-3.5 bg-orange-50 border border-orange-200 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-orange-800 tracking-wider block">SMS enviado a</span>
                    <p className="text-sm font-black text-slate-900">+52 {formatPhoneForDisplay(clean10Digits)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPhoneSubStep('phone');
                      setGeneralError('');
                    }}
                    className="text-xs font-bold text-orange-700 hover:text-orange-900 underline cursor-pointer"
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
                  className="w-full py-3.5 px-6 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-sm sm:text-base rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
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
        {/* STEP 2: DATOS PERSONALES Y DE CONTACTO */}
        {/* ========================================================================= */}
        {step === 2 && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
            <div className="space-y-1.5">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Datos personales y de contacto
              </h1>
              <p className="text-slate-600 text-sm">
                Así aparecerás ante los clientes de Querétaro que busquen tus servicios.
              </p>
            </div>

            {/* Unverified Phone Warning Banner for Facebook Authenticated Users */}
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
                if (!isSameWhatsapp && customWhatsapp.replace(/\D/g, '').length !== 10) {
                  setGeneralError('Por favor ingresa un número de WhatsApp de 10 dígitos válido.');
                  return;
                }
                setGeneralError('');
                setStep(3);
              }}
              className="space-y-5"
            >
              {/* Name and Last Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Nombre <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Roberto"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold focus:bg-white focus:outline-hidden focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Primer apellido <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Sánchez"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold focus:bg-white focus:outline-hidden focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Phone Input: Verified vs Editable + In-line SMS Linking */}
              {isPhoneAuthVerified && clean10Digits ? (
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Teléfono celular verificado
                  </label>
                  <div className="flex items-center justify-between p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span className="text-sm font-black text-emerald-900">
                        +52 {formatPhoneForDisplay(clean10Digits)}
                      </span>
                    </div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center gap-1">
                      <span>✓ Verificado por SMS</span>
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold uppercase text-slate-700">
                        Teléfono celular de contacto (10 dígitos) <span className="text-red-500">*</span>
                      </label>
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 text-amber-600" />
                        <span>Teléfono pendiente de verificar</span>
                      </span>
                    </div>
                    <div className="flex items-center rounded-xl border border-slate-300 bg-slate-50 focus-within:bg-white focus-within:border-orange-600 overflow-hidden">
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

                  {/* Inline SMS verification box */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
                    {linkSubStep === 'idle' ? (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="text-xs text-slate-600">
                          <p className="font-bold text-slate-800">Verifica este número ahora</p>
                          <p className="text-[11px]">Recibirás un código de 6 dígitos por mensaje SMS.</p>
                        </div>
                        <button
                          type="button"
                          disabled={clean10Digits.length !== 10 || isLinkingLoading}
                          onClick={handleSendLinkSms}
                          className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed shrink-0"
                        >
                          {isLinkingLoading ? (
                            <>
                              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              <span>Enviando SMS...</span>
                            </>
                          ) : (
                            <>
                              <Phone className="w-3.5 h-3.5" />
                              <span>VERIFICAR POR SMS</span>
                            </>
                          )}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-slate-800">
                            Ingresa el código enviado a +52 {formatPhoneForDisplay(clean10Digits)}:
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
                            className="w-36 p-2.5 text-center text-lg font-black tracking-widest bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:border-orange-500"
                          />
                          <button
                            type="button"
                            disabled={linkSmsCode.length !== 6 || isLinkingLoading}
                            onClick={handleConfirmLinkSms}
                            className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1 cursor-pointer disabled:cursor-not-allowed"
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
                            className="text-[11px] text-orange-600 font-bold hover:underline cursor-pointer"
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

              {/* WhatsApp Question */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-xs sm:text-sm">
                  <MessageCircle className="w-4 h-4 text-emerald-600" />
                  <span>¿Este número celular también es tu WhatsApp?</span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsSameWhatsapp(true)}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 cursor-pointer ${
                      isSameWhatsapp 
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs' 
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Sí, es el mismo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsSameWhatsapp(false)}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 cursor-pointer ${
                      !isSameWhatsapp 
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs' 
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <span>No, es otro número</span>
                  </button>
                </div>

                {!isSameWhatsapp && (
                  <div className="pt-2 animate-fadeIn">
                    <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                      Número de WhatsApp (10 dígitos)
                    </label>
                    <div className="flex items-center rounded-xl border border-slate-300 bg-white overflow-hidden">
                      <div className="px-3 py-2.5 bg-slate-100 border-r border-slate-300 text-xs font-bold text-slate-600">
                        +52
                      </div>
                      <input
                        type="tel"
                        inputMode="numeric"
                        placeholder="442 987 6543"
                        value={customWhatsapp}
                        onChange={(e) => setCustomWhatsapp(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        className="w-full p-2.5 text-sm font-semibold focus:outline-hidden"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Optional Email - only for Facebook authentication, removed for Phone Auth */}
              {registrationMethod === 'facebook' && (
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Correo electrónico <span className="text-slate-400 font-normal lowercase">(opcional)</span>
                  </label>
                  <input
                    type="email"
                    placeholder="ejemplo@correo.com"
                    value={optionalEmail}
                    onChange={(e) => setOptionalEmail(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium focus:bg-white focus:outline-hidden focus:border-orange-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Opcional. No es necesario para recibir llamadas de clientes.
                  </p>
                </div>
              )}

              <div className="pt-4 flex justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="py-3 px-4 border border-slate-300 text-slate-700 font-bold text-sm rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  Atrás
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 px-6 bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Continuar</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 3: INFORMACIÓN PROFESIONAL */}
        {/* ========================================================================= */}
        {step === 3 && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
            <div className="space-y-1.5">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Oficio principal y trabajos que realizas
              </h1>
              <p className="text-slate-600 text-sm">
                Los trabajos específicos que marcas son la variable principal que miran los clientes antes de contactarte.
              </p>
            </div>

            <div className="space-y-5">
              {/* Main Trade */}
              <div>
                <label className="block text-[14px] font-bold uppercase text-slate-700 pb-0 mb-[15px]">
                  Oficio principal
                </label>
                <select
                  value={mainTrade}
                  onChange={(e) => {
                    setMainTrade(e.target.value);
                  }}
                  className="w-full p-3.5 bg-slate-50 border border-slate-300 rounded-xl text-[21px] font-bold focus:bg-white focus:outline-hidden focus:border-orange-500 cursor-pointer"
                >
                  {trades.map((t) => (
                    <option key={t.id} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>

              {/* Years Experience */}
              <div>
                <div className="flex justify-between items-center mb-1 text-[17px]">
                  <label className="block text-[14px] font-bold uppercase text-slate-700 mb-[15px]">
                    Años de experiencia en el oficio
                  </label>
                  <span className="text-[17px] font-black text-orange-600 mb-[15px]">
                    {yearsExperience} {yearsExperience === 1 ? 'año' : 'años'}
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="40"
                  value={yearsExperience}
                  onChange={(e) => setYearsExperience(Number(e.target.value))}
                  className="w-full accent-orange-600 cursor-pointer ml-[1px]"
                />
              </div>

              {/* Secondary Trades (Chips) */}
              <div>
                <label className="block text-[14px] font-bold uppercase text-slate-700 bg-white mb-[15px]">
                  Otros oficios que también dominas (Opcional)
                </label>
                <div className="flex flex-wrap gap-1.5 text-[17px] font-normal not-italic text-left pt-[15px] pb-[15px]">
                  {trades
                    .filter((t) => t.name !== mainTrade)
                    .map((t) => {
                      const isSelected = secondaryTrades.includes(t.name);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => toggleSecondaryTrade(t.name)}
                          className={`px-3 py-1.5 rounded-lg text-[14px] font-semibold border transition-all cursor-pointer ${
                            isSelected 
                              ? 'bg-slate-900 text-white border-slate-900' 
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {isSelected && '✓ '}
                          {t.name}
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* Suggested Services / Specific Works */}
              <div
                ref={servicesSectionRef}
                tabIndex={-1}
                className={`space-y-2 p-3.5 sm:p-4 rounded-2xl transition-all outline-hidden ${
                  servicesError
                    ? 'border-2 border-red-500 bg-red-50/50 ring-2 ring-red-200'
                    : 'border border-slate-200/80 bg-slate-50/40'
                }`}
              >
                <div className="flex justify-between items-center">
                  <label className="block text-[14px] font-bold uppercase text-slate-700">
                    Trabajos que realizas
                  </label>
                  {services.length > 0 && (
                    <span className="text-xs font-bold text-orange-600">
                      {services.length} {services.length === 1 ? 'trabajo seleccionado' : 'trabajos seleccionados'}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">
                  Selecciona los trabajos específicos que sabes hacer para que los clientes te encuentren fácilmente:
                </p>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {(tradeServiceSuggestions[mainTrade] || []).map((sugg) => {
                    const isSelected = services.includes(sugg);
                    return (
                      <button
                        key={sugg}
                        type="button"
                        onClick={() => toggleService(sugg)}
                        className={`px-3 py-1.5 rounded-xl text-[14px] font-bold border transition-all cursor-pointer ${
                          isSelected 
                            ? 'bg-orange-600 text-white border-orange-600 shadow-xs' 
                            : 'bg-white text-slate-700 border-slate-200 hover:border-orange-300'
                        }`}
                      >
                        {isSelected ? '✓ ' : '+ '}
                        {sugg}
                      </button>
                    );
                  })}
                  {/* Custom services added by user that are not in suggestions */}
                  {services
                    .filter((srv) => !(tradeServiceSuggestions[mainTrade] || []).includes(srv))
                    .map((customSrv) => (
                      <button
                        key={customSrv}
                        type="button"
                        onClick={() => toggleService(customSrv)}
                        className="px-3 py-1.5 rounded-xl text-[14px] font-bold border transition-all cursor-pointer bg-orange-600 text-white border-orange-600 shadow-xs flex items-center gap-1.5"
                        title="Toca para quitar este trabajo"
                      >
                        <span>✓ {customSrv}</span>
                        <span className="text-orange-200 hover:text-white font-black text-xs">✕</span>
                      </button>
                    ))}
                </div>

                {/* Custom service input */}
                <div className="flex gap-2 pt-2">
                  <input
                    type="text"
                    placeholder="Otro trabajo específico (ej. Colocación de cantera)"
                    value={customServiceInput}
                    onChange={(e) => setCustomServiceInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
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
                      }
                    }}
                    className="flex-1 p-2.5 bg-white border border-slate-300 rounded-xl text-[17px] font-medium focus:bg-white focus:outline-hidden focus:border-orange-500"
                  />
                  <button
                    type="button"
                    onClick={(e) => handleAddCustomService(e as any)}
                    className="px-3 py-2 bg-slate-900 text-white text-[14px] font-bold rounded-xl hover:bg-black cursor-pointer shrink-0"
                  >
                    Agregar
                  </button>
                </div>

                {/* Error Message */}
                {servicesError && (
                  <div className="flex items-center gap-1.5 text-xs font-bold text-red-600 pt-1">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>{servicesError}</span>
                  </div>
                )}
              </div>

              {/* Brief presentation */}
              <div>
                <label className="block text-[14px] font-bold uppercase text-slate-700 mb-[15px]">
                  Breve presentación de tu trabajo (Opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Ej. Cuento con herramienta propia y puntualidad en todos mis trabajos en Querétaro."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium focus:bg-white focus:outline-hidden focus:border-orange-500"
                />
              </div>

              <div className="pt-4 flex justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="py-3 px-4 border border-slate-300 text-slate-700 font-bold text-sm rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  Atrás
                </button>
                <button
                  type="button"
                  onClick={validateStep3AndContinue}
                  className="flex-1 py-3 px-6 bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span className="text-[16px]">Continuar</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 4: ZONAS DE TRABAJO (INICIALIZADO VACÍO []) */}
        {/* ========================================================================= */}
        {step === 4 && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
            <div className="space-y-1.5">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Zonas de trabajo en Querétaro
              </h1>
              <p className="text-slate-600 text-sm">
                Indica en qué zonas o municipios realizas servicios para que los clientes locales te encuentren.
              </p>
            </div>

            <div className="space-y-5">
              <div>
                <div className="flex justify-between items-center mb-[15px] text-[16px]">
                  <label className="block text-[14px] font-bold uppercase text-slate-700">
                    Zonas y municipios de cobertura
                  </label>
                  <span className="text-[14px] font-bold text-orange-600">
                    {selectedAreas.length} {selectedAreas.length === 1 ? 'zona seleccionada' : 'zonas seleccionadas'}
                  </span>
                </div>

                <p className="text-[11px] text-slate-500 mb-[12px]">
                  Toca las zonas donde tienes disponibilidad de traslado para atender trabajos:
                </p>

                <div className="flex flex-wrap gap-2">
                  {serviceAreas.map((a) => {
                    const isSelected = selectedAreas.includes(a.name);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => toggleServiceArea(a.name)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                          isSelected 
                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs ring-2 ring-slate-900/10' 
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <MapPin className="w-3.5 h-3.5 text-orange-500" />
                        <span>{a.name}</span>
                        {isSelected && <span className="ml-1 text-[10px] text-emerald-400">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 flex justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="py-3 px-4 border border-slate-300 text-slate-700 font-bold text-sm rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  Atrás
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedAreas.length === 0) {
                      setGeneralError('Por favor selecciona al menos una zona de trabajo antes de continuar.');
                      return;
                    }
                    setGeneralError('');
                    setStep(5);
                  }}
                  className="flex-1 py-3 px-6 bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Continuar</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 5: FOTOGRAFÍAS, REVISIÓN PREVIA Y PUBLICAR PERFIL */}
        {/* ========================================================================= */}
        {step === 5 && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
            <div className="space-y-1.5">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Fotografías y revisión de tu perfil
              </h1>
              <p className="text-slate-600 text-sm">
                Revisa los datos de tu perfil y añade fotografías de tus trabajos antes de publicarlo en Maestro Cerca.
              </p>
            </div>

            <div className="space-y-5">
              {/* Profile Photo selector (Optional) */}
              <div className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                <div className="relative w-16 h-16 rounded-2xl overflow-hidden shrink-0">
                  <WorkerAvatar
                    alt="Foto de perfil"
                    allowPendingPreview={true}
                    previewUrl={profilePreviewUrl || profilePhotoUrl}
                    size="custom"
                    className="w-16 h-16 rounded-2xl"
                  />
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
                    <Camera className="w-5 h-5 text-white drop-shadow-md" />
                  </div>
                </div>

                <div className="flex-1 space-y-1">
                  <span className="text-xs font-bold text-slate-900 block">Fotografía de perfil (Opcional)</span>
                  <label className="inline-block px-3 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold rounded-lg cursor-pointer transition-colors shadow-xs">
                    <span>{profilePreviewUrl || profilePhotoUrl ? 'Cambiar foto' : 'Subir fotografía'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleProfilePhotoChange}
                      className="hidden"
                    />
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Si no subes foto, se mostrará un avatar neutral de trabajador. Nunca usamos fotos de stock falsas.
                  </p>
                </div>
              </div>

              {/* Work Gallery Upload (Optional) */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div>
                  <h3 className="text-xs font-bold uppercase text-slate-900">Fotos de tus trabajos (Opcional)</h3>
                  <p className="text-[11px] text-slate-500">
                    Muestra proyectos y acabados que hayas realizado para generar más llamadas y confianza.
                  </p>
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed italic bg-white p-2.5 rounded-xl border border-slate-200">
                  Al subir fotografías confirmas que cuentas con autorización para compartirlas y que procurarás no incluir documentos, teléfonos, domicilios u otros datos personales de terceros.
                </p>

                <label className="p-4 border-2 border-dashed border-slate-300 hover:border-orange-500 rounded-2xl flex flex-col items-center justify-center gap-1.5 cursor-pointer bg-white transition-colors">
                  <Upload className="w-6 h-6 text-slate-400" />
                  <span className="text-xs font-bold text-orange-600">Subir fotos de trabajos</span>
                  <span className="text-[10px] text-slate-400">JPG, PNG hasta 5MB por foto</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleWorkFilesUpload}
                    className="hidden"
                  />
                </label>

                {pendingWorkFiles.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-2">
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
              </div>

              {/* Resumen previo de perfil */}
              <div className="p-4 bg-orange-50/60 border border-orange-200 rounded-2xl space-y-2 text-xs">
                <span className="font-extrabold uppercase text-orange-900 tracking-wider block">
                  Resumen de tu nuevo perfil:
                </span>
                <div className="grid grid-cols-2 gap-2 text-slate-700 pt-1">
                  <div><strong>Nombre:</strong> {firstName} {lastName}</div>
                  <div><strong>Oficio:</strong> {mainTrade}</div>
                  <div><strong>Experiencia:</strong> {yearsExperience} años</div>
                  <div><strong>Celular:</strong> +52 {formatPhoneForDisplay(clean10Digits)}</div>
                  <div className="col-span-2">
                    <strong>Zonas ({selectedAreas.length}):</strong> {selectedAreas.join(', ')}
                  </div>
                </div>
              </div>

              {/* Submission CTA */}
              <div className="pt-4 flex justify-between gap-3">
                <button
                  type="button"
                  disabled={isSubmitting || isUploading}
                  onClick={() => setStep(4)}
                  className="py-3.5 px-4 border border-slate-300 text-slate-700 font-bold text-sm rounded-xl hover:bg-slate-50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Atrás
                </button>
                <button
                  type="button"
                  id="submit-worker-profile-btn"
                  disabled={isSubmitting || isUploading}
                  onClick={handleFinishRegistration}
                  className="flex-1 py-4 px-6 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white font-extrabold text-base rounded-2xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isSubmitting || isUploading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>{uploadStatusText || 'Guardando perfil...'}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      <span>Guardar mi perfil</span>
                    </>
                  )}
                </button>
              </div>
            </div>
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
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
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
                className="py-3.5 px-6 bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
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
