import React, { useState, useEffect } from 'react';
import { getWorkerAvatarSrc } from '../types';

const DEFAULT_AVATAR_SRC = '/images/default-avatar.webp';

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
      return getWorkerAvatarSrc(worker, { allowPendingPreview, previewUrl }) || DEFAULT_AVATAR_SRC;
    }
    if (allowPendingPreview && previewUrl) {
      return previewUrl;
    }
    const cleanSrc = typeof src === 'string' ? src.trim() : '';
    if (!cleanSrc || cleanSrc.includes('default-avatar.png')) {
      return DEFAULT_AVATAR_SRC;
    }
    return cleanSrc;
  };

  const [currentSrc, setCurrentSrc] = useState<string>(resolveInitialSrc);

  // Sync state whenever the incoming props update
  useEffect(() => {
    setCurrentSrc(resolveInitialSrc());
  }, [src, worker, allowPendingPreview, previewUrl]);

  // If the real photo fails to load, fall back to the generic avatar
  const handleImageError = () => {
    if (currentSrc !== DEFAULT_AVATAR_SRC) {
      setCurrentSrc(DEFAULT_AVATAR_SRC);
    }
  };

  // Size dimensions
  let sizeClasses = '';

  switch (size) {
    case 'sm':
      sizeClasses = 'w-10 h-10 rounded-xl';
      break;
    case 'lg':
      sizeClasses = 'w-28 h-28 sm:w-36 sm:h-36 rounded-2xl';
      break;
    case 'custom':
      sizeClasses = '';
      break;
    case 'md':
    default:
      sizeClasses = 'w-20 h-20 sm:w-24 sm:h-24 rounded-2xl';
      break;
  }

  return (
    <div
      className={`relative overflow-hidden shrink-0 border-2 border-slate-200 shadow-xs select-none bg-slate-100 ${sizeClasses} ${className}`}
      title={alt}
    >
      <img
        src={currentSrc}
        alt={alt}
        onError={handleImageError}
        className={`w-full h-full object-cover ${imgClassName}`}
      />

      {/* Optional overlays, spinners or buttons rendered inside */}
      {children}
    </div>
  );
};
