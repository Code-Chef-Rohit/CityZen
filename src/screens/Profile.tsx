import { useEffect, useState } from 'react';
import {
  Siren, Bell, Droplets, AlertCircle, Car, Sparkles, CheckCheck,
  Trash2, User, LogOut, Globe, MapPin, Shield, ChevronRight, Lock, Mail, Phone,
  FileText, History, KeyRound, Check
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Screen, ScreenHeader } from '@/components/Screen';
import { Modal } from '@/components/Modal';
import { timeAgo } from '@/lib/utils';
import type { Notification, NotificationType } from '@/lib/types';

const typeConfig: Record<NotificationType, { icon: typeof Bell; bg: string; color: string }> = {
  emergency: { icon: Siren, bg: 'bg-error-500/10 text-error-500 dark:bg-error-500/20', color: 'text-error-500' },
  government: { icon: Bell, bg: 'bg-primary-100 text-primary-600 dark:bg-primary-950/40 dark:text-primary-400', color: 'text-primary-600' },
  bill: { icon: Droplets, bg: 'bg-secondary-100 text-secondary-500 dark:bg-secondary-950/40 dark:text-secondary-400', color: 'text-secondary-500' },
  complaint: { icon: AlertCircle, bg: 'bg-accent-500/10 text-accent-500 dark:bg-accent-500/20', color: 'text-accent-500' },
  traffic: { icon: Car, bg: 'bg-ink-100 text-ink-500 dark:bg-slate-800 dark:text-slate-400', color: 'text-ink-500' },
  ai: { icon: Sparkles, bg: 'bg-primary-50 text-primary-600 dark:bg-primary-950/40 dark:text-primary-400', color: 'text-primary-600' },
};

export function Notifications({ onBack }: { onBack: () => void }) {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!profile?.id) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(30);
    setNotifications(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [profile?.id]);

  const clearAll = async () => {
    if (!profile?.id) return;
    await supabase.from('notifications').delete().eq('user_id', profile.id);
    load();
  };

  const deleteOne = async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id);
    load();
  };

  return (
    <Screen>
      <ScreenHeader
        title="Alerts & Notices"
        subtitle={`${notifications.length} civic notifications`}
        onBack={onBack}
        right={
          notifications.length > 0 ? (
            <button 
              onClick={clearAll} 
              className="text-xs font-bold text-red-600 dark:text-red-400 hover:text-red-700 flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear all
            </button>
          ) : undefined
        }
      />

      <div className="px-4 py-4 space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl h-20 skeleton border border-slate-100 dark:border-slate-800" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-8 sm:p-12 text-center shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-ink-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3.5 text-ink-400 dark:text-slate-400">
              <Bell className="w-8 h-8" />
            </div>
            <h3 className="font-bold text-ink-800 dark:text-white text-base">No active alerts</h3>
            <p className="text-xs text-ink-400 dark:text-slate-400 mt-1 max-w-xs mx-auto">
              You are completely up to date with municipal notices, bill receipts, and dispatch updates!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((n) => {
              const cfg = typeConfig[n.type] || typeConfig.government;
              return (
                <div
                  key={n.id}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-sm hover:shadow-md transition-all flex items-start gap-3 relative group"
                >
                  <div className={`w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0 mt-0.5 shadow-sm`}>
                    <cfg.icon className="w-5 h-5" />
                  </div>
                  
                  <div className="flex-1 min-w-0 pr-1">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-bold text-xs sm:text-sm text-ink-900 dark:text-white leading-snug">
                        {n.title}
                      </h4>
                      <button
                        onClick={() => deleteOne(n.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-ink-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 active:scale-95 transition-all cursor-pointer shrink-0 -mt-1 -mr-1"
                        title="Dismiss alert"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    
                    {n.message && (
                      <p className="text-[11px] sm:text-xs text-ink-600 dark:text-slate-300 mt-1 leading-relaxed line-clamp-3">
                        {n.message}
                      </p>
                    )}
                    
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] text-ink-400 dark:text-slate-500 font-medium">
                        {timeAgo(n.created_at)}
                      </span>
                      <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-ink-100 dark:bg-slate-800 text-ink-600 dark:text-slate-400">
                        {n.type}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Screen>
  );
}

export function Profile({ onBack }: { onBack: () => void }) {
  const { profile, session, signOut, refreshProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [ward, setWard] = useState(profile?.ward ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? '');
      setPhone(profile.phone ?? '');
      setWard(profile.ward ?? '');
    }
  }, [profile]);

  const startEditing = () => {
    if (profile) {
      setFullName(profile.full_name ?? '');
      setPhone(profile.phone ?? '');
      setWard(profile.ward ?? '');
    }
    setEditing(true);
  };

  const [changingPassword, setChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [myBills, setMyBills] = useState<any[]>([]);
  const [myComplaints, setMyComplaints] = useState<any[]>([]);
  const [mySOS, setMySOS] = useState<any[]>([]);
  const [activeHistoryTab, setActiveHistoryTab] = useState<'bills' | 'complaints' | 'sos' | null>(null);

  const loadUserHistory = async () => {
    if (!profile?.id) return;
    const [billsRes, complaintsRes, sosRes] = await Promise.all([
      supabase.from('bills').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }),
      supabase.from('complaints').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }),
      supabase.from('emergency_requests').select('*').eq('user_id', profile.id).order('created_at', { ascending: false })
    ]);
    setMyBills(billsRes.data ?? []);
    setMyComplaints(complaintsRes.data ?? []);
    setMySOS(sosRes.data ?? []);
  };

  useEffect(() => {
    loadUserHistory();
  }, [profile?.id]);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('cityzen_theme') as 'light' | 'dark') || 'dark';
  });

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('cityzen_theme', next);
    if (next === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleSave = async () => {
    if (!profile?.id) return;
    setSaving(true);
    try {
      const cleanPhone = phone.replace(/\D/g, '').trim();
      if (cleanPhone && cleanPhone.length !== 10) {
        alert("Please enter a valid 10-digit mobile phone number.");
        setSaving(false);
        return;
      }

      if (cleanPhone) {
        const { data: existingProfiles, error: checkErr } = await supabase
          .from('profiles')
          .select('id, full_name, phone')
          .eq('phone', cleanPhone)
          .neq('id', profile.id);

        if (checkErr) {
          console.warn("Phone uniqueness check:", checkErr);
        } else if (existingProfiles && existingProfiles.length > 0) {
          alert(`Phone number (${cleanPhone}) is already linked to another account (${existingProfiles[0].full_name || 'Citizen'}). Each citizen must use a unique mobile number.`);
          setSaving(false);
          return;
        }
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          phone: cleanPhone,
          ward: ward ? parseInt(String(ward), 10) : 12,
        })
        .eq('id', profile.id);

      if (error) throw error;
      setEditing(false);
      refreshProfile();
      alert('Profile updated successfully!');
    } catch (err: any) {
      alert(`Failed to save profile: ${err.message || err}`);
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!newPassword || newPassword.length < 6) {
      alert('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      alert('Passwords do not match.');
      return;
    }
    setPasswordSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      alert('Password changed successfully!');
      setChangingPassword(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      alert(`Error updating password: ${err.message}`);
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm("WARNING: Are you sure you want to delete your profile? This action is permanent and your account will be removed forever.")) {
      return;
    }
    try {
      const { error } = await supabase.rpc('delete_current_user');
      if (error) throw error;
      alert('Your account has been deleted successfully.');
      await signOut();
    } catch (err: any) {
      alert(`Failed to delete profile: ${err.message || err}`);
    }
  };

  const userEmail = session?.user?.email || profile?.email || 'citizen@cityzen.gov';

  return (
    <Screen>
      <ScreenHeader title="My Profile" subtitle="Account & Civic Identity" onBack={onBack} />

      {/* Top Profile Card */}
      <div className="px-4 pt-4 pb-2">
        <div className="bg-gradient-to-br from-primary-600 via-primary-700 to-secondary-700 rounded-3xl p-4 sm:p-5 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-36 h-36 bg-white/10 rounded-full blur-2xl -mr-12 -mt-12 pointer-events-none" />
          
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-13 h-13 sm:w-16 sm:h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-xl sm:text-2xl font-black shrink-0 border border-white/20 shadow-md">
                {(profile?.full_name ?? userEmail ?? 'C')[0].toUpperCase()}
              </div>
              
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold truncate leading-tight">
                    {profile?.full_name || 'Citizen'}
                  </h2>
                  <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-md border border-white/20 shrink-0">
                    {profile?.role ?? 'citizen'}
                  </span>
                </div>
                
                <p className="text-primary-100 text-[11px] sm:text-xs flex items-center gap-1.5 mt-0.5 truncate font-mono">
                  <Mail className="w-3.5 h-3.5 shrink-0 text-primary-200" />
                  <span className="truncate">{userEmail}</span>
                </p>
                
                <p className="text-primary-200/90 text-[10px] sm:text-xs flex items-center gap-1 mt-1 font-medium truncate">
                  <Shield className="w-3 h-3 text-primary-300 shrink-0" /> Registered Citizen · Ward {profile?.ward ?? '12'}
                </p>
              </div>
            </div>

            <button
              onClick={startEditing}
              className="self-end sm:self-center px-4 py-1.5 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer shrink-0 border border-white/20 shadow-sm"
            >
              Edit Profile
            </button>
          </div>
        </div>
      </div>

      {/* Activity Stats Grid */}
      <div className="px-4 py-2 grid grid-cols-3 gap-2 sm:gap-3">
        <button
          onClick={() => setActiveHistoryTab('bills')}
          className="bg-white dark:bg-slate-900 rounded-2xl p-2.5 sm:p-3.5 shadow-sm hover:shadow active:scale-95 transition-all text-left cursor-pointer border border-slate-100 dark:border-slate-800 min-h-[72px] flex flex-col justify-between"
        >
          <p className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate">My Bills</p>
          <div>
            <p className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">{myBills.length}</p>
            <span className="text-[9px] sm:text-[10px] text-red-500 font-bold block truncate">
              {myBills.filter(b => b.status === 'unpaid').length} unpaid
            </span>
          </div>
        </button>

        <button
          onClick={() => setActiveHistoryTab('complaints')}
          className="bg-white dark:bg-slate-900 rounded-2xl p-2.5 sm:p-3.5 shadow-sm hover:shadow active:scale-95 transition-all text-left cursor-pointer border border-slate-100 dark:border-slate-800 min-h-[72px] flex flex-col justify-between"
        >
          <p className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate">Complaints</p>
          <div>
            <p className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">{myComplaints.length}</p>
            <span className="text-[9px] sm:text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block truncate">
              {myComplaints.filter(c => c.status === 'resolved').length} solved
            </span>
          </div>
        </button>

        <button
          onClick={() => setActiveHistoryTab('sos')}
          className="bg-white dark:bg-slate-900 rounded-2xl p-2.5 sm:p-3.5 shadow-sm hover:shadow active:scale-95 transition-all text-left cursor-pointer border border-slate-100 dark:border-slate-800 min-h-[72px] flex flex-col justify-between"
        >
          <p className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate">SOS Calls</p>
          <div>
            <p className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">{mySOS.length}</p>
            <span className="text-[9px] sm:text-[10px] text-red-500 font-bold block truncate">
              {mySOS.filter(s => s.status === 'active').length} active
            </span>
          </div>
        </button>
      </div>

      {/* Settings list */}
      <div className="px-4 py-2 space-y-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm divide-y divide-ink-100 dark:divide-slate-800 overflow-hidden">
          <SettingRow icon={Mail} label="Logged-in Email" value={userEmail} />
          <SettingRow icon={Phone} label="Contact Phone" value={profile?.phone || 'Not set'} />
          <SettingRow icon={Globe} label="Language" value={profile?.language?.toUpperCase() ?? 'EN'} />
          <button onClick={toggleTheme} className="w-full text-left cursor-pointer">
            <SettingRow icon={Sparkles} label="Theme Mode" value={theme === 'dark' ? 'Dark Mode' : 'Light Mode'} />
          </button>
          <SettingRow icon={MapPin} label="Ward Location" value={profile?.ward ? `Ward ${profile.ward}` : 'Ward 12'} />
          <button onClick={() => setChangingPassword(true)} className="w-full text-left cursor-pointer">
            <SettingRow icon={Lock} label="Security" value="Change Password" />
          </button>
          {profile?.role === 'admin' && (
            <button 
              onClick={() => window.location.reload()} 
              className="w-full text-left cursor-pointer bg-orange-50 dark:bg-orange-950/20 hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors"
            >
              <SettingRow icon={Shield} label="Admin Access" value="Open Admin ⚡" />
            </button>
          )}
        </div>

        <button
          onClick={() => signOut()}
          className="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 flex items-center gap-3 shadow-sm text-error-600 dark:text-error-400 hover:bg-error-50 dark:hover:bg-error-950/20 active:scale-[0.99] transition-all cursor-pointer"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-error-500/10 flex items-center justify-center shrink-0">
            <LogOut className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />
          </div>
          <span className="font-bold text-xs sm:text-sm">Sign Out from CityZen</span>
        </button>

        <button
          onClick={handleDeleteAccount}
          className="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 flex items-center gap-3 shadow-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 active:scale-[0.99] transition-all cursor-pointer"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
            <Trash2 className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />
          </div>
          <span className="font-bold text-xs sm:text-sm">Delete Account</span>
        </button>

        <p className="text-center text-[10px] sm:text-xs text-ink-400 dark:text-slate-500 pt-2 pb-4">
          CITYZEN · Unified Smart Governance Portal · v1.0
        </p>
      </div>

      {/* Edit Profile Modal */}
      <Modal open={editing} onClose={() => setEditing(false)} title="Edit Profile Details">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-slate-400 mb-1.5 block">Logged-in Email (Verified)</label>
            <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-ink-100/70 dark:bg-slate-800/80 rounded-xl text-xs font-medium text-ink-700 dark:text-slate-300 border border-ink-200 dark:border-slate-700">
              <div className="flex items-center gap-2 truncate">
                <Mail className="w-4 h-4 text-ink-400 dark:text-slate-400 shrink-0" />
                <span className="font-mono truncate">{userEmail}</span>
              </div>
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full shrink-0">
                Verified
              </span>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-slate-400 mb-1.5 block">Full Name</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-ink-50 dark:bg-slate-800 border border-ink-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary-400 focus:bg-white dark:focus:bg-slate-900 text-ink-900 dark:text-white transition-all"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-slate-400 mb-1.5 block">Mobile Phone (10 Digits)</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={10}
              placeholder="e.g. 7735550648"
              className="w-full px-3.5 py-2.5 bg-ink-50 dark:bg-slate-800 border border-ink-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary-400 focus:bg-white dark:focus:bg-slate-900 text-ink-900 dark:text-white font-mono transition-all"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-slate-400 mb-1.5 block">Ward Number</label>
            <input
              type="number"
              value={ward}
              onChange={(e) => setWard(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-ink-50 dark:bg-slate-800 border border-ink-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary-400 focus:bg-white dark:focus:bg-slate-900 text-ink-900 dark:text-white transition-all"
            />
          </div>

          <div className="flex gap-2.5 pt-2">
            <button 
              onClick={() => setEditing(false)} 
              className="flex-1 py-2.5 bg-ink-100 dark:bg-slate-800 hover:bg-ink-200 dark:hover:bg-slate-700 rounded-xl font-semibold text-xs sm:text-sm text-ink-600 dark:text-slate-300 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-700 active:scale-95 rounded-xl font-bold text-xs sm:text-sm text-white transition-all disabled:opacity-50 cursor-pointer shadow-md"
            >
              {saving ? 'Saving…' : 'Save Details'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Change Password Modal */}
      <Modal open={changingPassword} onClose={() => setChangingPassword(false)} title="Change Security Password">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-slate-400 mb-1.5 block">New Password</label>
            <input
              type="password"
              placeholder="Enter at least 6 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-ink-50 dark:bg-slate-800 border border-ink-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary-400 focus:bg-white dark:focus:bg-slate-900 text-ink-900 dark:text-white transition-all"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-ink-500 dark:text-slate-400 mb-1.5 block">Confirm New Password</label>
            <input
              type="password"
              placeholder="Re-enter password to verify"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-ink-50 dark:bg-slate-800 border border-ink-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary-400 focus:bg-white dark:focus:bg-slate-900 text-ink-900 dark:text-white transition-all"
            />
          </div>

          <div className="flex gap-2.5 pt-2">
            <button 
              onClick={() => { setChangingPassword(false); setNewPassword(''); setConfirmPassword(''); }} 
              className="flex-1 py-2.5 bg-ink-100 dark:bg-slate-800 hover:bg-ink-200 dark:hover:bg-slate-700 rounded-xl font-semibold text-xs sm:text-sm text-ink-600 dark:text-slate-300 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handlePasswordChange}
              disabled={passwordSaving}
              className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-700 active:scale-95 rounded-xl font-bold text-xs sm:text-sm text-white transition-all disabled:opacity-50 cursor-pointer shadow-md"
            >
              {passwordSaving ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Activity History Modal */}
      <Modal 
        open={!!activeHistoryTab} 
        onClose={() => setActiveHistoryTab(null)} 
        title={
          activeHistoryTab === 'bills' ? 'My Linked Utilities' :
          activeHistoryTab === 'complaints' ? 'My Filed Complaints' : 'Emergency SOS Log'
        }
      >
        <div className="space-y-3">
          {activeHistoryTab === 'bills' && (
            <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
              {myBills.length === 0 ? (
                <p className="text-xs text-ink-400 dark:text-slate-500 py-6 text-center">No utility bills linked to your profile.</p>
              ) : (
                myBills.map(b => (
                  <div key={b.id} className="bg-ink-50 dark:bg-slate-800/60 border border-ink-100 dark:border-slate-700/60 rounded-xl p-3 flex justify-between items-center text-xs">
                    <div>
                      <p className="font-bold text-ink-900 dark:text-white capitalize">{b.type} Utility</p>
                      <p className="text-[10px] text-ink-400 dark:text-slate-400 mt-0.5">{b.period || 'Monthly Service'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-sm text-ink-900 dark:text-white">₹{b.amount}</p>
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase mt-1 ${
                        b.status === 'paid' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400'
                      }`}>
                        {b.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeHistoryTab === 'complaints' && (
            <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
              {myComplaints.length === 0 ? (
                <p className="text-xs text-ink-400 dark:text-slate-500 py-6 text-center">No civic complaints filed by your account.</p>
              ) : (
                myComplaints.map(c => (
                  <div key={c.id} className="bg-ink-50 dark:bg-slate-800/60 border border-ink-100 dark:border-slate-700/60 rounded-xl p-3 text-xs space-y-1.5">
                    <div className="flex justify-between items-start gap-2">
                      <p className="font-bold text-ink-900 dark:text-white truncate">{c.title}</p>
                      <span className={`inline-block px-2 py-0.5 rounded text-[8px] font-bold uppercase shrink-0 ${
                        c.status === 'resolved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400' : 
                        c.status === 'in_progress' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400' : 
                        'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400'
                      }`}>
                        {c.status}
                      </span>
                    </div>
                    <p className="text-[10px] text-ink-400 dark:text-slate-400">{c.location_text || 'Ward Coordinates'} · Category: {c.category}</p>
                    {c.description && <p className="text-[10px] text-ink-600 dark:text-slate-300 italic">"{c.description}"</p>}
                    {c.status === 'resolved' && c.resolution_proof && (
                      <div className="mt-1.5 p-2 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 rounded-lg border border-emerald-500/20 text-[10px]">
                        <span className="font-bold block uppercase tracking-wider text-[8px]">BMC Resolution Proof:</span>
                        <p className="italic mt-0.5">"{c.resolution_proof}"</p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {activeHistoryTab === 'sos' && (
            <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
              {mySOS.length === 0 ? (
                <p className="text-xs text-ink-400 dark:text-slate-500 py-6 text-center">No emergency SOS signals recorded.</p>
              ) : (
                mySOS.map(s => (
                  <div key={s.id} className="bg-ink-50 dark:bg-slate-800/60 border border-ink-100 dark:border-slate-700/60 rounded-xl p-3 text-xs space-y-1">
                    <div className="flex justify-between items-start gap-2">
                      <p className="font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">{s.type} Dispatch</p>
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-bold uppercase shrink-0 ${
                        s.status === 'resolved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400' : 
                        'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400 animate-pulse'
                      }`}>
                        {s.status}
                      </span>
                    </div>
                    <p className="text-[10px] text-ink-400 dark:text-slate-400">{new Date(s.created_at).toLocaleString()}</p>
                    <p className="text-[10px] text-ink-600 dark:text-slate-300 font-semibold">Location: {s.location_text || 'Ward Coordinates'}</p>
                    {s.notes && <p className="text-[10px] text-ink-500 dark:text-slate-400 mt-1 italic">Notes: {s.notes}</p>}
                  </div>
                ))
              )}
            </div>
          )}

          <button 
            onClick={() => setActiveHistoryTab(null)} 
            className="w-full mt-2 py-2.5 bg-ink-100 dark:bg-slate-800 hover:bg-ink-200 dark:hover:bg-slate-700 rounded-xl font-bold text-xs text-ink-700 dark:text-slate-200 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </Modal>
    </Screen>
  );
}

function SettingRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 p-3.5 sm:p-4 hover:bg-ink-50/50 dark:hover:bg-slate-800/40 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-ink-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-ink-500 dark:text-slate-400" />
        </div>
        <span className="text-xs sm:text-sm font-medium text-ink-800 dark:text-slate-200 truncate">{label}</span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 max-w-[50%] justify-end">
        <span className="text-xs sm:text-sm text-ink-400 dark:text-slate-400 truncate text-right font-mono">{value}</span>
        <ChevronRight className="w-4 h-4 text-ink-300 dark:text-slate-500 shrink-0" />
      </div>
    </div>
  );
}
