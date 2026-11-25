import React from 'react';

interface CityZenLogoProps {
  variant?: 'full' | 'icon' | 'badge';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showSubtitle?: boolean;
}

export const CityZenLogo: React.FC<CityZenLogoProps> = ({
  variant = 'full',
  size = 'md',
  className = '',
  showSubtitle = true,
}) => {
  // Size dimensions for icon
  const iconDimensions = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  }[size];

  const titleSizes = {
    xs: 'text-sm',
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-xl',
    xl: 'text-2xl',
  }[size];

  const iconElement = (
    <div
      className={`${iconDimensions} rounded-xl overflow-hidden shadow-md shadow-sky-500/20 border border-sky-400/30 shrink-0 bg-slate-900 flex items-center justify-center relative group-hover:scale-105 transition-transform duration-300`}
    >
      <img
        src="/logo.png"
        alt="CityZen Logo"
        className="w-full h-full object-cover"
        onError={(e) => {
          // Graceful fallback to SVG icon if PNG is loading
          (e.currentTarget as HTMLImageElement).src = '/logo-icon.svg';
        }}
      />
    </div>
  );

  if (variant === 'icon') {
    return <div className={`inline-flex items-center ${className}`}>{iconElement}</div>;
  }

  return (
    <div className={`inline-flex items-center gap-2.5 sm:gap-3 ${className}`}>
      {iconElement}
      <div className="flex flex-col">
        <span
          className={`font-black ${titleSizes} tracking-tight bg-gradient-to-r from-slate-900 via-sky-900 to-slate-800 dark:from-white dark:via-sky-200 dark:to-slate-200 bg-clip-text text-transparent leading-none`}
        >
          City<span className="text-orange-500">Zen</span>
        </span>
        {showSubtitle && (
          <span className="text-[9px] sm:text-[10px] font-extrabold tracking-wider uppercase text-sky-600 dark:text-sky-400 mt-0.5 leading-none">
            Bhubaneswar Smart City
          </span>
        )}
      </div>
    </div>
  );
};

export default CityZenLogo;
