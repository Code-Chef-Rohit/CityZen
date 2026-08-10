import { useEffect, useState } from 'react';
import {
  Siren, Bell, Droplets, AlertCircle, Car, Sparkles, CheckCheck,
  Trash2, User, LogOut, Globe, MapPin, Shield, ChevronRight, Lock
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Screen, ScreenHeader } from '@/components/Screen';
import { timeAgo } from '@/lib/utils';
import type { Notification, NotificationType } from '@/lib/types';

const typeConfig: Record<NotificationType, { icon: typeof Bell; bg: string; color: string }> = {
  emergency: { icon: Siren, bg: 'bg-error-500/10', color: 'text-error-500' },
  government: { icon: Bell, bg: 'bg-primary-100', color: 'text-primary-600' },
  bill: { icon: Droplets, bg: 'bg-secondary-100', color: 'text-secondary-500' },
  complaint: { icon: AlertCircle, bg: 'bg-accent-500/10', color: 'text-accent-500' },
  traffic: { icon: Car, bg: 'bg-ink-100', color: 'text-ink-500' },
  ai: { icon: Sparkles, bg: 'bg-primary-50', color: 'text-primary-600' },
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
        title="Alerts"
        subtitle={`${notifications.length} notifications`}
        onBack={onBack}
        right={
          notifications.length > 0 ? (
            <button onClick={clearAll} className="text-xs font-semibold text-red-600 flex items-center gap-1 cursor-pointer">
              <Trash2 className="w-4 h-4" /> Clear all
            </button>
          ) : undefined
        }
      />

      <div className="px-4 py-4">
        {loading ? (
          <div className="space-y-2.5">
            {[1, 2, 3, 4].map((i) => <div key={i} className="bg-white rounded-2xl h-16 skeleton" />)}
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-ink-100 flex items-center justify-center mx-auto mb-3">
              <Bell className="w-8 h-8 text-ink-400" />
            </div>
            <p className="font-semibold text-ink-700">No alerts</p>
            <p className="text-sm text-ink-400 mt-1">You're all caught up!</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {notifications.map((n) => {
              const cfg = typeConfig[n.type];
              return (
                <div
                  key={n.id}
                  className="w-full bg-white rounded-2xl p-4 flex items-start gap-3 shadow-sm hover:shadow-md transition-shadow relative group"
                >
                  <div className={`w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0`}>
                    <cfg.icon className={`w-5 h-5 ${cfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0 pr-6">
                    <p className="font-semibold text-sm text-ink-950">
                      {n.title}
                    </p>
                    {n.message && <p className="text-xs text-ink-500 mt-0.5 line-clamp-2">{n.message}</p>}
                    <p className="text-[10px] text-ink-400 mt-1">{timeAgo(n.created_at)} · {n.type}</p>
                  </div>
                  
                  {/* Action buttons (Dismiss single notification) */}
                  <button
                    onClick={() => deleteOne(n.id)}
                    className="absolute right-4 top-4 p-1 text-slate-350 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                    title="Dismiss alert"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
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
  const { profile, signOut, refreshProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [ward, setWard] = useState(profile?.ward ?? '');
  const [saving, setSaving] = useState(false);

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

  const handlePasswordChange = async () => {
    if (!newPassword.trim()) {
      alert("Password cannot be empty!");
      return;
    }
    if (newPassword !== confirmPassword) {
      alert("Passwords do not match!");
      return;
    }
    setPasswordSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordSaving(false);
    if (error) {
      alert("Failed to update password: " + error.message);
    } else {
      alert("Your password has been successfully updated!");
      setChangingPassword(false);
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  const [theme, setTheme] = useState<'light' | 'dark'>(
    document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  );

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    const root = window.document.documentElement;
    if (newTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', newTheme);
  };

  const handleSave = async () => {
    setSaving(true);
    await supabase.from('profiles').update({
      full_name: fullName.trim(),
      phone: phone.trim(),
      ward: ward ? Number(ward) : null,
    }).eq('id', profile?.id);
    await refreshProfile();
    setSaving(false);
    setEditing(false);
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

  return (
    <Screen>
      <ScreenHeader title="Profile" subtitle="Your account" onBack={onBack} />

      {/* Profile card */}
      <div className="px-4 py-4">
        <div className="bg-gradient-to-br from-primary-600 to-secondary-700 rounded-2xl p-5 text-white shadow-lg">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-2xl font-extrabold">
              {(profile?.full_name ?? 'C')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-bold truncate">{profile?.full_name || 'Citizen'}</p>
              <p className="text-primary-100 text-xs flex items-center gap-1 mt-0.5">
                <Shield className="w-3 h-3" /> {profile?.role ?? 'citizen'} · Ward {profile?.ward ?? '—'}
              </p>
            </div>
            <button
              onClick={() => setEditing(true)}
              className="px-3 py-1.5 bg-white/15 backdrop-blur-sm rounded-lg text-xs font-semibold hover:bg-white/25 transition-colors"
            >
              Edit
            </button>
          </div>
        </div>
      </div>

      {/* Activity Stats Grid */}
      <div className="px-4 py-2 grid grid-cols-3 gap-3">
        <button
          onClick={() => setActiveHistoryTab('bills')}
          className="bg-white rounded-2xl p-3 shadow-sm hover:shadow transition-shadow text-left cursor-pointer border border-slate-100 dark:border-white/5"
        >
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">My Bills</p>
          <p className="text-lg font-black text-slate-805 mt-1">{myBills.length}</p>
          <span className="text-[9px] text-red-500 font-semibold block mt-0.5">
            {myBills.filter(b => b.status === 'unpaid').length} unpaid
          </span>
        </button>

        <button
          onClick={() => setActiveHistoryTab('complaints')}
          className="bg-white rounded-2xl p-3 shadow-sm hover:shadow transition-shadow text-left cursor-pointer border border-slate-100 dark:border-white/5"
        >
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Complaints</p>
          <p className="text-lg font-black text-slate-805 mt-1">{myComplaints.length}</p>
          <span className="text-[9px] text-emerald-600 font-semibold block mt-0.5">
            {myComplaints.filter(c => c.status === 'resolved').length} solved
          </span>
        </button>

        <button
          onClick={() => setActiveHistoryTab('sos')}
          className="bg-white rounded-2xl p-3 shadow-sm hover:shadow transition-shadow text-left cursor-pointer border border-slate-100 dark:border-white/5"
        >
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">SOS Calls</p>
          <p className="text-lg font-black text-slate-805 mt-1">{mySOS.length}</p>
          <span className="text-[9px] text-red-650 font-semibold block mt-0.5">
            {mySOS.filter(s => s.status === 'active').length} active
          </span>
        </button>
      </div>

      {/* Settings list */}
      <div className="px-4">
        <div className="bg-white rounded-2xl shadow-sm divide-y divide-ink-100">
          <SettingRow icon={Globe} label="Language" value={profile?.language?.toUpperCase() ?? 'EN'} />
          <button onClick={toggleTheme} className="w-full text-left cursor-pointer">
            <SettingRow icon={Sparkles} label="Theme Mode" value={theme === 'dark' ? 'Dark Mode' : 'Light Mode'} />
          </button>
          <SettingRow icon={MapPin} label="Ward" value={profile?.ward ? `Ward ${profile.ward}` : 'Not set'} />
          <SettingRow icon={Bell} label="Notifications" value="On" />
          <button onClick={() => setChangingPassword(true)} className="w-full text-left cursor-pointer">
            <SettingRow icon={Lock} label="Security Settings" value="Change Password" />
          </button>
        </div>



        <button
          onClick={() => signOut()}
          className="w-full mt-4 bg-white rounded-2xl p-4 flex items-center gap-3 shadow-sm text-error-600 hover:bg-error-500/10 transition-colors cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-error-500/10 flex items-center justify-center">
            <LogOut className="w-5 h-5 text-red-500" />
          </div>
          <span className="font-semibold text-sm">Sign Out</span>
        </button>

        <button
          onClick={handleDeleteAccount}
          className="w-full mt-3 bg-white rounded-2xl p-4 flex items-center gap-3 shadow-sm text-red-500 hover:bg-red-50 transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
            <Trash2 className="w-5 h-5 text-red-500" />
          </div>
          <span className="font-semibold text-sm">Delete Profile</span>
        </button>

        <p className="text-center text-xs text-ink-400 mt-6">CITY ZEN · One City. One App. · v1.0</p>
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-ink-900/50 backdrop-blur-sm" onClick={() => setEditing(false)} />
          <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 animate-slide-up">
            <h2 className="text-lg font-bold text-ink-900 mb-4">Edit Profile</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-ink-500 mb-1.5 block">Full Name</label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-3 bg-ink-50 border border-ink-200 rounded-xl text-sm focus:outline-none focus:border-primary-400 focus:bg-white transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-500 mb-1.5 block">Phone</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-3 bg-ink-50 border border-ink-200 rounded-xl text-sm focus:outline-none focus:border-primary-400 focus:bg-white transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-500 mb-1.5 block">Ward Number</label>
                <input
                  type="number"
                  value={ward}
                  onChange={(e) => setWard(e.target.value)}
                  className="w-full px-4 py-3 bg-ink-50 border border-ink-200 rounded-xl text-sm focus:outline-none focus:border-primary-400 focus:bg-white transition-all"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setEditing(false)} className="flex-1 py-3 bg-ink-100 rounded-xl font-semibold text-sm text-ink-600">
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-3 bg-primary-600 rounded-xl font-semibold text-sm text-white hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {changingPassword && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-ink-900/50 backdrop-blur-sm" onClick={() => setChangingPassword(false)} />
          <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 animate-slide-up">
            <h2 className="text-lg font-bold text-ink-900 mb-4">Change Password</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-ink-500 mb-1.5 block">New Password</label>
                <input
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-ink-50 border border-ink-200 rounded-xl text-sm focus:outline-none focus:border-primary-400 focus:bg-white transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink-500 mb-1.5 block">Confirm Password</label>
                <input
                  type="password"
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-ink-50 border border-ink-200 rounded-xl text-sm focus:outline-none focus:border-primary-400 focus:bg-white transition-all"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button 
                  onClick={() => { setChangingPassword(false); setNewPassword(''); setConfirmPassword(''); }} 
                  className="flex-1 py-3 bg-ink-100 rounded-xl font-semibold text-sm text-ink-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePasswordChange}
                  disabled={passwordSaving}
                  className="flex-1 py-3 bg-primary-600 rounded-xl font-semibold text-sm text-white hover:bg-primary-700 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {passwordSaving ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Activity Details Slide-up Sheet */}
      {activeHistoryTab && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-ink-900/50 backdrop-blur-sm" onClick={() => setActiveHistoryTab(null)} />
          <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 animate-slide-up">
            
            {activeHistoryTab === 'bills' && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b pb-2 mb-3">Linked Utilities Detail</h3>
                {myBills.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">No utility bills linked to your profile.</p>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {myBills.map(b => (
                      <div key={b.id} className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex justify-between items-center text-xs">
                        <div>
                          <p className="font-bold text-slate-850 capitalize">{b.type} Bill</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{b.period || 'Utility Service'}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-extrabold text-slate-850 font-black">₹{b.amount}</p>
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-bold uppercase mt-1 ${
                            b.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {b.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeHistoryTab === 'complaints' && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b pb-2 mb-3">Filed Complaints History</h3>
                {myComplaints.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">No complaints filed by your account.</p>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {myComplaints.map(c => (
                      <div key={c.id} className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs space-y-1">
                        <div className="flex justify-between items-start">
                          <p className="font-bold text-slate-850">{c.title}</p>
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                            c.status === 'resolved' ? 'bg-emerald-100 text-emerald-700' : 
                            c.status === 'in_progress' ? 'bg-amber-100 text-amber-700' : 
                            'bg-red-100 text-red-700'
                          }`}>
                            {c.status}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400">{c.location_text || 'MG Road'} · Category: {c.category}</p>
                        {c.description && <p className="text-[10px] text-slate-550 mt-1 italic">"{c.description}"</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeHistoryTab === 'sos' && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b pb-2 mb-3">Emergency SOS Dispatch History</h3>
                {mySOS.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">No emergency SOS signals triggered by your account.</p>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {mySOS.map(s => (
                      <div key={s.id} className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs space-y-1">
                        <div className="flex justify-between items-start">
                          <p className="font-bold text-red-600 uppercase tracking-wider">{s.type} Alert</p>
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                            s.status === 'resolved' ? 'bg-emerald-100 text-emerald-700' : 
                            'bg-red-100 text-red-700 animate-pulse'
                          }`}>
                            {s.status}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400">{new Date(s.created_at).toLocaleString()}</p>
                        <p className="text-[10px] text-slate-550 font-semibold">Location: {s.location_text || 'Ward Coordinates'}</p>
                        {s.notes && <p className="text-[10px] text-slate-500 mt-1 italic">Notes: {s.notes}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button 
              onClick={() => setActiveHistoryTab(null)} 
              className="w-full mt-4 py-2.5 bg-slate-100 border border-slate-200 hover:bg-slate-150 rounded-xl font-bold text-xs text-slate-600 transition-colors cursor-pointer animate-fade-in"
            >
              Dismiss View
            </button>
          </div>
        </div>
      )}
    </Screen>
  );
}

function SettingRow({ icon: Icon, label, value }: { icon: typeof Bell; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-4">
      <div className="w-9 h-9 rounded-xl bg-ink-100 flex items-center justify-center">
        <Icon className="w-4 h-4 text-ink-500" />
      </div>
      <span className="flex-1 text-sm font-medium text-ink-700">{label}</span>
      <span className="text-sm text-ink-400">{value}</span>
      <ChevronRight className="w-4 h-4 text-ink-300" />
    </div>
  );
}
