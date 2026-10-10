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
        'w-full min-h-[100dvh] bg-ink-50 dark:bg-slate-950 text-ink-800 dark:text-slate-100 animate-fade-in max-w-7xl mx-auto px-0 sm:px-4 lg:px-6 py-0 lg:py-4',
        !noBottomPad && 'pb-24 lg:pb-8',
        className,
      )}
    >
      <div className="w-full bg-white dark:bg-slate-900 border-0 lg:border lg:border-slate-200/80 dark:lg:border-slate-800/80 lg:rounded-3xl lg:shadow-2xl overflow-hidden min-h-[82vh] flex flex-col justify-between">
        {children}
      </div>
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
    <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-b border-ink-100 dark:border-slate-800 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] flex items-center gap-3 transition-colors">
      {onBack && (
        <button
          onClick={onBack}
          className="w-9 h-9 -ml-1 rounded-full flex items-center justify-center text-ink-600 dark:text-slate-300 hover:bg-ink-100 dark:hover:bg-slate-800 active:scale-95 transition-all cursor-pointer shrink-0"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="text-base sm:text-lg font-bold text-ink-900 dark:text-white truncate">{title}</h1>
        {subtitle && <p className="text-[11px] sm:text-xs text-ink-500 dark:text-slate-400 truncate">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}
