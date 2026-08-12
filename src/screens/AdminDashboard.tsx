import { useEffect, useState } from 'react';
import { 
  Shield, Users, AlertCircle, CreditCard, Siren, LogOut, CheckCircle2, Trash2, ArrowRight, Camera, X, ZoomIn, ZoomOut, Navigation, MapPin, Mail, RefreshCw
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { formatINR } from '@/lib/utils';

type Tab = 'users' | 'complaints' | 'bills' | 'emergencies';

export default function AdminDashboard({ onSwitchToCitizen }: { onSwitchToCitizen?: () => void }) {
  const { profile, session, signOut, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('users');
  
  // Database Tables Lists
  const [users, setUsers] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [emergencies, setEmergencies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Search Queries States
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [billSearchQuery, setBillSearchQuery] = useState('');
  const [sosSearchQuery, setSosSearchQuery] = useState('');
  const [complaintSearchQuery, setComplaintSearchQuery] = useState('');

  // Clear/Adjust Utility States
  const [selectedBillToClear, setSelectedBillToClear] = useState<any>(null);
  const [deductAmount, setDeductAmount] = useState('');
  const [clearingAmount, setClearingAmount] = useState(false);

  // Admin Reset PW States
  const [selectedUserToResetPW, setSelectedUserToResetPW] = useState<any>(null);
  const [newAdminResetPassword, setNewAdminResetPassword] = useState('');
  const [resettingPW, setResettingPW] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState(1);

  // Analytics Metrics
  const [metrics, setMetrics] = useState({
    totalUsers: 0,
    activeComplaints: 0,
    totalUnpaidAmount: 0,
    activeEmergencies: 0,
  });

  const loadMetricsAndData = async () => {
    setLoading(true);
    setSyncError(null);
    try {
      const [usersRes, complaintsRes, billsRes, emergenciesRes] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('complaints').select('*').order('created_at', { ascending: false }),
        supabase.from('bills').select('*').order('created_at', { ascending: false }),
        supabase.from('emergency_requests').select('*').order('created_at', { ascending: false })
      ]);

      let usersList = usersRes.data ?? [];
      const errs: string[] = [];

      if (usersRes.error) {
        console.warn("Direct profiles query encountered an issue. Trying RPC get_all_profiles:", usersRes.error.message);
        try {
          const { data: rpcUsers, error: rpcErr } = await supabase.rpc('get_all_profiles');
          if (!rpcErr && rpcUsers && rpcUsers.length > 0) {
            usersList = rpcUsers;
          } else {
            errs.push(`Profiles Table: ${usersRes.error.message}`);
          }
        } catch (rpcEx) {
          errs.push(`Profiles Table: ${usersRes.error.message}`);
        }
      }

      if (complaintsRes.error) errs.push(`Complaints Table: ${complaintsRes.error.message}`);
      if (billsRes.error) errs.push(`Bills Table: ${billsRes.error.message}`);
      if (emergenciesRes.error) errs.push(`SOS Table: ${emergenciesRes.error.message}`);

      if (errs.length > 0) {
        console.warn("Database sync notices:", errs);
        setSyncError(errs.join(' • '));
      }

      const complaintsList = complaintsRes.data ?? [];
      const billsList = billsRes.data ?? [];
      const emergenciesList = emergenciesRes.data ?? [];

      setUsers(usersList);
      setComplaints(complaintsList);
      setBills(billsList);
      setEmergencies(emergenciesList);

      // Calculate Metrics
      const totalUsers = usersList.length;
      const activeComplaints = complaintsList.filter((c: any) => c.status !== 'resolved' && c.status !== 'rejected').length;
      const totalUnpaidAmount = billsList.filter((b: any) => b.status === 'unpaid').reduce((sum: number, b: any) => sum + Number(b.amount), 0);
      const activeEmergencies = emergenciesList.filter((e: any) => e.status !== 'resolved').length;

      setMetrics({
        totalUsers,
        activeComplaints,
        totalUnpaidAmount,
        activeEmergencies
      });
    } catch (e: any) {
      console.error('Failed to load admin metrics:', e);
      setSyncError(e?.message || 'Failed to sync municipal database tables');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetricsAndData();
  }, []);

  const handleToggleBlock = async (userId: string, currentBlocked: boolean) => {
    const target = users.find(u => u.id === userId);
    if (target?.email === 'rohitranjanpatra8@gmail.com' || target?.phone === '7735550648') {
      alert("Security Violation: You do not have permission to suspend the primary owner account!");
      return;
    }
    if (userId === profile?.id) {
      alert("You cannot suspend your own admin account!");
      return;
    }
    const confirmMsg = currentBlocked 
      ? "Are you sure you want to reactivate and unblock this user's account?" 
      : "Are you sure you want to block and suspend this user's account? They will lose access to the app immediately.";
    if (window.confirm(confirmMsg)) {
      await supabase.from('profiles').update({ blocked: !currentBlocked }).eq('id', userId);
      loadMetricsAndData();
    }
  };

  const handleUpdateComplaintStatus = async (complaintId: string, newStatus: string, childIds: string[] = []) => {
    const ids = [complaintId, ...childIds];
    await Promise.all(ids.map(id => 
      supabase.from('complaints').update({ status: newStatus }).eq('id', id)
    ));
    loadMetricsAndData();
  };

  const handleUpdateBillStatus = async (billId: string, newStatus: string) => {
    await supabase.from('bills').update({ status: newStatus }).eq('id', billId);
    loadMetricsAndData();
  };

  const handleClearBillAmount = async () => {
    if (!selectedBillToClear) return;
    const amtToDeduct = Number(deductAmount);
    if (isNaN(amtToDeduct) || amtToDeduct <= 0) {
      alert("Please enter a valid positive number.");
      return;
    }
    if (amtToDeduct > Number(selectedBillToClear.amount)) {
      alert("Deduct amount cannot be greater than the outstanding bill amount!");
      return;
    }
    setClearingAmount(true);
    const newAmount = Number(selectedBillToClear.amount) - amtToDeduct;
    const newStatus = newAmount <= 0 ? 'paid' : selectedBillToClear.status;
    
    await supabase
      .from('bills')
      .update({ 
        amount: newAmount, 
        status: newStatus,
        paid_at: newAmount <= 0 ? new Date().toISOString() : null
      })
      .eq('id', selectedBillToClear.id);
    
    setClearingAmount(false);
    setSelectedBillToClear(null);
    setDeductAmount('');
    loadMetricsAndData();
  };

  const handleDeleteBill = async (billId: string) => {
    if (confirm('Delete this bill transaction?')) {
      const { error } = await supabase.from('bills').delete().eq('id', billId);
      if (error) {
        alert("Failed to delete bill: " + error.message);
      } else {
        loadMetricsAndData();
      }
    }
  };

  const handleDeleteUser = async (userId: string) => {
    const target = users.find(u => u.id === userId);
    if (target?.email === 'rohitranjanpatra8@gmail.com' || target?.phone === '7735550648') {
      alert("Security Violation: You do not have permission to delete the primary owner account!");
      return;
    }
    if (userId === profile?.id) {
      alert("You cannot delete your own admin account!");
      return;
    }
    if (confirm(`Are you sure you want to permanently delete user "${target?.full_name || 'Registered User'}" and all associated profiles/records? This action is irreversible.`)) {
      const { error } = await supabase.rpc('admin_delete_user', { target_user_id: userId });
      if (error) {
        alert("Failed to delete user: " + error.message);
      } else {
        alert("User deleted successfully!");
        loadMetricsAndData();
      }
    }
  };

  const handleDeleteComplaint = async (complaintId: string, childIds: string[] = []) => {
    if (confirm("Permanently delete this complaint and all associated consolidated reports? This action is irreversible.")) {
      const ids = [complaintId, ...childIds];
      const { error } = await supabase.from('complaints').delete().in('id', ids);
      if (error) {
        alert("Failed to delete complaint: " + error.message);
      } else {
        loadMetricsAndData();
      }
    }
  };

  const handleDeleteEmergency = async (id: string) => {
    if (confirm("Permanently delete this SOS dispatch record? This action is irreversible.")) {
      const { error } = await supabase.from('emergency_requests').delete().eq('id', id);
      if (error) {
        alert("Failed to delete SOS record: " + error.message);
      } else {
        loadMetricsAndData();
      }
    }
  };

  const handleAdminResetPassword = async () => {
    if (!selectedUserToResetPW) return;
    if (selectedUserToResetPW.email === 'rohitranjanpatra8@gmail.com' || selectedUserToResetPW.phone === '7735550648') {
      alert("Security Violation: You do not have permission to reset the password of the primary owner account!");
      return;
    }
    if (!newAdminResetPassword.trim() || newAdminResetPassword.length < 6) {
      alert("Password must be at least 6 characters long!");
      return;
    }
    setResettingPW(true);
    const { error } = await supabase.rpc('admin_reset_user_password', {
      target_user_id: selectedUserToResetPW.id,
      new_plaintext_password: newAdminResetPassword.trim()
    });
    setResettingPW(false);
    if (error) {
      alert("Failed to reset password: " + error.message);
    } else {
      alert(`Successfully reset password for ${selectedUserToResetPW.full_name || 'user'}!`);
      setSelectedUserToResetPW(null);
      setNewAdminResetPassword('');
    }
  };

  const handleResolveEmergency = async (id: string) => {
    await supabase.from('emergency_requests').update({ status: 'resolved' }).eq('id', id);
    loadMetricsAndData();
  };

  const handleChangeUserRole = async (userId: string, newRole: 'citizen' | 'police' | 'hospital' | 'bmc' | 'admin') => {
    const target = users.find(u => u.id === userId);
    if (target?.email === 'rohitranjanpatra8@gmail.com' || target?.phone === '7735550648') {
      alert("Security Violation: You do not have permission to modify the owner's role authority!");
      return;
    }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId)
        .select();
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("Row update was rejected by Row-Level Security. Please ensure you have run the migration script in your Supabase SQL Editor to allow admins to edit profiles.");
      }
      loadMetricsAndData();
      alert(`User role updated successfully to ${newRole.toUpperCase()}!`);
    } catch (e: any) {
      alert("Failed to update user role: " + e.message);
    }
  };

  const handleRedoComplaint = async (id: string) => {
    if (window.confirm("Are you sure you want to redo this complaint? This will reset its status to 'submitted' and clear BMC resolution proof notes.")) {
      await supabase
        .from('complaints')
        .update({ status: 'submitted', resolution_proof: null, resolved_at: null })
        .eq('id', id);
      loadMetricsAndData();
    }
  };

  const handleRedoEmergency = async (id: string) => {
    if (window.confirm("Are you sure you want to re-open/redo this SOS dispatch? This will reset its status to 'active'.")) {
      await supabase
        .from('emergency_requests')
        .update({ status: 'active', resolved_at: null })
        .eq('id', id);
      loadMetricsAndData();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-slate-900 border-b border-white/5 px-6 py-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/10 shadow-lg shrink-0">
            <img src="/logo.jpg" alt="CityZen Logo" className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="font-extrabold text-lg text-orange-300">CityZen Admin Control Center</h1>
            <p className="text-xs text-slate-400">Superuser Municipal Auditing & System Configuration</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex flex-col text-right hidden sm:block">
            <span className="text-xs font-bold text-white">{profile?.full_name || 'System Administrator'}</span>
            <span className="text-[10px] text-slate-400 font-mono flex items-center justify-end gap-1">
              <Mail className="w-3 h-3 text-slate-500" /> {session?.user?.email || profile?.email || 'admin@cityzen.gov'}
            </span>
          </div>

          <div className="bg-orange-950/40 px-3 py-1.5 rounded-xl border border-orange-500/20 text-[10px] font-bold text-orange-400">
            Role: Super Admin
          </div>

          <button
            onClick={() => loadMetricsAndData()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-xl text-xs text-slate-200 font-bold transition-all cursor-pointer shadow-sm disabled:opacity-50"
            title="Refresh and sync all municipal tables"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-orange-400' : 'text-slate-400'}`} /> Sync
          </button>

          {onSwitchToCitizen && (
            <button
              onClick={onSwitchToCitizen}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-950/40 hover:bg-blue-900/60 border border-blue-500/30 rounded-xl text-xs text-blue-300 font-bold transition-all cursor-pointer shadow-sm"
              title="Preview Citizen View"
            >
              <Users className="w-3.5 h-3.5" /> Citizen View
            </button>
          )}

          <button
            onClick={signOut}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-950/40 hover:bg-red-950/70 border border-red-500/20 rounded-xl text-xs text-red-400 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </header>

      {/* Database Policy Notice Banner if any */}
      {syncError && (
        <div className="bg-amber-950/80 border-b border-amber-500/30 px-6 py-2.5 flex items-center justify-between text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span><strong>Database Table Notice:</strong> {syncError}. Please run the latest SQL migration in your Supabase SQL Editor.</span>
          </div>
          <button
            onClick={() => loadMetricsAndData()}
            className="underline text-amber-300 hover:text-white font-bold ml-4 shrink-0"
          >
            Retry Sync
          </button>
        </div>
      )}

      {/* Main Analytics Cards */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Total Citizens */}
          <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-4 flex items-center gap-4 shadow">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Citizens</p>
              <p className="text-2xl font-black text-white mt-0.5">{metrics.totalUsers}</p>
            </div>
          </div>

          {/* Active Complaints */}
          <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-4 flex items-center gap-4 shadow">
            <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-400">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Active Complaints</p>
              <p className="text-2xl font-black text-white mt-0.5">{metrics.activeComplaints}</p>
            </div>
          </div>

          {/* Total Unpaid Invoice Amount */}
          <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-4 flex items-center gap-4 shadow">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Unpaid Bills</p>
              <p className="text-lg font-black text-emerald-400 mt-1">{formatINR(metrics.totalUnpaidAmount)}</p>
            </div>
          </div>

          {/* Active SOS alerts */}
          <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-4 flex items-center gap-4 shadow">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400">
              <Siren className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Active Emergency SOS</p>
              <p className="text-2xl font-black text-red-400 mt-0.5">{metrics.activeEmergencies}</p>
            </div>
          </div>
        </div>

        {/* Tab Selector Section */}
        <div className="bg-slate-900/60 border border-white/5 rounded-3xl p-6 shadow-xl backdrop-blur-md">
          <div className="flex gap-2 p-1 bg-slate-950 rounded-xl mb-6 max-w-lg">
            {([
              { id: 'users', label: 'User Roles', icon: Users },
              { id: 'complaints', label: 'Complaints', icon: AlertCircle },
              { id: 'bills', label: 'Utility Invoices', icon: CreditCard },
              { id: 'emergencies', label: 'SOS Dispatches', icon: Siren },
            ] as const).map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === t.id ? 'bg-orange-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" /> {t.label}
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="space-y-4 py-8">
              {[1, 2, 3].map(i => <div key={i} className="h-12 bg-slate-950/50 rounded-xl skeleton" />)}
            </div>
          ) : (
            <div>
              {/* Active Search Bars based on selected tab */}
              <div className="mb-5">
                {activeTab === 'users' && (
                  <div className="relative max-w-md">
                    <input
                      type="text"
                      placeholder="Search users by name, email, or phone..."
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-xs focus:outline-none focus:border-orange-500 text-white placeholder-slate-500"
                    />
                  </div>
                )}
                {activeTab === 'complaints' && (
                  <div className="relative max-w-md">
                    <input
                      type="text"
                      placeholder="Search complaints by title, department, location, or citizen..."
                      value={complaintSearchQuery}
                      onChange={(e) => setComplaintSearchQuery(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-xs focus:outline-none focus:border-orange-500 text-white placeholder-slate-500"
                    />
                  </div>
                )}
                {activeTab === 'bills' && (
                  <div className="relative max-w-md">
                    <input
                      type="text"
                      placeholder="Search invoices by citizen name, email, or biller type..."
                      value={billSearchQuery}
                      onChange={(e) => setBillSearchQuery(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-xs focus:outline-none focus:border-orange-500 text-white placeholder-slate-500"
                    />
                  </div>
                )}
                {activeTab === 'emergencies' && (
                  <div className="relative max-w-md">
                    <input
                      type="text"
                      placeholder="Search SOS by city, ward, or citizen name..."
                      value={sosSearchQuery}
                      onChange={(e) => setSosSearchQuery(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-xs focus:outline-none focus:border-orange-500 text-white placeholder-slate-500"
                    />
                  </div>
                )}
              </div>

              <div className="overflow-x-auto">
                {/* Tab 1: User Roles Management */}
                {activeTab === 'users' && (() => {
                  const filteredUsers = users.filter(u => 
                    u.full_name?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                    u.email?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                    u.phone?.toLowerCase().includes(userSearchQuery.toLowerCase())
                  );

                  return (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-white/10 text-slate-400 font-bold uppercase text-[10px]">
                          <th className="pb-3">User Profile Name</th>
                          <th className="pb-3">Email Address</th>
                          <th className="pb-3">Role Authority</th>
                          <th className="pb-3">Ward</th>
                          <th className="pb-3">Linked Utilities</th>
                          <th className="pb-3">Status</th>
                          <th className="pb-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-8 text-center text-slate-500">
                              <Users className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                              <p className="font-semibold text-xs text-slate-300">No matching user accounts found</p>
                              <p className="text-[10px] text-slate-500 mt-1">If newly registered, click the Sync button above to refresh user records.</p>
                            </td>
                          </tr>
                        ) : (
                          filteredUsers.map(u => {
                            const userBills = bills.filter(b => b.user_id === u.id);
                          const unpaidTotal = userBills.filter(b => b.status === 'unpaid').reduce((sum, b) => sum + Number(b.amount), 0);
                          const billTypes = Array.from(new Set(userBills.map(b => b.type)));

                          return (
                            <tr key={u.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                              <td className="py-3 font-semibold text-white">
                                {u.full_name || 'Anonymous User'}
                                <span className="block text-[10px] text-slate-400 font-normal">{u.phone || 'No phone'}</span>
                              </td>
                              <td className="py-3 text-slate-300 font-medium">{u.email || 'N/A'}</td>
                              <td className="py-3">
                                {u.email === 'rohitranjanpatra8@gmail.com' || u.phone === '7735550648' ? (
                                  <span className="inline-block px-2.5 py-0.5 rounded text-[9px] font-bold uppercase border bg-orange-500/10 text-orange-400 border-orange-500/20 animate-pulse">
                                    Primary Owner
                                  </span>
                                ) : u.id !== profile?.id ? (
                                  <select
                                    value={u.role}
                                    onChange={(e) => handleChangeUserRole(u.id, e.target.value as any)}
                                    className={`bg-slate-900 border rounded-xl px-2 py-1 text-[10px] font-bold uppercase focus:outline-none focus:border-orange-500 cursor-pointer ${
                                      u.role === 'admin' ? 'text-orange-400 border-orange-500/25 bg-orange-500/10' :
                                      u.role === 'police' ? 'text-blue-400 border-blue-500/25 bg-blue-500/10' :
                                      u.role === 'hospital' ? 'text-red-400 border-red-500/25 bg-red-500/10' :
                                      u.role === 'bmc' ? 'text-amber-400 border-amber-500/25 bg-amber-500/10' :
                                      'text-emerald-400 border-emerald-500/25 bg-emerald-500/10'
                                    }`}
                                  >
                                    <option value="citizen">Citizen</option>
                                    <option value="police">Police</option>
                                    <option value="hospital">Hospital</option>
                                    <option value="bmc">BMC</option>
                                    <option value="admin">Super Admin</option>
                                  </select>
                                ) : (
                                  <span className="inline-block px-2.5 py-0.5 rounded text-[9px] font-bold uppercase border bg-orange-500/10 text-orange-400 border-orange-500/20">
                                    Super Admin
                                  </span>
                                )}
                              </td>
                              <td className="py-3 text-slate-300">{u.ward ? `Ward ${u.ward}` : 'Not set'}</td>
                              <td className="py-3 text-slate-300">
                                {userBills.length > 0 ? (
                                  <div>
                                    <span className="capitalize font-semibold text-slate-200">{billTypes.join(', ')}</span>
                                    <span className="block text-[10px] text-red-400">Due: {formatINR(unpaidTotal)}</span>
                                  </div>
                                ) : (
                                  <span className="text-slate-500">None linked</span>
                                )}
                              </td>
                              <td className="py-3">
                                <span className={`inline-block px-2.5 py-0.5 rounded text-[9px] font-bold uppercase border ${
                                  u.blocked ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                }`}>
                                  {u.blocked ? 'Blocked' : 'Active'}
                                </span>
                              </td>
                              <td className="py-3 text-right">
                                {u.email === 'rohitranjanpatra8@gmail.com' || u.phone === '7735550648' ? (
                                  <span className="text-[10px] text-orange-400 font-bold italic pr-2">Primary Owner</span>
                                ) : u.id !== profile?.id ? (
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      onClick={() => handleToggleBlock(u.id, !!u.blocked)}
                                      className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border transition-colors cursor-pointer ${
                                        u.blocked
                                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/25'
                                          : 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/25'
                                      }`}
                                    >
                                      {u.blocked ? 'Unblock' : 'Block'}
                                    </button>
                                    <button
                                      onClick={() => { setSelectedUserToResetPW(u); setNewAdminResetPassword(''); }}
                                      className="px-2.5 py-1 rounded-xl text-[10px] font-bold border border-white/10 bg-slate-850 hover:bg-slate-800 text-slate-300 transition-colors cursor-pointer"
                                    >
                                      Reset PW
                                    </button>
                                    <button
                                      onClick={() => handleDeleteUser(u.id)}
                                      className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                                      title="Delete User Account"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-500 font-semibold italic pr-2">Your Account</span>
                                )}
                              </td>
                            </tr>
                          );
                        }))}
                      </tbody>
                    </table>
                  );
                })()}

                {/* Tab 2: Complaints Auditing */}
                {activeTab === 'complaints' && (() => {
                  const filteredComplaints = complaints.filter(c => {
                    const query = complaintSearchQuery.toLowerCase();
                    const user = users.find(u => u.id === c.user_id);
                    return c.title?.toLowerCase().includes(query) ||
                           c.category?.toLowerCase().includes(query) ||
                           c.department?.toLowerCase().includes(query) ||
                           c.location_text?.toLowerCase().includes(query) ||
                           c.description?.toLowerCase().includes(query) ||
                           user?.full_name?.toLowerCase().includes(query) ||
                           user?.email?.toLowerCase().includes(query);
                  });
                  const masters = filteredComplaints.filter(c => 
                    !c.description?.startsWith('[ML_MERGE:') && 
                    !c.description?.startsWith('[ML_CLUSTER_OVERLOAD:')
                  );

                  return (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-white/10 text-slate-400 font-bold uppercase text-[10px]">
                          <th className="pb-3">Complaint Details</th>
                          <th className="pb-3 text-center">Consolidated Reports Count</th>
                          <th className="pb-3">Filed By (Citizens)</th>
                          <th className="pb-3">Department</th>
                          <th className="pb-3">Location</th>
                          <th className="pb-3 text-right">Lifecycle Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {masters.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-slate-500">
                              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                              <p className="font-semibold text-xs text-slate-300">No complaints reported or matching search</p>
                              <p className="text-[10px] text-slate-500 mt-1">Complaints filed by citizens will appear here with live ML deduplication & BMC resolution proof.</p>
                            </td>
                          </tr>
                        ) : (
                          masters.map(c => {
                          const children = complaints.filter(x => 
                            x.description && (
                              x.description.startsWith(`[ML_MERGE:${c.id}]`) ||
                              x.description.includes(`[ML_CLUSTER_OVERLOAD:${c.id}`)
                            )
                          );
                          const childIds = children.map(x => x.id);
                          const reportCount = 1 + children.length;
                          const cleanDesc = c.description ?? 'No description';
                          const getUserName = (uid: string) => users.find(u => u.id === uid)?.full_name ?? 'Anonymous';
                          const citizenNames = [getUserName(c.user_id), ...children.map(x => getUserName(x.user_id))].join(', ');

                          return (
                            <tr key={c.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                              <td className="py-3 pr-2">
                                <p className="font-semibold text-white flex flex-wrap items-center gap-1.5">
                                  {c.title}
                                  {c.photo_url && (
                                    <button 
                                      onClick={() => setPreviewPhoto(c.photo_url)}
                                      className="text-[9px] bg-cyan-500/10 hover:bg-cyan-500/25 text-cyan-400 px-2 py-0.5 rounded border border-cyan-500/20 cursor-pointer transition-colors flex items-center gap-1 shrink-0 font-bold"
                                    >
                                      <Camera className="w-2.5 h-2.5" /> Citizen Photo
                                    </button>
                                  )}
                                  {c.resolution_photo_url && (
                                    <button 
                                      onClick={() => setPreviewPhoto(c.resolution_photo_url)}
                                      className="text-[9px] bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 cursor-pointer transition-colors flex items-center gap-1 shrink-0 font-bold"
                                    >
                                      <CheckCircle2 className="w-2.5 h-2.5" /> BMC Proof Photo
                                    </button>
                                  )}
                                  {c.ml_verification_score && (
                                    <span className="text-[9px] bg-emerald-500/10 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/20 font-bold">
                                      {c.ml_verification_score}% Authenticity Verified
                                    </span>
                                  )}
                                </p>
                                <p className="text-[10px] text-slate-400 mt-0.5 max-w-sm truncate">{cleanDesc}</p>
                                {c.status === 'resolved' && c.resolution_proof && (
                                  <p className="text-[10px] text-emerald-400 mt-1 italic">
                                    BMC Proof: "{c.resolution_proof}"
                                  </p>
                                )}
                              </td>
                              <td className="py-3 text-center">
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                  reportCount > 1 
                                    ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20 animate-pulse' 
                                    : 'bg-slate-800 text-slate-400 border border-slate-700/50'
                                }`}>
                                  {reportCount} {reportCount === 1 ? 'report' : 'reports'}
                                </span>
                              </td>
                              <td className="py-3 text-slate-300 max-w-xs truncate" title={citizenNames}>
                                {citizenNames}
                              </td>
                              <td className="py-3 text-slate-300 capitalize">{c.category} ({c.department || 'Civic'})</td>
                              <td className="py-3 text-slate-300">
                                <div className="space-y-1">
                                  <span>{c.location_text || 'MG Road'}</span>
                                  {c.lat && c.lng && (
                                    <button
                                      onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}`, '_blank')}
                                      className="text-[9px] text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/25 px-2 py-0.5 rounded border border-emerald-500/20 font-bold flex items-center gap-1 cursor-pointer transition-all"
                                    >
                                      <Navigation className="w-2.5 h-2.5" /> Guide Me
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <select
                                    value={c.status}
                                    onChange={(e) => handleUpdateComplaintStatus(c.id, e.target.value as any, childIds)}
                                    className="bg-slate-900 border border-white/10 rounded-xl px-2 py-1 text-[10px] font-bold focus:outline-none focus:border-orange-500 cursor-pointer text-slate-200"
                                  >
                                    <option value="submitted">Submitted</option>
                                    <option value="assigned">Assigned</option>
                                    <option value="in_progress">In Progress</option>
                                    <option value="resolved">Resolved</option>
                                    <option value="rejected">Rejected</option>
                                  </select>
                                  <button
                                    onClick={() => handleDeleteComplaint(c.id, childIds)}
                                    className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                                    title="Delete Complaint and linked duplicates"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        }))}
                      </tbody>
                    </table>
                  );
                })()}

                {/* Tab 3: Utility Invoices Auditing */}
                {activeTab === 'bills' && (() => {
                  const filteredBills = bills.filter(b => {
                    const user = users.find(u => u.id === b.user_id);
                    const query = billSearchQuery.toLowerCase();
                    return b.period?.toLowerCase().includes(query) ||
                           b.type?.toLowerCase().includes(query) ||
                           user?.full_name?.toLowerCase().includes(query) ||
                           user?.email?.toLowerCase().includes(query);
                  });

                  return (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-white/10 text-slate-400 font-bold uppercase text-[10px]">
                          <th className="pb-3">Citizen (Owner)</th>
                          <th className="pb-3">Biller Details</th>
                          <th className="pb-3">Biller Type</th>
                          <th className="pb-3">Amount Due</th>
                          <th className="pb-3">Due Date</th>
                          <th className="pb-3">Status</th>
                          <th className="pb-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredBills.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-8 text-center text-slate-500">
                              <CreditCard className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                              <p className="font-semibold text-xs text-slate-300">No utility bills found</p>
                              <p className="text-[10px] text-slate-500 mt-1">Water, electricity, property tax, and waste invoices will be listed here.</p>
                            </td>
                          </tr>
                        ) : (
                          filteredBills.map(b => {
                          const user = users.find(u => u.id === b.user_id);
                          return (
                            <tr key={b.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                              <td className="py-3 font-bold text-slate-200">
                                {user ? user.full_name : 'Unknown Citizen'}
                                <span className="block text-[10px] text-slate-400 font-normal">{user?.email || user?.phone || 'No Contact'}</span>
                              </td>
                              <td className="py-3 font-semibold text-white">{b.period || 'Utility Service'}</td>
                              <td className="py-3 text-slate-300 capitalize">{b.type}</td>
                              <td className="py-3 text-slate-300 font-bold">{formatINR(Number(b.amount))}</td>
                              <td className="py-3 text-slate-400">{b.due_date}</td>
                              <td className="py-3">
                                <div className="flex items-center gap-2">
                                  <select
                                    value={b.status}
                                    onChange={(e) => handleUpdateBillStatus(b.id, e.target.value)}
                                    className={`border rounded-xl px-2 py-0.5 text-[10px] font-bold ${
                                      b.status === 'paid' 
                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                                    }`}
                                  >
                                    <option value="unpaid">Unpaid</option>
                                    <option value="paid">Paid</option>
                                  </select>

                                  {b.status === 'unpaid' && (
                                    <button
                                      onClick={() => { setSelectedBillToClear(b); setDeductAmount(''); }}
                                      className="px-2 py-0.5 border border-orange-500/20 bg-orange-500/10 text-orange-400 hover:bg-orange-500/25 rounded-xl text-[9px] font-bold transition-all cursor-pointer"
                                    >
                                      Deduct Balance
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 text-right">
                                <button
                                  onClick={() => handleDeleteBill(b.id)}
                                  className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        }))}
                      </tbody>
                    </table>
                  );
                })()}

                {/* Tab 4: SOS Dispatches monitoring */}
                {activeTab === 'emergencies' && (() => {
                  const filteredEmergencies = emergencies.filter(e => {
                    const query = sosSearchQuery.toLowerCase();
                    const user = users.find(u => u.id === e.user_id);
                    return e.location_text?.toLowerCase().includes(query) ||
                           e.notes?.toLowerCase().includes(query) ||
                           e.type?.toLowerCase().includes(query) ||
                           user?.full_name?.toLowerCase().includes(query);
                  });

                  return (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-white/10 text-slate-400 font-bold uppercase text-[10px]">
                          <th className="pb-3">Emergency Alert</th>
                          <th className="pb-3">Citizen Name</th>
                          <th className="pb-3">Location Coordinates</th>
                          <th className="pb-3">Dispatch Notes</th>
                          <th className="pb-3">Triggered Time</th>
                          <th className="pb-3">Status</th>
                          <th className="pb-3 text-right">Resolution</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredEmergencies.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-8 text-center text-slate-500">
                              <Siren className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                              <p className="font-semibold text-xs text-slate-300">No emergency SOS requests triggered</p>
                              <p className="text-[10px] text-slate-500 mt-1">Live police, ambulance, and disaster SOS alarms will be monitored here.</p>
                            </td>
                          </tr>
                        ) : (
                          filteredEmergencies.map(e => {
                          const user = users.find(u => u.id === e.user_id);
                          return (
                            <tr key={e.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                              <td className="py-3 font-semibold text-red-400 uppercase tracking-wider">{e.type}</td>
                              <td className="py-3 font-bold text-slate-200">
                                {user ? user.full_name : 'Unknown Citizen'}
                                <span className="block text-[10px] text-slate-400 font-normal">{user?.phone || 'No phone'}</span>
                              </td>
                              <td className="py-3 text-slate-300">{e.location_text || 'Ward 12'}</td>
                              <td className="py-3 text-slate-300 max-w-sm truncate">{e.notes || 'No description'}</td>
                              <td className="py-3 text-slate-400">{new Date(e.created_at).toLocaleTimeString()}</td>
                              <td className="py-3">
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                                  e.status === 'active' ? 'bg-red-500/10 text-red-400 border-red-500/20 animate-pulse' :
                                  e.status === 'dispatched' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                  'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                }`}>
                                  {e.status}
                                </span>
                              </td>
                              <td className="py-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {e.status !== 'resolved' ? (
                                    <button
                                      onClick={() => handleResolveEmergency(e.id)}
                                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                                    >
                                      Resolve
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleRedoEmergency(e.id)}
                                      className="px-2.5 py-1 bg-red-950/40 hover:bg-red-950/70 border border-red-500/20 text-red-400 font-bold rounded-lg text-[10px] transition-colors cursor-pointer"
                                      title="Redo SOS dispatch request"
                                    >
                                      Redo
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleDeleteEmergency(e.id)}
                                    className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                                    title="Delete SOS Dispatch"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        }))}
                      </tbody>
                    </table>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Deduct/Clear Bill Amount Modal */}
      {selectedBillToClear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setSelectedBillToClear(null)} />
          <div className="relative w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 className="font-extrabold text-base text-orange-300">Deduct / Clear Bill Balance</h3>
            <div className="bg-slate-950/40 p-4 rounded-xl border border-white/5 space-y-1 text-xs">
              <p className="text-slate-400">CITIZEN OWNER</p>
              <p className="font-bold text-white">
                {users.find(u => u.id === selectedBillToClear.user_id)?.full_name || 'Citizen'}
              </p>
              <div className="flex justify-between mt-2 pt-2 border-t border-white/5">
                <span className="text-slate-400">Biller Detail:</span>
                <span className="font-semibold text-white capitalize">{selectedBillToClear.type} · {selectedBillToClear.period}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Outstanding Balance:</span>
                <span className="font-bold text-orange-400">{formatINR(Number(selectedBillToClear.amount))}</span>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 block mb-1.5 uppercase tracking-wider">Enter Amount to Deduct/Clear</label>
              <input
                type="number"
                placeholder="e.g. 500"
                value={deductAmount}
                onChange={(e) => setDeductAmount(e.target.value)}
                className="w-full px-4 py-3 bg-slate-950 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-orange-500 text-white"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setSelectedBillToClear(null)}
                className="flex-1 py-2.5 bg-slate-850 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleClearBillAmount}
                disabled={clearingAmount}
                className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50 cursor-pointer"
              >
                {clearingAmount ? 'Deducting...' : 'Deduct Balance'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Password Reset Modal */}
      {selectedUserToResetPW && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setSelectedUserToResetPW(null)} />
          <div className="relative w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 className="font-extrabold text-base text-orange-300">Force Password Reset</h3>
            <div className="bg-slate-950/40 p-4 rounded-xl border border-white/5 space-y-1 text-xs">
              <p className="text-slate-400">TARGET USER</p>
              <p className="font-bold text-white">{selectedUserToResetPW.full_name || 'Anonymous User'}</p>
              <p className="text-slate-400 mt-1">{selectedUserToResetPW.email || 'No email'}</p>
              <p className="text-slate-400">{selectedUserToResetPW.phone || 'No phone'}</p>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 block mb-1.5 uppercase tracking-wider">New Password</label>
              <input
                type="text"
                placeholder="Enter new password (min 6 chars)"
                value={newAdminResetPassword}
                onChange={(e) => setNewAdminResetPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-950 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-orange-500 text-white"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setSelectedUserToResetPW(null)}
                className="flex-1 py-2.5 bg-slate-850 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleAdminResetPassword}
                disabled={resettingPW}
                className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50 cursor-pointer"
              >
                {resettingPW ? 'Resetting...' : 'Force Reset'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Preview Lightbox Modal */}
      {previewPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={() => { setPreviewPhoto(null); setZoomScale(1); }} />
          <div className="relative max-w-3xl w-full bg-slate-900 border border-white/10 rounded-3xl p-5 overflow-hidden flex flex-col items-center justify-center animate-slide-up shadow-2xl">
            <button
              onClick={() => { setPreviewPhoto(null); setZoomScale(1); }}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-950/60 border border-white/10 text-white flex items-center justify-center hover:bg-slate-950 transition-colors cursor-pointer z-10"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="w-full overflow-auto flex items-center justify-center rounded-2xl bg-black/40 p-2 border border-white/5 max-h-[70vh]">
              <img 
                src={previewPhoto} 
                alt="Evidence Lightbox" 
                className="max-w-full max-h-[65vh] object-contain rounded-xl transition-transform duration-200" 
                style={{ transform: `scale(${zoomScale})` }}
              />
            </div>
            
            {/* Interactive Zoom Controller */}
            <div className="mt-4 flex items-center gap-3 bg-slate-950/80 border border-white/10 rounded-full px-4 py-2 text-white shadow-lg">
              <button 
                type="button"
                onClick={() => setZoomScale(s => Math.max(1, s - 0.25))}
                className="p-1 hover:bg-white/10 rounded transition-colors cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold font-mono min-w-[40px] text-center">{Math.round(zoomScale * 100)}%</span>
              <button 
                type="button"
                onClick={() => setZoomScale(s => Math.min(3.5, s + 0.25))}
                className="p-1 hover:bg-white/10 rounded transition-colors cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <div className="w-px h-4 bg-white/20 mx-1" />
              <button 
                type="button"
                onClick={() => setZoomScale(1)}
                className="text-[10px] font-bold bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded transition-colors cursor-pointer"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
