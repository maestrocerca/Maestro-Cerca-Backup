import React, { useState, useEffect } from 'react';
import { 
  Phone, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  RotateCcw
} from 'lucide-react';
import { ConfirmationResult } from 'firebase/auth';
import { useStore, formatMexicanPhoneToE164, formatPhoneForDisplay } from '../context/StoreContext';
import { FACEBOOK_AUTH_ENABLED } from '../config/featureFlags';
import loginHeaderImage from '../assets/images/regenerated_image_1789689228307.png';

const FacebookIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5 shrink-0" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

export const WorkerLoginView: React.FC = () => {
  const { 
    sendPhoneVerificationCode, 
    confirmPhoneVerificationCode,
    loginWorkerWithFacebook,
    logoutWorker,
    showToast,
    navigateTo,
    isAdmin
  } = useStore();

  useEffect(() => {
    if (isAdmin) {
      navigateTo({ type: 'admin' });
    }
  }, [isAdmin, navigateTo]);

  if (isAdmin) {
    return null;
  }

  // Step 1: Phone input, Step 2: Code input
  const [step, setStep] = useState<1 | 2>(1);
  
  // Form fields
  const [rawPhone, setRawPhone] = useState('');
  const [smsCode, setSmsCode] = useState('');
  
  // Status states
  const [error, setError] = useState('');
  const [nonExistentAccount, setNonExistentAccount] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFacebookLoading, setIsFacebookLoading] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  
  // Resend countdown timer
  const [cooldown, setCooldown] = useState(0);

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

  // Clean 10 digits only
  const cleanPhoneDigits = rawPhone.replace(/\D/g, '').slice(0, 10);

  const handleFacebookSignIn = async () => {
    setError('');
    setNonExistentAccount(false);
    setIsFacebookLoading(true);
    try {
      const res = await loginWorkerWithFacebook();
      if (res.success) {
        if (isAdmin) {
          navigateTo({ type: 'admin' });
          return;
        }
        if (res.hasExistingProfile) {
          navigateTo({ type: 'dashboard' });
        } else {
          // Safety guard: login must strictly require an existing active profile
          await logoutWorker();
          setNonExistentAccount(true);
          setError('No encontramos una cuenta de trabajador vinculada a este Facebook. Por favor regístrate primero.');
        }
      } else if (res.error) {
        console.log('[Facebook Sign-In Error in View]:', res.error);
        setError(res.error);
        if (res.error.toLowerCase().includes('no encontramos') || res.error.toLowerCase().includes('regístrate')) {
          setNonExistentAccount(true);
        }
      }
    } catch (err: any) {
      console.error('[Facebook Sign-In Exception in View]:', err?.code, err?.message, err);
      setError(err?.message || 'Error al iniciar sesión con Facebook.');
    } finally {
      setIsFacebookLoading(false);
    }
  };

  const handleSendSms = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');
    setNonExistentAccount(false);

    if (cleanPhoneDigits.length !== 10) {
      setError('Por favor ingresa los 10 dígitos de tu número celular.');
      return;
    }

    const formattedE164 = formatMexicanPhoneToE164(cleanPhoneDigits);
    setIsLoading(true);

    try {
      // 1. Backend-First verification: verify if worker profile exists BEFORE sending SMS
      const checkRes = await fetch('/api/auth/phone-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phone: formattedE164,
          intent: 'login',
        }),
      });

      const checkData = await checkRes.json().catch(() => ({}));

      if (!checkRes.ok || !checkData.success) {
        setError(checkData.error || 'No se pudo verificar el número telefónico. Intenta de nuevo.');
        setIsLoading(false);
        return;
      }

      // Check strictly state === "linked" AND hasProfile === true
      // If either is false: DO NOT send SMS, DO NOT trigger reCAPTCHA, DO NOT create ghost Auth users!
      if (checkData.state !== 'linked' || !checkData.hasProfile) {
        setIsLoading(false);
        setNonExistentAccount(true);
        setError('Teléfono no vinculado a un usuario');
        return;
      }

      // 2. Profile confirmed in database -> Send SMS verification code
      const res = await sendPhoneVerificationCode(formattedE164, 'recaptcha-login-container');
      if (res.success && res.confirmationResult) {
        setConfirmationResult(res.confirmationResult);
        setStep(2);
        setCooldown(60); // 60s cooldown for resending
        setSmsCode('');
      } else {
        setError(res.error || 'No pudimos enviar el código SMS. Intenta nuevamente.');
      }
    } catch (err: any) {
      setError(err?.message || 'Error de conexión al verificar el número.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!confirmationResult) {
      setError('Por favor solicita un nuevo código SMS.');
      setStep(1);
      return;
    }

    const cleanCode = smsCode.trim().replace(/\D/g, '');
    if (cleanCode.length < 6) {
      setError('Ingresa el código de 6 dígitos que recibiste por SMS.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await confirmPhoneVerificationCode(confirmationResult, cleanCode);
      if (res.success) {
        if (isAdmin) {
          navigateTo({ type: 'admin' });
          return;
        }
        if (res.hasExistingProfile) {
          // Worker has completed profile in Firestore -> go directly to Dashboard
          navigateTo({ type: 'dashboard' });
        } else {
          // CRITICAL: This is the LOGIN view, NOT registration.
          // If no existing profile is found, do NOT navigate to register.
          // Sign out immediately, return to step 1 and display clear notice.
          await logoutWorker();
          setStep(1);
          setNonExistentAccount(true);
          setError('No encontramos un perfil de trabajador activo asociado a este número. Por favor regístrate como trabajador.');
        }
      } else {
        if (
          res.error === 'auth/credential-already-in-use' ||
          res.error?.includes('credential-already-in-use') ||
          res.error?.toLowerCase().includes('ya está vinculado')
        ) {
          setError('Este número celular ya está vinculado a otra cuenta');
        } else {
          setError(res.error || 'Código incorrecto. Revisa el SMS e intenta de nuevo.');
        }
      }
    } catch (err: any) {
      if (
        err?.code === 'auth/credential-already-in-use' ||
        err?.message?.includes('credential-already-in-use') ||
        String(err?.message || '').toLowerCase().includes('ya está vinculado')
      ) {
        setError('Este número celular ya está vinculado a otra cuenta');
      } else {
        setError(err?.message || 'Error al validar el código SMS.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (cooldown > 0 || isLoading) return;
    await handleSendSms();
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="max-w-md w-full space-y-8">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto shadow-xs overflow-hidden">
            <img
              src={loginHeaderImage}
              alt="Maestro Cerca"
              className="w-full h-full object-cover"
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#0C2340] tracking-tight">
            Acceso para trabajadores
          </h1>
          <p className="text-slate-600 text-sm">
            Entra a tu cuenta con cualquiera de los métodos que tengas vinculados.
          </p>
        </div>

        {/* Main Card */}
        <div key={step} className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6 animate-fadeIn">
          
          {/* Error notice */}
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Non-existent account warning with direct action to register */}
          {nonExistentAccount && (
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-2xl space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                <div className="text-xs text-orange-950 space-y-1">
                  <p className="font-bold text-sm text-orange-900">Teléfono no vinculado a un usuario</p>
                  <p className="text-slate-600 leading-relaxed">
                    No encontramos una cuenta de trabajador asociada a este número celular. Si realizas trabajos de construcción o remodelación, regístrate para comenzar a recibir solicitudes.
                  </p>
                </div>
              </div>
              <button
                type="button"
                id="login-to-register-btn"
                onClick={() => navigateTo({ type: 'register' })}
                className="w-full py-2.5 px-4 bg-[#FF6B00] hover:bg-[#e65f00] active:scale-[0.98] text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Registrarme de forma gratuita</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* STEP 1: Phone number input & Facebook Sign-In */}
          {step === 1 && (
            <div className="space-y-5">
              <form onSubmit={handleSendSms} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1.5">
                    Número de celular
                  </label>
                  <div className="flex items-center rounded-xl border border-slate-300 bg-slate-50 focus-within:bg-white focus-within:border-orange-600 focus-within:ring-2 focus-within:ring-orange-500/20 transition-all overflow-hidden">
                    <div className="px-3 py-3 bg-slate-100 border-r border-slate-300 text-slate-700 font-bold text-sm flex items-center gap-1 select-none">
                      <span>🇲🇽</span>
                      <span>+52</span>
                    </div>
                    <input
                      type="tel"
                      id="worker-phone-input"
                      inputMode="numeric"
                      autoFocus
                      placeholder="442 123 4567"
                      value={rawPhone}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setRawPhone(val);
                        if (nonExistentAccount) setNonExistentAccount(false);
                        if (error) setError('');
                      }}
                      className="w-full p-3 bg-transparent text-slate-900 text-base font-bold tracking-wider placeholder:text-slate-400 placeholder:font-normal focus:outline-hidden"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                    Enviaremos un SMS con un código de seguridad para acceder a tu cuenta.
                  </p>
                </div>

                {/* Invisible reCAPTCHA container */}
                <div id="recaptcha-login-container"></div>

                <button
                  type="submit"
                  id="send-sms-btn"
                  disabled={isLoading || isFacebookLoading || cleanPhoneDigits.length !== 10}
                  className="w-full py-3.5 px-4 bg-[#FF6B00] hover:bg-[#e65f00] active:scale-[0.98] disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Verificando número celular...</span>
                    </>
                  ) : (
                    <>
                      <span>Enviar código por SMS</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* OAuth Providers: disabled for the MVP (FACEBOOK_AUTH_ENABLED flag) */}
              {FACEBOOK_AUTH_ENABLED && (
                <>
                  {/* Dual Auth Divider */}
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200"></div>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white px-3 text-slate-400 font-semibold tracking-wider">o bien</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {/* Facebook Sign-In Button */}
                    <button
                      type="button"
                      id="worker-facebook-login-btn"
                      onClick={handleFacebookSignIn}
                      disabled={isLoading || isFacebookLoading}
                      className="w-full py-3.5 px-4 bg-[#1877F2] hover:bg-[#166FE5] active:bg-[#1465D2] text-white font-bold text-sm rounded-xl shadow-xs transition-all flex items-center justify-center gap-3 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isFacebookLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Conectando con Facebook...</span>
                        </>
                      ) : (
                        <>
                          <FacebookIcon className="w-5 h-5 fill-white shrink-0" />
                          <span>Continuar con Facebook</span>
                        </>
                      )}
                    </button>

                    {/* Texto aclaratorio para evitar cuentas duplicadas */}
                    <p className="text-xs text-slate-500 text-center leading-relaxed pt-1">
                      ¿Ya tienes una cuenta creada con celular? Inicia con tu teléfono. También puedes vincular Facebook desde tu perfil.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* STEP 2: SMS Code input */}
          {step === 2 && (
            <form onSubmit={handleConfirmCode} className="space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-600">
                  Código enviado a <strong className="text-slate-900">+52 {formatPhoneForDisplay(cleanPhoneDigits)}</strong>
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setError('');
                  }}
                  className="text-xs font-bold text-[#FF6B00] hover:text-[#e65f00] underline cursor-pointer shrink-0"
                >
                  Cambiar
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1.5">
                  Ingresa el código de 6 dígitos
                </label>
                <input
                  type="text"
                  id="sms-code-input"
                  inputMode="numeric"
                  autoFocus
                  maxLength={6}
                  placeholder="123456"
                  value={smsCode}
                  onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full p-3.5 bg-slate-50 border-2 border-slate-300 focus:bg-white focus:border-orange-600 focus:ring-2 focus:ring-orange-500/20 text-center text-2xl font-black tracking-[0.3em] rounded-xl transition-all focus:outline-hidden"
                />
                <p className="text-[11px] text-slate-500 mt-2 text-center">
                  Revisa los mensajes SMS de tu celular.
                </p>
              </div>

              <button
                type="submit"
                id="confirm-code-btn"
                disabled={isLoading || smsCode.replace(/\D/g, '').length < 6}
                className="w-full py-3.5 px-4 bg-[#FF6B00] hover:bg-[#e65f00] active:scale-[0.98] disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Verificando código...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirmar código y entrar</span>
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
                    onClick={handleResendCode}
                    disabled={isLoading}
                    className="text-xs text-[#FF6B00] hover:text-[#e65f00] font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reenviar código por SMS</span>
                  </button>
                )}
              </div>
            </form>
          )}

          {/* Footer note */}
          <div className="pt-2 border-t border-slate-100 text-center text-xs text-slate-500">
            ¿Nuevo en Maestro Cerca?{' '}
            <button
              type="button"
              id="worker-register-link-footer"
              onClick={() => navigateTo({ type: 'register' })}
              className="text-[#FF6B00] font-bold hover:underline cursor-pointer"
            >
              Registra tu perfil gratis aquí
            </button>
          </div>
        </div>

        {/* Hyperlocal trust footnote */}
        <div className="flex items-center justify-center gap-2 text-xs text-slate-500 font-medium">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Autenticación segura y directa para profesionales</span>
        </div>
      </div>
    </div>
  );
};
