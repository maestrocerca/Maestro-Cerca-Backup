import React from 'react';
import { Hammer, ShieldCheck, MapPin, Phone, MessageSquare, AlertCircle } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { BrandLogo } from './BrandLogo';

export const Footer: React.FC = () => {
  const { navigateTo } = useStore();

  return (
    <footer className="bg-slate-900 text-slate-400 border-t border-slate-800">
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12">
          
          {/* Brand Col */}
          <div className="lg:col-span-2 space-y-4">
            <div 
              onClick={() => navigateTo({ type: 'home' })}
              className="cursor-pointer inline-flex"
            >
              <BrandLogo size="md" textColor="light" />
            </div>
            
            <p className="text-slate-400 text-sm leading-relaxed max-w-sm">
              Maestro Cerca conecta personas que necesitan trabajos de construcción, mantenimiento o remodelación con trabajadores de oficios confiables y verificados en Querétaro.
            </p>

            <div className="flex items-center gap-2 text-xs text-slate-400">
              <MapPin className="w-4 h-4 text-orange-500 shrink-0" />
              <span>Santiago de Querétaro, Qro., México</span>
            </div>
          </div>

          {/* Col 1: Clientes */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
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
              <li>
                <button
                  onClick={() => navigateTo({ type: 'search', trade: 'Albañil' })}
                  className="hover:text-orange-400 transition-colors text-slate-400"
                >
                  Albañiles en Querétaro
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigateTo({ type: 'search', trade: 'Plomero' })}
                  className="hover:text-orange-400 transition-colors text-slate-400"
                >
                  Plomeros en Querétaro
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigateTo({ type: 'search', trade: 'Electricista' })}
                  className="hover:text-orange-400 transition-colors text-slate-400"
                >
                  Electricistas en Querétaro
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigateTo({ type: 'how-it-works' })}
                  className="hover:text-orange-400 transition-colors"
                >
                  Cómo funciona
                </button>
              </li>
            </ul>
          </div>

          {/* Col 2: Trabajadores */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
              Para trabajadores
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <button
                  onClick={() => navigateTo({ type: 'register' })}
                  className="text-orange-400 hover:text-orange-300 font-medium transition-colors"
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
              <li>
                <button
                  onClick={() => navigateTo({ type: 'how-it-works' })}
                  className="hover:text-orange-400 transition-colors text-slate-400"
                >
                  Beneficios de registrarte
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigateTo({ type: 'how-it-works' })}
                  className="hover:text-orange-400 transition-colors text-slate-400"
                >
                  Proceso de verificación
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3: Legal & Soporte */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
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
              <li>
                <span className="text-slate-400">
                  Contacto: <a href="mailto:soporte@maestrocerca.mx" className="text-orange-400 hover:underline">soporte@maestrocerca.mx</a>
                </span>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} Maestro Cerca. Todos los derechos reservados. Querétaro, México.</p>
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
