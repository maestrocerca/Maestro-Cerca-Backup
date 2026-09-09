import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  ShieldCheck, 
  Briefcase, 
  MapPin, 
  Camera, 
  ArrowRight, 
  ArrowLeft, 
  Upload, 
  Plus, 
  X, 
  Star, 
  AlertCircle,
  Clock,
  Sparkles,
  Phone,
  RotateCcw,
  MessageCircle,
  Image as ImageIcon,
  User,
  Check,
  ExternalLink
} from 'lucide-react';
import { ConfirmationResult } from 'firebase/auth';
import { 
  useStore, 
  formatMexicanPhoneToE164, 
  formatPhoneForDisplay 
} from '../context/StoreContext';
import { Worker, WorkPhoto } from '../types';
import { uploadWorkerProfileImage, uploadWorkerWorkPhoto, validateImageFile } from '../lib/storage';

export const WorkerRegisterView: React.FC = () => {
  const { 
    trades, 
    serviceAreas, 
    firebaseUser,
    sendPhoneVerificationCode,
    confirmPhoneVerificationCode,
    createWorkerProfile, 
    updateWorkerProfile, 
    navigateTo, 
    trackGenericEvent 
  } = useStore();

  // Multi-step:
  // Step 1: Phone number & Send SMS
  // Step 2: SMS Verification Code
  // Step 3: Personal details & WhatsApp preference
  // Step 4: Trade, Experience & Services
  // Step 5: Service Areas & Work Photos
  // Step 6: Confirmation / Success
  const [step, setStep] = useState<number>(1);

  // Phone Auth State
  const [rawPhone, setRawPhone] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isSameWhatsapp, setIsSameWhatsapp] = useState(true);
  const [customWhatsapp, setCustomWhatsapp] = useState('');
  const [optionalEmail, setOptionalEmail] = useState('');
  
  const [mainTrade, setMainTrade] = useState('Albañil');
  const [secondaryTrades, setSecondaryTrades] = useState<string[]>([]);
  const [yearsExperience, setYearsExperience] = useState<number>(5);
  const [description, setDescription] = useState('');
  const [services, setServices] = useState<string[]>([]);
  const [customServiceInput, setCustomServiceInput] = useState('');
  
  const [selectedAreas, setSelectedAreas] = useState<string[]>(['Querétaro Centro', 'Juriquilla']);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('https://images.unsplash.com/photo-1540569014015-19a7be504e3a?auto=format&fit=crop&w=400&q=80');

  // File Upload State
  const [pendingProfileFile, setPendingProfileFile] = useState<File | null>(null);
  const [profilePreviewUrl, setProfilePreviewUrl] = useState<string>('');
  const [pendingWorkFiles, setPendingWorkFiles] = useState<{ file: File; previewUrl: string; title: string }[]>([]);

  // Submission State
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [createdWorker, setCreatedWorker] = useState<Worker | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState('');
  const [generalError, setGeneralError] = useState('');

  // Auto-fill phone if already authenticated
  useEffect(() => {
    if (firebaseUser?.phoneNumber && step === 1) {
      const clean = firebaseUser.phoneNumber.replace(/^\+52/, '').replace(/\D/g, '');
      setRawPhone(clean);
      setStep(3); // Already authenticated with phone -> jump to profile info
    }
  }, [firebaseUser, step]);

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

  // STEP 1: Send SMS
  const handleSendSms = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setGeneralError('');

    if (clean10Digits.length !== 10) {
      setGeneralError('Por favor ingresa los 10 dígitos de tu número celular.');
      return;
    }

    if (!privacyAccepted) {
      setGeneralError('Debes leer y aceptar el Aviso de Privacidad para continuar con tu registro.');
      return;
    }

    const formattedE164 = formatMexicanPhoneToE164(clean10Digits);
    setIsSubmitting(true);

    try {
      const res = await sendPhoneVerificationCode(formattedE164, 'recaptcha-register-container');
      if (res.success && res.confirmationResult) {
        setConfirmationResult(res.confirmationResult);
        setStep(2);
        setCooldown(60);
        setSmsCode('');
      } else {
        setGeneralError(res.error || 'No pudimos enviar el código SMS. Intenta nuevamente.');
      }
    } catch (err: any) {
      setGeneralError(err?.message || 'Error de conexión al enviar el código SMS.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // STEP 2: Confirm SMS Code
  const handleConfirmCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError('');

    if (!confirmationResult) {
      setGeneralError('Solicita un nuevo código por SMS.');
      setStep(1);
      return;
    }

    const cleanCode = smsCode.trim().replace(/\D/g, '');
    if (cleanCode.length < 6) {
      setGeneralError('Ingresa el código de 6 dígitos que recibiste por SMS.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await confirmPhoneVerificationCode(confirmationResult, cleanCode);
      if (res.success) {
        if (res.hasExistingProfile && res.worker) {
          // If already registered in Firestore, go to dashboard
          navigateTo({ type: 'dashboard' });
        } else {
          // Advance to personal details profile step
          setStep(3);
        }
      } else {
        setGeneralError(res.error || 'Código incorrecto. Revisa el SMS e intenta de nuevo.');
      }
    } catch (err: any) {
      setGeneralError(err?.message || 'Error al validar el código SMS.');
    } finally {
      setIsSubmitting(false);
    }
  };

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
    setServices((prev) =>
      prev.includes(trimmed) ? prev.filter((s) => s !== trimmed) : [...prev, trimmed]
    );
  };

  const handleAddCustomService = (e: React.FormEvent) => {
    e.preventDefault();
    if (customServiceInput.trim() && !services.includes(customServiceInput.trim())) {
      setServices((prev) => [...prev, customServiceInput.trim()]);
      setCustomServiceInput('');
    }
  };

  const toggleServiceArea = (areaName: string) => {
    setSelectedAreas((prev) =>
      prev.includes(areaName) ? prev.filter((a) => a !== areaName) : [...prev, areaName]
    );
  };

  // STEP 5: Final Submission to Firestore & Storage
  const handleFinishRegistration = async () => {
    setIsSubmitting(true);
    setGeneralError('');
    setUploadStatusText('Guardando perfil del trabajador...');

    const resolvedWhatsapp = isSameWhatsapp 
      ? clean10Digits 
      : customWhatsapp.replace(/\D/g, '') || clean10Digits;

    try {
      const res = await createWorkerProfile({
        firstName: firstName.trim() || 'Maestro',
        lastName: lastName.trim() || '',
        phone: clean10Digits,
        whatsapp: resolvedWhatsapp,
        email: optionalEmail.trim() || undefined,
        mainTrade: mainTrade || 'Mantenimiento general',
        secondaryTrades,
        yearsExperience: Number(yearsExperience) || 5,
        description: description.trim() || `Especialista en ${mainTrade} con ${yearsExperience} años de experiencia en Querétaro.`,
        services: services.length > 0 ? services : [`Servicios profesionales de ${mainTrade}`],
        serviceAreas: selectedAreas.length > 0 ? selectedAreas : ['Querétaro Centro'],
        profilePhoto: profilePhotoUrl,
        workPhotos: [],
        privacyNoticeAccepted: true,
        privacyNoticeAcceptedAt: new Date().toISOString(),
        privacyNoticeVersion: '1.0',
      });

      if (res.success && res.worker) {
        const targetUserId = res.worker.userId;
        let finalProfilePhotoUrl = res.worker.profilePhoto;
        const uploadedWorkPhotos: WorkPhoto[] = [];

        // 1. Upload profile photo to Firebase Storage if selected
        if (pendingProfileFile) {
          setUploadStatusText('Subiendo fotografía de perfil a Firebase Storage...');
          try {
            finalProfilePhotoUrl = await uploadWorkerProfileImage(targetUserId, pendingProfileFile);
          } catch (storageErr: any) {
            console.warn('Profile photo upload note:', storageErr);
          }
        }

        // 2. Upload work photos to Firebase Storage if selected
        if (pendingWorkFiles.length > 0) {
          setUploadStatusText(`Subiendo ${pendingWorkFiles.length} fotografías a Firebase Storage...`);
          for (let i = 0; i < pendingWorkFiles.length; i++) {
            const item = pendingWorkFiles[i];
            try {
              const uploaded = await uploadWorkerWorkPhoto(targetUserId, item.file, item.title);
              uploadedWorkPhotos.push({
                id: `p-${Date.now()}-${i}`,
                url: uploaded.url,
                title: uploaded.title,
              });
            } catch (storageErr: any) {
              console.warn('Work photo upload note:', storageErr);
            }
          }
        }

        // 3. Update worker with uploaded URLs
        if (pendingProfileFile || uploadedWorkPhotos.length > 0) {
          setUploadStatusText('Actualizando perfil con fotografías...');
          await updateWorkerProfile(res.worker.id, {
            profilePhoto: finalProfilePhotoUrl,
            workPhotos: uploadedWorkPhotos,
          });
        }

        setCreatedWorker({
          ...res.worker,
          profilePhoto: finalProfilePhotoUrl,
          workPhotos: uploadedWorkPhotos,
        });

        setStep(6); // Success screen
      } else {
        setGeneralError(res.error || 'No fue posible crear el perfil. Verifica tu conexión.');
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      setGeneralError(err?.message || 'Error de conexión al procesar el registro.');
    } finally {
      setIsSubmitting(false);
      setUploadStatusText('');
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto space-y-8">
        
        {/* Progress Bar (Steps 1 to 5) */}
        {step < 6 && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
              <span>Paso {step} de 5</span>
              <span className="text-orange-600 font-extrabold">
                {step === 1 && 'Celular'}
                {step === 2 && 'Código SMS'}
                {step === 3 && 'Datos personales'}
                {step === 4 && 'Oficio y servicios'}
                {step === 5 && 'Zonas y fotos'}
              </span>
            </div>
            <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
              <div 
                className="bg-orange-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${(step / 5) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Global Error Banner */}
        {generalError && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm rounded-2xl flex items-start gap-2 shadow-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
            <div className="space-y-1">
              <p className="font-bold">{generalError}</p>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 1: CELULAR */}
        {/* ========================================================================= */}
        {step === 1 && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
            <div className="space-y-1.5">
              <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center mb-2">
                <Phone className="w-6 h-6" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Registra tu oficio en Maestro Cerca
              </h1>
              <p className="text-slate-600 text-sm leading-relaxed">
                Empieza con tu número celular. Te enviaremos un código SMS de seguridad para verificar tu cuenta al instante (sin necesidad de crear contraseñas).
              </p>
            </div>

            <form onSubmit={handleSendSms} className="space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1.5">
                  Número de teléfono celular
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
                    autoFocus
                    placeholder="442 123 4567"
                    value={rawPhone}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setRawPhone(val);
                    }}
                    className="w-full p-3.5 bg-transparent text-slate-900 text-base font-bold tracking-wider placeholder:text-slate-400 placeholder:font-normal focus:outline-hidden"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  Enviaremos un SMS con un código de seguridad para verificar tu cuenta de Maestro Cerca.
                </p>
              </div>

              {/* Aviso breve de privacidad y aceptación obligatoria */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5 text-left">
                <p className="text-xs text-slate-700 leading-relaxed">
                  Utilizaremos tu número y la información que proporciones para crear y administrar tu cuenta y perfil en Maestro Cerca.
                </p>

                <p className="text-xs text-slate-600">
                  Consulta nuestro{' '}
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
                </p>

                <label className="flex items-start gap-2.5 pt-1.5 border-t border-slate-200/80 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    id="register-privacy-acceptance-checkbox"
                    checked={privacyAccepted}
                    onChange={(e) => setPrivacyAccepted(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-orange-600 border-slate-300 focus:ring-orange-500 cursor-pointer shrink-0"
                  />
                  <span className="text-xs font-bold text-slate-800">
                    He leído y acepto el Aviso de Privacidad.
                  </span>
                </label>
              </div>

              {/* Invisible reCAPTCHA container for registration */}
              <div id="recaptcha-register-container"></div>

              <button
                type="submit"
                id="register-send-sms-btn"
                disabled={isSubmitting || clean10Digits.length !== 10 || !privacyAccepted}
                className="w-full py-4 px-6 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-base rounded-2xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Enviando código SMS...</span>
                  </>
                ) : (
                  <>
                    <span>Enviar código por SMS</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>

            <div className="pt-2 border-t border-slate-100 text-center text-xs text-slate-500">
              ¿Ya tienes cuenta registrada?{' '}
              <button
                type="button"
                onClick={() => navigateTo({ type: 'login' })}
                className="text-orange-600 font-bold hover:underline cursor-pointer"
              >
                Inicia sesión con tu celular
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 2: CÓDIGO SMS */}
        {/* ========================================================================= */}
        {step === 2 && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
            <div className="space-y-1.5">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Ingresa el código que enviamos a tu celular
              </h1>
              <p className="text-slate-600 text-sm">
                Escribe los 6 dígitos que recibiste por mensaje de texto (SMS).
              </p>
            </div>

            <form onSubmit={handleConfirmCode} className="space-y-5">
              <div className="p-3.5 bg-orange-50 border border-orange-200 rounded-2xl flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold uppercase text-orange-800 tracking-wider">SMS enviado al número</span>
                  <p className="text-sm font-black text-slate-900">
                    +52 {formatPhoneForDisplay(clean10Digits)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setGeneralError('');
                  }}
                  className="text-xs font-bold text-orange-700 hover:text-orange-900 underline cursor-pointer"
                >
                  Cambiar número
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1.5">
                  Código de seguridad (6 dígitos)
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
                  className="w-full p-4 bg-slate-50 border-2 border-slate-300 focus:bg-white focus:border-orange-600 focus:ring-2 focus:ring-orange-500/20 text-center text-3xl font-black tracking-[0.3em] rounded-2xl transition-all focus:outline-hidden"
                />
              </div>

              <button
                type="submit"
                id="register-confirm-code-btn"
                disabled={isSubmitting || smsCode.replace(/\D/g, '').length < 6}
                className="w-full py-4 px-6 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-base rounded-2xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
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
                    onClick={handleSendSms}
                    disabled={isSubmitting}
                    className="text-xs text-orange-600 hover:text-orange-700 font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reenviar código por SMS</span>
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 3: DATOS PERSONALES & WHATSAPP */}
        {/* ========================================================================= */}
        {step === 3 && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
            <div className="space-y-1.5">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Datos personales y de contacto
              </h1>
              <p className="text-slate-600 text-sm">
                Así aparecerás ante los clientes de Querétaro que busquen tus servicios.
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!firstName.trim()) {
                  setGeneralError('Por favor escribe tu nombre.');
                  return;
                }
                setGeneralError('');
                setStep(4);
              }}
              className="space-y-5"
            >
              {/* Profile Photo selector */}
              <div className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-slate-200 border border-slate-300 shrink-0">
                  <img
                    src={profilePreviewUrl || profilePhotoUrl}
                    alt="Foto de perfil"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                    <Camera className="w-5 h-5 text-white drop-shadow-md" />
                  </div>
                </div>
                <div className="flex-1 space-y-1">
                  <span className="text-xs font-bold text-slate-900 block">Fotografía de perfil (Opcional)</span>
                  <label className="inline-block px-3 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold rounded-lg cursor-pointer transition-colors shadow-xs">
                    <span>Elegir foto</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleProfilePhotoChange}
                      className="hidden"
                    />
                  </label>
                  <p className="text-[11px] text-slate-500">Muestra tu rostro con amabilidad para generar mayor confianza.</p>
                </div>
              </div>

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
                    Apellidos <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Hernández Trejo"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold focus:bg-white focus:outline-hidden focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Verified Phone Display */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Teléfono celular autenticado
                </label>
                <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm font-black text-emerald-900">
                      +52 {formatPhoneForDisplay(clean10Digits)}
                    </span>
                  </div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                    Verificado por SMS
                  </span>
                </div>
              </div>

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

              {/* Optional Email */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Correo electrónico <span className="text-slate-400 font-normal lowercase">(opcional)</span>
                </label>
                <input
                  type="email"
                  placeholder="ejemplo@correo.com (opcional)"
                  value={optionalEmail}
                  onChange={(e) => setOptionalEmail(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium focus:bg-white focus:outline-hidden focus:border-orange-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Opcional. No es necesario para acceder a tu cuenta ni para recibir llamadas.
                </p>
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
        {/* STEP 4: OFICIO Y SERVICIOS */}
        {/* ========================================================================= */}
        {step === 4 && (
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
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Oficio principal <span className="text-red-500">*</span>
                </label>
                <select
                  value={mainTrade}
                  onChange={(e) => {
                    const selected = e.target.value;
                    setMainTrade(selected);
                    // Pre-fill suggestions from trade
                    const defaults = tradeServiceSuggestions[selected] || [];
                    if (defaults.length > 0) {
                      setServices(defaults.slice(0, 3));
                    }
                  }}
                  className="w-full p-3.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold focus:bg-white focus:outline-hidden focus:border-orange-500"
                >
                  {trades.map((t) => (
                    <option key={t.id} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>

              {/* Years Experience */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold uppercase text-slate-700">
                    Años de experiencia en el oficio
                  </label>
                  <span className="text-sm font-black text-orange-600">
                    {yearsExperience} {yearsExperience === 1 ? 'año' : 'años'}
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="40"
                  value={yearsExperience}
                  onChange={(e) => setYearsExperience(Number(e.target.value))}
                  className="w-full accent-orange-600 cursor-pointer"
                />
              </div>

              {/* Secondary Trades (Chips) */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1.5">
                  Otros oficios que también dominas (Opcional)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {trades
                    .filter((t) => t.name !== mainTrade)
                    .map((t) => {
                      const isSelected = secondaryTrades.includes(t.name);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => toggleSecondaryTrade(t.name)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
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
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase text-slate-700">
                  Trabajos que realizas <span className="text-orange-600 font-extrabold">(Toca para agregar)</span>
                </label>
                <p className="text-[11px] text-slate-500">
                  Selecciona los trabajos y especialidades que sabes hacer para que los clientes te encuentren fácilmente:
                </p>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {(tradeServiceSuggestions[mainTrade] || []).map((sugg) => {
                    const isSelected = services.includes(sugg);
                    return (
                      <button
                        key={sugg}
                        type="button"
                        onClick={() => toggleService(sugg)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
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
                        if (customServiceInput.trim()) {
                          toggleService(customServiceInput.trim());
                          setCustomServiceInput('');
                        }
                      }
                    }}
                    className="flex-1 p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden focus:border-orange-500"
                  />
                  <button
                    type="button"
                    onClick={(e) => handleAddCustomService(e as any)}
                    className="px-3 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-black cursor-pointer shrink-0"
                  >
                    Agregar
                  </button>
                </div>
              </div>

              {/* Brief presentation */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
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
                  onClick={() => setStep(3)}
                  className="py-3 px-4 border border-slate-300 text-slate-700 font-bold text-sm rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  Atrás
                </button>
                <button
                  type="button"
                  onClick={() => {
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
        {/* STEP 5: ZONAS Y FOTOS */}
        {/* ========================================================================= */}
        {step === 5 && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
            <div className="space-y-1.5">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Zonas de trabajo y fotos
              </h1>
              <p className="text-slate-600 text-sm">
                Indica en qué zonas de Querétaro realizas servicios y añade fotos de tus trabajos terminados.
              </p>
            </div>

            <div className="space-y-5">
              {/* Service Areas */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-bold uppercase text-slate-700">
                    Zonas de cobertura en Querétaro
                  </label>
                  <span className="text-[11px] font-bold text-orange-600">
                    {selectedAreas.length} {selectedAreas.length === 1 ? 'zona seleccionada' : 'zonas seleccionadas'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {serviceAreas.map((a) => {
                    const isSelected = selectedAreas.includes(a.name);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => toggleServiceArea(a.name)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                          isSelected 
                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs' 
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <MapPin className="w-3 h-3" />
                        <span>{a.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Work Gallery Upload (Optional) */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xs font-bold uppercase text-slate-900">Fotos de tus trabajos (Opcional)</h3>
                    <p className="text-[11px] text-slate-500">Muestra proyectos y acabados que hayas realizado para generar más llamadas.</p>
                  </div>
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

              {/* Submission CTA */}
              <div className="pt-4 flex justify-between gap-3">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setStep(4)}
                  className="py-3.5 px-4 border border-slate-300 text-slate-700 font-bold text-sm rounded-xl hover:bg-slate-50 cursor-pointer disabled:cursor-not-allowed"
                >
                  Atrás
                </button>
                <button
                  type="button"
                  id="submit-worker-profile-btn"
                  disabled={isSubmitting}
                  onClick={handleFinishRegistration}
                  className="flex-1 py-4 px-6 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white font-extrabold text-base rounded-2xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>{uploadStatusText || 'Guardando perfil...'}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      <span>Guardar y activar mi perfil</span>
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
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">
                ¡Registro completado!
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                ¡Bienvenido a Maestro Cerca, {createdWorker.firstName}!
              </h1>
              <p className="text-slate-600 text-sm max-w-md mx-auto">
                Tu perfil de <strong>{createdWorker.mainTrade}</strong> ha sido registrado en la base de datos de Querétaro y ya puedes empezar a recibir clientes.
              </p>
            </div>

            {/* Quick Profile Snapshot Card */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-left max-w-md mx-auto space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">Teléfono autenticado:</span>
                <span className="text-xs font-black text-slate-900">+52 {formatPhoneForDisplay(createdWorker.phone)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">Oficio:</span>
                <span className="text-xs font-black text-orange-600">{createdWorker.mainTrade}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">Zonas:</span>
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
                <span>Ir a mi panel de control</span>
              </button>
              <button
                type="button"
                id="view-public-profile-btn"
                onClick={() => navigateTo({ type: 'profile', workerSlug: createdWorker.slug })}
                className="py-3.5 px-6 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold text-sm rounded-xl transition-colors cursor-pointer"
              >
                <span>Ver mi perfil público</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
