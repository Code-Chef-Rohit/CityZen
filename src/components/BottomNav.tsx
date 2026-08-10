import { Home, Map, LayoutGrid, Siren, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';

export type Tab = 'home' | 'map' | 'explore' | 'emergency' | 'notifications';

interface BottomNavProps {
  active: Tab;
  onChange: (tab: Tab) => void;
  unreadCount?: number;
}

const tabs: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'map', label: 'Map', icon: Map },
  { id: 'explore', label: 'Explore', icon: LayoutGrid },
  { id: 'emergency', label: 'SOS', icon: Siren },
  { id: 'notifications', label: 'Alerts', icon: Bell },
];

export function BottomNav({ active, onChange, unreadCount = 0 }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-ink-100 safe-bottom">
      <div className="max-w-5xl mx-auto flex items-stretch justify-around px-1">
        {tabs.map(({ id, label, icon: Icon }) => {
          const isActive = active === id;
          const isEmergency = id === 'emergency';
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className="relative flex flex-col items-center justify-center gap-0.5 py-2.5 px-2 flex-1 transition-colors"
            >
              {isEmergency ? (
                <span
                  className={cn(
                    'relative w-11 h-11 rounded-full flex items-center justify-center -mt-3 transition-all duration-300',
                    isActive
                      ? 'bg-error-500 text-white shadow-lg shadow-error-500/40 scale-110'
                      : 'bg-error-500/10 text-error-500',
                  )}
                >
                  <Icon className="w-5 h-5" />
                </span>
              ) : (
                <span className="relative">
                  <Icon
                    className={cn(
                      'w-5 h-5 transition-colors',
                      isActive ? 'text-primary-600' : 'text-ink-400',
                    )}
                  />
                  {id === 'notifications' && unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 bg-error-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </span>
              )}
              <span
                className={cn(
                  'text-[10px] font-medium transition-colors',
                  isActive ? 'text-primary-700' : 'text-ink-400',
                  isEmergency && !isActive && 'text-error-500',
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
