import React, { useState, useEffect } from 'react';
import { 
  Phone, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  RotateCcw, 
  ArrowLeft,
  KeyRound,
  Sparkles
} from 'lucide-react';
import { ConfirmationResult } from 'firebase/auth';
import { useStore, formatMexicanPhoneToE164, formatPhoneForDisplay } from '../context/StoreContext';

export const WorkerLoginView: React.FC = () => {
  const { 
    sendPhoneVerificationCode, 
    confirmPhoneVerificationCode, 
    navigateTo 
  } = useStore();

  // Step 1: Phone input, Step 2: Code input
  const [step, setStep] = useState<1 | 2>(1);
  
  // Form fields
  const [rawPhone, setRawPhone] = useState('');
  const [smsCode, setSmsCode] = useState('');
  
  // Status states
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
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

  const handleSendSms = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');

    if (cleanPhoneDigits.length !== 10) {
      setError('Por favor ingresa los 10 dígitos de tu número celular.');
      return;
    }

    const formattedE164 = formatMexicanPhoneToE164(cleanPhoneDigits);
    setIsLoading(true);

    try {
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
      setError(err?.message || 'Error de conexión al enviar el código.');
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
        if (res.hasExistingProfile) {
          // Worker already has a completed profile in Firestore -> go directly to Dashboard
          navigateTo({ type: 'dashboard' });
        } else {
          // Authenticated but profile is not completed yet -> go directly to Register onboarding
          navigateTo({ type: 'register' });
        }
      } else {
        setError(res.error || 'Código incorrecto. Revisa el SMS e intenta de nuevo.');
      }
    } catch (err: any) {
      setError(err?.message || 'Error al validar el código SMS.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (cooldown > 0 || isLoading) return;
    await handleSendSms();
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="max-w-md w-full space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-orange-600 text-white rounded-2xl flex items-center justify-center mx-auto shadow-xs">
            <Phone className="w-6 h-6" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Acceso para trabajadores
          </h1>
          <p className="text-slate-600 text-sm">
            Ingresa rápidamente con tu número celular mediante código SMS de seguridad.
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
          
          {/* Error notice */}
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: Phone number input */}
          {step === 1 && (
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
                    }}
                    className="w-full p-3 bg-transparent text-slate-900 text-base font-bold tracking-wider placeholder:text-slate-400 placeholder:font-normal focus:outline-hidden"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                  Enviaremos un SMS con un código de seguridad para verificar tu cuenta de Maestro Cerca.
                </p>
              </div>

              {/* Invisible reCAPTCHA container */}
              <div id="recaptcha-login-container"></div>

              <button
                type="submit"
                id="send-sms-btn"
                disabled={isLoading || cleanPhoneDigits.length !== 10}
                className="w-full py-3.5 px-4 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Enviando código SMS...</span>
                  </>
                ) : (
                  <>
                    <span>Enviar código</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* STEP 2: SMS Code input */}
          {step === 2 && (
            <form onSubmit={handleConfirmCode} className="space-y-5">
              <div className="p-3.5 bg-orange-50 border border-orange-200 rounded-2xl flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold uppercase text-orange-800 tracking-wider">Código enviado al</span>
                  <p className="text-sm font-black text-slate-900">
                    +52 {formatPhoneForDisplay(cleanPhoneDigits)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setError('');
                  }}
                  className="text-xs font-bold text-orange-700 hover:text-orange-900 underline cursor-pointer"
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
                className="w-full py-3.5 px-4 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
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
                    className="text-xs text-orange-600 hover:text-orange-700 font-bold flex items-center gap-1.5 cursor-pointer"
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
              onClick={() => navigateTo({ type: 'register' })}
              className="text-orange-600 font-bold hover:underline cursor-pointer"
            >
              Registra tu perfil gratis aquí
            </button>
          </div>
        </div>

        {/* Hyperlocal trust footnote */}
        <div className="flex items-center justify-center gap-2 text-xs text-slate-500 font-medium">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Autenticación segura por SMS para trabajadores de Querétaro</span>
        </div>
      </div>
    </div>
  );
};
