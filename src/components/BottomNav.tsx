import { Home, Map, LayoutGrid, Siren, Bell, AlertCircle, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';

export type Tab = 'home' | 'explore' | 'emergency' | 'complaints' | 'bills' | 'map' | 'notifications';

interface BottomNavProps {
  active: Tab;
  onChange: (tab: Tab) => void;
  unreadCount?: number;
}

const tabs: { id: Tab; label: string; icon: any }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'explore', label: 'Services', icon: LayoutGrid },
  { id: 'emergency', label: 'SOS', icon: Siren },
  { id: 'complaints', label: 'Complaints', icon: AlertCircle },
  { id: 'bills', label: 'Bills', icon: CreditCard },
];

export function BottomNav({ active, onChange, unreadCount = 0 }: BottomNavProps) {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-ink-100 dark:border-slate-800 pb-[max(0.35rem,env(safe-area-inset-bottom))] shadow-lg transition-colors">
      <div className="max-w-5xl mx-auto flex items-stretch justify-around px-1">
        {tabs.map(({ id, label, icon: Icon }) => {
          const isActive = active === id;
          const isEmergency = id === 'emergency';
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className="relative flex flex-col items-center justify-center gap-0.5 py-2 px-1 sm:px-2 flex-1 transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[48px]"
            >
              {isEmergency ? (
                <span
                  className={cn(
                    'relative w-11 h-11 rounded-full flex items-center justify-center -mt-3.5 transition-all duration-300',
                    isActive
                      ? 'bg-error-500 text-white shadow-lg shadow-error-500/40 scale-110'
                      : 'bg-error-500/15 text-error-500 hover:bg-error-500/25',
                  )}
                >
                  <Icon className="w-5 h-5" />
                </span>
              ) : (
                <span className="relative">
                  <Icon
                    className={cn(
                      'w-5 h-5 transition-transform duration-200',
                      isActive ? 'text-primary-600 dark:text-primary-400 scale-110' : 'text-ink-400 dark:text-slate-400',
                    )}
                  />
                  {id === 'notifications' && unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 bg-error-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </span>
              )}
              <span
                className={cn(
                  'text-[10px] font-semibold transition-colors',
                  isActive ? 'text-primary-700 dark:text-primary-400 font-bold' : 'text-ink-500 dark:text-slate-400',
                  isEmergency && !isActive && 'text-error-500 font-bold',
                )}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
