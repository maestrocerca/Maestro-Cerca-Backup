import React, { useEffect, useState } from 'react';
import { useStore } from '../context/StoreContext';
import { isUserAdmin, DESIGNATED_ADMIN_EMAILS } from '../config/admins';
import { ShieldAlert, LogOut, Lock, AlertCircle } from 'lucide-react';

interface AdminGuardProps {
  children: React.ReactNode;
}

export const AdminGuard: React.FC<AdminGuardProps> = ({ children }) => {
  const {
    firebaseUser,
    isAuthLoading,
    loginAdmin,
    loginAdminWithGoogle,
    logoutWorker,
    navigateTo,
  } = useStore();

  const [hasAdminPrivilege, setHasAdminPrivilege] = useState<boolean | null>(null);
  const [checkingClaims, setCheckingClaims] = useState<boolean>(true);

  // Local login state
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState('');

  // Validate admin claims and email against centralized governance
  useEffect(() => {
    let isMounted = true;

    async function evaluateAdminPrivileges() {
      if (!firebaseUser) {
        if (isMounted) {
          setHasAdminPrivilege(false);
          setCheckingClaims(false);
        }
        return;
      }

      try {
        // Retrieve fresh ID token result to check custom claims
        const idTokenResult = await firebaseUser.getIdTokenResult();
        const claims = idTokenResult?.claims || {};
        const isAuthorized = isUserAdmin(firebaseUser, claims);
        if (isMounted) {
          setHasAdminPrivilege(isAuthorized);
        }
      } catch (err) {
        console.warn('Error verifying admin custom claims:', err);
        // Fallback to designated emails validation
        if (isMounted) {
          setHasAdminPrivilege(isUserAdmin(firebaseUser));
        }
      } finally {
        if (isMounted) {
          setCheckingClaims(false);
        }
      }
    }

    setCheckingClaims(true);
    evaluateAdminPrivileges();

    return () => {
      isMounted = false;
    };
  }, [firebaseUser]);

  const handleAdminEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setAuthError('');
    try {
      const res = await loginAdmin(adminEmail, adminPassword);
      if (!res.success) {
        setAuthError(res.error || 'Credenciales administrativas no válidas.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setAuthError('');
    try {
      const res = await loginAdminWithGoogle();
      if (!res.success) {
        setAuthError(res.error || 'No se pudo iniciar sesión con Google.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  // 1. Loading screen
  if (isAuthLoading || checkingClaims) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center bg-[#FAFAFA]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-600 text-sm font-medium">Verificando credenciales de acceso y permisos RBAC...</p>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated user: Show Admin Login
  if (!firebaseUser) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center bg-[#FAFAFA] py-16 px-4">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 bg-slate-900 text-orange-500 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Acceso Administrativo</h2>
            <p className="text-slate-600 text-xs leading-relaxed">
              Panel protegido para el equipo de gestión de Maestro Cerca en Zibatá y Querétaro.
            </p>
          </div>

          {authError && (
            <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{authError}</span>
            </div>
          )}

          {/* Google Sign-In button */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoggingIn}
            className="w-full py-3 px-4 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-bold rounded-xl flex items-center justify-center gap-2.5 transition-colors cursor-pointer shadow-xs"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>Continuar con Google Workspace</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="h-px bg-slate-200 flex-1" />
            <span className="text-[11px] font-bold text-slate-400 uppercase">o con correo y contraseña</span>
            <div className="h-px bg-slate-200 flex-1" />
          </div>

          <form onSubmit={handleAdminEmailLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Correo de Administrador</label>
              <input
                type="email"
                required
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="maestrocerca.mx@gmail.com"
                className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Contraseña</label>
              <input
                type="password"
                required
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden focus:border-orange-500"
              />
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3.5 px-6 bg-slate-900 hover:bg-black text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2 text-xs uppercase tracking-wider"
            >
              {isLoggingIn ? 'Autenticando...' : 'Iniciar Sesión en Panel'}
            </button>
          </form>

          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => navigateTo({ type: 'home' })}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
            >
              ← Volver al Directorio Público
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Authenticated user but NOT an administrator (403 Forbidden Screen)
  if (!hasAdminPrivilege) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center bg-[#FAFAFA] py-16 px-4">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-red-200 shadow-md text-center space-y-6">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-3xl flex items-center justify-center mx-auto">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <span className="inline-block py-1 px-2.5 bg-red-100 text-red-700 text-[11px] font-black uppercase rounded-full tracking-wider">
              Error 403: Acceso Denegado
            </span>
            <h2 className="text-2xl font-black text-slate-900">Área Reservada</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              La cuenta autenticada <strong className="text-slate-900">{firebaseUser.email || firebaseUser.phoneNumber || 'actual'}</strong> no cuenta con privilegios administrativos ni token claims de gestión en Maestro Cerca.
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-left text-xs text-slate-600 space-y-1">
            <p className="font-bold text-slate-800">Correos autorizados para administración:</p>
            <ul className="list-disc list-inside text-[11px] text-slate-500 space-y-0.5">
              {DESIGNATED_ADMIN_EMAILS.map((email) => (
                <li key={email} className="font-mono">{email}</li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <button
              type="button"
              onClick={logoutWorker}
              className="w-full py-3 px-4 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Cerrar sesión / Probar otra cuenta</span>
            </button>
            <button
              type="button"
              onClick={() => navigateTo({ type: 'home' })}
              className="py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            >
              Volver al Inicio
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. Fully authorized admin user
  return <>{children}</>;
};
