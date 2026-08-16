import { type ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-ink-900/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div
        className={cn(
          'relative w-full sm:max-w-md bg-white dark:bg-slate-900 dark:text-slate-100 rounded-t-[2rem] sm:rounded-3xl shadow-2xl animate-slide-up sm:animate-scale-in max-h-[92vh] sm:max-h-[85vh] overflow-y-auto no-scrollbar pb-[max(1.25rem,env(safe-area-inset-bottom))] border-t sm:border border-ink-100 dark:border-slate-800',
          className,
        )}
      >
        {/* Mobile drag handle bar */}
        <div className="pt-2.5 pb-1 sm:hidden flex justify-center cursor-pointer" onClick={onClose}>
          <div className="w-10 h-1.5 bg-ink-200 dark:bg-slate-700 rounded-full" />
        </div>

        {title && (
          <div className="sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-5 pt-3 pb-3 flex items-center justify-between border-b border-ink-100 dark:border-slate-800">
            <h2 className="text-base sm:text-lg font-bold text-ink-900 dark:text-white truncate pr-2">{title}</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-ink-100 dark:bg-slate-800 flex items-center justify-center text-ink-500 dark:text-slate-400 hover:bg-ink-200 dark:hover:bg-slate-700 active:scale-95 transition-all cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="p-4 sm:p-5">{children}</div>
      </div>
    </div>
  );
}
