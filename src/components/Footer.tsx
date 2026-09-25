import React from 'react';
import { Hammer, ShieldCheck, MapPin, Phone, MessageSquare, AlertCircle, SlidersHorizontal, Lock } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { BrandLogo } from './BrandLogo';
import footerLogo from '../assets/images/regenerated_image_1789674062841.jpg';

export const Footer: React.FC = () => {
  const { navigateTo } = useStore();

  return (
    <footer className="bg-[#0c2340] text-slate-400 border-t border-slate-800">
      {/* Upper disclaimer box */}
      <div className="border-b border-slate-800 bg-slate-950/60 py-6 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-3 text-xs text-slate-400">
          <div className="p-2 rounded-lg bg-slate-800 text-orange-400 shrink-0">
            <AlertCircle className="w-4 h-4" />
          </div>
          <p className="leading-relaxed">
            <strong className="text-slate-200">Aviso importante:</strong> Maestro Cerca facilita el contacto directo entre clientes y trabajadores independientes. Los presupuestos, acuerdos, pagos y la ejecución material de los trabajos se realizan directamente entre ambas partes.
          </p>
        </div>
      </div>

      <div 
        className="mx-auto bg-[#0c2340]"
        style={{
          paddingTop: '63px',
          paddingBottom: '66px',
          paddingLeft: '50px',
          paddingRight: '50px',
          marginTop: '-2px',
          marginBottom: '0px',
          marginRight: '0px',
          maxWidth: '1151px',
          width: '100%',
        }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12">
          
          {/* Brand Col */}
          <div className="lg:col-span-2 space-y-4">
            <div 
              onClick={() => navigateTo({ type: 'home' })}
              className="cursor-pointer inline-flex items-center bg-[#0c2340] px-3 pt-1 pb-1.5 -mt-0.5 rounded-xl shadow-xs"
            >
              <img 
                src={footerLogo} 
                alt="Maestro Cerca Logo" 
                style={{
                  height: '41px',
                  width: '131.365px',
                  marginLeft: '6px',
                  marginRight: '4px',
                  marginTop: '-2px',
                  marginBottom: '-1px',
                }}
                className="object-contain" 
              />
            </div>
            
            <p className="text-slate-400 text-sm leading-relaxed max-w-sm ml-[18px]">
              Maestro Cerca conecta personas que necesitan trabajos de construcción, mantenimiento o remodelación con trabajadores de oficios confiables y verificados en todo el Estado de Querétaro.
            </p>

            <div className="flex items-center gap-2 text-xs text-slate-400 ml-[18px]">
              <MapPin className="w-4 h-4 text-orange-500 shrink-0" />
              <span>Estado de Querétaro, México</span>
            </div>
          </div>

          {/* Col 1: Clientes */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#ff8415]">
              Para clientes
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <button
                  onClick={() => navigateTo({ type: 'search' })}
                  className="hover:text-orange-400 transition-colors"
                >
                  Buscar trabajadores
                </button>
              </li>
            </ul>
          </div>

          {/* Col 2: Trabajadores */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#ff8415]">
              Para trabajadores
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <button
                  onClick={() => navigateTo({ type: 'register' })}
                  className="text-white hover:text-orange-300 font-medium transition-colors text-left"
                >
                  Registrarme como trabajador
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigateTo({ type: 'login' })}
                  className="hover:text-orange-400 transition-colors text-slate-400"
                >
                  Iniciar sesión
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3: Legal & Soporte */}
          <div 
            className="space-y-3"
            style={{
              width: '167.802px',
              minHeight: '172px',
            }}
          >
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#ff8415]">
              Legal y soporte
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="/aviso-de-privacidad"
                  onClick={(e) => {
                    e.preventDefault();
                    navigateTo({ type: 'privacy' });
                  }}
                  className="text-slate-300 hover:text-orange-400 font-medium transition-colors inline-block"
                >
                  Aviso de Privacidad
                </a>
              </li>
              <li>
                <button
                  onClick={() => navigateTo({ type: 'terms' })}
                  className="hover:text-orange-400 transition-colors text-slate-400"
                >
                  Términos y condiciones
                </button>
              </li>
              <li className="pt-1">
                <button
                  id="footer-admin-portal-btn"
                  onClick={() => navigateTo({ type: 'admin' })}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer shadow-2xs"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-orange-400" />
                  <span>Portal Administrativo</span>
                </button>
              </li>
              <li>
                <span className="text-slate-400">
                  Contacto: <a href="mailto:maestrocerca.mx@gmail.com" className="text-orange-400 hover:underline">maestrocerca.mx@gmail.com</a>
                </span>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} Maestro Cerca. Todos los derechos reservados. Estado de Querétaro, México.</p>
          <div className="flex flex-wrap items-center gap-4 text-slate-400">
            <a
              href="/aviso-de-privacidad"
              onClick={(e) => {
                e.preventDefault();
                navigateTo({ type: 'privacy' });
              }}
              className="text-slate-300 hover:text-orange-400 transition-colors underline decoration-slate-700 underline-offset-4"
            >
              Aviso de Privacidad
            </a>
            <button
              id="footer-bottom-admin-btn"
              onClick={() => navigateTo({ type: 'admin' })}
              className="text-slate-400 hover:text-orange-400 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5 text-slate-500 hover:text-orange-400" />
              <span>Acceso Admin</span>
            </button>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-green-500" />
              Directorio con Verificación Manual
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
