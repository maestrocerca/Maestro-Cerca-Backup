import React from 'react';
import { MapPin, CheckCircle2, ChevronRight, Users } from 'lucide-react';
import { Worker } from '../types';
import { WorkerAvatar } from './WorkerAvatar';

export interface WorkerCatalogCardProps {
  worker: Worker;
  onOpenProfile: (worker: Worker) => void;
}

/**
 * Full catalog card (search / directory grid): same visual language as the homepage
 * WorkerMarketplaceCard (photo-dominant, name overlay), extended with a description
 * snippet and a contact count so visitors can compare workers at a glance.
 * Contact actions (WhatsApp/Llamar) live on the full profile page, not here.
 */
export const WorkerCatalogCard: React.FC<WorkerCatalogCardProps> = ({ worker, onOpenProfile }) => {
  const isVerified = worker.verificationStatus === 'verified' || worker.verificado === true;

  const workPhotoList = (worker.workPhotos && worker.workPhotos.length > 0)
    ? worker.workPhotos
    : (worker.fotosTrabajos && worker.fotosTrabajos.length > 0)
      ? worker.fotosTrabajos.map((url, idx) => ({ id: `ft-${idx}`, url, title: 'Trabajo realizado' }))
      : [];
  const heroPhotoUrl = workPhotoList[0]?.url || '';

  const fullName = worker.nombre || `${worker.firstName || ''} ${worker.lastName || ''}`.trim() || 'Maestro';
  const oficio = worker.mainTrade || worker.oficio || 'Especialista';
  const zone = (worker.serviceAreas && worker.serviceAreas[0]) || '';
  const description = worker.description || worker.bio || '';
  const topServices = (worker.services && worker.services.length > 0) ? worker.services.slice(0, 3) : [];
  const contactCount = worker.contactCount || 0;

  return (
    <div
      id={`catalog-card-${worker.slug}`}
      onClick={() => onOpenProfile(worker)}
      className="group bg-white rounded-3xl border border-slate-200 hover:border-orange-300 hover:shadow-xl shadow-slate-200/40 transition-all duration-200 cursor-pointer overflow-hidden flex flex-col"
    >
      {/* Photo block */}
      <div className="relative w-full aspect-[4/3] bg-slate-100 overflow-hidden">
        {heroPhotoUrl ? (
          <img
            src={heroPhotoUrl}
            alt={`Trabajo de ${fullName}`}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
          />
        ) : (
          <WorkerAvatar
            worker={worker}
            alt={fullName}
            size="custom"
            className="w-full h-full !rounded-none [&_svg]:!w-16 [&_svg]:!h-16"
          />
        )}

        <div className="absolute top-3 left-3 flex items-center gap-1.5">
          {isVerified ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/95 text-green-700 text-[11px] font-bold shadow-sm">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
              Verificado
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/90 text-slate-600 text-[11px] font-semibold shadow-sm">
              Registrado
            </span>
          )}
        </div>

        {contactCount > 0 && (
          <div className="absolute top-3 right-3">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/90 text-slate-700 text-[11px] font-bold shadow-sm">
              <Users className="w-3.5 h-3.5 text-slate-500" />
              {contactCount}
            </span>
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent p-4 pt-10">
          <h3 className="text-white font-black text-lg leading-tight drop-shadow-sm">{fullName}</h3>
          {zone && (
            <p className="text-white/90 text-xs font-medium flex items-center gap-1 mt-0.5">
              <MapPin className="w-3.5 h-3.5" />
              <span>{zone}</span>
            </p>
          )}
        </div>
      </div>

      {/* Info block */}
      <div className="p-4 sm:p-5 space-y-2.5 flex-1 flex flex-col">
        <p className="text-orange-600 font-bold text-sm">
          {oficio}
          {typeof worker.yearsExperience === 'number' && worker.yearsExperience > 0 && (
            <span className="text-slate-500 font-semibold"> · {worker.yearsExperience} años de experiencia</span>
          )}
        </p>

        {topServices.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {topServices.map((service, idx) => (
              <span key={idx} className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-semibold">
                {service}
              </span>
            ))}
          </div>
        )}

        {description && (
          <p className="text-slate-600 text-xs sm:text-sm line-clamp-2 leading-relaxed">
            {description}
          </p>
        )}

        <div className="flex-1" />

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenProfile(worker);
          }}
          className="w-full mt-1 py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>Ver perfil completo</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
