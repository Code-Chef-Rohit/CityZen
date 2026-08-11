import { useEffect, useState } from 'react';
import { User, KeyRound, Phone } from 'lucide-react';
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
import StaffDashboard from '@/screens/StaffDashboard';
import AdminDashboard from '@/screens/AdminDashboard';
import { supabase } from '@/lib/supabase';

type Screen =
  | { name: 'home' }
  | { name: 'map'; category?: any }
  | { name: 'explore' }
  | { name: 'emergency' }
  | { name: 'notifications' }
  | { name: 'profile' }
  | { name: 'zen' }
  | { name: 'complaints'; category?: any }
  | { name: 'bills'; type?: any }
  | { name: 'service'; id: string };

function AppContent() {
  const { session, loading, profile, signOut, refreshProfile } = useAuth();
  const [showSplash, setShowSplash] = useState(true);
  const [screen, setScreen] = useState<Screen>({ name: 'home' });

  // Mandatory Phone Gate States
  const [pendingScreen, setPendingScreen] = useState<Screen | null>(null);
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const navigateToScreen = (target: Screen) => {
    const serviceScreens = ['complaints', 'bills', 'emergency', 'zen', 'service'];
    if (serviceScreens.includes(target.name) && (!profile?.phone || profile.phone.trim() === '')) {
      setPendingScreen(target);
      setPhoneInput('');
      setPhoneError(null);
    } else {
      setScreen(target);
    }
  };

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

  if (profile?.role === 'police' || profile?.role === 'hospital' || profile?.role === 'bmc') {
    return <StaffDashboard />;
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
    if (id === 'bills') navigateToScreen({ name: 'bills' });
    else if (id === 'complaints') navigateToScreen({ name: 'complaints' });
    else navigateToScreen({ name: 'service', id });
  };

  const back = () => setScreen({ name: 'home' });

  return (
    <div className="relative">
      {screen.name === 'home' && (
        <Home
          onTab={(t) => navigateToScreen(tabMap[t])}
          onOpenZen={() => navigateToScreen({ name: 'zen' })}
          onOpenService={openService}
        />
      )}
      {screen.name === 'map' && <SmartMap onBack={back} initialCategory={screen.category} />}
      {screen.name === 'explore' && <Explore onBack={back} onOpenService={openService} />}
      {screen.name === 'service' && (
        <ServiceDetail 
          serviceId={screen.id} 
          onBack={() => setScreen({ name: 'explore' })} 
          onFileComplaint={(category) => navigateToScreen({ name: 'complaints', category })}
          onPayBill={(type) => navigateToScreen({ name: 'bills', type })}
          onViewMap={(category) => setScreen({ name: 'map', category })}
        />
      )}
      {screen.name === 'emergency' && <Emergency onBack={back} />}
      {screen.name === 'notifications' && <Notifications onBack={back} />}
      {screen.name === 'zen' && (
        <ZenAI 
          onBack={back} 
          onNavigate={(targetScreen) => navigateToScreen(targetScreen)} 
        />
      )}
      {screen.name === 'complaints' && <Complaints onBack={back} initialCategory={screen.category} />}
      {screen.name === 'bills' && <Bills onBack={back} initialType={screen.type} />}
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

      {/* Phone Number Mandatory Modal */}
      {pendingScreen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm" />
          <div className="relative w-full sm:max-w-md bg-white rounded-3xl p-6 shadow-2xl animate-scale-up space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 mx-auto">
              <Phone className="w-6 h-6 animate-pulse" />
            </div>
            
            <div className="space-y-1">
              <h3 className="font-extrabold text-ink-900 text-lg">Contact Number Required</h3>
              <p className="text-xs text-ink-500 leading-normal px-2">
                To proceed with this service, you must link a valid 10-digit mobile number to your citizen profile for municipal tracking.
              </p>
            </div>
            
            <div className="space-y-3 pt-2">
              <div>
                <input
                  type="tel"
                  placeholder="10-Digit Mobile Number"
                  value={phoneInput}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, ''); // numeric only
                    if (val.length <= 10) setPhoneInput(val);
                  }}
                  className="w-full text-center px-4 py-3 bg-slate-50 border border-ink-200 rounded-xl text-sm focus:outline-none focus:border-amber-500 transition-all font-bold tracking-widest text-ink-800"
                />
              </div>

              {phoneError && (
                <p className="text-center text-xs text-red-500 font-semibold">{phoneError}</p>
              )}
              
              <div className="flex gap-2.5 pt-2">
                <button
                  onClick={() => setPendingScreen(null)}
                  className="flex-1 py-2.5 bg-slate-100 border border-slate-200 hover:bg-slate-200 rounded-xl font-bold text-xs text-slate-600 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (phoneInput.length !== 10) {
                      setPhoneError('Please enter a valid 10-digit phone number.');
                      return;
                    }
                    setPhoneSaving(true);
                    setPhoneError(null);
                    try {
                      // Check for duplicate phone number across all users
                      const { data: existingPhone } = await supabase
                        .from('profiles')
                        .select('id')
                        .eq('phone', phoneInput.trim())
                        .neq('id', profile?.id)
                        .maybeSingle();

                      if (existingPhone) {
                        setPhoneError('This phone number is already registered to another user account.');
                        setPhoneSaving(false);
                        return;
                      }

                      const { error } = await supabase
                        .from('profiles')
                        .update({ phone: phoneInput.trim() })
                        .eq('id', profile?.id);
                      if (error) throw error;
                      
                      await refreshProfile();
                      setScreen(pendingScreen); // Proceed to target screen
                      setPendingScreen(null);
                    } catch (e: any) {
                      setPhoneError(e.message || 'Failed to update phone number.');
                    } finally {
                      setPhoneSaving(false);
                    }
                  }}
                  disabled={phoneSaving}
                  className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-750 text-white rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                >
                  {phoneSaving ? 'Saving...' : 'Verify & Continue'}
                </button>
              </div>
            </div>
          </div>
        </div>
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
