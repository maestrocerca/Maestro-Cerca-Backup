import React from 'react';

interface BrandLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'icon' | 'stacked' | 'logotipo' | 'image';
  textColor?: 'dark' | 'light' | 'auto';
  showSubtitle?: boolean;
}

// Brand Assets Paths from uploaded files
export const BRAND_ASSET_PROFILE_ICON = '/Foto%20de%20perfil%20Oficial.jpg';
export const BRAND_ASSET_FULL_LOGO = '/Logotipo%20V1.jpg';

/**
 * Standalone Isotipo / Brand Icon using official "Foto de perfil Oficial.jpg"
 */
export const BrandLogoIcon: React.FC<{ 
  className?: string; 
  size?: number;
  alt?: string;
}> = ({ 
  className = '', 
  size = 40,
  alt = 'Maestro Cerca Logo',
}) => {
  return (
    <img
      src={BRAND_ASSET_PROFILE_ICON}
      alt={alt}
      width={size}
      height={size}
      style={{ width: `${size}px`, height: `${size}px` }}
      className={`shrink-0 object-contain select-none ${className}`}
      loading="eager"
      decoding="async"
    />
  );
};

/**
 * Full Brand Display using "Logotipo V1.jpg"
 */
export const BrandLogoFullImage: React.FC<{
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  height?: number;
  alt?: string;
}> = ({
  className = '',
  size = 'md',
  height,
  alt = 'Maestro Cerca',
}) => {
  const heightMap = {
    sm: 32,
    md: 40,
    lg: 48,
    xl: 60,
  };
  const targetHeight = height || heightMap[size];

  return (
    <img
      src={BRAND_ASSET_FULL_LOGO}
      alt={alt}
      style={{ height: `${targetHeight}px`, width: 'auto' }}
      className={`object-contain max-w-full select-none ${className}`}
      loading="eager"
      decoding="async"
    />
  );
};

export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = '',
  size = 'md',
  variant = 'full',
  textColor = 'dark',
  showSubtitle = false,
}) => {
  // Sizing map
  const iconSizes = {
    sm: 32,
    md: 40,
    lg: 48,
    xl: 60,
  };

  const textSizes = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-2xl',
    xl: 'text-3xl sm:text-4xl',
  };

  const iconPx = iconSizes[size];

  // Official Brand Navy Color: #0E0E55 for light/auto backgrounds, pure white for dark backgrounds
  const isDarkText = textColor === 'dark' || textColor === 'auto';
  const mainTextColor = isDarkText ? 'text-[#0E0E55]' : 'text-white';
  const subTextColor = isDarkText ? 'text-slate-500' : 'text-slate-300';

  if (variant === 'icon') {
    return <BrandLogoIcon size={iconPx} className={className} />;
  }

  if (variant === 'logotipo' || variant === 'image') {
    return <BrandLogoFullImage size={size} className={className} />;
  }

  if (variant === 'stacked') {
    return (
      <div className={`flex flex-col items-center text-center gap-2 ${className}`}>
        <BrandLogoIcon size={iconPx * 1.3} />
        <div>
          <span className={`font-black tracking-tight ${textSizes[size]} ${mainTextColor} block leading-tight font-sans`}>
            Maestro Cerca
          </span>
          {showSubtitle && (
            <span className={`text-xs font-semibold ${subTextColor} block mt-0.5 tracking-wide uppercase`}>
              Oficios de Confianza
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2.5 sm:gap-3 group ${className}`}>
      <BrandLogoIcon size={iconPx} className="transition-transform group-hover:scale-105 duration-200" />
      <div className="flex flex-col justify-center leading-none">
        <div className="flex flex-col">
          <span className={`font-black tracking-tight ${textSizes[size]} ${mainTextColor} leading-tight font-sans`}>
            Maestro Cerca
          </span>
        </div>
        {showSubtitle && (
          <span className={`text-[10px] sm:text-xs font-bold ${subTextColor} tracking-wider uppercase mt-0.5`}>
            Querétaro
          </span>
        )}
      </div>
    </div>
  );
};
