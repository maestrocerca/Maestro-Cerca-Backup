import React, { useState } from 'react';
import { 
  Hammer, 
  Search, 
  HelpCircle, 
  User, 
  ShieldCheck, 
  Menu, 
  X, 
  ChevronRight,
  LogOut,
  SlidersHorizontal
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { WorkerAvatar } from './WorkerAvatar';

export const Navbar: React.FC = () => {
  const { currentView, navigateTo, currentWorker, logoutWorker, isAdmin, isDemoMode, isWorkerRegistrationActive } = useStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (type: string) => {
    return currentView.type === type;
  };

  const handleNav = (action: () => void) => {
    action();
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          
          {/* Logo */}
          <div
            id="brand-logo"
            onClick={() => handleNav(() => navigateTo({ type: 'home' }))}
            title="Ir a la página principal"
            className="cursor-pointer select-none flex items-center hover:opacity-80 transition-opacity"
          >
            <img
              src="/Logo%20Oficial%20para%20sitio%20web.jpg"
              alt="Maestro Cerca - Ir a la página principal"
              className="h-10 sm:h-12 w-auto object-contain pl-[22px] pt-[2px] pr-0 pb-[3px]"
            />
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2">
            <button
              id="nav-search-btn"
              onClick={() => navigateTo({ type: 'search' })}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                isActive('search') 
                  ? 'text-orange-600 bg-orange-50 font-semibold' 
                  : 'text-slate-600 hover:text-orange-600 hover:bg-slate-50'
              }`}
            >
              <Search className="w-4 h-4 text-slate-400" />
              <span>Buscar trabajadores</span>
            </button>

            {/* Navigation CTAs based on session role */}
            {isAdmin ? (
              <div className="flex items-center gap-2 ml-2">
                <button
                  id="nav-admin-panel-btn"
                  onClick={() => navigateTo({ type: 'admin' })}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-xs ${
                    isActive('admin') 
                      ? 'bg-slate-900 text-white' 
                      : 'bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-orange-600" />
                  <span>Panel Admin</span>
                </button>
                <button
                  id="nav-admin-logout-btn"
                  onClick={logoutWorker}
                  title="Cerrar sesión de administrador"
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden lg:inline text-slate-500">Salir</span>
                </button>
              </div>
            ) : currentWorker ? (
              <div className="flex items-center gap-2 ml-2">
                <button
                  id="nav-dashboard-btn"
                  onClick={() => navigateTo({ type: 'dashboard' })}
                  className={`px-4 py-2 rounded-full text-white text-sm font-semibold shadow-xs transition-all flex items-center gap-2 ${
                    isDemoMode ? 'bg-amber-600 hover:bg-amber-700' : 'bg-orange-600 hover:bg-orange-700'
                  }`}
                >
                  <WorkerAvatar
                    worker={currentWorker}
                    alt={currentWorker.firstName}
                    size="custom"
                    className="w-5 h-5 !rounded-full !border-white/40 shadow-none"
                    imgClassName="rounded-full"
                  />
                  <span>Mi perfil ({currentWorker.firstName})</span>
                  {isDemoMode && (
                    <span className="px-1.5 py-0.2 text-[10px] bg-amber-800 text-amber-100 font-bold rounded-full uppercase tracking-wider">
                      Demo
                    </span>
                  )}
                </button>
                <button
                  id="nav-logout-btn"
                  onClick={logoutWorker}
                  title="Cerrar sesión de trabajador"
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : isWorkerRegistrationActive ? (
              <div className="flex items-center ml-2">
                <span className="text-xs font-semibold text-amber-800 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-200">
                  Registro en proceso
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 ml-2">
                <button
                  id="nav-worker-login-btn"
                  onClick={() => navigateTo({ type: 'login' })}
                  className="px-3.5 py-2 rounded-lg text-slate-600 hover:text-slate-900 text-sm font-medium hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Iniciar sesión
                </button>
                <button
                  id="nav-worker-register-btn"
                  onClick={() => navigateTo({ type: 'register' })}
                  className="text-sm font-semibold text-orange-600 bg-orange-50 px-4 py-2 rounded-full border border-orange-100 hover:bg-orange-100 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <User className="w-4 h-4" />
                  <span>Registrarme como trabajador</span>
                </button>
              </div>
            )}
          </nav>

          {/* Mobile Menu Button */}
          <div className="flex items-center gap-2 md:hidden">
            {currentWorker && (
              <button
                onClick={() => navigateTo({ type: 'dashboard' })}
                className="p-1 bg-orange-50 rounded-lg border border-orange-200"
              >
                <WorkerAvatar
                  worker={currentWorker}
                  alt={currentWorker.firstName}
                  size="custom"
                  className="w-7 h-7 !rounded-full !border-orange-300 shadow-none"
                  imgClassName="rounded-full"
                />
              </button>
            )}
            <button
              id="mobile-menu-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-slate-700 hover:bg-slate-100 transition-colors"
              aria-label="Abrir menú"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-6 space-y-3 shadow-xl">
          <div className="space-y-1">
            <button
              onClick={() => handleNav(() => navigateTo({ type: 'search' }))}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl font-medium text-sm flex items-center justify-between ${
                isActive('search') ? 'bg-orange-50 text-orange-600 font-bold' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Search className="w-4 h-4 text-slate-500" />
                <span>Buscar trabajadores</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>

            {isAdmin && (
              <button
                id="mobile-nav-admin-btn"
                onClick={() => handleNav(() => navigateTo({ type: 'admin' }))}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl font-medium text-sm flex items-center justify-between ${
                  isActive('admin') ? 'bg-slate-900 text-white font-bold' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <SlidersHorizontal className="w-4 h-4 text-orange-400" />
                  <span>Panel Administrativo</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>
            )}
          </div>

          <div className="pt-3 border-t border-slate-200 space-y-2">
            {isAdmin ? (
              <div className="space-y-2">
                <button
                  id="mobile-drawer-admin-btn"
                  onClick={() => handleNav(() => navigateTo({ type: 'admin' }))}
                  className="w-full py-3 px-4 rounded-xl bg-slate-900 text-white font-bold text-center flex items-center justify-center gap-2 shadow-sm"
                >
                  <SlidersHorizontal className="w-4 h-4 text-orange-400" />
                  <span>Panel Administrativo</span>
                </button>
                <button
                  id="mobile-drawer-admin-logout-btn"
                  onClick={() => handleNav(logoutWorker)}
                  className="w-full py-2.5 px-4 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm text-center flex items-center justify-center gap-2 hover:bg-slate-50"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Cerrar sesión de administrador</span>
                </button>
              </div>
            ) : currentWorker ? (
              <div className="space-y-2">
                <button
                  onClick={() => handleNav(() => navigateTo({ type: 'dashboard' }))}
                  className="w-full py-3 px-4 rounded-xl bg-orange-600 text-white font-bold text-center flex items-center justify-center gap-2 shadow-sm"
                >
                  <WorkerAvatar
                    worker={currentWorker}
                    alt={currentWorker.firstName}
                    size="custom"
                    className="w-6 h-6 !rounded-full !border-white/40 shadow-none"
                    imgClassName="rounded-full"
                  />
                  <span>Mi perfil ({currentWorker.firstName})</span>
                </button>
                <button
                  onClick={() => handleNav(logoutWorker)}
                  className="w-full py-2.5 px-4 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm text-center flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Cerrar sesión</span>
                </button>
              </div>
            ) : isWorkerRegistrationActive ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center text-xs text-amber-900 font-medium">
                Registro en proceso
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={() => handleNav(() => navigateTo({ type: 'register' }))}
                  className="w-full py-3 px-4 rounded-full bg-orange-50 text-orange-600 border border-orange-100 font-bold text-center shadow-xs flex items-center justify-center gap-2 hover:bg-orange-100"
                >
                  <User className="w-4 h-4" />
                  <span>Registrarme como trabajador</span>
                </button>
                <button
                  onClick={() => handleNav(() => navigateTo({ type: 'login' }))}
                  className="w-full py-2.5 px-4 rounded-xl border border-slate-300 text-slate-800 font-semibold text-sm text-center"
                >
                  Ya tengo cuenta (Iniciar sesión)
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
