import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Image as ImageIcon,
  Sparkles,
  Award,
  ChevronRight
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { Trade, Worker, isPubliclyVisible } from '../types';
import { WorkerMarketplaceCard } from './WorkerMarketplaceCard';

export const HomeView: React.FC = () => {
  const { trades, serviceAreas, workers, navigateTo, trackSearch } = useStore();
  const [selectedTrade, setSelectedTrade] = useState<string>('');
  const [tradeQuery, setTradeQuery] = useState<string>('');
  const [selectedArea, setSelectedArea] = useState<string>('');
  const [showTradeSuggestions, setShowTradeSuggestions] = useState<boolean>(false);
  const tradeFieldRef = useRef<HTMLDivElement>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const finalTrade = selectedTrade || tradeQuery.trim();
    trackSearch(finalTrade || undefined, selectedArea || undefined);
    navigateTo({
      type: 'search',
      trade: finalTrade || undefined,
      area: selectedArea || undefined,
    });
  };

  const handlePickTrade = (name: string) => {
    setSelectedTrade(name);
    setTradeQuery(name);
    setShowTradeSuggestions(false);
  };

  const tradeSuggestions = useMemo(() => {
    const q = tradeQuery.trim().toLowerCase();
    if (!q) return [];
    return trades.filter((t) => t.active && t.name.toLowerCase().includes(q)).slice(0, 6);
  }, [tradeQuery, trades]);

  // Close the suggestions dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tradeFieldRef.current && !tradeFieldRef.current.contains(event.target as Node)) {
        setShowTradeSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Rotating placeholder words (superprof.mx-style) cycling through popular trades
  const rotatingTradeNames = useMemo(() => {
    const names = trades.filter((t) => t.popular && t.active).map((t) => t.name);
    return names.length > 0 ? names : ['Albañil', 'Plomero', 'Electricista'];
  }, [trades]);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [placeholderVisible, setPlaceholderVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderVisible(false);
      setTimeout(() => {
        setPlaceholderIndex((i) => (i + 1) % rotatingTradeNames.length);
        setPlaceholderVisible(true);
      }, 220);
    }, 2200);
    return () => clearInterval(interval);
  }, [rotatingTradeNames]);

  // Featured worker profiles for the homepage marketplace grid
  const featuredWorkers = useMemo(() => {
    return workers
      .filter(isPubliclyVisible)
      .sort((a, b) => {
        const aVerif = a.verificado === true || a.verificationStatus === 'verified';
        const bVerif = b.verificado === true || b.verificationStatus === 'verified';
        if (aVerif && !bVerif) return -1;
        if (!aVerif && bVerif) return 1;
        const aPhotos = a.workPhotos?.length || a.fotosTrabajos?.length || 0;
        const bPhotos = b.workPhotos?.length || b.fotosTrabajos?.length || 0;
        return bPhotos - aPhotos;
      })
      .slice(0, 6);
  }, [workers]);

  const handleOpenWorker = (worker: Worker) => {
    navigateTo({ type: 'profile', workerSlug: worker.slug! });
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
    <div 
      className="space-y-16 lg:space-y-24"
      style={{ paddingBottom: '80px' }}
    >
      
      {/* 1. HERO SECTION */}
      <section 
        className="relative overflow-hidden bg-gradient-to-b from-orange-50/40 via-white to-[#FAFAFA] pt-[100px] border-b border-slate-200 mb-[84px]"
        style={{ paddingBottom: '45px' }}
      >

        {/* Subtle decorative background accents */}
        <div className="absolute inset-0 bg-[radial-gradient(#ea580c_1px,transparent_1px)] [background-size:28px_28px] opacity-10 pointer-events-none" />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative text-center">
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.12] mb-8 sm:mb-10">
            Encuentra trabajadores de <span className="text-orange-600">confianza</span> cerca de ti
          </h1>

          {/* MAIN SEARCH BOX */}
          <div 
            className="max-w-[780px] w-full mx-auto bg-white p-3 sm:p-4 rounded-[50px] shadow-xl shadow-slate-200/50 border border-slate-200 text-left"
            style={{
              borderRadius: '50px',
              maxWidth: '780px',
            }}
          >
            <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-12 gap-3">

              {/* Field 1: Oficio (free text, animated rotating placeholder + suggestions) */}
              <div ref={tradeFieldRef} className={`relative ${selectedArea || tradeQuery ? 'md:col-span-5' : 'md:col-span-9'}`}>
                <div className="relative">
                  <input
                    id="hero-trade-input"
                    type="text"
                    autoComplete="off"
                    value={tradeQuery}
                    onChange={(e) => {
                      setTradeQuery(e.target.value);
                      setSelectedTrade('');
                      setShowTradeSuggestions(true);
                    }}
                    onFocus={() => setShowTradeSuggestions(true)}
                    style={{ borderRadius: '30px' }}
                    className="w-full pl-10 pr-8 py-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-[30px] text-slate-800 font-medium text-sm sm:text-base focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
                  />
                  <Hammer className="w-5 h-5 text-orange-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />

                  {/* Animated rotating placeholder overlay, superprof.mx-style */}
                  {!tradeQuery && (
                    <div className="absolute left-10 top-1/2 -translate-y-1/2 pointer-events-none flex items-center gap-1.5 text-sm sm:text-base text-slate-400">
                      <span>Ej.</span>
                      <span
                        className={`font-semibold text-slate-500 transition-all duration-200 ${
                          placeholderVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'
                        }`}
                      >
                        {rotatingTradeNames[placeholderIndex]}
                      </span>
                    </div>
                  )}

                  {/* Suggestions dropdown */}
                  {showTradeSuggestions && tradeSuggestions.length > 0 && (
                    <div className="absolute z-20 top-full mt-1.5 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                      {tradeSuggestions.map((trade) => (
                        <button
                          key={trade.id}
                          type="button"
                          onClick={() => handlePickTrade(trade.name)}
                          className="w-full text-left px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-orange-50 hover:text-orange-700 transition-colors cursor-pointer flex items-center gap-2"
                        >
                          <Hammer className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                          <span>{trade.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Field 2: Zona — only appears once the worker has started typing what they need */}
              {(tradeQuery || selectedArea) && (
                <div className="md:col-span-4 relative animate-in fade-in slide-in-from-left-2 duration-300">
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
              )}

              {/* Submit CTA */}
              <div className={`flex items-end ${tradeQuery || selectedArea ? 'md:col-span-3' : 'md:col-span-3'}`}>
                <button
                  type="submit"
                  id="hero-search-submit-btn"
                  style={{ borderRadius: '30px' }}
                  className="w-full py-3.5 px-5 bg-slate-900 hover:bg-black active:scale-[0.98] text-white font-bold text-sm sm:text-base rounded-[30px] shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Search className="w-5 h-5 text-orange-400" />
                  <span>Buscar</span>
                </button>
              </div>

            </form>
          </div>

          {/* COMPACT OFICIOS POPULARES — right below the search box, superprof-style density */}
          <div className="max-w-3xl mx-auto mt-4 flex flex-wrap items-center justify-center gap-1.5">
            {popularTrades.map((trade) => (
              <button
                key={trade.id}
                id={`trade-card-${trade.slug}`}
                onClick={() => {
                  trackSearch(trade.name, undefined);
                  navigateTo({ type: 'search', trade: trade.name });
                }}
                className="group flex items-center gap-1.5 pl-1.5 pr-3 py-1.5 rounded-full bg-white hover:bg-orange-50 border border-slate-200 hover:border-orange-300 shadow-xs transition-all duration-150 cursor-pointer"
              >
                <span className="w-6 h-6 rounded-full bg-orange-50 group-hover:bg-orange-600 group-hover:text-white text-orange-600 flex items-center justify-center transition-colors shrink-0 [&_svg]:w-3 [&_svg]:h-3">
                  {getTradeIcon(trade.iconName)}
                </span>
                <span className="font-bold text-slate-700 text-xs group-hover:text-orange-700 transition-colors">
                  {trade.name}
                </span>
              </button>
            ))}
            <button
              onClick={() => navigateTo({ type: 'search' })}
              className="inline-flex items-center gap-1 text-orange-600 hover:text-orange-700 font-bold text-xs px-2 cursor-pointer"
            >
              <span>Ver todos</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

        </div>
      </section>

      {/* 1.5 TRABAJADORES DESTACADOS (Marketplace grid, superprof.mx-inspired) */}
      {featuredWorkers.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-[70px]">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Trabajadores disponibles cerca de ti
              </h2>
              <p className="text-slate-600 text-sm sm:text-base mt-1">
                Perfiles reales, con fotos de trabajos terminados
              </p>
            </div>
            <button
              onClick={() => navigateTo({ type: 'search' })}
              className="inline-flex items-center gap-1.5 text-orange-600 hover:text-orange-700 font-bold text-sm hover:underline cursor-pointer shrink-0"
            >
              <span>Ver todos los trabajadores</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {featuredWorkers.map((worker) => (
              <WorkerMarketplaceCard key={worker.id} worker={worker} onOpen={handleOpenWorker} />
            ))}
          </div>
        </section>
      )}

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
        <div 
          className="bg-black text-white text-center sm:text-left relative overflow-hidden shadow-lg border border-slate-800"
          style={{
            paddingTop: '30px',
            paddingBottom: '30px',
            paddingLeft: '30px',
            paddingRight: '30px',
            borderRadius: '30px',
            maxWidth: '327px',
            minHeight: '450px',
            margin: '0 auto',
          }}
        >
          
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            
            <div className="md:col-span-8 space-y-4">
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
