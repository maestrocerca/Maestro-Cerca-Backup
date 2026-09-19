import React from 'react';
import { MapPin, CheckCircle2, Images } from 'lucide-react';
import { Worker } from '../types';
import { WorkerAvatar } from './WorkerAvatar';

export interface WorkerMarketplaceCardProps {
  worker: Worker;
  onOpen: (worker: Worker) => void;
}

/**
 * Big, marketplace-style worker card for the homepage listing (superprof.mx-inspired):
 * the photo dominates the card (~2/3 of its height) and a compact info block with a
 * large "ver fotos de trabajos" CTA sits below it (~1/3).
 */
export const WorkerMarketplaceCard: React.FC<WorkerMarketplaceCardProps> = ({ worker, onOpen }) => {
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

  return (
    <div
      id={`marketplace-card-${worker.slug}`}
      onClick={() => onOpen(worker)}
      className="group bg-white rounded-3xl border border-slate-200 hover:border-orange-300 hover:shadow-xl shadow-slate-200/40 transition-all duration-200 cursor-pointer overflow-hidden flex flex-col"
    >
      {/* Photo block: ~2/3 of the card */}
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

        {/* Verification badge overlay */}
        <div className="absolute top-3 left-3">
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

        {/* Name overlay on the photo, superprof-style */}
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

      {/* Info block: ~1/3 of the card */}
      <div className="p-4 sm:p-5 space-y-2.5 flex-1 flex flex-col">
        <p className="text-orange-600 font-bold text-sm">{oficio}</p>

        {description && (
          <p className="text-slate-600 text-xs sm:text-sm line-clamp-2 leading-relaxed flex-1">
            {description}
          </p>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(worker);
          }}
          className="w-full mt-1 py-3.5 px-4 bg-slate-900 group-hover:bg-orange-600 text-white font-bold text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
        >
          <Images className="w-4.5 h-4.5" />
          <span>Ver fotos de trabajos</span>
        </button>
      </div>
    </div>
  );
};
