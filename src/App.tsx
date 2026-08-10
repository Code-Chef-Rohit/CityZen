import { useEffect, useState } from 'react';
import { User, KeyRound } from 'lucide-react';
import { AuthProvider, useAuth } from '@/lib/auth';
import { BottomNav, type Tab } from '@/components/BottomNav';
import { Splash } from '@/screens/Splash';
import { Auth } from '@/screens/Auth';
import { Home } from '@/screens/Home';
import { Explore, ServiceDetail } from '@/screens/Explore';
import { SmartMap } from '@/screens/SmartMap';
import { Complaints } from '@/screens/Complaints';
import { Bills } from '@/screens/Bills';
import { Emergency } from '@/screens/Emergency';
import { ZenAI } from '@/screens/ZenAI';
import { Notifications, Profile } from '@/screens/Profile';
import MerchantDashboard from '@/screens/MerchantDashboard';
import AdminDashboard from '@/screens/AdminDashboard';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

type Screen =
  | { name: 'home' }
  | { name: 'map' }
  | { name: 'explore' }
  | { name: 'emergency' }
  | { name: 'notifications' }
  | { name: 'profile' }
  | { name: 'zen' }
  | { name: 'complaints' }
  | { name: 'bills' }
  | { name: 'service'; id: string };

function AppContent() {
  const { session, loading, profile, signOut } = useAuth();
  const [showSplash, setShowSplash] = useState(true);
  const [screen, setScreen] = useState<Screen>({ name: 'home' });

  // Password Recovery Flow States
  const [isRecovery, setIsRecovery] = useState(false);
  const [recoveryPassword, setRecoveryPassword] = useState('');
  const [confirmRecoveryPassword, setConfirmRecoveryPassword] = useState('');
  const [recovering, setRecovering] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  useEffect(() => {
    // Check if recovery parameter is present in redirect URL hash
    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
      setIsRecovery(true);
    }
  }, []);

  const handleCompleteRecovery = async () => {
    if (recoveryPassword.length < 6) {
      setRecoveryError("Password must be at least 6 characters!");
      return;
    }
    if (recoveryPassword !== confirmRecoveryPassword) {
      setRecoveryError("Passwords do not match!");
      return;
    }
    setRecovering(true);
    setRecoveryError(null);
    const { error } = await supabase.auth.updateUser({ password: recoveryPassword });
    setRecovering(false);
    if (error) {
      setRecoveryError(error.message);
    } else {
      alert("Password updated successfully! Welcome back.");
      setIsRecovery(false);
      window.location.hash = ''; // clear hash
    }
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center mb-4 text-orange-400 border border-orange-500/25">
          <KeyRound className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-extrabold text-white">Backend Not Connected</h1>
        <p className="text-sm text-slate-400 mt-2 max-w-sm">
          This app needs a Supabase project to sign users in and store data. Add
          {' '}<code className="text-orange-300">VITE_SUPABASE_URL</code> and{' '}
          <code className="text-orange-300">VITE_SUPABASE_ANON_KEY</code> under
          Site configuration → Environment variables in Netlify, then redeploy.
        </p>
      </div>
    );
  }

  if (isRecovery) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center mb-4 text-orange-400 border border-orange-500/25">
          <KeyRound className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-extrabold text-white">Create New Password</h1>
        <p className="text-xs text-slate-400 mt-2 max-w-sm">
          Please enter your new secure password below to regain access to your account.
        </p>
        
        <div className="w-full max-w-xs mt-6 space-y-4 text-left">
          <div>
            <label className="text-[10px] font-bold text-slate-400 block mb-1.5 uppercase tracking-wider">New Password</label>
            <input
              type="password"
              placeholder="Min 6 characters"
              value={recoveryPassword}
              onChange={(e) => setRecoveryPassword(e.target.value)}
              className="w-full px-4 py-3 bg-slate-900 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-primary-500 text-white"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 block mb-1.5 uppercase tracking-wider">Confirm Password</label>
            <input
              type="password"
              placeholder="Re-enter password"
              value={confirmRecoveryPassword}
              onChange={(e) => setConfirmRecoveryPassword(e.target.value)}
              className="w-full px-4 py-3 bg-slate-900 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-primary-500 text-white"
            />
          </div>

          {recoveryError && (
            <div className="text-xs text-red-400 bg-red-500/10 rounded-xl px-4 py-2 border border-red-500/15">
              {recoveryError}
            </div>
          )}

          <button
            onClick={handleCompleteRecovery}
            disabled={recovering}
            className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50"
          >
            {recovering ? 'Updating...' : 'Set Password'}
          </button>
        </div>
      </div>
    );
  }

  if (showSplash) return <Splash onDone={() => setShowSplash(false)} />;
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink-50">
        <div className="w-8 h-8 border-3 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!session) return <Auth />;

  if (profile?.blocked) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4 text-red-500 border border-red-500/25">
          <User className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-extrabold text-red-400">Account Suspended</h1>
        <p className="text-sm text-slate-400 mt-2 max-w-sm">
          Your account has been suspended by the city municipal administration. Please contact your ward supervisor or file an appeal for assistance.
        </p>
        <button
          onClick={() => signOut()}
          className="mt-6 px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
        >
          Sign Out & Exit
        </button>
      </div>
    );
  }

  if (profile?.role === 'business') {
    return <MerchantDashboard />;
  }

  if (profile?.role === 'admin') {
    return <AdminDashboard />;
  }

  const tabMap: Record<Tab, Screen> = {
    home: { name: 'home' },
    map: { name: 'map' },
    explore: { name: 'explore' },
    emergency: { name: 'emergency' },
    notifications: { name: 'notifications' },
  };

  const activeTab: Tab =
    screen.name === 'home' ? 'home' :
    screen.name === 'map' ? 'map' :
    screen.name === 'explore' || screen.name === 'service' ? 'explore' :
    screen.name === 'emergency' ? 'emergency' :
    'notifications';

  const openService = (id: string) => {
    if (id === 'bills') setScreen({ name: 'bills' });
    else if (id === 'complaints') setScreen({ name: 'complaints' });
    else setScreen({ name: 'service', id });
  };

  const back = () => setScreen({ name: 'home' });

  return (
    <div className="relative">
      {screen.name === 'home' && (
        <Home
          onTab={(t) => setScreen(tabMap[t])}
          onOpenZen={() => setScreen({ name: 'zen' })}
          onOpenService={openService}
        />
      )}
      {screen.name === 'map' && <SmartMap onBack={back} />}
      {screen.name === 'explore' && <Explore onBack={back} onOpenService={openService} />}
      {screen.name === 'service' && <ServiceDetail serviceId={screen.id} onBack={() => setScreen({ name: 'explore' })} />}
      {screen.name === 'emergency' && <Emergency onBack={back} />}
      {screen.name === 'notifications' && <Notifications onBack={back} />}
      {screen.name === 'zen' && <ZenAI onBack={back} />}
      {screen.name === 'complaints' && <Complaints onBack={back} />}
      {screen.name === 'bills' && <Bills onBack={back} />}
      {screen.name === 'profile' && <Profile onBack={back} />}

      {/* Floating profile button */}
      {screen.name === 'home' && (
        <button
          onClick={() => setScreen({ name: 'profile' })}
          className="fixed top-4 right-4 z-30 w-10 h-10 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/25 transition-colors"
        >
          <User className="w-5 h-5" />
        </button>
      )}

      {/* Bottom nav — hidden on full-screen overlays */}
      {!['zen', 'complaints', 'bills', 'service', 'profile'].includes(screen.name) && (
        <BottomNav active={activeTab} onChange={(t) => setScreen(tabMap[t])} />
      )}
    </div>
  );
}

export default function App() {
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    const root = window.document.documentElement;
    if (savedTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, []);

  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
