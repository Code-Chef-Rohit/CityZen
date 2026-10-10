import { 
  Home, Map, LayoutGrid, Siren, Bell, Sparkles, User, LogOut, 
  CreditCard, AlertCircle, Shield, Sun, Moon, MapPin 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';

export type Tab = 'home' | 'map' | 'explore' | 'emergency' | 'notifications' | 'complaints' | 'bills' | 'zen' | 'profile';

interface DesktopNavbarProps {
  currentScreen: string;
  onNavigate: (screen: { name: string; [key: string]: any }) => void;
  unreadCount?: number;
}

export function DesktopNavbar({ currentScreen, onNavigate, unreadCount = 0 }: DesktopNavbarProps) {
  const { profile, session, signOut } = useAuth();
  const rawName = profile?.full_name || session?.user?.user_metadata?.full_name || 'Citizen';
  const firstName = rawName.trim().split(' ')[0] || 'Citizen';

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'map', label: 'Smart Map', icon: Map },
    { id: 'explore', label: 'Services & DigiLocker', icon: LayoutGrid },
    { id: 'complaints', label: 'Complaints', icon: AlertCircle },
    { id: 'bills', label: 'Bills & Taxes', icon: CreditCard },
    { id: 'emergency', label: 'SOS Emergency', icon: Siren, highlight: true },
    { id: 'zen', label: 'Zen AI', icon: Sparkles, badge: 'AI' },
  ];

  return (
    <header className="hidden lg:block sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800 shadow-sm transition-colors">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand Logo & Title */}
        <button
          onClick={() => onNavigate({ name: 'home' })}
          className="flex items-center gap-3 hover:opacity-90 transition-opacity cursor-pointer shrink-0"
        >
          <div className="w-10 h-10 rounded-xl border border-white/20 overflow-hidden shadow-md shrink-0">
            <img src="/logo.jpg" alt="CityZen Logo" className="w-full h-full object-cover" />
          </div>
          <div className="text-left">
            <h1 className="font-black text-lg text-slate-900 dark:text-white tracking-tight leading-none flex items-center gap-1.5">
              CityZen <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-500/20 font-bold">OS v2.5</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Smart Municipal Operating System</p>
          </div>
        </button>

        {/* Center Desktop Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-slate-100/80 dark:bg-slate-950/80 p-1 rounded-2xl border border-slate-200/60 dark:border-slate-800/80">
          {navItems.map(({ id, label, icon: Icon, highlight, badge }) => {
            const isActive = currentScreen === id;
            return (
              <button
                key={id}
                onClick={() => onNavigate({ name: id })}
                className={cn(
                  'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap',
                  highlight
                    ? isActive 
                      ? 'bg-red-600 text-white shadow-md shadow-red-600/30' 
                      : 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20'
                    : isActive
                      ? 'bg-white dark:bg-slate-800 text-primary-600 dark:text-primary-400 shadow-sm border border-slate-200/60 dark:border-slate-700'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-900/60 hover:text-slate-900 dark:hover:text-white'
                )}
              >
                <Icon className={cn("w-4 h-4", highlight && !isActive && "animate-pulse")} />
                <span>{label}</span>
                {badge && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-primary-500/20 text-primary-600 dark:text-primary-400 font-mono font-bold">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right Desktop User Tools */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => onNavigate({ name: 'notifications' })}
            className="relative w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 transition-all cursor-pointer shadow-sm border border-slate-200/60 dark:border-slate-700"
            title="Civic Alerts & Notifications"
          >
            <Bell className="w-4.5 h-4.5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Profile Identity Button */}
          <button
            onClick={() => onNavigate({ name: 'profile' })}
            className={cn(
              'flex items-center gap-2.5 px-3 py-1.5 rounded-xl border transition-all cursor-pointer shadow-sm',
              currentScreen === 'profile'
                ? 'bg-primary-50 dark:bg-primary-950/40 border-primary-500/40 text-primary-600 dark:text-primary-400'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-800 dark:text-white'
            )}
          >
            <div className="w-7 h-7 rounded-lg bg-primary-600 text-white font-bold flex items-center justify-center text-xs shadow-sm">
              {firstName[0].toUpperCase()}
            </div>
            <div className="text-left hidden xl:block">
              <p className="text-xs font-bold leading-none">{firstName}</p>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">Ward {profile?.ward ?? 12}</p>
            </div>
          </button>
        </div>
      </div>
    </header>
  );
}
