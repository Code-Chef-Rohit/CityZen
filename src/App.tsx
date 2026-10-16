import { useEffect, useState } from 'react';
import { User, KeyRound, Phone, Shield, CheckCircle, X } from 'lucide-react';
import { AuthProvider, useAuth } from '@/lib/auth';
import { BottomNav, type Tab } from '@/components/BottomNav';
import { DesktopNavbar } from '@/components/DesktopNavbar';
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
import { supabase, isConfigured } from '@/lib/supabase';
import { ROLE_AUTHORITY_INFO } from '@/lib/emailService';

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
  const [adminViewMode, setAdminViewMode] = useState<'admin' | 'citizen'>('admin');

  const [pendingScreen, setPendingScreen] = useState<Screen | null>(null);
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const refreshUnreadCount = async () => {
    if (!profile?.id) return;
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('read', false);
      if (!error && count !== null) {
        setUnreadCount(count);
      }
    } catch (e) {
      console.warn("Notice checking notifications count:", e);
    }
  };

  useEffect(() => {
    refreshUnreadCount();
    const interval = setInterval(refreshUnreadCount, 10000);
    return () => clearInterval(interval);
  }, [profile?.id, screen.name]);

  // Automated Realtime Authority Grant Alert State
  const [authorityGrantAlert, setAuthorityGrantAlert] = useState<{
    notifId: string;
    role: string;
    title: string;
    message: string;
    date: string;
  } | null>(null);

  useEffect(() => {
    if (!profile?.id) return;

    // 1. Initial check for unread authority grant notifications for this user
    const checkUnreadAuthorityNotifs = async () => {
      try {
        const { data } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', profile.id)
          .eq('type', 'government')
          .ilike('title', '%Authority Granted%')
          .eq('read', false)
          .order('created_at', { ascending: false })
          .limit(1);

        if (data && data.length > 0) {
          const notif = data[0];
          const matchedRole = notif.title.toLowerCase().includes('admin') ? 'admin' :
                             notif.title.toLowerCase().includes('police') ? 'police' :
                             notif.title.toLowerCase().includes('hospital') ? 'hospital' :
                             notif.title.toLowerCase().includes('bmc') ? 'bmc' : (profile.role || 'citizen');
          setAuthorityGrantAlert({
            notifId: notif.id,
            role: matchedRole,
            title: notif.title,
            message: notif.message,
            date: notif.created_at || new Date().toISOString()
          });
        }
      } catch (err) {
        console.warn('Authority notification check notice:', err);
      }
    };

    checkUnreadAuthorityNotifs();

    // 2. Realtime listener: Whenever an admin assigns a new role to this user,
    // pop up the official alert dialog automatically and immediately!
    const notifSub = supabase
      .channel(`user-authority-alert-${profile.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${profile.id}`
      }, (payload: any) => {
        const newNotif = payload.new;
        if (newNotif?.type === 'government' && newNotif?.title?.includes('Authority Granted')) {
          const matchedRole = newNotif.title.toLowerCase().includes('admin') ? 'admin' :
                             newNotif.title.toLowerCase().includes('police') ? 'police' :
                             newNotif.title.toLowerCase().includes('hospital') ? 'hospital' :
                             newNotif.title.toLowerCase().includes('bmc') ? 'bmc' : (profile.role || 'citizen');
          setAuthorityGrantAlert({
            notifId: newNotif.id,
            role: matchedRole,
            title: newNotif.title,
            message: newNotif.message,
            date: newNotif.created_at || new Date().toISOString()
          });
          refreshProfile();
          refreshUnreadCount();
        }
      })
      .subscribe();

    // 3. Realtime listener on profiles table for instant role change without reload
    const profileSub = supabase
      .channel(`user-profile-change-${profile.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${profile.id}`
      }, (payload: any) => {
        if (payload.new?.role && payload.new.role !== profile.role) {
          refreshProfile();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(notifSub);
      supabase.removeChannel(profileSub);
    };
  }, [profile?.id]);

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
  if (!isConfigured) return <MissingConfigScreen />;
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

  const renderAuthorityGrantModal = () => {
    if (!authorityGrantAlert) return null;
    const roleInfo = ROLE_AUTHORITY_INFO[authorityGrantAlert.role] || ROLE_AUTHORITY_INFO.citizen;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in text-left">
        <div className="relative max-w-lg w-full bg-slate-900 border-2 border-orange-500/50 rounded-3xl p-6 shadow-2xl animate-scale-up space-y-4 text-white max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400 shrink-0">
                <Shield className="w-6 h-6 text-orange-400" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-[10px] font-mono uppercase tracking-wider text-orange-400 font-extrabold">Official Administrative Communiqué</span>
                </div>
                <h2 className="text-base sm:text-lg font-black text-white mt-0.5">Role Authority Activated</h2>
              </div>
            </div>
            <button
              type="button"
              onClick={async () => {
                try {
                  await supabase.from('notifications').update({ read: true }).eq('id', authorityGrantAlert.notifId);
                } catch (e) {
                  console.warn(e);
                }
                setAuthorityGrantAlert(null);
                refreshUnreadCount();
              }}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Granted Role Badge */}
          <div className="p-4 bg-slate-950/80 border border-white/10 rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Your Assigned Operational Role</p>
              <p className="text-xl font-black text-white uppercase mt-0.5 tracking-tight flex items-center gap-2">
                <span>{authorityGrantAlert.role}</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 font-bold uppercase">
                  {roleInfo.clearance}
                </span>
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>

          {/* Official Message Body */}
          <div className="p-4 bg-slate-950/60 border border-white/5 rounded-2xl space-y-2 text-xs text-slate-300 font-mono leading-relaxed max-h-48 overflow-y-auto">
            <p className="font-bold text-white font-sans text-sm">Designation: {roleInfo.title}</p>
            <p className="text-[11px] text-slate-300">{authorityGrantAlert.message}</p>
            {roleInfo.permissions && (
              <div className="pt-2 border-t border-white/10 space-y-1">
                <p className="text-[10px] uppercase font-bold text-orange-400">Authorized Capabilities:</p>
                {roleInfo.permissions.map((p, idx) => (
                  <p key={idx} className="text-[11px] text-slate-400">• {p}</p>
                ))}
              </div>
            )}
          </div>

          {/* Notice Footer info */}
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-1">
            <span>Automated Municipal System Alert</span>
            <span>{new Date(authorityGrantAlert.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2.5 pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={async () => {
                try {
                  await supabase.from('notifications').update({ read: true }).eq('id', authorityGrantAlert.notifId);
                } catch (e) {
                  console.warn(e);
                }
                setAuthorityGrantAlert(null);
                refreshUnreadCount();
                await refreshProfile();
                if (authorityGrantAlert.role === 'admin') {
                  setAdminViewMode('admin');
                }
              }}
              className="flex-1 py-3 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-extrabold rounded-xl text-xs shadow-lg transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Shield className="w-4 h-4" />
              <span>Acknowledge & Access Dashboard</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (profile?.role === 'police' || profile?.role === 'hospital' || profile?.role === 'bmc') {
    return (
      <>
        <StaffDashboard />
        {renderAuthorityGrantModal()}
      </>
    );
  }

  if (profile?.role === 'admin' && adminViewMode === 'admin') {
    return (
      <>
        <AdminDashboard onSwitchToCitizen={() => setAdminViewMode('citizen')} />
        {renderAuthorityGrantModal()}
      </>
    );
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
    <div className="relative min-h-[100dvh] bg-ink-50 dark:bg-slate-950">
      <DesktopNavbar 
        currentScreen={screen.name} 
        onNavigate={(s) => navigateToScreen(s as any)} 
        unreadCount={unreadCount}
      />
      {renderAuthorityGrantModal()}

      {screen.name === 'home' && (
        <Home
          onTab={(t) => navigateToScreen(tabMap[t])}
          onOpenZen={() => navigateToScreen({ name: 'zen' })}
          onOpenService={openService}
          onOpenProfile={() => setScreen({ name: 'profile' })}
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
      {screen.name === 'notifications' && (
        <Notifications 
          onBack={back} 
          onNavigate={(s) => navigateToScreen(s)}
          onRefreshCount={refreshUnreadCount}
        />
      )}
      {screen.name === 'zen' && (
        <ZenAI 
          onBack={back} 
          onNavigate={(targetScreen) => navigateToScreen(targetScreen)} 
        />
      )}
      {screen.name === 'complaints' && <Complaints onBack={back} initialCategory={screen.category} />}
      {screen.name === 'bills' && <Bills onBack={back} initialType={screen.type} />}
      {screen.name === 'profile' && <Profile onBack={back} />}

      {/* Floating admin control center button for admin users in citizen mode */}
      {profile?.role === 'admin' && (
        <button
          onClick={() => setAdminViewMode('admin')}
          className="fixed top-[max(0.85rem,env(safe-area-inset-top))] left-4 z-40 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 active:scale-95 text-white rounded-full text-xs font-black flex items-center gap-1.5 shadow-2xl transition-all cursor-pointer ring-2 ring-white/30"
          title="Return to Admin Control Center"
        >
          <Shield className="w-3.5 h-3.5" /> Admin Center
        </button>
      )}

      {/* Bottom nav — hidden on full-screen overlays */}
      {!['zen', 'complaints', 'bills', 'service', 'profile'].includes(screen.name) && (
        <BottomNav active={activeTab} onChange={(t) => setScreen(tabMap[t])} unreadCount={unreadCount} />
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
                    const cleanPhone = phoneInput.replace(/\D/g, '').trim();
                    if (cleanPhone.length !== 10) {
                      setPhoneError('Please enter a valid 10-digit mobile number.');
                      return;
                    }
                    setPhoneSaving(true);
                    setPhoneError(null);
                    try {
                      // Check for duplicate phone number across all users
                      const { data: existingPhone } = await supabase
                        .from('profiles')
                        .select('id')
                        .eq('phone', cleanPhone)
                        .neq('id', profile?.id)
                        .maybeSingle();

                      if (existingPhone) {
                        setPhoneError(`Mobile number ${cleanPhone} is already registered to another citizen account. Each user must have a unique mobile number.`);
                        setPhoneSaving(false);
                        return;
                      }

                      const { error } = await supabase
                        .from('profiles')
                        .update({ phone: cleanPhone })
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

function MissingConfigScreen() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Background ambient glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[400px] h-[400px] bg-red-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-orange-500/10 rounded-full blur-[100px] pointer-events-none" />
      
      <div className="w-full max-w-[480px] bg-slate-900/80 border border-white/10 rounded-[32px] p-8 shadow-2xl relative z-10 backdrop-blur-xl space-y-6">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-[2px] bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-70" />
        
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-4 animate-pulse">
            <div className="absolute inset-0 bg-red-500/20 rounded-2xl blur-lg" />
            <div className="relative w-16 h-16 rounded-2xl border border-white/10 overflow-hidden shadow-2xl bg-slate-950 flex items-center justify-center">
              <img src="/logo.jpg" alt="CityZen Logo" className="w-full h-full object-cover" />
            </div>
          </div>
          <h1 className="text-xl font-black text-white tracking-tight">Database Credentials Required</h1>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            Your application was deployed successfully, but the Supabase connection keys are not configured in your hosting environment variables.
          </p>
        </div>

        <div className="bg-slate-950/80 border border-white/5 rounded-2xl p-5 space-y-4 text-xs leading-relaxed text-slate-300">
          <p className="font-bold text-white flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            How to resolve on Netlify:
          </p>
          <ol className="list-decimal list-inside space-y-2.5 text-slate-400 font-medium pl-1">
            <li>Go to your <strong className="text-slate-200">Netlify Dashboard</strong>.</li>
            <li>Select your <strong className="text-slate-200">CityZen</strong> site, then navigate to <strong className="text-slate-200">Site Configuration &gt; Environment Variables</strong>.</li>
            <li>Add the following two keys:
              <div className="bg-slate-900 border border-white/5 rounded-lg p-2.5 mt-1.5 font-mono text-[10px] text-cyan-400 space-y-1.5 select-all">
                <div>VITE_SUPABASE_URL = <span className="text-slate-400">your_supabase_url</span></div>
                <div>VITE_SUPABASE_ANON_KEY = <span className="text-slate-400">your_anon_key</span></div>
              </div>
            </li>
            <li>Go to <strong className="text-slate-200">Deploys</strong> and click <strong className="text-slate-200">Trigger Deploy &gt; Clear Cache and Deploy Site</strong>.</li>
          </ol>
        </div>

        <p className="text-center text-[10px] text-slate-500 uppercase tracking-widest font-bold">
          CityZen Municipal Network · Setup Guide
        </p>
      </div>
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
