import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ScreenProps {
  children: ReactNode;
  className?: string;
  noBottomPad?: boolean;
}

export function Screen({ children, className, noBottomPad }: ScreenProps) {
  return (
    <div
      className={cn(
        'min-h-screen md:min-h-0 md:h-[calc(100vh-3rem)] w-full md:max-w-5xl mx-auto bg-ink-50 md:shadow-2xl md:my-6 md:rounded-3xl overflow-y-auto border border-slate-800/40 animate-fade-in',
        !noBottomPad && 'pb-24',
        className,
      )}
    >
      {children}
    </div>
  );
}

interface HeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
}

export function ScreenHeader({ title, subtitle, onBack, right }: HeaderProps) {
  return (
    <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-lg border-b border-ink-100 px-4 py-3 flex items-center gap-3">
      {onBack && (
        <button
          onClick={onBack}
          className="w-9 h-9 -ml-1 rounded-full flex items-center justify-center text-ink-600 hover:bg-ink-100 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="text-lg font-bold text-ink-900 truncate">{title}</h1>
        {subtitle && <p className="text-xs text-ink-500 truncate">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}
