import React, { useState, useMemo, useEffect } from 'react';
import { Search, MapPin, ShieldCheck, Filter, RotateCcw } from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useStore } from '../context/StoreContext';
import { Worker } from '../types';
import { WorkerCatalogCard } from './WorkerCatalogCard';

interface SearchResultsViewProps {
  initialTrade?: string;
  initialArea?: string;
  initialVerifiedOnly?: boolean;
}

export const SearchResultsView: React.FC<SearchResultsViewProps> = ({
  initialTrade = '',
  initialArea = '',
  initialVerifiedOnly = false,
}) => {
  const { workers, trades, serviceAreas, navigateTo, logContactClick, contactarWhatsApp, trackSearch } = useStore();

  const [tradeFilter, setTradeFilter] = useState<string>(initialTrade);
  const [areaFilter, setAreaFilter] = useState<string>(initialArea);
  const [verifiedOnly, setVerifiedOnly] = useState<boolean>(initialVerifiedOnly);
  const [minExperience, setMinExperience] = useState<number>(0);
  const [showMobileFilters, setShowMobileFilters] = useState<boolean>(false);

  // SERVER-SIDE QUERY: Filter profiles at the Firestore server level
  // Conditions: status == 'active' and onboardingIncomplete == false
  const [serverWorkers, setServerWorkers] = useState<Worker[]>([]);
  const [isLoadingServer, setIsLoadingServer] = useState<boolean>(true);

  useEffect(() => {
    setIsLoadingServer(true);
    const maestrosRef = collection(db, 'maestros');
    const baseServerQuery = query(
      maestrosRef,
      where('status', '==', 'active'),
      where('onboardingIncomplete', '==', false),
      where('aprobado', '==', true)
    );

    const unsubscribe = onSnapshot(
      baseServerQuery,
      (snapshot) => {
        const loaded: Worker[] = [];
        snapshot.forEach((docSnap) => {
          loaded.push({
            ...(docSnap.data() as Worker),
            id: docSnap.id,
          });
        });
        setServerWorkers(loaded);
        setIsLoadingServer(false);
      },
      (error) => {
        console.warn('[SearchResultsView] Server-side Firestore query fallback:', error);
        setIsLoadingServer(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Update filters when props change
  React.useEffect(() => {
    if (initialTrade) setTradeFilter(initialTrade);
    if (initialArea) setAreaFilter(initialArea);
    if (initialVerifiedOnly) setVerifiedOnly(initialVerifiedOnly);
  }, [initialTrade, initialArea, initialVerifiedOnly]);

  const handleFilterChange = (trade: string, area: string) => {
    trackSearch(trade || undefined, area || undefined);
  };

  // Filter and sort workers directly from server-side query results
  const filteredWorkers = useMemo(() => {
    const candidateWorkers = serverWorkers.length > 0 || !isLoadingServer ? serverWorkers : workers;

    return candidateWorkers
      .filter((w) => {
        // Trade filter
        if (tradeFilter) {
          const matchesMain = (w.mainTrade || w.oficio || '').toLowerCase() === tradeFilter.toLowerCase();
          const matchesSecondary = w.secondaryTrades?.some(
            (t) => t.toLowerCase() === tradeFilter.toLowerCase()
          );
          if (!matchesMain && !matchesSecondary) return false;
        }

        // Area filter
        if (areaFilter) {
          const matchesArea = w.serviceAreas?.some((a) =>
            a.toLowerCase().includes(areaFilter.toLowerCase())
          );
          if (!matchesArea) return false;
        }

        // Verified filter
        if (verifiedOnly && !(w.verificado === true || w.verificationStatus === 'verified')) {
          return false;
        }

        // Experience filter
        if (minExperience > 0 && (w.yearsExperience || 0) < minExperience) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        // Boost verified workers first
        const aVerif = a.verificado === true || a.verificationStatus === 'verified';
        const bVerif = b.verificado === true || b.verificationStatus === 'verified';
        if (aVerif && !bVerif) return -1;
        if (!aVerif && bVerif) return 1;

        // Then by number of work photos
        const photosDiff = (b.workPhotos?.length || 0) - (a.workPhotos?.length || 0);
        if (photosDiff !== 0) return photosDiff;

        // Then by years of experience
        return (b.yearsExperience || 0) - (a.yearsExperience || 0);
      });
  }, [workers, tradeFilter, areaFilter, verifiedOnly, minExperience]);

  const handleResetFilters = () => {
    setTradeFilter('');
    setAreaFilter('');
    setVerifiedOnly(false);
    setMinExperience(0);
  };

  const handleWhatsAppContact = (worker: Worker, e: React.MouseEvent) => {
    e.stopPropagation();
    contactarWhatsApp(worker);
  };

  const handlePhoneCall = (worker: Worker, e: React.MouseEvent) => {
    e.stopPropagation();
    logContactClick(worker, 'phone');
    window.location.href = `tel:${worker.phone}`;
  };

  // Pluralization helper for trade titles in Spanish
  const pluralizeTrade = (trade: string): string => {
    const trimmed = trade.trim();
    if (!trimmed) return '';
    const lower = trimmed.toLowerCase();

    const knownPlurals: Record<string, string> = {
      'albañil': 'Albañiles',
      'plomero': 'Plomeros',
      'electricista': 'Electricistas',
      'pintor': 'Pintores',
      'carpintero': 'Carpinteros',
      'herrero': 'Herreros',
      'jardinero': 'Jardineros',
      'mecánico': 'Mecánicos',
      'mecanico': 'Mecánicos',
      'soldador': 'Soldadores',
      'instalador': 'Instaladores',
      'cerrajero': 'Cerrajeros',
      'fumigador': 'Fumigadores',
      'impermeabilizador': 'Impermeabilizadores',
      'vidriero': 'Vidrieros',
      'técnico': 'Técnicos',
      'tecnico': 'Técnicos',
      'yesero': 'Yeseros',
      'tablaroquero': 'Tablaroqueros',
      'azulejero': 'Azulejeros',
      'fontanero': 'Fontaneros',
    };

    if (knownPlurals[lower]) {
      return knownPlurals[lower];
    }

    if (/[lrdzn]$/i.test(trimmed)) {
      return `${trimmed}es`;
    }
    if (/z$/i.test(trimmed)) {
      return `${trimmed.slice(0, -1)}ces`;
    }
    if (/s$/i.test(trimmed)) {
      return trimmed;
    }
    return `${trimmed}s`;
  };

  // Dynamic Title
  const getPageTitle = () => {
    if (tradeFilter && areaFilter) {
      return `${pluralizeTrade(tradeFilter)} en ${areaFilter}`;
    }
    if (tradeFilter) {
      return pluralizeTrade(tradeFilter);
    }
    if (areaFilter) {
      return `Trabajadores de oficios en ${areaFilter}`;
    }
    return `Directorio de trabajadores y especialistas`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      
      {/* Search Header Banner */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-orange-600 uppercase tracking-wider mb-1">
              <MapPin className="w-3.5 h-3.5" />
              <span>Directorio de trabajadores</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
              {getPageTitle()}
            </h1>
            <p className="text-slate-600 text-sm sm:text-base mt-1">
              Mostrando {filteredWorkers.length} {filteredWorkers.length === 1 ? 'especialista disponible' : 'especialistas disponibles'}
            </p>
          </div>

          {/* Quick toggle for mobile filters */}
          <div className="flex items-center gap-2 md:hidden">
            <button
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className="flex-1 py-2.5 px-4 bg-white border border-slate-200 rounded-xl font-bold text-sm text-slate-800 flex items-center justify-center gap-2 shadow-xs"
            >
              <Filter className="w-4 h-4 text-orange-600" />
              <span>Filtros { (tradeFilter || areaFilter || verifiedOnly || minExperience > 0) && '• (Activos)'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* DESKTOP & MOBILE FILTERS SIDEBAR */}
        <aside className={`lg:col-span-4 ${showMobileFilters ? 'block' : 'hidden lg:block'}`}>
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6 sticky top-28">
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="font-black text-slate-900 text-base flex items-center gap-2">
                <Filter className="w-4 h-4 text-orange-600" />
                <span className="text-[20px] font-bold">Filtros de búsqueda</span>
              </h2>
              {(tradeFilter || areaFilter || verifiedOnly || minExperience > 0) && (
                <button
                  onClick={handleResetFilters}
                  className="text-xs font-semibold text-slate-500 hover:text-orange-600 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Limpiar</span>
                </button>
              )}
            </div>

            {/* Filter 1: Oficio */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Oficio / Especialidad
              </label>
              <select
                id="filter-trade-select"
                value={tradeFilter}
                onChange={(e) => {
                  setTradeFilter(e.target.value);
                  handleFilterChange(e.target.value, areaFilter);
                }}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-medium focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="">Todos los oficios</option>
                {trades.filter((t) => t.active).map((trade) => (
                  <option key={trade.id} value={trade.name}>
                    {trade.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter 2: Zona */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Municipio o Zona
              </label>
              <select
                id="filter-area-select"
                value={areaFilter}
                onChange={(e) => {
                  setAreaFilter(e.target.value);
                  handleFilterChange(tradeFilter, e.target.value);
                }}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-medium focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="">Todas las ubicaciones</option>
                {serviceAreas.filter((a) => a.active).map((area) => (
                  <option key={area.id} value={area.name}>
                    {area.name} ({area.municipality})
                  </option>
                ))}
              </select>
            </div>

            {/* Filter 3: Solo verificados */}
            <div className="pt-2 border-t border-slate-100">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  id="filter-verified-checkbox"
                  checked={verifiedOnly}
                  onChange={(e) => setVerifiedOnly(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-orange-600 rounded border-slate-300 focus:ring-orange-500 cursor-pointer"
                />
                <div>
                  <span className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-green-600" />
                    Solo perfiles verificados
                  </span>
                  <p className="text-xs text-slate-500 mt-0.5 leading-snug">
                    Con teléfono activo, fotos de trabajos e identidad comprobada
                  </p>
                </div>
              </label>
            </div>

            {/* Filter 4: Años de experiencia */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                <span>Experiencia mínima</span>
                <span className="text-orange-600 font-bold bg-orange-50 px-2 py-0.5 rounded">
                  {minExperience === 0 ? 'Cualquiera' : `${minExperience}+ años`}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={20}
                step={2}
                value={minExperience}
                onChange={(e) => setMinExperience(Number(e.target.value))}
                className="w-full accent-orange-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>0 años</span>
                <span>10 años</span>
                <span>20+ años</span>
              </div>
            </div>

            {/* Mobile close filters button */}
            <button
              onClick={() => setShowMobileFilters(false)}
              className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold md:hidden"
            >
              Aplicar filtros ({filteredWorkers.length} resultados)
            </button>

          </div>
        </aside>

        {/* WORKER CARDS GRID */}
        <main className="lg:col-span-8">

          {/* EMPTY STATE */}
          {filteredWorkers.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 sm:p-12 text-center border border-slate-200 shadow-xs space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center mx-auto">
                <Search className="w-8 h-8" />
              </div>
              <div className="max-w-md mx-auto space-y-2">
                <h3 className="text-xl font-bold text-slate-900">
                  Todavía no encontramos un trabajador con esos filtros
                </h3>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Prueba ampliando la zona de búsqueda o eliminando el filtro de oficio para ver especialistas cercanos.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  onClick={handleResetFilters}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-black text-white font-bold text-sm rounded-xl transition-colors cursor-pointer"
                >
                  Ver todos los trabajadores
                </button>
                {areaFilter && (
                  <button
                    onClick={() => setAreaFilter('')}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-sm rounded-xl transition-colors cursor-pointer"
                  >
                    Ver en todo Querétaro
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
              {filteredWorkers.map((worker) => (
                <WorkerCatalogCard
                  key={worker.id}
                  worker={worker}
                  onOpenProfile={(w) => navigateTo({ type: 'profile', workerSlug: w.slug })}
                  onWhatsApp={handleWhatsAppContact}
                  onCall={handlePhoneCall}
                />
              ))}
            </div>
          )}

        </main>

      </div>

    </div>
  );
};
