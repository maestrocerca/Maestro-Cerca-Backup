import React, { useState, useMemo } from 'react';
import { 
  Search, 
  MapPin, 
  ShieldCheck, 
  Award, 
  Phone, 
  MessageCircle, 
  Filter, 
  RotateCcw, 
  ChevronRight, 
  CheckCircle2, 
  Clock, 
  Briefcase, 
  ImageIcon,
  Sparkles,
  UserCheck,
  User,
  Wrench
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { Worker, isPubliclyVisible } from '../types';
import { WorkerAvatar } from './WorkerAvatar';

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

  // Update filters when props change
  React.useEffect(() => {
    if (initialTrade) setTradeFilter(initialTrade);
    if (initialArea) setAreaFilter(initialArea);
    if (initialVerifiedOnly) setVerifiedOnly(initialVerifiedOnly);
  }, [initialTrade, initialArea, initialVerifiedOnly]);

  const handleFilterChange = (trade: string, area: string) => {
    trackSearch(trade || undefined, area || undefined);
  };

  // Filter and sort workers
  const filteredWorkers = useMemo(() => {
    return workers
      .filter((w) => {
        // Canonical public visibility check (approved, available, onboarding complete, not draft)
        if (!isPubliclyVisible(w)) return false;

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

        {/* WORKER CARDS LIST */}
        <main className="lg:col-span-8 space-y-4">
          
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
            filteredWorkers.map((worker) => {
              const isVerified = worker.verificationStatus === 'verified' || worker.verificado === true;
              const workPhotoList = (worker.workPhotos && worker.workPhotos.length > 0)
                ? worker.workPhotos
                : (worker.fotosTrabajos && worker.fotosTrabajos.length > 0)
                  ? worker.fotosTrabajos.map((url, idx) => ({ id: `ft-${idx}`, url, title: 'Trabajo realizado' }))
                  : [];
              const hasWorkPhotos = workPhotoList.length > 0;
              const servicesList = worker.services && worker.services.length > 0 ? worker.services : [];
              const maxVisibleServices = 4;
              const visibleServices = servicesList.slice(0, maxVisibleServices);
              const remainingServicesCount = servicesList.length - maxVisibleServices;

              return (
                <div
                  key={worker.id}
                  id={`worker-card-${worker.slug}`}
                  onClick={() => navigateTo({ type: 'profile', workerSlug: worker.slug })}
                  className={`bg-white rounded-2xl p-4 sm:p-6 border transition-all duration-200 cursor-pointer group hover:shadow-md ${
                    isVerified 
                      ? 'border-slate-200 hover:border-green-500 ring-1 ring-green-500/10' 
                      : 'border-slate-200 hover:border-slate-400'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
                    
                    {/* Worker Avatar & Status Badge */}
                    <div className="relative shrink-0 flex items-center sm:block w-[150px] h-[150px] pl-[1px] ml-0 mt-[70px]">
                      <div className="w-[150px] h-[150px] pl-[25px]">
                        <WorkerAvatar
                          worker={worker}
                          alt={worker.nombre || `${worker.firstName} ${worker.lastName}`}
                          size="custom"
                          className="w-[92px] h-[92px] pl-0 rounded-2xl [&_svg]:!w-[120px] [&_svg]:!h-[120px]"
                        />
                      </div>

                      {/* Mobile Status Badge */}
                      <div className="sm:hidden ml-3">
                        {isVerified ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-green-100 text-green-700 text-xs font-bold border border-green-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                            <span>Verificado</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 text-xs font-medium border border-slate-200">
                            <span>Registrado</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Worker Main Info */}
                    <div className="flex-1 min-w-0 space-y-3">
                      
                      {/* 1. Name & Main Trade & Status */}
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h3 className="text-[24px] font-black text-slate-900 group-hover:text-orange-600 transition-colors">
                            {worker.firstName} {worker.lastName}
                          </h3>
                          <p className="text-[19px] font-bold text-orange-600 mt-0.5">
                            {worker.mainTrade}
                            {worker.secondaryTrades && worker.secondaryTrades.length > 0 && (
                              <span className="text-slate-500 font-normal text-xs ml-1.5">
                                • También: {worker.secondaryTrades.join(', ')}
                              </span>
                            )}
                          </p>
                        </div>

                        {/* Desktop Verification Badge */}
                        <div className="hidden sm:block">
                          {isVerified ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-100 text-green-700 text-[16px] font-bold border border-green-200 shadow-xs">
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                              Verificado por Maestro Cerca
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[16px] font-medium border border-slate-200">
                              Registrado en Maestro Cerca
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 2. PRIORITY SECTION: TRABAJOS QUE REALIZA */}
                      {servicesList.length > 0 && (
                        <div className="space-y-1.5 ml-0 pt-[4px] mb-[11px]">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                            Trabajos que realiza:
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {visibleServices.map((service, idx) => (
                              <span
                                key={idx}
                                className="px-2.5 py-1 rounded-lg bg-orange-50/80 text-orange-950 font-semibold text-xs border border-orange-200/70"
                              >
                                {service}
                              </span>
                            ))}
                            {remainingServicesCount > 0 && (
                              <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-600 font-bold text-xs border border-slate-200">
                                +{remainingServicesCount} más
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* 3. Secondary Info: Experience & Zones */}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 pt-0.5">
                        <div className="flex items-center gap-1 font-medium bg-slate-100 px-2.5 py-1 rounded-md">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          <span>{worker.yearsExperience} años de experiencia</span>
                        </div>

                        <div className="flex items-center gap-1 font-medium text-slate-600">
                          <MapPin className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                          <span className="line-clamp-1">
                            {worker.serviceAreas.slice(0, 3).join(', ')}
                            {worker.serviceAreas.length > 3 && ` +${worker.serviceAreas.length - 3}`}
                          </span>
                        </div>
                      </div>

                      {/* 4. Description snippet */}
                      <p className="text-xs sm:text-sm text-slate-600 line-clamp-2 leading-relaxed">
                        {worker.description}
                      </p>

                      {/* 5. Work photo thumbnails */}
                      {hasWorkPhotos && (
                        <div className="flex items-center gap-2 pt-1">
                          {workPhotoList.slice(0, 2).map((photo) => (
                            <div key={photo.id} className="relative group/photo">
                              <img
                                src={photo.url}
                                alt={photo.title || 'Trabajo realizado'}
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                                className="w-16 h-12 sm:w-20 sm:h-14 rounded-lg object-cover border border-slate-200 shadow-xs"
                              />
                            </div>
                          ))}
                          {workPhotoList.length > 2 && (
                            <span className="text-[11px] font-semibold text-slate-500 pl-1">
                              +{workPhotoList.length - 2} fotos más
                            </span>
                          )}
                        </div>
                      )}

                      {/* 6. Action Buttons Row */}
                      <div className="pt-0 flex flex-wrap items-center gap-2 sm:gap-3 border-t border-slate-100">
                        {/* Primary WhatsApp CTA */}
                        <button
                          type="button"
                          onClick={(e) => handleWhatsAppContact(worker, e)}
                          className="flex-1 sm:flex-none py-2.5 px-4 bg-green-600 hover:bg-green-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span>Contactar por WhatsApp</span>
                        </button>

                        {/* Phone CTA */}
                        <button
                          type="button"
                          onClick={(e) => handlePhoneCall(worker, e)}
                          className="py-2.5 px-3.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs sm:text-sm rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Phone className="w-4 h-4 text-slate-600" />
                          <span>Llamar</span>
                        </button>

                        {/* View profile button */}
                        <button
                          type="button"
                          onClick={() => navigateTo({ type: 'profile', workerSlug: worker.slug })}
                          className="py-2.5 px-3.5 text-slate-700 hover:text-slate-900 font-bold text-xs sm:text-sm hover:bg-slate-100 rounded-xl transition-colors ml-auto flex items-center gap-1 cursor-pointer"
                        >
                          <span className="text-[15px]">Ver perfil completo</span>
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        </button>
                      </div>

                    </div>

                  </div>
                </div>
              );
            })
          )}

        </main>

      </div>

    </div>
  );
};
