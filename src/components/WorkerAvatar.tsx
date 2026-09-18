import React, { useState, useEffect } from 'react';
import { HardHat, User } from 'lucide-react';
import { getWorkerAvatarSrc } from '../types';

export interface WorkerAvatarProps {
  src?: string | null;
  worker?: {
    photoUrl?: string | null;
    fotoUrl?: string | null;
    profilePhoto?: string | null;
    profilePhotoReviewStatus?: string;
  } | null;
  allowPendingPreview?: boolean;
  previewUrl?: string | null;
  alt: string;
  size?: 'sm' | 'md' | 'lg' | 'custom';
  className?: string;
  imgClassName?: string;
  showLabel?: boolean;
  children?: React.ReactNode;
}

export const WorkerAvatar: React.FC<WorkerAvatarProps> = ({
  src,
  worker,
  allowPendingPreview = false,
  previewUrl,
  alt,
  size = 'md',
  className = '',
  imgClassName = '',
  children,
}) => {
  const resolveInitialSrc = (): string => {
    if (worker) {
      return getWorkerAvatarSrc(worker, { allowPendingPreview, previewUrl });
    }
    if (allowPendingPreview && previewUrl) {
      return previewUrl;
    }
    const cleanSrc = typeof src === 'string' ? src.trim() : '';
    if (cleanSrc.includes('default-avatar.png')) {
      return '';
    }
    return cleanSrc;
  };

  const [currentSrc, setCurrentSrc] = useState<string>(resolveInitialSrc);
  const [imageFailed, setImageFailed] = useState<boolean>(false);

  // Sync state whenever the incoming props update
  useEffect(() => {
    const nextSrc = resolveInitialSrc();
    setCurrentSrc(nextSrc);
    setImageFailed(false);
  }, [src, worker, allowPendingPreview, previewUrl]);

  // Fallback handler if remote image fails or 404s
  const handleImageError = () => {
    setImageFailed(true);
  };

  const showRealPhoto = Boolean(currentSrc && !imageFailed);

  // Size dimensions
  let sizeClasses = '';
  let iconSize = 'w-9 h-9';
  let helmetSize = 'w-5 h-5';

  switch (size) {
    case 'sm':
      sizeClasses = 'w-10 h-10 rounded-xl';
      iconSize = 'w-5 h-5';
      helmetSize = 'w-3.5 h-3.5';
      break;
    case 'lg':
      sizeClasses = 'w-28 h-28 sm:w-36 sm:h-36 rounded-2xl';
      iconSize = 'w-16 h-16 sm:w-20 sm:h-20';
      helmetSize = 'w-9 h-9 sm:w-11 sm:h-11';
      break;
    case 'custom':
      sizeClasses = '';
      iconSize = 'w-1/2 h-1/2';
      helmetSize = 'w-1/3 h-1/3';
      break;
    case 'md':
    default:
      sizeClasses = 'w-20 h-20 sm:w-24 sm:h-24 rounded-2xl';
      iconSize = 'w-10 h-10 sm:w-12 sm:h-12';
      helmetSize = 'w-6 h-6 sm:w-7 sm:h-7';
      break;
  }

  return (
    <div
      className={`relative overflow-hidden shrink-0 border-2 border-slate-200 shadow-xs select-none ${
        showRealPhoto ? 'bg-slate-100' : 'bg-gradient-to-b from-amber-50 to-slate-100'
      } ${sizeClasses} ${className}`}
      title={alt}
    >
      {showRealPhoto ? (
        <img
          src={currentSrc}
          alt={alt}
          onError={handleImageError}
          className={`w-full h-full object-cover ${imgClassName}`}
        />
      ) : (
        /* Neutral worker avatar: User figure with construction HardHat */
        <div className="w-full h-full flex flex-col items-center justify-center relative text-amber-700/80">
          <div className="relative flex items-center justify-center">
            <User className={`${iconSize} text-slate-400 stroke-[1.8]`} />
            <div className="absolute -top-1.5 flex items-center justify-center text-amber-500 drop-shadow-xs">
              <HardHat className={`${helmetSize} stroke-[2.2] fill-amber-400/30`} />
            </div>
          </div>
        </div>
      )}

      {/* Optional overlays, spinners or buttons rendered inside */}
      {children}
    </div>
  );
};
