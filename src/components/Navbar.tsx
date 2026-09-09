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
  SlidersHorizontal,
  MapPin
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { BrandLogo } from './BrandLogo';

export const Navbar: React.FC = () => {
  const { currentView, navigateTo, currentWorker, logoutWorker } = useStore();
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
      {/* Top micro-bar highlighting Querétaro hyperlocal focus */}
      <div className="bg-slate-900 text-slate-300 text-xs py-1.5 px-4 text-center font-medium flex items-center justify-center gap-1.5 border-b border-slate-800">
        <MapPin className="w-3.5 h-3.5 text-orange-400" />
        <span>Directorio de trabajadores y especialistas de confianza en <strong className="text-white">Querétaro, Qro.</strong></span>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          
          {/* Logo */}
          <div 
            id="brand-logo"
            onClick={() => handleNav(() => navigateTo({ type: 'home' }))}
            className="cursor-pointer select-none"
          >
            <BrandLogo size="md" />
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2">
            <button
              id="nav-home-btn"
              onClick={() => navigateTo({ type: 'home' })}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                isActive('home') 
                  ? 'text-orange-600 bg-orange-50 font-semibold' 
                  : 'text-slate-600 hover:text-orange-600 hover:bg-slate-50'
              }`}
            >
              <span>Página principal</span>
            </button>

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

            <div className="h-4 w-px bg-slate-200 mx-2" />

            {/* Admin quick toggle for testing */}
            <button
              id="nav-admin-btn"
              onClick={() => navigateTo({ type: 'admin' })}
              title="Panel Administrativo (Demo)"
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 border ${
                isActive('admin') 
                  ? 'bg-slate-900 text-white border-slate-900' 
                  : 'text-slate-500 hover:text-slate-900 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Admin MVP</span>
            </button>

            {/* Worker CTA or Worker Profile */}
            {currentWorker ? (
              <div className="flex items-center gap-2 ml-2">
                <button
                  id="nav-dashboard-btn"
                  onClick={() => navigateTo({ type: 'dashboard' })}
                  className="px-4 py-2 rounded-full bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold shadow-xs transition-all flex items-center gap-2"
                >
                  <img 
                    src={currentWorker.profilePhoto} 
                    alt={currentWorker.firstName}
                    className="w-5 h-5 rounded-full object-cover border border-white/40" 
                  />
                  <span>Mi perfil ({currentWorker.firstName})</span>
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
            ) : (
              <div className="flex items-center gap-2 ml-2">
                <button
                  id="nav-worker-login-btn"
                  onClick={() => navigateTo({ type: 'login' })}
                  className="px-3.5 py-2 rounded-lg text-slate-600 hover:text-slate-900 text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  Iniciar sesión
                </button>
                <button
                  id="nav-worker-register-btn"
                  onClick={() => navigateTo({ type: 'register' })}
                  className="text-sm font-semibold text-orange-600 bg-orange-50 px-4 py-2 rounded-full border border-orange-100 hover:bg-orange-100 transition-colors flex items-center gap-1.5"
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
                className="p-1.5 bg-orange-50 rounded-lg border border-orange-200"
              >
                <img 
                  src={currentWorker.profilePhoto} 
                  alt={currentWorker.firstName}
                  className="w-7 h-7 rounded-full object-cover" 
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
              onClick={() => handleNav(() => navigateTo({ type: 'home' }))}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl font-medium text-sm flex items-center justify-between ${
                isActive('home') ? 'bg-orange-50 text-orange-600 font-bold' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span>Página principal</span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>

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

            <button
              onClick={() => handleNav(() => navigateTo({ type: 'admin' }))}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl font-medium text-sm flex items-center justify-between ${
                isActive('admin') ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <SlidersHorizontal className="w-4 h-4 text-slate-500" />
                <span>Panel Administrativo (Demo)</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          <div className="pt-3 border-t border-slate-200 space-y-2">
            {currentWorker ? (
              <div className="space-y-2">
                <button
                  onClick={() => handleNav(() => navigateTo({ type: 'dashboard' }))}
                  className="w-full py-3 px-4 rounded-xl bg-orange-600 text-white font-bold text-center flex items-center justify-center gap-2 shadow-sm"
                >
                  <img 
                    src={currentWorker.profilePhoto} 
                    alt={currentWorker.firstName}
                    className="w-5 h-5 rounded-full object-cover" 
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
