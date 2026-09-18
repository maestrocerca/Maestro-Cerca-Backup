import React, { useState } from 'react';
import { 
  Search, 
  MapPin, 
  Hammer, 
  Wrench, 
  Zap, 
  Paintbrush, 
  Scissors, 
  Layers, 
  ShieldCheck, 
  CheckCircle2, 
  ArrowRight, 
  PhoneCall, 
  Users, 
  Image as ImageIcon,
  Sparkles,
  Award,
  ChevronRight
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { Trade, isPubliclyVisible } from '../types';

export const HomeView: React.FC = () => {
  const { trades, serviceAreas, workers, navigateTo, trackSearch } = useStore();
  const [selectedTrade, setSelectedTrade] = useState<string>('');
  const [selectedArea, setSelectedArea] = useState<string>('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    trackSearch(selectedTrade || undefined, selectedArea || undefined);
    navigateTo({
      type: 'search',
      trade: selectedTrade || undefined,
      area: selectedArea || undefined,
    });
  };

  const getTradeIcon = (iconName: string) => {
    switch (iconName) {
      case 'Hammer': return <Hammer className="w-6 h-6" />;
      case 'Wrench': return <Wrench className="w-6 h-6" />;
      case 'Zap': return <Zap className="w-6 h-6" />;
      case 'Paintbrush': return <Paintbrush className="w-6 h-6" />;
      case 'Scissors': return <Scissors className="w-6 h-6" />;
      case 'Layers': return <Layers className="w-6 h-6" />;
      default: return <Hammer className="w-6 h-6" />;
    }
  };

  // Popular trades for the grid
  const popularTrades = trades.filter((t) => t.popular && t.active);

  // Count verified and total public available workers
  const publicWorkers = workers.filter(isPubliclyVisible);
  const totalWorkersCount = publicWorkers.length;
  const verifiedCount = publicWorkers.filter((w) => w.verificationStatus === 'verified' || w.verificado === true).length;

  return (
    <div className="space-y-16 lg:space-y-24 pb-20">
      
      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden bg-gradient-to-b from-orange-50/40 via-white to-[#FAFAFA] pt-[100px] pb-[90px] border-b border-slate-200 mb-[84px]">
        
        {/* Subtle decorative background accents */}
        <div className="absolute inset-0 bg-[radial-gradient(#ea580c_1px,transparent_1px)] [background-size:28px_28px] opacity-10 pointer-events-none" />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative text-center">
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.12] mb-8 sm:mb-10">
            Encuentra trabajadores de <span className="text-orange-600">confianza</span> cerca de ti
          </h1>

          {/* MAIN SEARCH BOX */}
          <div className="max-w-3xl mx-auto bg-white p-3 sm:p-4 rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 text-left">
            <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-12 gap-3">
              
              {/* Field 1: Oficio */}
              <div className="md:col-span-5 relative">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  ¿Qué necesitas?
                </label>
                <div className="relative">
                  <select
                    id="hero-trade-select"
                    value={selectedTrade}
                    onChange={(e) => setSelectedTrade(e.target.value)}
                    className="w-full pl-10 pr-8 py-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl text-slate-800 font-medium text-sm sm:text-base focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all appearance-none cursor-pointer"
                  >
                    <option value="">Todos los oficios</option>
                    {trades.filter((t) => t.active).map((trade) => (
                      <option key={trade.id} value={trade.name}>
                        {trade.name}
                      </option>
                    ))}
                  </select>
                  <Hammer className="w-5 h-5 text-orange-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Field 2: Zona */}
              <div className="md:col-span-4 relative">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  ¿Dónde necesitas el trabajo?
                </label>
                <div className="relative">
                  <select
                    id="hero-area-select"
                    value={selectedArea}
                    onChange={(e) => setSelectedArea(e.target.value)}
                    className="w-full pl-10 pr-8 py-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl text-slate-800 font-medium text-sm sm:text-base focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all appearance-none cursor-pointer"
                  >
                    <option value="">Todas las ubicaciones</option>
                    {serviceAreas.filter((a) => a.active).map((area) => (
                      <option key={area.id} value={area.name}>
                        {area.name} ({area.municipality})
                      </option>
                    ))}
                  </select>
                  <MapPin className="w-5 h-5 text-orange-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Submit CTA */}
              <div className="md:col-span-3 flex items-end">
                <button
                  type="submit"
                  id="hero-search-submit-btn"
                  className="w-full py-3.5 px-5 bg-slate-900 hover:bg-black active:scale-[0.98] text-white font-bold text-sm sm:text-base rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Search className="w-5 h-5 text-orange-400" />
                  <span>Buscar</span>
                </button>
              </div>

            </form>

            {/* Popular quick tags */}
            <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
              <span className="font-semibold text-slate-700">Populares:</span>
              {['Albañil', 'Plomero', 'Electricista', 'Pintor', 'Juriquilla', 'Corregidora'].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    const isArea = serviceAreas.some((a) => a.name.includes(tag));
                    if (isArea) {
                      trackSearch(undefined, tag);
                      navigateTo({ type: 'search', area: tag });
                    } else {
                      trackSearch(tag, undefined);
                      navigateTo({ type: 'search', trade: tag });
                    }
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-orange-50 hover:text-orange-700 text-slate-700 transition-colors font-medium border border-slate-200/60 cursor-pointer"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* 2. OFICIOS POPULARES */}
      <section className="max-w-7xl mx-auto px-8 mb-[70px]">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Oficios populares en Maestro Cerca
            </h2>
            <p className="text-slate-600 text-sm sm:text-base mt-1">
              Selecciona una especialidad para ver los trabajadores disponibles
            </p>
          </div>
          <button
            onClick={() => navigateTo({ type: 'search' })}
            className="inline-flex items-center gap-1.5 text-orange-600 hover:text-orange-700 font-bold text-sm hover:underline cursor-pointer"
          >
            <span>Ver todos los oficios</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {popularTrades.map((trade) => {
            return (
              <div
                key={trade.id}
                id={`trade-card-${trade.slug}`}
                onClick={() => {
                  trackSearch(trade.name, undefined);
                  navigateTo({ type: 'search', trade: trade.name });
                }}
                className="group p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 hover:border-orange-300 hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col justify-between"
              >
                <div className="w-12 h-12 rounded-xl bg-orange-50 group-hover:bg-orange-600 group-hover:text-white text-orange-600 flex items-center justify-center transition-colors mb-4">
                  {getTradeIcon(trade.iconName)}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base sm:text-lg group-hover:text-orange-600 transition-colors">
                    {trade.name}
                  </h3>
                  <p className="text-xs text-orange-600 group-hover:text-orange-700 font-semibold mt-1 flex items-center gap-1">
                    <span>Explorar</span>
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* SECCIÓN SOBRE CONFIANZA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-slate-900 text-white rounded-3xl pt-[65px] pl-16 pb-16 pr-8 sm:pr-12 lg:pr-16 relative overflow-hidden border border-slate-800">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-green-950 text-green-300 border border-green-800/80 text-xs font-semibold">
                <ShieldCheck className="w-4 h-4 text-green-400" />
                <span>Niveles de perfil y confianza</span>
              </div>

              <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                Trabajadores con información que puedes revisar
              </h2>

              <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                Maestro Cerca busca crear un directorio transparente donde los trabajadores independientes puedan mostrar su experiencia real, fotografías de proyectos terminados, referencias laborales y verificaciones de identidad.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {/* Badge 1 */}
                <div className="p-4 rounded-xl bg-slate-800/90 border border-slate-700">
                  <span className="inline-block px-2.5 py-1 rounded-md bg-slate-700 text-slate-200 text-xs font-bold mb-2">
                    Registrado en Maestro Cerca
                  </span>
                  <p className="text-xs text-slate-400 leading-normal">
                    Trabajador que creó su cuenta, agregó su experiencia, zonas de servicio y fotos de su trabajo.
                  </p>
                </div>

                {/* Badge 2 */}
                <div className="p-4 rounded-xl bg-green-950/60 border border-green-700/60">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-green-800 text-green-100 text-xs font-bold mb-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-300" />
                    Verificado por Maestro Cerca
                  </span>
                  <p className="text-xs text-slate-300 leading-normal">
                    Revisión manual de identificación, número telefónico activo, fotos de trabajos y referencias comprobables.
                  </p>
                </div>
              </div>
            </div>

            {/* Trust checklist visual */}
            <div className="lg:col-span-5 bg-slate-800 p-6 sm:p-8 rounded-2xl border border-slate-700 space-y-4">
              <h3 className="font-bold text-slate-100 text-lg flex items-center gap-2">
                <Award className="w-5 h-5 text-orange-400" />
                <span>Señales de verificación</span>
              </h3>
              
              <ul className="space-y-3 text-sm text-slate-300">
                <li className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-green-900 text-green-300 flex items-center justify-center shrink-0">
                    ✓
                  </div>
                  <span><strong>Teléfono activo y WhatsApp</strong> comprobados</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-green-900 text-green-300 flex items-center justify-center shrink-0">
                    ✓
                  </div>
                  <span><strong>Fotografías de trabajos</strong> revisadas</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-green-900 text-green-300 flex items-center justify-center shrink-0">
                    ✓
                  </div>
                  <span><strong>Identidad oficial</strong> cotejada manualmente</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-green-900 text-green-300 flex items-center justify-center shrink-0">
                    ✓
                  </div>
                  <span><strong>Referencias y experiencia</strong> en Querétaro</span>
                </li>
              </ul>

              <div className="pt-4 border-t border-slate-700">
                <button
                  onClick={() => navigateTo({ type: 'search', verifiedOnly: true })}
                  className="w-full py-2.5 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm text-center transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Ver especialistas verificados</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 5. CTA DESTACADO PARA TRABAJADORES */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-black text-white rounded-3xl pt-[56px] px-8 sm:px-12 lg:px-14 pb-8 sm:pb-12 lg:pb-14 text-center sm:text-left relative overflow-hidden shadow-lg border border-slate-800">
          
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            
            <div className="md:col-span-8 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-950 text-orange-300 border border-orange-800/60 text-xs font-semibold">
                <Users className="w-3.5 h-3.5" />
                <span>Comunidad de trabajadores y especialistas de oficios</span>
              </div>

              <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                ¿Trabajas en construcción, mantenimiento o remodelación?
              </h2>

              <p className="text-slate-300 text-base sm:text-lg max-w-2xl leading-relaxed">
                Crea tu perfil en Maestro Cerca y permite que más personas encuentren tus servicios directamente en tu zona.
              </p>
            </div>

            <div className="md:col-span-4 flex flex-col sm:flex-row md:flex-col items-center justify-center gap-3">
              <button
                id="home-worker-cta-btn"
                onClick={() => navigateTo({ type: 'register' })}
                className="w-full py-4 px-6 bg-orange-600 text-white hover:bg-orange-700 font-bold text-base rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Crear mi perfil gratis</span>
                <ArrowRight className="w-5 h-5 text-white" />
              </button>

              <button
                onClick={() => navigateTo({ type: 'login' })}
                className="text-slate-400 hover:text-white text-sm font-semibold underline underline-offset-4 cursor-pointer"
              >
                Ya tengo una cuenta registrada
              </button>
            </div>

          </div>

        </div>
      </section>

    </div>
  );
};
