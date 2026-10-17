import { useEffect, useState } from 'react';
import { 
  Shield, Users, AlertCircle, CreditCard, Siren, LogOut, CheckCircle2, Trash2, ArrowRight, Camera, X, ZoomIn, ZoomOut, Navigation, MapPin, Mail, RefreshCw, Calendar, Phone, Send, Copy, Check, ExternalLink, ShieldCheck, FileText, Zap, Settings, CheckCircle, Clock, Hourglass, CalendarClock, RotateCcw, ShieldAlert
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { formatINR, formatDate, timeAgo } from '@/lib/utils';
import { 
  sendAutomatedRoleChangeEmail, 
  sendAutomatedCitizenNoticeEmail,
  getEmailGatewayConfig, 
  saveEmailGatewayConfig, 
  sendTestAutomatedEmail, 
  ROLE_AUTHORITY_INFO,
  type EmailGatewayConfig 
} from '@/lib/emailService';
import {
  getActiveDeletionSchedule,
  formatDeletionCountdown,
  checkAccountCreationLock,
  adminModifyDeletionTiming,
  adminImmediateDeleteUser,
  cancelCitizenAccountDeletion,
  type DeletionScheduleEntry,
} from '@/lib/deletionService';

type Tab = 'users' | 'complaints' | 'bills' | 'emergencies';

interface RoleChangeNoticeState {
  isOpen: boolean;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  newRole: string;
  refNumber: string;
  subject: string;
  body: string;
  copied?: boolean;
  dispatching?: boolean;
  dispatchSuccess?: boolean;
  dispatchId?: string;
  dispatchMethod?: string;
  dispatchTimestamp?: string;
  dispatchError?: string;
}

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

  // Status Filter States
  const [complaintStatusFilter, setComplaintStatusFilter] = useState<'all' | 'active' | 'resolved'>('all');
  const [sosStatusFilter, setSosStatusFilter] = useState<'all' | 'active' | 'resolved'>('active');

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

  // Role Authority Notice Email Modal State
  const [roleNoticeModal, setRoleNoticeModal] = useState<RoleChangeNoticeState | null>(null);
  const [floatingToast, setFloatingToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setFloatingToast({ message, type });
    setTimeout(() => {
      setFloatingToast((cur) => (cur?.message === message ? null : cur));
    }, 4500);
  };

  // Automated Email Gateway Settings States
  const [gatewayModalOpen, setGatewayModalOpen] = useState(false);
  const [gatewayConfig, setGatewayConfig] = useState<EmailGatewayConfig>(getEmailGatewayConfig);
  const [gatewayTestEmail, setGatewayTestEmail] = useState(profile?.email || 'admin@cityzen.gov');
  const [gatewayTestStatus, setGatewayTestStatus] = useState<string | null>(null);
  const [gatewayTesting, setGatewayTesting] = useState(false);

  // Account Deletion Tracking & Timing Modification States
  const [userFilterMode, setUserFilterMode] = useState<'all' | 'deletion_scheduled'>('all');
  const [deletionManageModal, setDeletionManageModal] = useState<{
    isOpen: boolean;
    user: any;
    schedule: DeletionScheduleEntry;
    customDateInput: string;
    modifying: boolean;
    deletingImmediately: boolean;
    cancelling: boolean;
  } | null>(null);

  const openManageDeletion = (u: any, sched?: DeletionScheduleEntry | null) => {
    const activeSched = sched || getActiveDeletionSchedule(u);
    if (!activeSched) return;
    const d = new Date(activeSched.scheduledAt);
    const pad = (n: number) => String(n).padStart(2, '0');
    const localIso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    setDeletionManageModal({
      isOpen: true,
      user: u,
      schedule: activeSched,
      customDateInput: localIso,
      modifying: false,
      deletingImmediately: false,
      cancelling: false,
    });
  };

  const handleAdminModifyTiming = async (newDateIso: string) => {
    if (!deletionManageModal) return;
    setDeletionManageModal(prev => prev ? { ...prev, modifying: true } : null);
    try {
      const res = await adminModifyDeletionTiming({
        targetUserId: deletionManageModal.user.id,
        targetUserName: deletionManageModal.user.full_name || 'Citizen',
        targetUserEmail: deletionManageModal.user.email || '',
        newScheduledAt: new Date(newDateIso).toISOString(),
      });
      showToast(res.message, 'success');
      setDeletionManageModal(null);
      loadMetricsAndData();
    } catch (e: any) {
      alert(`Failed to modify deletion timing: ${e.message || e}`);
      setDeletionManageModal(prev => prev ? { ...prev, modifying: false } : null);
    }
  };

  const handleAdminRevokeDeletion = async () => {
    if (!deletionManageModal) return;
    if (!confirm(`Cancel deletion request and restore account for "${deletionManageModal.user.full_name || 'Citizen'}"?`)) return;
    setDeletionManageModal(prev => prev ? { ...prev, cancelling: true } : null);
    try {
      const res = await cancelCitizenAccountDeletion({
        userId: deletionManageModal.user.id,
        userName: deletionManageModal.user.full_name || 'Citizen',
        userEmail: deletionManageModal.user.email || '',
      });
      showToast(res.message, 'success');
      setDeletionManageModal(null);
      loadMetricsAndData();
    } catch (e: any) {
      alert(`Failed to cancel deletion: ${e.message || e}`);
      setDeletionManageModal(prev => prev ? { ...prev, cancelling: false } : null);
    }
  };

  const handleAdminImmediateDelete = async () => {
    if (!deletionManageModal) return;
    if (deletionManageModal.user.email === 'rohitranjanpatra8@gmail.com' || deletionManageModal.user.phone === '7735550648') {
      alert("Security Violation: You do not have permission to delete the primary owner account!");
      return;
    }
    if (deletionManageModal.user.id === profile?.id) {
      alert("You cannot delete your own admin account!");
      return;
    }
    if (!confirm(`SUPER ADMIN OVERRIDE:\nAre you sure you want to delete user "${deletionManageModal.user.full_name || 'Citizen'}" IMMEDIATELY?\n\nThis will bypass the 7-day waiting period and permanently erase all user records.`)) {
      return;
    }
    setDeletionManageModal(prev => prev ? { ...prev, deletingImmediately: true } : null);
    try {
      const res = await adminImmediateDeleteUser(deletionManageModal.user.id);
      showToast(res.message, 'success');
      setDeletionManageModal(null);
      loadMetricsAndData();
    } catch (e: any) {
      alert(`Immediate deletion failed: ${e.message || e}`);
      setDeletionManageModal(prev => prev ? { ...prev, deletingImmediately: false } : null);
    }
  };

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

    const master = complaints.find(c => c.id === complaintId);
    if (master) {
      const citizen = users.find(u => u.id === master.user_id);
      if (citizen) {
        const title = `Civic Grievance Status: ${newStatus.replace('_', ' ').toUpperCase()}`;
        const msg = `Your civic complaint "${master.title}" (Category: ${master.category}) status has been updated to "${newStatus.replace('_', ' ')}" by Municipal Administration.`;
        if (citizen.email) {
          sendAutomatedCitizenNoticeEmail({
            userId: citizen.id,
            userEmail: citizen.email,
            userName: citizen.full_name || 'Citizen',
            title,
            subject: `[BMC STATUS] Complaint #${complaintId.slice(0, 8).toUpperCase()} - ${newStatus.toUpperCase()}`,
            message: `Dear ${citizen.full_name || 'Citizen'},\n\n${msg}\n\nLocation: ${master.location_text || 'Ward'}\nReference: BMC/GRIEV-${complaintId.slice(0, 8).toUpperCase()}\n\nBhubaneswar Municipal Corporation (BMC)`,
            category: 'complaint'
          }).catch(e => console.warn(e));
        } else {
          supabase.from('notifications').insert({
            user_id: citizen.id,
            title,
            message: msg,
            type: 'complaint',
            read: false
          }).then();
        }
      }
    }
    showToast(`Complaint status updated to ${newStatus.toUpperCase()}`, 'success');
    loadMetricsAndData();
  };

  const handleUpdateBillStatus = async (billId: string, newStatus: string) => {
    await supabase.from('bills').update({ status: newStatus, paid_at: newStatus === 'paid' ? new Date().toISOString() : null }).eq('id', billId);
    const targetBill = bills.find(b => b.id === billId);
    if (targetBill) {
      const citizen = users.find(u => u.id === targetBill.user_id);
      if (citizen) {
        const title = `Utility Bill Status: ${newStatus.toUpperCase()}`;
        const msg = `Your ${targetBill.type} utility invoice of ₹${targetBill.amount} has been marked as ${newStatus.toUpperCase()} by Municipal Revenue Administration.`;
        if (citizen.email) {
          sendAutomatedCitizenNoticeEmail({
            userId: citizen.id,
            userEmail: citizen.email,
            userName: citizen.full_name || 'Citizen',
            title,
            subject: `[BBPS NOTICE] ${targetBill.type.toUpperCase()} Utility Invoice ${newStatus.toUpperCase()}`,
            message: `Dear ${citizen.full_name || 'Citizen'},\n\n${msg}\n\nInvoice ID: ${targetBill.id.slice(0, 8).toUpperCase()}\nPeriod: ${targetBill.period || 'Current Cycle'}\n\nCityZen Municipal Revenue Directorate`,
            category: 'bill'
          }).catch(e => console.warn(e));
        } else {
          supabase.from('notifications').insert({
            user_id: citizen.id,
            title,
            message: msg,
            type: 'bill',
            read: false
          }).then();
        }
      }
    }
    showToast(`Bill status updated to ${newStatus.toUpperCase()}`, 'success');
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
    
    // Notify citizen if bill was adjusted
    const citizen = users.find(u => u.id === selectedBillToClear.user_id);
    if (citizen) {
      const title = `Utility Adjustment: ₹${amtToDeduct} Deducted`;
      const msg = `A payment adjustment of ₹${amtToDeduct} was processed by Municipal Revenue on your ${selectedBillToClear.type} bill. Remaining balance: ₹${newAmount}. Status: ${newStatus.toUpperCase()}.`;
      if (citizen.email) {
        sendAutomatedCitizenNoticeEmail({
          userId: citizen.id,
          userEmail: citizen.email,
          userName: citizen.full_name || 'Citizen',
          title,
          subject: `[BBPS ADJUSTMENT] ₹${amtToDeduct} Applied to ${selectedBillToClear.type.toUpperCase()} Bill`,
          message: `Dear ${citizen.full_name || 'Citizen'},\n\n${msg}\n\nCityZen Municipal Revenue Directorate`,
          category: 'bill'
        }).catch(e => console.warn(e));
      }
    }

    setClearingAmount(false);
    setSelectedBillToClear(null);
    setDeductAmount('');
    showToast(`Successfully deducted ₹${amtToDeduct}. Remaining: ₹${newAmount}`, 'success');
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
    const targetEmerg = emergencies.find(e => e.id === id);
    await supabase.from('emergency_requests').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', id);
    if (targetEmerg?.user_id) {
      const citizen = users.find(u => u.id === targetEmerg.user_id);
      const title = `🚨 Emergency SOS Cleared: ${targetEmerg.type.toUpperCase()}`;
      const msg = `Your ${targetEmerg.type.toUpperCase()} emergency request at ${targetEmerg.location_text || 'reported location'} has been attended and resolved by Municipal Administration.`;
      if (citizen?.email) {
        sendAutomatedCitizenNoticeEmail({
          userId: citizen.id,
          userEmail: citizen.email,
          userName: citizen.full_name || 'Citizen',
          title,
          subject: `[EMERGENCY CLEARED] Incident Status Update`,
          message: `Dear ${citizen.full_name || 'Citizen'},\n\n${msg}\n\nStatus: Incident Resolved\nRef: SOS-${id.slice(0, 8).toUpperCase()}\n\nCityZen Emergency Command`,
          category: 'emergency',
          refNumber: `SOS-${id.slice(0, 8).toUpperCase()}`
        }).catch(e => console.warn(e));
      } else {
        supabase.from('notifications').insert({
          user_id: targetEmerg.user_id,
          title,
          message: msg,
          type: 'emergency',
          read: false
        }).then();
      }
    }
    showToast('Emergency SOS marked resolved and citizen notified.', 'success');
    loadMetricsAndData();
  };

  const handleChangeUserRole = async (userId: string, newRole: 'citizen' | 'police' | 'hospital' | 'bmc' | 'admin') => {
    const target = users.find(u => u.id === userId);
    if (!target) return;

    if (target?.email === 'rohitranjanpatra8@gmail.com' || target?.phone === '7735550648') {
      alert("Security Violation: You do not have permission to modify the owner's role authority!");
      return;
    }

    try {
      // 1. Update profiles table
      const { data, error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId)
        .select();
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("Row update was rejected by Row-Level Security. Please ensure you have run the migration script in your Supabase SQL Editor to allow admins to edit profiles.");
      }

      // 2. Fetch role authority details
      const roleDetails = ROLE_AUTHORITY_INFO[newRole] || ROLE_AUTHORITY_INFO.citizen;
      const refNumber = `BMC/CZ-AUTH/2026/08-${Math.floor(100000 + Math.random() * 900000)}`;
      const recipientName = target.full_name || 'Designated Officer';
      let recipientEmail = (target.email || '').trim();

      // If user profile does not have an email, prompt admin to provide it so the notice definitely reaches them
      if (!recipientEmail || !recipientEmail.includes('@')) {
        const manualEmail = window.prompt(`User "${recipientName}" does not have an email address recorded on their profile. Please enter their email address so their official role clearance letter reaches them:`, '');
        if (manualEmail && manualEmail.includes('@')) {
          recipientEmail = manualEmail.trim();
          target.email = recipientEmail;
          supabase.from('profiles').update({ email: recipientEmail }).eq('id', userId).then();
        }
      }

      // 3. Insert official notification into notifications table for target user
      try {
        await supabase.from('notifications').insert({
          user_id: userId,
          title: `🏛️ Authority Granted: Designated as ${newRole.toUpperCase()}`,
          message: `Your CityZen municipal security clearance and operational role have been formally updated to ${newRole.toUpperCase()} (${roleDetails.title}) by the Municipal Administration. You now have access to: ${roleDetails.responsibilities}. Please log in to your department dashboard.`,
          type: 'government',
          read: false
        });
      } catch (notifErr) {
        console.warn("Could not insert notification into database:", notifErr);
      }

      // 4. Prepare formal municipal dispatch email text (tuned for anti-spam deliverability)
      const emailSubject = `CityZen Account Role Update for ${recipientName}: ${roleDetails.title}`;
      const emailDate = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
      const emailBody = `Hello ${recipientName},

Your user profile role on the CityZen Portal has been updated by the Municipal Administration.

Official Communique Ref Number & Date:
Ref Number: ${refNumber}
Date: ${emailDate}

New Assigned Role & Designation:
Assigned Role: ${newRole.toUpperCase()}
Designation: ${roleDetails.title} (${roleDetails.clearance})

Authorized Capabilities & Permissions:
${roleDetails.permissions.map(p => `• ${p}`).join('\n')}

Login Link to CityZen Portal:
${window.location.origin}
Registered Email: ${recipientEmail || 'your email'}

---
Sender: CityZen Portal Team
CityZen Smart Municipal Governance Platform
Contact: cityzen.system@gmail.com

This is an automated administrative notification sent to ${recipientEmail || 'your email'} regarding your verified user account on the CityZen platform. If you have any questions or did not expect this change, please contact cityzen.system@gmail.com.`;

      loadMetricsAndData();

      // 5. Background automated dispatch without forcing a modal popup on the admin screen
      setRoleNoticeModal(null);
      showToast(`Designating ${recipientName} as ${newRole.toUpperCase()}...`, 'info');

      // 6. Automatically transmit official email directly to the user whose role changed
      if (recipientEmail) {
        sendAutomatedRoleChangeEmail({
          userId,
          userName: recipientName,
          userEmail: recipientEmail,
          userPhone: target.phone || '',
          newRole,
          roleTitle: roleDetails.title,
          clearance: roleDetails.clearance,
          responsibilities: roleDetails.responsibilities,
          permissions: roleDetails.permissions,
          refNumber,
          subject: emailSubject,
          body: emailBody,
        }).then((res) => {
          if (res.status === 'delivered') {
            showToast(`Official clearance communique delivered to ${recipientEmail} (${recipientName}).`, 'success');
          } else {
            console.error("EmailJS dispatch notice:", res);
            showToast(`Role updated. Email dispatch status: ${res.method || res.message}`, 'error');
          }
        }).catch((err) => {
          console.warn("Automated email background error:", err);
          showToast(`Role updated. Automated mail error: ${err?.message || 'failed'}`, 'error');
        });
      } else {
        showToast(`Role updated to ${newRole.toUpperCase()} for ${recipientName} (No recipient email provided; In-App notification recorded).`, 'info');
      }

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
      {/* Non-intrusive floating feedback toast */}
      {floatingToast && (
        <div className="fixed top-4 right-4 z-50 animate-fade-in max-w-md pointer-events-auto">
          <div className={`px-4 py-3 rounded-2xl shadow-2xl border text-xs font-semibold flex items-center gap-2.5 backdrop-blur-xl ${
            floatingToast.type === 'error'
              ? 'bg-red-950/90 border-red-500/40 text-red-200 shadow-red-950/50'
              : floatingToast.type === 'info'
              ? 'bg-blue-950/90 border-blue-500/40 text-blue-200 shadow-blue-950/50'
              : 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200 shadow-emerald-950/50'
          }`}>
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span className="flex-1 leading-snug">{floatingToast.message}</span>
            <button onClick={() => setFloatingToast(null)} className="text-slate-400 hover:text-white cursor-pointer ml-1">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Top Header */}
      <header className="bg-slate-900 border-b border-white/5 px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/10 shadow-lg shrink-0">
            <img src="/logo.jpg" alt="CityZen Logo" className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="font-extrabold text-base sm:text-lg text-orange-300">CityZen Admin Control Center</h1>
            <p className="text-[11px] sm:text-xs text-slate-400">Superuser Municipal Auditing & System Configuration</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto justify-start sm:justify-end">
          <div className="flex flex-col text-right hidden lg:block">
            <span className="text-xs font-bold text-white">{profile?.full_name || 'System Administrator'}</span>
            <span className="text-[10px] text-slate-400 font-mono flex items-center justify-end gap-1">
              <Mail className="w-3 h-3 text-slate-500" /> {session?.user?.email || profile?.email || 'admin@cityzen.gov'}
            </span>
          </div>

          <div className="bg-orange-950/40 px-2.5 py-1 rounded-xl border border-orange-500/20 text-[10px] font-bold text-orange-400 shrink-0">
            Role: Super Admin
          </div>

          <button
            onClick={() => loadMetricsAndData()}
            disabled={loading}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-xl text-xs text-slate-200 font-bold transition-all cursor-pointer shadow-sm disabled:opacity-50 shrink-0"
            title="Refresh and sync all municipal tables"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-orange-400' : 'text-slate-400'}`} /> Sync
          </button>

          <button
            onClick={() => setGatewayModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-orange-950/40 hover:bg-orange-900/60 border border-orange-500/30 rounded-xl text-xs text-orange-300 font-bold transition-all cursor-pointer shadow-sm shrink-0"
            title="Configure Automated Email Gateway & Dispatch Settings"
          >
            <Zap className="w-3.5 h-3.5 text-orange-400" /> Auto Mailer
          </button>

          {onSwitchToCitizen && (
            <button
              onClick={onSwitchToCitizen}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-950/40 hover:bg-blue-900/60 border border-blue-500/30 rounded-xl text-xs text-blue-300 font-bold transition-all cursor-pointer shadow-sm shrink-0"
              title="Preview Citizen View"
            >
              <Users className="w-3.5 h-3.5" /> Citizen View
            </button>
          )}

          <button
            onClick={signOut}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-950/40 hover:bg-red-950/70 border border-red-500/20 rounded-xl text-xs text-red-400 transition-colors cursor-pointer shrink-0"
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
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          {/* Total Citizens */}
          <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-3 sm:p-4 flex items-center gap-2.5 sm:gap-4 shadow">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
              <Users className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate">Total Citizens</p>
              <p className="text-xl sm:text-2xl font-black text-white mt-0.5 truncate">{metrics.totalUsers}</p>
            </div>
          </div>

          {/* Active Complaints */}
          <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-3 sm:p-4 flex items-center gap-2.5 sm:gap-4 shadow">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-400 shrink-0">
              <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate">Active Complaints</p>
              <p className="text-xl sm:text-2xl font-black text-white mt-0.5 truncate">{metrics.activeComplaints}</p>
            </div>
          </div>

          {/* Total Unpaid Invoice Amount */}
          <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-3 sm:p-4 flex items-center gap-2.5 sm:gap-4 shadow">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
              <CreditCard className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate">Total Unpaid Bills</p>
              <p className="text-base sm:text-lg font-black text-emerald-400 mt-1 truncate">{formatINR(metrics.totalUnpaidAmount)}</p>
            </div>
          </div>

          {/* Active SOS alerts */}
          <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-3 sm:p-4 flex items-center gap-2.5 sm:gap-4 shadow">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400 shrink-0">
              <Siren className="w-5 h-5 sm:w-6 sm:h-6 animate-pulse" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate">Active SOS Alarms</p>
              <p className="text-xl sm:text-2xl font-black text-red-400 mt-0.5 truncate">{metrics.activeEmergencies}</p>
            </div>
          </div>
        </div>

        {/* Tab Selector Section */}
        <div className="bg-slate-900/60 border border-white/5 rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 shadow-xl backdrop-blur-md">
          <div className="flex gap-1.5 p-1 bg-slate-950 rounded-2xl mb-4 sm:mb-6 overflow-x-auto no-scrollbar scrollbar-none w-full max-w-xl">
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
                  className={`flex-1 min-w-[105px] sm:min-w-0 flex items-center justify-center gap-1.5 py-2 sm:py-2.5 px-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    activeTab === t.id ? 'bg-orange-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{t.label}</span>
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
                {activeTab === 'users' && (() => {
                  const scheduledCount = users.filter(u => getActiveDeletionSchedule(u) !== null).length;
                  return (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                      <div className="relative flex-1 max-w-md">
                        <input
                          type="text"
                          placeholder="Search users by name, email, or phone..."
                          value={userSearchQuery}
                          onChange={(e) => setUserSearchQuery(e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-xs focus:outline-none focus:border-orange-500 text-white placeholder-slate-500"
                        />
                      </div>
                      <div className="flex items-center gap-2 shrink-0 overflow-x-auto pb-1 sm:pb-0">
                        <button
                          type="button"
                          onClick={() => setUserFilterMode('all')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                            userFilterMode === 'all'
                              ? 'bg-orange-600 text-white border-orange-500 shadow-sm'
                              : 'bg-slate-900 text-slate-400 border-white/10 hover:text-white'
                          }`}
                        >
                          All Users ({users.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setUserFilterMode('deletion_scheduled')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 ${
                            userFilterMode === 'deletion_scheduled'
                              ? 'bg-red-600 text-white border-red-500 shadow-sm'
                              : scheduledCount > 0
                                ? 'bg-red-500/15 text-red-300 border-red-500/30 hover:bg-red-500/25 animate-pulse'
                                : 'bg-slate-900 text-slate-400 border-white/10 hover:text-white'
                          }`}
                        >
                          <Hourglass className="w-3.5 h-3.5 text-red-400" />
                          <span>Pending Deletions ({scheduledCount})</span>
                        </button>
                      </div>
                    </div>
                  );
                })()}
                {activeTab === 'complaints' && (() => {
                  const compMasters = complaints.filter(c => 
                    !c.description?.startsWith('[ML_MERGE:') && 
                    !c.description?.startsWith('[ML_CLUSTER_OVERLOAD:')
                  );
                  const compActiveCount = compMasters.filter(c => c.status !== 'resolved' && c.status !== 'rejected').length;
                  const compResolvedCount = compMasters.filter(c => c.status === 'resolved').length;

                  return (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                      <div className="relative flex-1 max-w-md">
                        <input
                          type="text"
                          placeholder="Search complaints by title, department, location, or citizen..."
                          value={complaintSearchQuery}
                          onChange={(e) => setComplaintSearchQuery(e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-xs focus:outline-none focus:border-orange-500 text-white placeholder-slate-500"
                        />
                      </div>
                      <div className="flex items-center gap-2 shrink-0 overflow-x-auto pb-1 sm:pb-0">
                        <button
                          type="button"
                          onClick={() => setComplaintStatusFilter('active')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 ${
                            complaintStatusFilter === 'active'
                              ? 'bg-amber-600 text-white border-amber-500 shadow-sm'
                              : 'bg-slate-900 text-amber-400 border-white/10 hover:border-amber-500/30'
                          }`}
                        >
                          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                          <span>Active Complaints ({compActiveCount})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setComplaintStatusFilter('resolved')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 ${
                            complaintStatusFilter === 'resolved'
                              ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                              : 'bg-slate-900 text-emerald-400 border-white/10 hover:border-emerald-500/30'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Resolved ({compResolvedCount})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setComplaintStatusFilter('all')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                            complaintStatusFilter === 'all'
                              ? 'bg-orange-600 text-white border-orange-500 shadow-sm'
                              : 'bg-slate-900 text-slate-400 border-white/10 hover:text-white'
                          }`}
                        >
                          All ({compMasters.length})
                        </button>
                      </div>
                    </div>
                  );
                })()}
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
                {activeTab === 'emergencies' && (() => {
                  const sosActiveCount = emergencies.filter(e => e.status !== 'resolved').length;
                  const sosResolvedCount = emergencies.filter(e => e.status === 'resolved').length;

                  return (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                      <div className="relative flex-1 max-w-md">
                        <input
                          type="text"
                          placeholder="Search SOS by city, ward, or citizen name..."
                          value={sosSearchQuery}
                          onChange={(e) => setSosSearchQuery(e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-xs focus:outline-none focus:border-orange-500 text-white placeholder-slate-500"
                        />
                      </div>
                      <div className="flex items-center gap-2 shrink-0 overflow-x-auto pb-1 sm:pb-0">
                        <button
                          type="button"
                          onClick={() => setSosStatusFilter('active')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 ${
                            sosStatusFilter === 'active'
                              ? 'bg-red-600 text-white border-red-500 shadow-sm'
                              : 'bg-slate-900 text-red-400 border-white/10 hover:border-red-500/30'
                          }`}
                        >
                          <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
                          <span>Active Alarms ({sosActiveCount})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSosStatusFilter('resolved')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 ${
                            sosStatusFilter === 'resolved'
                              ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                              : 'bg-slate-900 text-emerald-400 border-white/10 hover:border-emerald-500/30'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Resolved ({sosResolvedCount})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSosStatusFilter('all')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                            sosStatusFilter === 'all'
                              ? 'bg-slate-700 text-white border-slate-500 shadow-sm'
                              : 'bg-slate-900 text-slate-400 border-white/10 hover:text-white'
                          }`}
                        >
                          All ({emergencies.length})
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="overflow-x-auto">
                {/* Tab 1: User Roles Management */}
                {activeTab === 'users' && (() => {
                  const filteredUsers = users.filter(u => {
                    if (userFilterMode === 'deletion_scheduled') {
                      const sched = getActiveDeletionSchedule(u);
                      if (!sched) return false;
                    }
                    const q = userSearchQuery.toLowerCase();
                    const joinedStr = u.created_at ? formatDate(u.created_at).toLowerCase() : '';
                    return u.full_name?.toLowerCase().includes(q) ||
                           u.email?.toLowerCase().includes(q) ||
                           u.phone?.toLowerCase().includes(q) ||
                           joinedStr.includes(q);
                  });

                  if (filteredUsers.length === 0) {
                    return (
                      <div className="py-8 text-center text-slate-500">
                        <Users className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                        <p className="font-semibold text-xs text-slate-300">
                          {userFilterMode === 'deletion_scheduled' 
                            ? 'No accounts currently scheduled for deletion.' 
                            : 'No matching user accounts found.'}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-1">
                          {userFilterMode === 'deletion_scheduled'
                            ? 'Citizens requesting account deletion will automatically appear here with full timing telemetry.'
                            : 'If newly registered, click the Sync button above to refresh user records.'}
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div>
                      {/* Responsive Mobile Cards View (< md) */}
                      <div className="md:hidden space-y-3">
                        {filteredUsers.map(u => {
                          const userBills = bills.filter(b => b.user_id === u.id);
                          const unpaidTotal = userBills.filter(b => b.status === 'unpaid').reduce((sum, b) => sum + Number(b.amount), 0);
                          const isPrimaryOwner = u.email === 'rohitranjanpatra8@gmail.com' || u.phone === '7735550648';
                          const sched = getActiveDeletionSchedule(u);
                          const lock = checkAccountCreationLock(u.created_at);

                          return (
                            <div key={u.id} className="bg-slate-950/60 border border-white/5 rounded-2xl p-4 space-y-3 shadow-md">
                              {/* Top Bar: Name, Avatar, Status */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center font-black text-xs shrink-0 border border-orange-500/20">
                                    {u.full_name ? u.full_name.charAt(0).toUpperCase() : 'U'}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-bold text-sm text-white truncate">{u.full_name || 'Anonymous User'}</p>
                                    <p className="text-xs text-slate-400">{u.phone || 'No phone'}</p>
                                  </div>
                                </div>
                                <div className="shrink-0 flex flex-col items-end gap-1">
                                  {isPrimaryOwner ? (
                                    <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase border bg-orange-500/10 text-orange-400 border-orange-500/20">
                                      Owner
                                    </span>
                                  ) : u.blocked ? (
                                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase bg-red-500/10 text-red-400 border border-red-500/20">
                                      Blocked
                                    </span>
                                  ) : (
                                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                      Active
                                    </span>
                                  )}
                                  {sched ? (
                                    <button
                                      type="button"
                                      onClick={() => openManageDeletion(u, sched)}
                                      className="px-2 py-0.5 rounded text-[8px] font-bold uppercase border bg-red-500/20 text-red-300 border-red-500/40 animate-pulse cursor-pointer"
                                    >
                                      ⚠️ Deletion Pending
                                    </button>
                                  ) : lock.isLocked ? (
                                    <span className="px-1.5 py-0.5 rounded text-[8px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20">
                                      🔒 3d Lock
                                    </span>
                                  ) : null}
                                </div>
                              </div>

                              {/* Deletion Pending Card for Mobile if scheduled */}
                              {sched && (
                                <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-xs space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <span className="text-red-400 font-bold flex items-center gap-1 text-[11px]">
                                      <Clock className="w-3.5 h-3.5" /> Deletion Activity:
                                    </span>
                                    <span className="font-mono text-[10px] text-red-300 font-bold">
                                      {formatDeletionCountdown(sched.scheduledAt).text}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-slate-300">
                                    Target: {new Date(sched.scheduledAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                                  </p>
                                  {sched.reason && (
                                    <p className="text-[10px] text-slate-400 italic truncate">
                                      Reason: "{sched.reason}"
                                    </p>
                                  )}
                                  <div className="flex items-center gap-1.5 pt-1">
                                    <button
                                      type="button"
                                      onClick={() => openManageDeletion(u, sched)}
                                      className="flex-1 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-lg text-[10px] font-bold transition-colors cursor-pointer flex items-center justify-center gap-1"
                                    >
                                      <CalendarClock className="w-3 h-3" />
                                      <span>Modify Timing</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => openManageDeletion(u, sched)}
                                      className="py-1 px-2.5 bg-red-600/30 hover:bg-red-600/50 text-red-300 border border-red-500/40 rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                                    >
                                      Purge Now ⚡
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Details Grid */}
                              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-900/60 rounded-xl p-3 border border-white/5">
                                <div className="min-w-0">
                                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Email</span>
                                  <span className="text-slate-300 font-medium truncate block text-xs" title={u.email}>{u.email || 'N/A'}</span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Ward</span>
                                  <span className="text-slate-300 font-medium text-xs">{u.ward ? `Ward ${u.ward}` : 'Not set'}</span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Joined Date</span>
                                  <div className="flex items-center gap-1 text-slate-300 font-medium text-xs">
                                    <Calendar className="w-3 h-3 text-orange-400 shrink-0" />
                                    <span>{u.created_at ? formatDate(u.created_at) : 'N/A'}</span>
                                  </div>
                                </div>
                                <div>
                                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Utilities Due</span>
                                  {userBills.length > 0 ? (
                                    <span className="text-red-400 font-semibold text-xs">{formatINR(unpaidTotal)}</span>
                                  ) : (
                                    <span className="text-slate-500 text-xs">None</span>
                                  )}
                                </div>
                              </div>

                              {/* Role Selector & Actions Bar */}
                              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] text-slate-400 font-bold uppercase">Role:</span>
                                  {isPrimaryOwner ? (
                                    <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase border bg-orange-500/10 text-orange-400 border-orange-500/20">
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
                                    <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase border bg-orange-500/10 text-orange-400 border-orange-500/20">
                                      Super Admin
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5 ml-auto">
                                  {sched && (
                                    <button
                                      type="button"
                                      onClick={() => openManageDeletion(u, sched)}
                                      className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-lg text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                                      title="Modify Deletion Timing"
                                    >
                                      <Clock className="w-3 h-3 text-amber-400" />
                                      <span>Timing</span>
                                    </button>
                                  )}
                                  <button
                                    onClick={() => { setSelectedUserToResetPW(u); setNewAdminResetPassword(''); }}
                                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                                  >
                                    Reset PW
                                  </button>
                                  {!isPrimaryOwner && u.id !== profile?.id && (
                                    <>
                                      <button
                                        onClick={() => handleToggleBlock(u.id, !!u.blocked)}
                                        className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                                          u.blocked 
                                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20' 
                                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20'
                                        }`}
                                      >
                                        {u.blocked ? 'Unblock' : 'Block'}
                                      </button>
                                      <button
                                        onClick={() => handleDeleteUser(u.id)}
                                        className="p-1 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                                        title="Delete User"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Desktop Table View (>= md) */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full min-w-[850px] text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-white/10 text-slate-400 font-bold uppercase text-[10px]">
                              <th className="pb-3">User Profile Name</th>
                              <th className="pb-3">Joined Date</th>
                              <th className="pb-3">Email Address</th>
                              <th className="pb-3">Role Authority</th>
                              <th className="pb-3">Ward</th>
                              <th className="pb-3">Linked Utilities</th>
                              <th className="pb-3">Status</th>
                              <th className="pb-3 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredUsers.map(u => {
                              const userBills = bills.filter(b => b.user_id === u.id);
                              const unpaidTotal = userBills.filter(b => b.status === 'unpaid').reduce((sum, b) => sum + Number(b.amount), 0);
                              const billTypes = Array.from(new Set(userBills.map(b => b.type)));
                              const sched = getActiveDeletionSchedule(u);
                              const lock = checkAccountCreationLock(u.created_at);

                              return (
                                <tr key={u.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                  <td className="py-3 font-semibold text-white">
                                    {u.full_name || 'Anonymous User'}
                                    <span className="block text-[10px] text-slate-400 font-normal">{u.phone || 'No phone'}</span>
                                  </td>
                                  <td className="py-3 text-slate-300 font-medium">
                                    <div className="flex items-center gap-1.5 text-xs text-slate-200">
                                      <Calendar className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                                      <span>{u.created_at ? formatDate(u.created_at) : 'N/A'}</span>
                                    </div>
                                    <span className="block text-[10px] text-slate-400 font-normal pl-5">
                                      {u.created_at ? timeAgo(u.created_at) : ''}
                                    </span>
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
                                    <div className="space-y-1">
                                      <span className={`inline-block px-2.5 py-0.5 rounded text-[9px] font-bold uppercase border ${
                                        u.blocked ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                      }`}>
                                        {u.blocked ? 'Blocked' : 'Active'}
                                      </span>
                                      {sched ? (
                                        <button
                                          type="button"
                                          onClick={() => openManageDeletion(u, sched)}
                                          className="block text-[9px] font-bold text-red-300 hover:text-white bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg px-2 py-0.5 transition-all cursor-pointer whitespace-nowrap animate-pulse"
                                          title="Click to view and modify deletion schedule"
                                        >
                                          ⚠️ Deletion: {formatDeletionCountdown(sched.scheduledAt).text}
                                        </button>
                                      ) : lock.isLocked ? (
                                        <span className="block text-[9px] text-amber-400 font-semibold" title={lock.message}>
                                          🔒 3d Lock ({lock.daysRemaining}d {lock.hoursRemaining}h)
                                        </span>
                                      ) : null}
                                    </div>
                                  </td>
                                  <td className="py-3 text-right">
                                    {u.email === 'rohitranjanpatra8@gmail.com' || u.phone === '7735550648' ? (
                                      <span className="text-[10px] text-orange-400 font-bold italic pr-2">Primary Owner</span>
                                    ) : u.id !== profile?.id ? (
                                      <div className="flex items-center justify-end gap-2">
                                        {sched && (
                                          <button
                                            type="button"
                                            onClick={() => openManageDeletion(u, sched)}
                                            className="px-2.5 py-1 rounded-xl text-[10px] font-bold border border-amber-500/30 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 transition-colors flex items-center gap-1 cursor-pointer"
                                            title="Modify Deletion Timing & Schedule"
                                          >
                                            <Clock className="w-3 h-3 text-amber-400" />
                                            <span>Timing</span>
                                          </button>
                                        )}
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
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
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
                  const displayedMasters = masters.filter(c => {
                    if (complaintStatusFilter === 'active') return c.status !== 'resolved' && c.status !== 'rejected';
                    if (complaintStatusFilter === 'resolved') return c.status === 'resolved';
                    return true;
                  });

                  if (displayedMasters.length === 0) {
                    return (
                      <div className="py-8 text-center text-slate-500">
                        <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                        <p className="font-semibold text-xs text-slate-300">
                          {complaintStatusFilter === 'active' ? 'No active complaints pending' :
                           complaintStatusFilter === 'resolved' ? 'No resolved complaints matching filter' :
                           'No complaints reported or matching search'}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-1">
                          {complaintStatusFilter === 'active' ? 'All reported civic issues in this view are resolved or completed.' :
                           'Complaints filed by citizens will appear here with live ML deduplication & BMC resolution proof.'}
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div>
                      {/* Responsive Mobile Cards View (< md) */}
                      <div className="md:hidden space-y-3">
                        {displayedMasters.map(c => {
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
                            <div key={c.id} className="bg-slate-950/60 border border-white/5 rounded-2xl p-4 space-y-3 shadow-md">
                              {/* Header Badges */}
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                    {c.category}
                                  </span>
                                  <span className="px-2 py-0.5 rounded text-[9px] font-bold text-slate-400 bg-slate-900 border border-white/5 capitalize">
                                    {c.department || 'Civic'}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                    reportCount > 1 
                                      ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20 animate-pulse' 
                                      : 'bg-slate-800 text-slate-400'
                                  }`}>
                                    {reportCount} {reportCount === 1 ? 'report' : 'reports'}
                                  </span>
                                </div>
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
                                  c.status === 'resolved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                  c.status === 'in_progress' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                  c.status === 'rejected' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                  'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                }`}>
                                  {c.status.replace('_', ' ')}
                                </span>
                              </div>

                              {/* Title & ML Score */}
                              <div className="space-y-1">
                                <h3 className="font-bold text-sm text-white">{c.title}</h3>
                                {c.ml_verification_score && (
                                  <span className="inline-block text-[9px] bg-emerald-500/10 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/20 font-bold">
                                    {c.ml_verification_score}% Authenticity Verified
                                  </span>
                                )}
                                <p className="text-xs text-slate-400 leading-relaxed">{cleanDesc}</p>
                              </div>

                              {/* Photos if any */}
                              {(c.photo_url || c.resolution_photo_url) && (
                                <div className="flex flex-wrap gap-2 pt-1">
                                  {c.photo_url && (
                                    <button 
                                      onClick={() => setPreviewPhoto(c.photo_url)}
                                      className="text-[10px] bg-cyan-500/10 hover:bg-cyan-500/25 text-cyan-400 px-2.5 py-1 rounded-xl border border-cyan-500/20 cursor-pointer transition-colors flex items-center gap-1 font-bold"
                                    >
                                      <Camera className="w-3 h-3" /> Citizen Photo
                                    </button>
                                  )}
                                  {c.resolution_photo_url && (
                                    <button 
                                      onClick={() => setPreviewPhoto(c.resolution_photo_url)}
                                      className="text-[10px] bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-400 px-2.5 py-1 rounded-xl border border-emerald-500/20 cursor-pointer transition-colors flex items-center gap-1 font-bold"
                                    >
                                      <CheckCircle2 className="w-3 h-3" /> BMC Proof Photo
                                    </button>
                                  )}
                                </div>
                              )}

                              {/* BMC Proof note */}
                              {c.status === 'resolved' && c.resolution_proof && (
                                <div className="p-2.5 bg-emerald-500/5 rounded-xl border border-emerald-500/15 text-xs text-emerald-300">
                                  <span className="font-bold block text-[9px] text-emerald-400 uppercase tracking-wider mb-0.5">BMC Resolution Proof</span>
                                  "{c.resolution_proof}"
                                </div>
                              )}

                              {/* Details: Citizens & Location */}
                              <div className="bg-slate-900/60 rounded-xl p-3 border border-white/5 space-y-2 text-xs">
                                <div>
                                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Filed By</span>
                                  <span className="text-slate-300 font-medium">{citizenNames}</span>
                                </div>
                                <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5">
                                  <div className="min-w-0">
                                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Location</span>
                                    <span className="text-slate-300 font-medium truncate block">{c.location_text || 'MG Road'}</span>
                                  </div>
                                  {c.lat && c.lng && (
                                    <button
                                      onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}`, '_blank')}
                                      className="text-[10px] text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/25 px-2.5 py-1 rounded-xl border border-emerald-500/20 font-bold flex items-center gap-1 cursor-pointer transition-all shrink-0"
                                    >
                                      <Navigation className="w-3 h-3" /> Guide Me
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Actions Bar */}
                              <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/5">
                                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                  <span className="text-[10px] text-slate-400 font-bold uppercase shrink-0">Status:</span>
                                  <select
                                    value={c.status}
                                    onChange={(e) => handleUpdateComplaintStatus(c.id, e.target.value as any, childIds)}
                                    className="bg-slate-900 border border-white/10 rounded-xl px-2.5 py-1 text-xs font-bold focus:outline-none focus:border-orange-500 cursor-pointer text-slate-200 w-full max-w-[140px]"
                                  >
                                    <option value="submitted">Submitted</option>
                                    <option value="assigned">Assigned</option>
                                    <option value="in_progress">In Progress</option>
                                    <option value="resolved">Resolved</option>
                                    <option value="rejected">Rejected</option>
                                  </select>
                                </div>
                                <button
                                  onClick={() => handleDeleteComplaint(c.id, childIds)}
                                  className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer shrink-0"
                                  title="Delete Complaint"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Desktop Table View (>= md) */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full min-w-[850px] text-left text-xs border-collapse">
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
                            {displayedMasters.map(c => {
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
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
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

                  if (filteredBills.length === 0) {
                    return (
                      <div className="py-8 text-center text-slate-500">
                        <CreditCard className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                        <p className="font-semibold text-xs text-slate-300">No utility bills found</p>
                        <p className="text-[10px] text-slate-500 mt-1">Water, electricity, property tax, and waste invoices will be listed here.</p>
                      </div>
                    );
                  }

                  return (
                    <div>
                      {/* Responsive Mobile Cards View (< md) */}
                      <div className="md:hidden space-y-3">
                        {filteredBills.map(b => {
                          const user = users.find(u => u.id === b.user_id);

                          return (
                            <div key={b.id} className="bg-slate-950/60 border border-white/5 rounded-2xl p-4 space-y-3 shadow-md">
                              {/* Header Badges */}
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase bg-orange-500/10 text-orange-400 border border-orange-500/20">
                                    {b.type}
                                  </span>
                                  <span className="text-xs font-semibold text-white">{b.period || 'Utility Service'}</span>
                                </div>
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
                                  b.status === 'paid' 
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                    : 'bg-red-500/10 text-red-400 border-red-500/20'
                                }`}>
                                  {b.status}
                                </span>
                              </div>

                              {/* Citizen Details */}
                              <div className="flex items-center gap-2.5 bg-slate-900/60 rounded-xl p-3 border border-white/5">
                                <div className="w-8 h-8 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center font-bold text-xs shrink-0">
                                  {user?.full_name?.charAt(0).toUpperCase() || 'C'}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-bold text-xs text-white truncate">{user ? user.full_name : 'Unknown Citizen'}</p>
                                  <p className="text-[10px] text-slate-400 truncate">{user?.email || user?.phone || 'No Contact'}</p>
                                </div>
                              </div>

                              {/* Amount & Due Date Grid */}
                              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-900/40 rounded-xl p-2.5 border border-white/5">
                                <div>
                                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Amount Due</span>
                                  <span className={`text-sm font-black ${b.status === 'paid' ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {formatINR(Number(b.amount))}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Due Date</span>
                                  <span className="text-slate-300 font-medium text-xs">{b.due_date || 'N/A'}</span>
                                </div>
                              </div>

                              {/* Actions Bar */}
                              <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/5">
                                <div className="flex items-center gap-2">
                                  <select
                                    value={b.status}
                                    onChange={(e) => handleUpdateBillStatus(b.id, e.target.value)}
                                    className={`border rounded-xl px-2.5 py-1 text-xs font-bold cursor-pointer ${
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
                                      className="px-2.5 py-1 border border-orange-500/20 bg-orange-500/10 text-orange-400 hover:bg-orange-500/25 rounded-xl text-[10px] font-bold transition-all cursor-pointer"
                                    >
                                      Deduct Balance
                                    </button>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleDeleteBill(b.id)}
                                  className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                                  title="Delete Bill"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Desktop Table View (>= md) */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full min-w-[750px] text-left text-xs border-collapse">
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
                            {filteredBills.map(b => {
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
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
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

                  const displayedEmergencies = filteredEmergencies.filter(e => {
                    if (sosStatusFilter === 'active') return e.status !== 'resolved';
                    if (sosStatusFilter === 'resolved') return e.status === 'resolved';
                    return true;
                  });

                  if (displayedEmergencies.length === 0) {
                    return (
                      <div className="py-8 text-center text-slate-500">
                        <Siren className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                        <p className="font-semibold text-xs text-slate-300">
                          {sosStatusFilter === 'active' ? 'No active emergency SOS alarms' :
                           sosStatusFilter === 'resolved' ? 'No resolved emergency alarms in history' :
                           'No emergency SOS requests triggered or matching search'}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-1">
                          {sosStatusFilter === 'active' ? 'Live police, ambulance, and disaster SOS alarms will alert here in real time.' :
                           'All historical and resolved dispatches will be archived here.'}
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div>
                      {/* Responsive Mobile Cards View (< md) */}
                      <div className="md:hidden space-y-3">
                        {displayedEmergencies.map(e => {
                          const user = users.find(u => u.id === e.user_id);

                          return (
                            <div key={e.id} className="bg-slate-950/60 border border-white/5 rounded-2xl p-4 space-y-3 shadow-md">
                              {/* Header: Alert Type & Status */}
                              <div className="flex items-center justify-between gap-2">
                                <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20">
                                  {e.type} ALERT
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                                    e.status === 'active' ? 'bg-red-500/10 text-red-400 border-red-500/20 animate-pulse' :
                                    e.status === 'dispatched' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                    'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  }`}>
                                    {e.status}
                                  </span>
                                  <span className="text-[10px] text-slate-500">
                                    {new Date(e.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                              </div>

                              {/* Citizen Profile Details */}
                              <div className="bg-slate-900/60 rounded-xl p-3 border border-white/5 flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Citizen Profile</span>
                                  <p className="font-bold text-xs text-white truncate">{user ? user.full_name : 'Unknown Citizen'}</p>
                                </div>
                                {user?.phone ? (
                                  <a
                                    href={`tel:${user.phone}`}
                                    className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 rounded-xl text-[10px] font-bold flex items-center gap-1 shrink-0"
                                    title="Call Citizen"
                                  >
                                    <Phone className="w-3 h-3" /> {user.phone}
                                  </a>
                                ) : (
                                  <span className="text-[10px] text-slate-500 italic">No phone</span>
                                )}
                              </div>

                              {/* Location & Navigation */}
                              <div className="bg-slate-900/40 rounded-xl p-3 border border-white/5 space-y-1.5 text-xs">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="min-w-0">
                                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Location</span>
                                    <span className="text-slate-300 font-medium truncate block">{e.location_text || 'Ward 12'}</span>
                                  </div>
                                  {e.lat && e.lng && (
                                    <button
                                      onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${e.lat},${e.lng}`, '_blank')}
                                      className="text-[10px] text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/25 px-2.5 py-1 rounded-xl border border-emerald-500/20 font-bold flex items-center gap-1 cursor-pointer transition-all shrink-0"
                                    >
                                      <Navigation className="w-3 h-3" /> Guide Me
                                    </button>
                                  )}
                                </div>
                                {e.lat && e.lng && (
                                  <p className="text-[10px] font-mono text-slate-400">
                                    GPS: {Number(e.lat).toFixed(4)}, {Number(e.lng).toFixed(4)}
                                  </p>
                                )}
                              </div>

                              {/* Notes */}
                              {e.notes && (
                                <p className="text-xs text-slate-400 italic bg-slate-950/40 p-2.5 rounded-xl border border-white/5">
                                  "{e.notes}"
                                </p>
                              )}

                              {/* Actions Bar */}
                              <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/5">
                                <div>
                                  {e.status !== 'resolved' ? (
                                    <button
                                      onClick={() => handleResolveEmergency(e.id)}
                                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                                    >
                                      Resolve SOS
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleRedoEmergency(e.id)}
                                      className="px-3 py-1.5 bg-red-950/40 hover:bg-red-950/70 border border-red-500/20 text-red-400 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                                      title="Redo SOS dispatch request"
                                    >
                                      Redo
                                    </button>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleDeleteEmergency(e.id)}
                                  className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                                  title="Delete SOS Dispatch"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Desktop Table View (>= md) */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full min-w-[750px] text-left text-xs border-collapse">
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
                            {displayedEmergencies.map(e => {
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
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
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

      {/* Role Authority Formal Communiqué Modal */}
      {roleNoticeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setRoleNoticeModal(null)} />
          <div className="relative max-w-2xl w-full bg-slate-900 border-2 border-orange-500/40 rounded-3xl p-6 sm:p-7 shadow-[0_0_50px_rgba(249,115,22,0.2)] animate-slide-up space-y-4 max-h-[90vh] flex flex-col overflow-hidden">
            
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
                  <ShieldCheck className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-base sm:text-lg text-white">Official Role Authority Communiqué</h3>
                    {roleNoticeModal.dispatching ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 animate-pulse">
                        <RefreshCw className="w-3 h-3 animate-spin" /> Auto-Transmitting...
                      </span>
                    ) : roleNoticeModal.dispatchSuccess ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Auto-Dispatched
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-orange-500/20 text-orange-400 border border-orange-500/30">
                        In-App Recorded
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Ref: <span className="font-mono font-bold text-slate-300">{roleNoticeModal.refNumber}</span> · CityZen Municipal Governance
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRoleNoticeModal(null)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Live Automated Dispatch Status Banner */}
            <div className={`p-3.5 rounded-2xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 ${
              roleNoticeModal.dispatching
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                : roleNoticeModal.dispatchSuccess
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                : 'bg-slate-800/80 border-white/10 text-slate-300'
            }`}>
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  roleNoticeModal.dispatching ? 'bg-amber-500/20 text-amber-400' :
                  roleNoticeModal.dispatchSuccess ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'
                }`}>
                  <Zap className={`w-4 h-4 ${roleNoticeModal.dispatching ? 'animate-bounce' : ''}`} />
                </div>
                <div className="min-w-0">
                  <p className="font-extrabold text-white text-xs truncate">
                    {roleNoticeModal.dispatching 
                      ? `Transmitting automated alert to ${roleNoticeModal.userEmail}...` 
                      : `Automated System Communiqué Dispatched to ${roleNoticeModal.userEmail || roleNoticeModal.userName}`}
                  </p>
                  <p className="text-[10px] opacity-80 truncate font-mono mt-0.5">
                    Sender: no-reply@cityzen.odisha.gov.in · {roleNoticeModal.dispatchMethod || 'Municipal Background Relay'}
                  </p>
                </div>
              </div>

              {roleNoticeModal.userEmail && (
                <button
                  type="button"
                  disabled={roleNoticeModal.dispatching}
                  onClick={() => {
                    if (!roleNoticeModal) return;
                    setRoleNoticeModal(prev => prev ? { ...prev, dispatching: true } : null);
                    const roleDetails = ROLE_AUTHORITY_INFO[roleNoticeModal.newRole] || ROLE_AUTHORITY_INFO.citizen;
                    sendAutomatedRoleChangeEmail({
                      userId: roleNoticeModal.userId,
                      userName: roleNoticeModal.userName,
                      userEmail: roleNoticeModal.userEmail,
                      userPhone: roleNoticeModal.userPhone,
                      newRole: roleNoticeModal.newRole,
                      roleTitle: roleDetails.title,
                      clearance: roleDetails.clearance,
                      responsibilities: roleDetails.responsibilities,
                      permissions: roleDetails.permissions,
                      refNumber: roleNoticeModal.refNumber,
                      subject: roleNoticeModal.subject,
                      body: roleNoticeModal.body,
                    }).then((res) => {
                      setRoleNoticeModal(prev => prev ? {
                        ...prev,
                        dispatching: false,
                        dispatchSuccess: res.success,
                        dispatchId: res.dispatchId,
                        dispatchMethod: res.method,
                        dispatchTimestamp: res.timestamp,
                      } : null);
                    });
                  }}
                  className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer shrink-0 disabled:opacity-50"
                  title="Trigger automated background re-dispatch"
                >
                  <RefreshCw className={`w-3 h-3 ${roleNoticeModal.dispatching ? 'animate-spin' : ''}`} />
                  <span>{roleNoticeModal.dispatching ? 'Transmitting...' : 'Re-send Auto'}</span>
                </button>
              )}
            </div>

            {/* Recipient & Status Badges */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3.5 bg-slate-950/70 border border-white/5 rounded-2xl text-xs shrink-0">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Designated Personnel</p>
                <p className="font-extrabold text-white text-sm mt-0.5">{roleNoticeModal.userName}</p>
                <p className="text-slate-400 font-mono text-[11px] mt-0.5 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                  {roleNoticeModal.userEmail || 'No email registered'}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Granted Authority Scope</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-2.5 py-1 rounded-xl text-xs font-black uppercase tracking-wider border ${
                    roleNoticeModal.newRole === 'admin' ? 'bg-orange-500/20 text-orange-300 border-orange-500/40' :
                    roleNoticeModal.newRole === 'police' ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' :
                    roleNoticeModal.newRole === 'hospital' ? 'bg-red-500/20 text-red-300 border-red-500/40' :
                    roleNoticeModal.newRole === 'bmc' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                    'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  }`}>
                    {roleNoticeModal.newRole}
                  </span>
                  <span className="text-[11px] text-slate-300 font-medium">
                    {ROLE_AUTHORITY_INFO[roleNoticeModal.newRole]?.clearance || 'Level-1'}
                  </span>
                </div>
                <p className="text-[10px] text-emerald-400 flex items-center gap-1 mt-1 font-semibold">
                  <CheckCircle2 className="w-3 h-3" /> In-App Notification Recorded
                </p>
              </div>
            </div>

            {/* Formatted Communiqué Document View */}
            <div className="flex-1 overflow-y-auto bg-slate-950/90 border border-white/10 rounded-2xl p-4 font-mono text-[11px] leading-relaxed text-slate-300 whitespace-pre-wrap select-text">
              {roleNoticeModal.body}
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 shrink-0 border-t border-white/10">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(roleNoticeModal.body);
                    setRoleNoticeModal(prev => prev ? { ...prev, copied: true } : null);
                    setTimeout(() => {
                      setRoleNoticeModal(prev => prev ? { ...prev, copied: false } : null);
                    }, 2500);
                  }}
                  className="flex-1 sm:flex-none px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer border border-white/10"
                >
                  {roleNoticeModal.copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-400">Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy Formal Notice</span>
                    </>
                  )}
                </button>

                <div className="flex items-center gap-1.5">
                  <span className="px-2.5 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 rounded-xl text-[11px] font-bold flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Auto-Sent by System</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setGatewayModalOpen(true)}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-[11px] font-semibold transition-all flex items-center gap-1 cursor-pointer border border-white/10"
                    title="Configure Automated Email Gateway"
                  >
                    <Zap className="w-3.5 h-3.5 text-orange-400" />
                    <span className="hidden sm:inline">Gateway Settings</span>
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setRoleNoticeModal(null)}
                className="w-full sm:w-auto px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-md"
              >
                Close Communiqué
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Automated Email Gateway Configuration Modal */}
      {gatewayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setGatewayModalOpen(false)} />
          <div className="relative max-w-lg w-full bg-slate-900 border-2 border-orange-500/40 rounded-3xl p-6 shadow-2xl animate-scale-up space-y-5 text-left max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
                  <Zap className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base">Automated Municipal Email Gateway</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Automated background mail dispatch configuration</p>
                </div>
              </div>
              <button
                onClick={() => setGatewayModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl flex items-center gap-2.5 text-xs text-emerald-300">
              <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
              <span><strong>100% Automated Background Dispatch Active:</strong> When role authority is changed, official communiqués are transmitted automatically to citizen inboxes without manual mail client or pressing Enter.</span>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-400 font-bold block mb-1 uppercase tracking-wider text-[10px]">Dispatch Provider</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setGatewayConfig(prev => ({ ...prev, provider: 'emailjs' }))}
                    className={`py-2 px-3 rounded-xl border font-bold text-center transition-all cursor-pointer ${
                      gatewayConfig.provider === 'emailjs'
                        ? 'bg-orange-500/20 border-orange-500 text-orange-300'
                        : 'bg-slate-950 border-white/10 text-slate-400 hover:bg-white/5'
                    }`}
                  >
                    EmailJS SMTP Relay
                  </button>
                  <button
                    type="button"
                    onClick={() => setGatewayConfig(prev => ({ ...prev, provider: 'webhook' }))}
                    className={`py-2 px-3 rounded-xl border font-bold text-center transition-all cursor-pointer ${
                      gatewayConfig.provider === 'webhook'
                        ? 'bg-orange-500/20 border-orange-500 text-orange-300'
                        : 'bg-slate-950 border-white/10 text-slate-400 hover:bg-white/5'
                    }`}
                  >
                    Custom Webhook
                  </button>
                </div>
              </div>

              {gatewayConfig.provider === 'emailjs' ? (
                <div className="space-y-2.5 bg-slate-950/60 p-3 rounded-2xl border border-white/5">
                  <div>
                    <label className="text-slate-400 font-medium block mb-1 text-[11px]">EmailJS Public Key</label>
                    <input
                      type="text"
                      placeholder="e.g. user_live_xxx or default"
                      value={gatewayConfig.emailjsPublicKey}
                      onChange={(e) => setGatewayConfig(prev => ({ ...prev, emailjsPublicKey: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-orange-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-400 font-medium block mb-1 text-[11px]">Service ID</label>
                      <input
                        type="text"
                        placeholder="service_xxx"
                        value={gatewayConfig.emailjsServiceId}
                        onChange={(e) => setGatewayConfig(prev => ({ ...prev, emailjsServiceId: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 font-medium block mb-1 text-[11px]">Template ID</label>
                      <input
                        type="text"
                        placeholder="template_xxx"
                        value={gatewayConfig.emailjsTemplateId}
                        onChange={(e) => setGatewayConfig(prev => ({ ...prev, emailjsTemplateId: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-950/60 p-3 rounded-2xl border border-white/5">
                  <label className="text-slate-400 font-medium block mb-1 text-[11px]">Webhook Endpoint URL</label>
                  <input
                    type="url"
                    placeholder="https://your-webhook-or-edge-function.com/api/send"
                    value={gatewayConfig.webhookUrl}
                    onChange={(e) => setGatewayConfig(prev => ({ ...prev, webhookUrl: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-orange-500"
                  />
                </div>
              )}

              {/* Diagnostic Test Dispatch */}
              <div className="pt-2 border-t border-white/10">
                <label className="text-slate-400 font-bold block mb-1.5 uppercase tracking-wider text-[10px]">Test Automated Dispatch</label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="Enter email to test dispatch..."
                    value={gatewayTestEmail}
                    onChange={(e) => setGatewayTestEmail(e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-orange-500"
                  />
                  <button
                    type="button"
                    disabled={gatewayTesting || !gatewayTestEmail}
                    onClick={async () => {
                      setGatewayTesting(true);
                      setGatewayTestStatus(null);
                      try {
                        const res = await sendTestAutomatedEmail(gatewayTestEmail);
                        setGatewayTestStatus(res.message);
                      } catch (err: any) {
                        setGatewayTestStatus(`Test failed: ${err.message}`);
                      } finally {
                        setGatewayTesting(false);
                      }
                    }}
                    className="px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Send className={`w-3.5 h-3.5 ${gatewayTesting ? 'animate-spin' : ''}`} />
                    <span>{gatewayTesting ? 'Sending...' : 'Test Send'}</span>
                  </button>
                </div>
                {gatewayTestStatus && (
                  <p className="mt-2 text-[11px] text-emerald-400 font-mono bg-emerald-950/40 p-2 rounded-xl border border-emerald-500/20">
                    {gatewayTestStatus}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setGatewayModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  saveEmailGatewayConfig(gatewayConfig);
                  alert("Automated Email Gateway configuration saved successfully!");
                  setGatewayModalOpen(false);
                }}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-lg shadow-orange-600/30"
              >
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Deletion Timing & Activity Control Modal */}
      {deletionManageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setDeletionManageModal(null)} />
          <div className="relative max-w-xl w-full bg-slate-900 border-2 border-red-500/40 rounded-3xl p-6 shadow-2xl animate-scale-up space-y-5 text-left max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0">
                  <CalendarClock className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                    <span>Account Deletion Telemetry & Timing</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Municipal lifecycle supervision & timing adjustments</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeletionManageModal(null)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Citizen Identity & Activity Overview */}
            <div className="bg-slate-950/70 border border-white/10 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-orange-500/20 text-orange-300 flex items-center justify-center font-black text-xs border border-orange-500/30">
                    {(deletionManageModal.user.full_name || 'U')[0].toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">{deletionManageModal.user.full_name || 'Citizen'}</h4>
                    <p className="text-xs text-slate-400 font-mono">{deletionManageModal.user.email || 'No email'}</p>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-red-500/20 text-red-300 border border-red-500/30 animate-pulse">
                  Waiting Period Active
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-white/5">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Account Registered</span>
                  <span className="text-slate-300 font-medium text-xs">
                    {deletionManageModal.user.created_at ? formatDate(deletionManageModal.user.created_at) : 'N/A'}
                  </span>
                  <span className="block text-[10px] text-slate-400 font-normal">
                    {deletionManageModal.user.created_at ? timeAgo(deletionManageModal.user.created_at) : ''}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">3-Day Lock Status</span>
                  {(() => {
                    const lock = checkAccountCreationLock(deletionManageModal.user.created_at);
                    return lock.isLocked ? (
                      <span className="text-amber-400 font-semibold text-xs">
                        🔒 Active ({lock.daysRemaining}d {lock.hoursRemaining}h remaining)
                      </span>
                    ) : (
                      <span className="text-emerald-400 font-semibold text-xs">
                        ✓ Expired (Deletion Eligible)
                      </span>
                    );
                  })()}
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Deletion Requested At</span>
                  <span className="text-slate-300 font-medium text-xs">
                    {new Date(deletionManageModal.schedule.requestedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Current Target Execution</span>
                  <span className="text-red-400 font-bold text-xs">
                    {new Date(deletionManageModal.schedule.scheduledAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                  <span className="block text-[10px] text-amber-300 font-mono">
                    ({formatDeletionCountdown(deletionManageModal.schedule.scheduledAt).text})
                  </span>
                </div>
              </div>

              {deletionManageModal.schedule.reason && (
                <div className="p-2.5 bg-slate-900/90 rounded-xl border border-white/5 text-xs text-slate-300">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Citizen Reason:</span>
                  <p className="italic mt-0.5">"{deletionManageModal.schedule.reason}"</p>
                </div>
              )}
            </div>

            {/* Timing Modification Section */}
            <div className="bg-slate-950/70 border border-white/10 rounded-2xl p-4 space-y-3">
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Modify Deletion Timing (Reschedule)</span>
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Admins can extend or expedite the deletion timeline. Changes automatically dispatch an email notice to the citizen.
                </p>
              </div>

              {/* Quick Adjustment Pills */}
              <div>
                <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1.5">Quick Presets</label>
                <div className="grid grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
                      const pad = (n: number) => String(n).padStart(2, '0');
                      const localIso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                      setDeletionManageModal(prev => prev ? { ...prev, customDateInput: localIso } : null);
                    }}
                    className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 rounded-xl text-[10px] font-bold text-center cursor-pointer transition-colors"
                  >
                    Tomorrow
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const cur = new Date(deletionManageModal.schedule.scheduledAt).getTime();
                      const d = new Date(cur + 3 * 24 * 60 * 60 * 1000);
                      const pad = (n: number) => String(n).padStart(2, '0');
                      const localIso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                      setDeletionManageModal(prev => prev ? { ...prev, customDateInput: localIso } : null);
                    }}
                    className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 rounded-xl text-[10px] font-bold text-center cursor-pointer transition-colors"
                  >
                    +3 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const cur = new Date(deletionManageModal.schedule.scheduledAt).getTime();
                      const d = new Date(cur + 7 * 24 * 60 * 60 * 1000);
                      const pad = (n: number) => String(n).padStart(2, '0');
                      const localIso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                      setDeletionManageModal(prev => prev ? { ...prev, customDateInput: localIso } : null);
                    }}
                    className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 rounded-xl text-[10px] font-bold text-center cursor-pointer transition-colors"
                  >
                    +7 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const cur = new Date(deletionManageModal.schedule.scheduledAt).getTime();
                      const d = new Date(cur + 14 * 24 * 60 * 60 * 1000);
                      const pad = (n: number) => String(n).padStart(2, '0');
                      const localIso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                      setDeletionManageModal(prev => prev ? { ...prev, customDateInput: localIso } : null);
                    }}
                    className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 rounded-xl text-[10px] font-bold text-center cursor-pointer transition-colors"
                  >
                    +14 Days
                  </button>
                </div>
              </div>

              {/* Exact Date & Time Picker */}
              <div>
                <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Set Execution Date & Time</label>
                <div className="flex gap-2">
                  <input
                    type="datetime-local"
                    value={deletionManageModal.customDateInput}
                    onChange={(e) => setDeletionManageModal(prev => prev ? { ...prev, customDateInput: e.target.value } : null)}
                    className="flex-1 px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-amber-500 cursor-pointer"
                  />
                  <button
                    type="button"
                    disabled={deletionManageModal.modifying || !deletionManageModal.customDateInput}
                    onClick={() => handleAdminModifyTiming(deletionManageModal.customDateInput)}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-black rounded-xl text-xs transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-md shrink-0"
                  >
                    <CalendarClock className="w-3.5 h-3.5" />
                    <span>{deletionManageModal.modifying ? 'Updating...' : 'Save Timing'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Admin Overrides & Resolution Controls */}
            <div className="p-3 bg-red-500/10 border border-red-500/25 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-red-300 uppercase tracking-wider flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                    <span>Administrative Resolution Actions</span>
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Revoke request to restore full citizen standing, or execute immediate permanent deletion.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <button
                  type="button"
                  disabled={deletionManageModal.cancelling}
                  onClick={handleAdminRevokeDeletion}
                  className="flex-1 py-2.5 px-3 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{deletionManageModal.cancelling ? 'Restoring...' : 'Revoke Request & Keep Account'}</span>
                </button>
                <button
                  type="button"
                  disabled={deletionManageModal.deletingImmediately}
                  onClick={handleAdminImmediateDelete}
                  className="flex-1 py-2.5 px-3 bg-red-600 hover:bg-red-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-md shadow-red-600/30"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{deletionManageModal.deletingImmediately ? 'Purging...' : 'Delete Immediately (Admin Override)'}</span>
                </button>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setDeletionManageModal(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

