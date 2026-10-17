import { useEffect, useState, useRef, useMemo } from 'react';
import {
  Droplets, Zap, Leaf, Landmark, CheckCircle2, Clock, Receipt,
  CreditCard, Wallet, Building, X, Plus, Trash2, AlertCircle,
  Printer, Download, ShieldCheck, ArrowRight, Sparkles, Building2,
  QrCode, Camera, Copy, Check, ExternalLink, RefreshCw, Smartphone,
  ScanLine, Upload, CheckCheck
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Screen, ScreenHeader } from '@/components/Screen';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { formatINR, formatDate } from '@/lib/utils';
import type { Bill, BillType } from '@/lib/types';
import {
  buildNpciUpiUri, generateNpciQrDataUrl, parseScannedQrPayload,
  DEFAULT_MUNICIPAL_VPAS, isValidVpa, playPaymentChime, playScannerBeep,
  sanitizeUpiNote
} from '@/lib/upiPaymentService';
import { getCachedBills, setCachedBills } from '@/lib/screenDataCache';

const typeConfig: Record<BillType, { icon: typeof Droplets; color: string; bg: string; label: string }> = {
  water: { icon: Droplets, color: 'text-secondary-500', bg: 'bg-secondary-100 dark:bg-secondary-950/40', label: 'Water Supply' },
  electricity: { icon: Zap, color: 'text-amber-500', bg: 'bg-amber-500/10 dark:bg-amber-950/40', label: 'Electricity' },
  property: { icon: Landmark, color: 'text-primary-600 dark:text-primary-400', bg: 'bg-primary-100 dark:bg-primary-950/40', label: 'Property Tax' },
  waste: { icon: Leaf, color: 'text-emerald-500', bg: 'bg-emerald-500/10 dark:bg-emerald-950/40', label: 'Municipal Waste' },
};

export function getBillConfig(type?: string) {
  if (type && type in typeConfig) {
    return typeConfig[type as BillType];
  }
  return {
    icon: Landmark,
    color: 'text-primary-600 dark:text-primary-400',
    bg: 'bg-primary-100 dark:bg-primary-950/40',
    label: type ? String(type).charAt(0).toUpperCase() + String(type).slice(1) : 'Utility Bill'
  };
}

const billers = [
  { id: 'tata_power', label: 'Tata Power (Electricity)', type: 'electricity' as const, name: 'Tata Power Distribution' },
  { id: 'tewed', label: 'TPCODL / CESU (Electricity)', type: 'electricity' as const, name: 'TP Central Odisha Distribution' },
  { id: 'bescom', label: 'BESCOM (Electricity)', type: 'electricity' as const, name: 'Bangalore Electricity Supply' },
  { id: 'watco', label: 'WATCO Odisha (Water)', type: 'water' as const, name: 'Water Corporation of Odisha' },
  { id: 'djb', label: 'Delhi Jal Board (Water)', type: 'water' as const, name: 'Delhi Jal Board' },
  { id: 'bmc_tax', label: 'BMC Property Tax (Property)', type: 'property' as const, name: 'Bhubaneswar Municipal Corp Tax' },
  { id: 'bmc_waste', label: 'BMC Sanitation (Waste)', type: 'waste' as const, name: 'Municipal Waste Management' },
];

export function Bills({ onBack, initialType }: { onBack: () => void; initialType?: BillType }) {
  const { session, profile } = useAuth();
  const cached = getCachedBills(session?.user?.id);
  const [bills, setBills] = useState<Bill[]>(() => cached || []);
  const [loading, setLoading] = useState<boolean>(() => !cached);
  const [filter, setFilter] = useState<'all' | 'unpaid' | 'paid'>('unpaid');
  const [payBill, setPayBill] = useState<Bill | null>(null);
  const [viewReceiptBill, setViewReceiptBill] = useState<Bill | null>(null);

  // Add Bill states
  const [showAddModal, setShowAddModal] = useState(!!initialType);
  const [addMode, setAddMode] = useState<'link' | 'manual'>('link');
  const [selectedBiller, setSelectedBiller] = useState(
    initialType ? (billers.find(b => b.type === initialType) || billers[0]) : billers[0]
  );
  const [consumerNo, setConsumerNo] = useState('');
  const [fetchingBill, setFetchingBill] = useState(false);
  const [bbpsLogs, setBbpsLogs] = useState<string[]>([]);
  const [fetchedBill, setFetchedBill] = useState<{ amount: number; period: string; dueDate: string } | null>(null);

  const [newType, setNewType] = useState<BillType>('electricity');
  const [newAmount, setNewAmount] = useState('');
  const [newPeriod, setNewPeriod] = useState('August 2026');
  const [newDueDate, setNewDueDate] = useState(new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString().split('T')[0]);
  const [adding, setAdding] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);

  const load = async (silent = false) => {
    if (!session?.user) return;
    if (!silent && !getCachedBills(session.user.id)) {
      setLoading(true);
    }
    try {
      const { data, error: queryErr } = await supabase
        .from('bills')
        .select('*')
        .eq('user_id', session.user.id)
        .order('due_date', { ascending: true });
      if (queryErr) {
        console.warn('Supabase bills query error:', queryErr);
        setDbError(queryErr.message);
      } else {
        const list = data ?? [];
        setBills(list);
        setCachedBills(list, session.user.id);
        setDbError(null);
      }
    } catch (err: any) {
      setDbError(err.message || 'Failed to query database schema cache.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const hasCache = !!getCachedBills(session?.user?.id);
    load(hasCache);
  }, [session]);

  useEffect(() => {
    if (initialType) {
      setNewType(initialType);
      const matched = billers.find(b => b.type === initialType);
      if (matched) {
        setSelectedBiller(matched);
      }
      setShowAddModal(true);
    }
  }, [initialType]);

  const handleSeedSampleBills = async () => {
    if (!session?.user) return;
    setSeeding(true);
    try {
      const sampleBills = [
        {
          user_id: session.user.id,
          type: 'electricity',
          amount: 1450,
          period: 'TPCODL Electricity · Consumer #882049182',
          due_date: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0],
          status: 'unpaid'
        },
        {
          user_id: session.user.id,
          type: 'water',
          amount: 320,
          period: 'WATCO Water Supply · Consumer #2049182',
          due_date: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().split('T')[0],
          status: 'unpaid'
        },
        {
          user_id: session.user.id,
          type: 'waste',
          amount: 180,
          period: 'BMC Municipal Sanitation · July 2026',
          due_date: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString().split('T')[0],
          status: 'paid',
          paid_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString()
        }
      ];

      const { error: insertErr } = await supabase.from('bills').insert(sampleBills);
      if (insertErr) throw insertErr;
      await load();
    } catch (e: any) {
      alert("Error seeding sample bills: " + e.message);
    } finally {
      setSeeding(false);
    }
  };

  const handleFetchBill = () => {
    if (!consumerNo.trim() || consumerNo.length < 5) {
      setError('Please enter a valid Consumer Number (at least 5 digits).');
      return;
    }
    setFetchingBill(true);
    setError(null);
    setFetchedBill(null);
    setBbpsLogs([]);

    setTimeout(() => {
      setBbpsLogs(prev => [...prev, `[BBPS SW-301] Locating billing clearing house for ${selectedBiller.name}...`]);
    }, 100);

    setTimeout(() => {
      setBbpsLogs(prev => [...prev, `[GATEWAY] Accessing merchant gateway node (SSL/TLS V1.3 authorized)...`]);
    }, 600);

    setTimeout(() => {
      setBbpsLogs(prev => [...prev, `[VERIFIED] Connection open. Scanning registry for Consumer ID: ${consumerNo}...`]);
    }, 1200);

    setTimeout(() => {
      const seed = consumerNo.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const generatedAmount = 450 + (seed % 1750);
      const generatedPeriod = `July-August 2026 (Consumer No: ${consumerNo})`;
      const generatedDueDate = new Date(Date.now() + 12 * 24 * 3600 * 1000).toISOString().split('T')[0];

      setBbpsLogs(prev => [...prev, `[RETRIEVED] Active invoice found. Payload response size: 1.2KB`]);
      setFetchedBill({
        amount: generatedAmount,
        period: generatedPeriod,
        dueDate: generatedDueDate
      });
      setFetchingBill(false);
    }, 1800);
  };

  const handleLinkFetchedBill = async () => {
    if (!session?.user || !fetchedBill) return;
    setAdding(true);
    setError(null);
    const { error: insertErr } = await supabase.from('bills').insert({
      user_id: session.user.id,
      type: selectedBiller.type,
      amount: fetchedBill.amount,
      period: `${selectedBiller.name} · ${fetchedBill.period}`,
      due_date: fetchedBill.dueDate,
      status: 'unpaid',
    });
    setAdding(false);
    if (insertErr) {
      setError(insertErr.message);
      return;
    }

    await supabase.from('notifications').insert({
      user_id: session.user.id,
      title: 'Biller Linked Successfully',
      message: `Your account for ${selectedBiller.label} has been linked. Pending bill of ${formatINR(fetchedBill.amount)} fetched.`,
      type: 'bill',
    });

    setConsumerNo('');
    setFetchedBill(null);
    setShowAddModal(false);
    load();
  };

  const handleAddBill = async () => {
    if (!session?.user) return;
    if (!newAmount || isNaN(Number(newAmount)) || Number(newAmount) <= 0) {
      setError('Please enter a valid amount greater than 0.');
      return;
    }
    setAdding(true);
    setError(null);
    const { error: insertErr } = await supabase.from('bills').insert({
      user_id: session.user.id,
      type: newType,
      amount: Number(newAmount),
      period: newPeriod,
      due_date: newDueDate,
      status: 'unpaid',
    });
    setAdding(false);
    if (insertErr) {
      setError(insertErr.message);
      return;
    }

    await supabase.from('notifications').insert({
      user_id: session.user.id,
      title: 'New bill generated',
      message: `A new ${newType} bill of ${formatINR(Number(newAmount))} has been registered to your account.`,
      type: 'bill',
    });

    setNewAmount('');
    setShowAddModal(false);
    load();
  };

  const deleteBill = async (billId: string) => {
    if (!session?.user) return;
    await supabase.from('bills').delete().eq('id', billId).eq('user_id', session.user.id);
    load();
  };

  const clearPaidBills = async () => {
    if (!session?.user) return;
    if (confirm('Are you sure you want to clear your paid bills history?')) {
      await supabase.from('bills').delete().eq('status', 'paid').eq('user_id', session.user.id);
      load();
    }
  };

  const filtered = bills.filter((b) => filter === 'all' || b.status === filter);
  const totalDue = bills.filter((b) => b.status === 'unpaid').reduce((sum, b) => sum + Number(b.amount), 0);

  const handlePaidSuccess = async (bill: Bill, paymentDetails?: { method: string; txnId: string }) => {
    if (!session?.user) return;
    const paidAt = new Date().toISOString();
    const txnReference = paymentDetails?.txnId || `BBPS-${Math.floor(100000000 + Math.random() * 900000000)}`;
    
    try {
      await supabase.from('bills').update({ status: 'paid', paid_at: paidAt }).eq('id', bill.id);
    } catch (err) {
      console.warn('Bill status update error in Supabase:', err);
    }
    
    // Play payment success chime safely
    try {
      playPaymentChime();
    } catch (chimeErr) {
      console.debug('Chime playback error:', chimeErr);
    }

    try {
      const billLabel = getBillConfig(bill.type).label;
      const safeAmt = Number(bill.amount) || 0;
      await supabase.from('notifications').insert({
        user_id: session.user.id,
        title: 'Payment Successful 🎉',
        message: `Your ${billLabel} bill of ${formatINR(safeAmt)} was paid successfully (${paymentDetails?.method ? paymentDetails.method.toUpperCase() : 'UPI'} Ref: ${txnReference}). Official e-tax receipt generated.`,
        type: 'bill',
        read: false
      });
    } catch (notifErr) {
      console.warn('Notification insert error in Supabase:', notifErr);
    }

    const paidBillObj = { ...bill, status: 'paid' as const, paid_at: paidAt };
    setPayBill(null);
    setViewReceiptBill(paidBillObj);
    load();
  };

  return (
    <Screen className="max-w-4xl mx-auto">
      <ScreenHeader
        title="Bills & Utility Invoices"
        subtitle="Real-time Municipal Payment Gateway"
        onBack={onBack}
        right={
          <div className="flex gap-2">
            {bills.some((b) => b.status === 'paid') && (
              <button
                onClick={clearPaidBills}
                title="Clear Paid History"
                className="w-9 h-9 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 hover:bg-red-500/20 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setShowAddModal(true)}
              className="w-9 h-9 rounded-full bg-primary-600 flex items-center justify-center text-white shadow-sm hover:bg-primary-700 transition-colors cursor-pointer"
              title="Add or Link Biller Account"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        }
      />

      {dbError && (
        <div className="mx-4 mt-4 p-4 bg-red-500/10 border border-red-500/20 text-red-800 dark:text-red-400 rounded-2xl space-y-2 text-xs">
          <p className="font-bold flex items-center gap-1.5 text-sm">
            ⚠️ Supabase Schema Notice: 'public.bills'
          </p>
          <p>
            The <code>bills</code> table query returned: {dbError}. Please run the latest SQL migration script in your Supabase SQL Editor.
          </p>
        </div>
      )}

      {/* Summary card */}
      <div className="px-4 pt-4">
        <div className="bg-gradient-to-br from-primary-600 via-primary-700 to-secondary-700 rounded-3xl p-5 sm:p-6 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-36 h-36 bg-white/10 rounded-full blur-2xl -mr-12 -mt-12 pointer-events-none" />
          <p className="text-primary-100 text-xs font-semibold uppercase tracking-wider">Total Outstanding Invoices</p>
          <p className="text-3xl sm:text-4xl font-black mt-1 tracking-tight">{formatINR(totalDue)}</p>
          
          <div className="flex items-center gap-6 mt-5 pt-4 border-t border-white/15">
            <div>
              <p className="text-2xl font-bold">{bills.filter((b) => b.status === 'unpaid').length}</p>
              <p className="text-primary-100/90 text-xs font-medium">Pending Unpaid</p>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div>
              <p className="text-2xl font-bold text-emerald-300">{bills.filter((b) => b.status === 'paid').length}</p>
              <p className="text-primary-100/90 text-xs font-medium">Settled Receipts</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="px-4 py-4 flex items-center justify-between gap-3">
        <div className="flex-1 flex gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 rounded-2xl">
          {(['unpaid', 'paid', 'all'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-bold capitalize transition-all cursor-pointer ${
                filter === f 
                  ? 'bg-white dark:bg-slate-800 text-primary-600 dark:text-primary-400 shadow-sm' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {bills.length === 0 && !loading && (
          <button
            onClick={handleSeedSampleBills}
            disabled={seeding}
            className="px-3 py-2 bg-primary-50 dark:bg-primary-950/40 border border-primary-500/20 text-primary-600 dark:text-primary-400 rounded-2xl text-xs font-bold flex items-center gap-1.5 hover:bg-primary-100 active:scale-95 transition-all shrink-0 cursor-pointer"
            title="Load sample utility bills for quick testing"
          >
            <Sparkles className="w-3.5 h-3.5" /> Sample Bills
          </button>
        )}
      </div>

      {/* Bills list */}
      <div className="px-4 pb-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="rounded-2xl h-24 skeleton border border-slate-200/50 dark:border-slate-800/60" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-8 text-center shadow-sm">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <p className="font-bold text-slate-800 dark:text-white text-base">All clear!</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              No {filter} bills to display.
            </p>
            <button
              onClick={handleSeedSampleBills}
              disabled={seeding}
              className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-xl text-xs font-bold hover:bg-primary-700 transition-all cursor-pointer shadow-md inline-flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" /> Seed Demo Utility Bills
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((bill) => {
              const cfg = getBillConfig(bill.type);
              return (
                <div key={bill.id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0`}>
                      <cfg.icon className={`w-5 h-5 ${cfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 dark:text-white text-sm">{cfg.label} Bill</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{bill.period || 'General Municipal Utility'}</p>
                    </div>
                    
                    <div className="text-right flex items-center gap-2.5">
                      <div>
                        <p className="font-extrabold text-slate-900 dark:text-white text-base">{formatINR(Number(bill.amount))}</p>
                        {bill.status === 'unpaid' && bill.due_date && (
                          <p className="text-[11px] text-red-500 font-bold flex items-center gap-0.5 justify-end">
                            <Clock className="w-3 h-3" />
                            Due {formatDate(bill.due_date)}
                          </p>
                        )}
                        {bill.status === 'paid' && (
                          <p className="text-[11px] text-emerald-500 font-bold flex items-center gap-0.5 justify-end">
                            <CheckCircle2 className="w-3 h-3" /> Settled
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => deleteBill(bill.id)}
                        title="Delete Bill"
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                    {bill.status === 'unpaid' ? (
                      <Button onClick={() => setPayBill(bill)} size="sm" className="w-full font-bold">
                        <CreditCard className="w-4 h-4" /> Pay Now ({formatINR(Number(bill.amount))})
                      </Button>
                    ) : (
                      <button
                        onClick={() => setViewReceiptBill(bill)}
                        className="w-full py-2 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Receipt className="w-4 h-4" /> View Payment Receipt
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Payment modal */}
      <Modal open={!!payBill} onClose={() => setPayBill(null)} title="Secure Payment Gateway">
        <ErrorBoundary fallbackTitle="Payment Gateway Notice" onReset={() => setPayBill(null)}>
          {payBill && <PaymentFlow bill={payBill} onPaid={(details) => handlePaidSuccess(payBill, details)} />}
        </ErrorBoundary>
      </Modal>

      {/* Payment Receipt Modal */}
      <Modal open={!!viewReceiptBill} onClose={() => setViewReceiptBill(null)} title="Official Payment Receipt">
        <ErrorBoundary fallbackTitle="Receipt Display Notice" onReset={() => setViewReceiptBill(null)}>
          {viewReceiptBill && <ReceiptCard bill={viewReceiptBill} userName={profile?.full_name || 'Citizen'} userEmail={session?.user?.email} />}
        </ErrorBoundary>
      </Modal>

      {/* Add Bill Modal */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Manage & Link Biller">
        <div className="space-y-4">
          <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl">
            <button
              onClick={() => { setAddMode('link'); setError(null); }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                addMode === 'link' ? 'bg-white dark:bg-slate-800 text-primary-600 dark:text-primary-400 shadow-sm' : 'text-slate-500'
              }`}
            >
              🔗 Link BBPS Biller
            </button>
            <button
              onClick={() => { setAddMode('manual'); setError(null); }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                addMode === 'manual' ? 'bg-white dark:bg-slate-800 text-primary-600 dark:text-primary-400 shadow-sm' : 'text-slate-500'
              }`}
            >
              ✍️ Manual Invoice Entry
            </button>
          </div>

          {addMode === 'link' ? (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 block">Select Biller Provider</label>
                <select
                  value={selectedBiller.id}
                  onChange={(e) => {
                    const found = billers.find(b => b.id === e.target.value);
                    if (found) setSelectedBiller(found);
                    setFetchedBill(null);
                  }}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-primary-500 text-slate-800 dark:text-white"
                >
                  {billers.map(b => (
                    <option key={b.id} value={b.id}>{b.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 block">Consumer / Customer Account ID</label>
                <input
                  type="text"
                  placeholder="e.g. 100234567"
                  value={consumerNo}
                  onChange={(e) => { setConsumerNo(e.target.value); setFetchedBill(null); }}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-primary-500 text-slate-800 dark:text-white font-mono"
                />
              </div>

              {(fetchingBill || bbpsLogs.length > 0) && (
                <div className="bg-slate-950 rounded-xl p-3 border border-white/5 font-mono text-[9px] text-slate-400 space-y-1 max-h-40 overflow-y-auto">
                  <p className="text-[10px] text-orange-400 font-bold border-b border-white/5 pb-1 mb-1.5 flex items-center justify-between">
                    <span>⚡ BBPS SECURE QUERY ROUTING</span>
                    {fetchingBill && <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-ping" />}
                  </p>
                  {bbpsLogs.map((log, idx) => (
                    <p key={idx} className={log.includes('[RETRIEVED]') ? 'text-emerald-400 font-semibold' : 'text-slate-400'}>
                      {log}
                    </p>
                  ))}
                </div>
              )}

              {fetchedBill && (
                <div className="bg-primary-500/10 border border-primary-500/20 rounded-2xl p-4 space-y-3 animate-fade-in text-slate-800 dark:text-white">
                  <p className="text-xs font-bold text-primary-500 uppercase tracking-widest">INVOICE PAYLOAD FETCHED</p>
                  <div className="text-xs space-y-1">
                    <p><strong>Biller:</strong> {selectedBiller.name}</p>
                    <p><strong>Consumer No:</strong> {consumerNo}</p>
                    <p><strong>Cycle:</strong> July-August 2026</p>
                  </div>
                  <div className="border-t border-primary-500/10 pt-2 flex justify-between items-baseline">
                    <span className="text-xs font-semibold">Outstanding Due:</span>
                    <span className="text-xl font-black text-primary-600 dark:text-primary-400">{formatINR(fetchedBill.amount)}</span>
                  </div>
                </div>
              )}

              {error && (
                <div className="text-xs text-red-500 bg-red-500/10 rounded-xl px-3 py-2 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {!fetchedBill ? (
                <Button onClick={handleFetchBill} loading={fetchingBill} size="lg" className="w-full font-bold">
                  Fetch Outstanding Bill
                </Button>
              ) : (
                <Button onClick={handleLinkFetchedBill} loading={adding} size="lg" className="w-full font-bold">
                  Link Account & Sync Bill
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 block">Bill Category</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['electricity', 'water', 'property', 'waste'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setNewType(t)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold capitalize border transition-all cursor-pointer ${
                        newType === t 
                          ? 'bg-primary-600 text-white border-primary-600' 
                          : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      {typeConfig[t].label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 block">Amount (INR ₹)</label>
                <input
                  type="number"
                  placeholder="e.g. 1500"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-primary-500 text-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 block">Billing Period / Consumer Note</label>
                <input
                  type="text"
                  placeholder="e.g. August 2026"
                  value={newPeriod}
                  onChange={(e) => setNewPeriod(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-primary-500 text-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 block">Due Date</label>
                <input
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-primary-500 text-slate-800 dark:text-white"
                />
              </div>

              {error && (
                <div className="text-xs text-red-500 bg-red-500/10 rounded-xl px-3 py-2 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button onClick={handleAddBill} loading={adding} size="lg" className="w-full font-bold">
                Add Invoice
              </Button>
            </div>
          )}
        </div>
      </Modal>
    </Screen>
  );
}

function ReceiptCard({ bill, userName, userEmail }: { bill: Bill; userName: string; userEmail?: string }) {
  const txnId = `TXN-${Math.floor(100000000 + Math.random() * 900000000)}`;
  const paidDate = bill.paid_at ? new Date(bill.paid_at).toLocaleString() : new Date().toLocaleString();
  const cfg = getBillConfig(bill.type);

  const handlePrint = () => {
    try {
      window.print();
    } catch (e) {
      console.warn('Print not supported:', e);
    }
  };

  return (
    <div className="space-y-4 text-slate-800 dark:text-white">
      <div className="border border-emerald-500/30 bg-emerald-500/5 rounded-3xl p-5 space-y-4 relative overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="font-extrabold text-sm text-slate-900 dark:text-white">CITY MUNICIPAL CORPORATION</p>
              <p className="text-[10px] text-slate-400 font-mono">Official E-Tax Payment Receipt</p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-extrabold uppercase border border-emerald-500/20">
            PAID & VERIFIED
          </span>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
            <span className="text-slate-400 font-medium">Transaction Reference:</span>
            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{txnId}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
            <span className="text-slate-400 font-medium">Payer Account:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{userName} ({userEmail || 'Registered Citizen'})</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
            <span className="text-slate-400 font-medium">Biller Category:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{cfg.label}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
            <span className="text-slate-400 font-medium">Billing Period Note:</span>
            <span className="font-medium text-slate-800 dark:text-slate-200">{bill.period || 'General Municipal Utility'}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
            <span className="text-slate-400 font-medium">Settled Timestamp:</span>
            <span className="font-mono text-slate-800 dark:text-slate-200">{paidDate}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Amount Paid in Full</p>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{formatINR(Number(bill.amount) || 0)}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={handlePrint} variant="outline" className="flex-1 font-bold">
          <Printer className="w-4 h-4" /> Print Receipt
        </Button>
      </div>
    </div>
  );
}

function PaymentFlow({ bill, onPaid }: { bill: Bill; onPaid: (details?: { method: string; txnId: string }) => void }) {
  const [method, setMethod] = useState<'upi' | 'card' | 'netbanking' | 'wallet'>('upi');
  const [processing, setProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Device detection: differentiates mobile from laptop/desktop
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  useEffect(() => {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const mobilePattern = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
    setIsMobileDevice(mobilePattern.test(ua));
  }, []);

  // UPI Sub-modes: 'qr' (Show scannable QR) vs 'scanner' (In-app camera scanner)
  const [upiSubTab, setUpiSubTab] = useState<'qr' | 'scanner'>('qr');
  const [selectedVpaIndex, setSelectedVpaIndex] = useState(0);
  const [customVpa, setCustomVpa] = useState('');
  const [showCustomVpaInput, setShowCustomVpaInput] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // In-app Camera Scanner States
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannedResult, setScannedResult] = useState<{
    vpa: string;
    payeeName: string;
    amount: number;
    note: string;
    raw: string;
  } | null>(null);

  // Card form states
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardName, setCardName] = useState('');

  // Net banking state
  const [selectedBank, setSelectedBank] = useState('sbi');

  // Active VPA calculation memoized to prevent recreation on every render
  const currentPayee = useMemo(() => {
    if (showCustomVpaInput && isValidVpa(customVpa)) {
      return { vpa: customVpa.trim(), name: 'Custom Registered UPI Payee' };
    }
    return (
      DEFAULT_MUNICIPAL_VPAS[selectedVpaIndex] ||
      DEFAULT_MUNICIPAL_VPAS[0] || {
        vpa: 'bmc.odisha@sbi',
        name: 'Bhubaneswar Municipal Corporation',
      }
    );
  }, [showCustomVpaInput, customVpa, selectedVpaIndex]);

  const safeAmount = Number(bill.amount) > 0 ? Number(bill.amount) : 0;
  const safePeriod = bill.period || 'General Municipal Utility';

  // Stable transaction reference derived deterministically from the bill
  const transactionRef = useMemo(() => {
    const rawId = (bill?.id || 'BILL').toString().replace(/[^a-zA-Z0-9]/g, '');
    return `CZ${rawId.slice(-12) || 'REF'}`;
  }, [bill?.id]);

  // NPCI-compliant UPI URI memoized with stable references
  const upiUri = useMemo(() => {
    return buildNpciUpiUri({
      pa: currentPayee.vpa,
      pn: currentPayee.name,
      am: safeAmount,
      tn: `Bill Settlement - ${safePeriod}`,
      tr: transactionRef,
    });
  }, [currentPayee.vpa, currentPayee.name, safeAmount, safePeriod, transactionRef]);

  // Generate offline QR Code whenever URI changes
  useEffect(() => {
    let active = true;
    generateNpciQrDataUrl(upiUri, 300)
      .then((url) => {
        if (active && url) setQrDataUrl(url);
      })
      .catch((err) => {
        console.warn('QR Code generation notice:', err);
        if (active) {
          setQrDataUrl(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiUri)}`);
        }
      });
    return () => {
      active = false;
    };
  }, [upiUri]);

  // Camera Scanner Lifecycle with laptop-friendly constraints
  useEffect(() => {
    let stream: MediaStream | null = null;
    let isCancelled = false;

    if (method === 'upi' && upiSubTab === 'scanner') {
      setCameraError(null);
      const initCamera = async () => {
        try {
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            if (!isCancelled) {
              setCameraActive(false);
              setCameraError('Camera access is not supported in this browser environment or over insecure connection.');
            }
            return;
          }

          let s: MediaStream;
          try {
            // Prefer rear camera on mobile without throwing OverconstrainedError on laptop webcams
            s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
          } catch (envErr) {
            console.warn('Environment camera not found, trying default webcam:', envErr);
            s = await navigator.mediaDevices.getUserMedia({ video: true });
          }

          if (isCancelled) {
            s.getTracks().forEach((track) => track.stop());
            return;
          }

          stream = s;
          if (videoRef.current) {
            videoRef.current.srcObject = s;
            setCameraActive(true);
          }
        } catch (err: any) {
          console.warn('Camera access denied or unavailable:', err);
          if (!isCancelled) {
            setCameraActive(false);
            setCameraError('Camera access not available on this device. You can use the Quick Test Scanner below.');
          }
        }
      };

      initCamera();
    } else {
      setCameraActive(false);
    }

    return () => {
      isCancelled = true;
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [method, upiSubTab]);

  const handleCopy = async (text: string, type: 'vpa' | 'link') => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const el = document.createElement('textarea');
        el.value = text;
        el.style.position = 'fixed';
        el.style.opacity = '0';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      if (type === 'vpa') {
        setCopiedUpi(true);
        setTimeout(() => setCopiedUpi(false), 2200);
      } else {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2200);
      }
    } catch (e) {
      console.warn('Clipboard write notice:', e);
    }
  };

  // Simulate scanning a barcode / voucher
  const handleSimulateScan = (voucherType: 'meter' | 'water' | 'bharatqr') => {
    playScannerBeep();
    if (voucherType === 'meter') {
      setScannedResult({
        vpa: 'tpcdl.smartmeter@sbi',
        payeeName: 'TP Central Odisha Electricity Clearing',
        amount: Number(bill.amount),
        note: `Smart Meter Tariff ${bill.period}`,
        raw: `upi://pay?pa=tpcdl.smartmeter@sbi&pn=TPCODL&am=${bill.amount}&cu=INR`
      });
    } else if (voucherType === 'water') {
      setScannedResult({
        vpa: 'watco.odisha@icici',
        payeeName: 'WATCO Municipal Water Supply',
        amount: Number(bill.amount),
        note: `Water Consumer Connection ${bill.period}`,
        raw: `upi://pay?pa=watco.odisha@icici&pn=WATCO&am=${bill.amount}&cu=INR`
      });
    } else {
      setScannedResult({
        vpa: 'bmc.odisha@sbi',
        payeeName: 'Bhubaneswar Municipal Corporation BharatQR',
        amount: Number(bill.amount),
        note: `Municipal E-Tax Payment - ${bill.period}`,
        raw: `00020101021126480010sbi.bmc0112bmc.odisha@sbi520493995303356540${Number(bill.amount).toFixed(2)}5802IN`
      });
    }
  };

  const handlePay = (customTxnId?: string) => {
    setPaymentError(null);

    if (method === 'card') {
      const cleanNum = cardNumber.replace(/\D/g, '');
      if (cleanNum.length < 16) {
        setPaymentError('Please enter a valid 16-digit card number.');
        return;
      }
      if (!cardExpiry.includes('/') || cardExpiry.length < 5) {
        setPaymentError('Please enter card expiry in MM/YY format.');
        return;
      }
      if (cardCvv.length < 3) {
        setPaymentError('Please enter a valid 3-digit CVV code.');
        return;
      }
      if (!cardName.trim()) {
        setPaymentError('Please enter cardholder name as printed on card.');
        return;
      }
    }

    setProcessing(true);
    const txnId = customTxnId || `UPI-TXN-${Math.floor(100000000 + Math.random() * 900000000)}`;

    setTimeout(() => {
      setProcessing(false);
      onPaid({ method, txnId });
    }, 1500);
  };

  return (
    <div className="space-y-4 text-slate-800 dark:text-white">
      {/* Bill summary header */}
      <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold truncate max-w-[200px]">
            {getBillConfig(bill?.type).label} · {bill?.period || 'General Utility'}
          </span>
          <span className="text-xs text-slate-400 font-mono">Due {formatDate(bill?.due_date)}</span>
        </div>
        <div className="flex items-baseline justify-between mt-2">
          <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            {formatINR(Number(bill?.amount) || 0)}
          </p>
          <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> BBPS 256-Bit Encrypted
          </span>
        </div>
      </div>

      {/* Payment method tabs */}
      <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl text-center">
        <button
          onClick={() => { setMethod('upi'); setPaymentError(null); }}
          className={`py-2 rounded-lg text-[10px] sm:text-xs font-bold transition-all cursor-pointer ${
            method === 'upi' ? 'bg-white dark:bg-slate-800 text-primary-600 dark:text-primary-400 shadow-sm' : 'text-slate-500'
          }`}
        >
          📲 UPI & Scanner
        </button>
        <button
          onClick={() => { setMethod('card'); setPaymentError(null); }}
          className={`py-2 rounded-lg text-[10px] sm:text-xs font-bold transition-all cursor-pointer ${
            method === 'card' ? 'bg-white dark:bg-slate-800 text-primary-600 dark:text-primary-400 shadow-sm' : 'text-slate-500'
          }`}
        >
          💳 Card
        </button>
        <button
          onClick={() => { setMethod('netbanking'); setPaymentError(null); }}
          className={`py-2 rounded-lg text-[10px] sm:text-xs font-bold transition-all cursor-pointer ${
            method === 'netbanking' ? 'bg-white dark:bg-slate-800 text-primary-600 dark:text-primary-400 shadow-sm' : 'text-slate-500'
          }`}
        >
          🏦 NetBanking
        </button>
        <button
          onClick={() => { setMethod('wallet'); setPaymentError(null); }}
          className={`py-2 rounded-lg text-[10px] sm:text-xs font-bold transition-all cursor-pointer ${
            method === 'wallet' ? 'bg-white dark:bg-slate-800 text-primary-600 dark:text-primary-400 shadow-sm' : 'text-slate-500'
          }`}
        >
          👛 Wallet
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 1. UPI & SCANNER INTERACTION FLOW                                         */}
      {/* ========================================================================= */}
      {method === 'upi' && (
        <div className="space-y-3.5">
          {/* Sub-tabs: Display Scannable QR vs In-App Camera Scanner */}
          <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
            <button
              onClick={() => setUpiSubTab('qr')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                upiSubTab === 'qr'
                  ? 'bg-white dark:bg-slate-900 text-primary-600 dark:text-primary-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Show Scannable QR</span>
            </button>
            <button
              onClick={() => setUpiSubTab('scanner')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                upiSubTab === 'scanner'
                  ? 'bg-white dark:bg-slate-900 text-primary-600 dark:text-primary-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <ScanLine className="w-3.5 h-3.5 text-emerald-500" />
              <span>Scan QR with Camera</span>
            </button>
          </div>

          {/* MODE A: DISPLAY SCANNABLE NPCI QR CODE */}
          {upiSubTab === 'qr' && (
            <div className="space-y-3 text-center">
              {/* Payee VPA Switcher Bar */}
              <div className="bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-2xl border border-slate-200/50 dark:border-slate-800 text-left">
                <div className="flex items-center justify-between text-[11px] mb-1.5">
                  <span className="font-bold text-slate-500 dark:text-slate-400">Clearing Payee UPI ID:</span>
                  <button
                    onClick={() => setShowCustomVpaInput(!showCustomVpaInput)}
                    className="text-[10px] text-primary-600 dark:text-primary-400 font-bold hover:underline cursor-pointer"
                  >
                    {showCustomVpaInput ? 'Use Default Gateway' : '+ Enter Custom UPI ID'}
                  </button>
                </div>

                {showCustomVpaInput ? (
                  <div className="space-y-1">
                    <input
                      type="text"
                      placeholder="e.g. yourname@okhdfcbank"
                      value={customVpa}
                      onChange={(e) => setCustomVpa(e.target.value.trim())}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-800 dark:text-white"
                    />
                    <p className="text-[9px] text-slate-400">Enter your UPI address to test real phone scanning directly to your handle.</p>
                  </div>
                ) : (
                  <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                    {DEFAULT_MUNICIPAL_VPAS.map((vpaObj, i) => (
                      <button
                        key={vpaObj.id}
                        onClick={() => setSelectedVpaIndex(i)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap border transition-all cursor-pointer ${
                          selectedVpaIndex === i
                            ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                            : 'bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        {vpaObj.vpa}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* High-Resolution QR Card */}
              <div className="flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/70 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-1.5 mb-2.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <p className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                    NPCI Unified BharatQR · 100% Scannable
                  </p>
                </div>

                {qrDataUrl ? (
                  <div className="relative p-2.5 bg-white rounded-2xl border-2 border-slate-900/10 shadow-md">
                    <img
                      src={qrDataUrl}
                      alt="NPCI Compliant UPI QR Code"
                      className="w-48 h-48 sm:w-52 sm:h-52 object-contain rounded-lg"
                    />
                    <div className="absolute inset-x-0 bottom-3 flex justify-center">
                      <span className="px-2 py-0.5 rounded-full bg-slate-900/90 text-white text-[9px] font-black uppercase tracking-wider shadow">
                        BHIM · GPay · PhonePe · Paytm
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="w-48 h-48 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-2xl flex items-center justify-center text-xs text-slate-400 font-bold">
                    Generating NPCI QR...
                  </div>
                )}

                <div className="flex items-center gap-2 mt-3 w-full max-w-xs justify-center">
                  <button
                    onClick={() => handleCopy(currentPayee.vpa, 'vpa')}
                    className="flex-1 py-1.5 px-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                  >
                    {copiedUpi ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedUpi ? 'VPA Copied!' : 'Copy UPI ID'}</span>
                  </button>

                  <button
                    onClick={() => handleCopy(upiUri, 'link')}
                    className="flex-1 py-1.5 px-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <ExternalLink className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? 'Link Copied!' : 'Copy UPI URL'}</span>
                  </button>
                </div>
              </div>

              {/* Direct UPI App intent button (Mobile) vs Desktop Mode (Laptop) */}
              {isMobileDevice ? (
                <button
                  type="button"
                  onClick={() => {
                    try {
                      window.location.assign(upiUri);
                    } catch (e) {
                      console.warn('Could not launch external UPI application:', e);
                    }
                  }}
                  className="flex items-center justify-center gap-2 w-full py-3 bg-primary-600 hover:bg-primary-700 active:scale-95 text-white rounded-xl font-bold text-xs transition-all shadow-md cursor-pointer text-center"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Launch UPI App on Mobile (GPay / PhonePe / Paytm)</span>
                </button>
              ) : (
                <div className="p-3 bg-slate-50 dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 text-left">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-primary-500/10 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                        💻 Laptop / Desktop Mode Active
                        <span className="px-1.5 py-0.2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] rounded-md font-mono font-bold">READY</span>
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                        Scan the BharatQR code with GPay, PhonePe, or Paytm on your mobile phone, or switch to Card / NetBanking.
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => handleCopy(upiUri, 'link')}
                      className="py-2 px-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedLink ? 'Link Copied!' : 'Copy Payment Link'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMethod('card');
                        setPaymentError(null);
                      }}
                      className="py-2 px-3 bg-primary-50 dark:bg-primary-950/40 border border-primary-500/20 hover:bg-primary-100 rounded-xl text-xs font-bold text-primary-600 dark:text-primary-400 transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 shadow-sm"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Pay via Card</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Actions row: Confirm payment or simulate scanner test */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button
                  onClick={() => handlePay()}
                  loading={processing}
                  className="w-full font-bold text-xs"
                >
                  {processing ? 'Verifying...' : '✅ I Completed Payment'}
                </Button>

                <button
                  onClick={() => {
                    playScannerBeep();
                    handlePay(`SIM-QR-${Math.floor(100000000 + Math.random() * 900000000)}`);
                  }}
                  disabled={processing}
                  className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow cursor-pointer disabled:opacity-50"
                  title="Simulate instant payment authorization from external scanner"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>⚡ Simulate Scan & Pay</span>
                </button>
              </div>
            </div>
          )}

          {/* MODE B: IN-APP CAMERA QR SCANNER */}
          {upiSubTab === 'scanner' && (
            <div className="space-y-3">
              <div className="relative bg-slate-950 rounded-3xl overflow-hidden border border-slate-800 aspect-video flex flex-col items-center justify-center shadow-inner">
                {cameraActive ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="p-4 text-center text-slate-400 space-y-2">
                    <Camera className="w-8 h-8 mx-auto text-slate-500 animate-bounce" />
                    <p className="text-xs font-bold text-slate-300">Camera Viewfinder Active</p>
                    <p className="text-[10px] text-slate-500 max-w-xs mx-auto">
                      {cameraError || 'Point camera towards the payment voucher or BharatQR code to scan.'}
                    </p>
                  </div>
                )}

                {/* Animated Targeting Reticle & Sweeping Laser Line */}
                <div className="absolute inset-8 border-2 border-emerald-500/60 rounded-2xl pointer-events-none flex flex-col justify-between p-2">
                  <div className="flex justify-between">
                    <span className="w-3 h-3 border-t-2 border-l-2 border-emerald-400"></span>
                    <span className="w-3 h-3 border-t-2 border-r-2 border-emerald-400"></span>
                  </div>
                  {/* Laser beam */}
                  <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_8px_#22d3ee] animate-pulse"></div>
                  <div className="flex justify-between">
                    <span className="w-3 h-3 border-b-2 border-l-2 border-emerald-400"></span>
                    <span className="w-3 h-3 border-b-2 border-r-2 border-emerald-400"></span>
                  </div>
                </div>

                <div className="absolute bottom-2 inset-x-0 flex justify-center">
                  <span className="px-3 py-1 rounded-full bg-slate-900/80 text-emerald-400 text-[10px] font-mono font-bold backdrop-blur-sm border border-emerald-500/30">
                    SCANNER READY · ALIGN QR WITHIN FRAME
                  </span>
                </div>
              </div>

              {/* Scanned Result Banner */}
              {scannedResult ? (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-500/30 rounded-2xl space-y-1.5 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-800 dark:text-emerald-300">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      QR Code Validated & Detected!
                    </span>
                    <span className="font-mono text-base font-black text-emerald-700 dark:text-emerald-400">
                      {formatINR(scannedResult.amount)}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-300 space-y-0.5 font-mono">
                    <p><span className="text-slate-400 font-sans">Payee:</span> {scannedResult.payeeName}</p>
                    <p><span className="text-slate-400 font-sans">VPA:</span> {scannedResult.vpa}</p>
                    <p><span className="text-slate-400 font-sans">Note:</span> {scannedResult.note}</p>
                  </div>
                  <Button
                    onClick={() => handlePay(`SCAN-AUTH-${Date.now()}`)}
                    loading={processing}
                    className="w-full mt-2 font-bold text-xs"
                  >
                    {processing ? 'Clearing Payment...' : `Confirm & Pay ${formatINR(scannedResult.amount)}`}
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    Quick Scanner Simulation (Test without physical paper):
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      onClick={() => handleSimulateScan('meter')}
                      className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-200 transition-all border border-slate-200 dark:border-slate-700 cursor-pointer"
                    >
                      ⚡ TPCODL Meter QR
                    </button>
                    <button
                      onClick={() => handleSimulateScan('water')}
                      className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-200 transition-all border border-slate-200 dark:border-slate-700 cursor-pointer"
                    >
                      ⚡ WATCO Water QR
                    </button>
                    <button
                      onClick={() => handleSimulateScan('bharatqr')}
                      className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-200 transition-all border border-slate-200 dark:border-slate-700 cursor-pointer"
                    >
                      ⚡ BMC BharatQR
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. CARD PAYMENT FLOW                                                      */}
      {/* ========================================================================= */}
      {method === 'card' && (
        <div className="space-y-4">
          <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800 space-y-3">
            {/* Interactive Card Mockup */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-950 text-white rounded-2xl p-4 font-mono shadow-md relative overflow-hidden border border-white/10">
              <div className="absolute right-4 top-4 text-xs font-black text-slate-400 italic">VISA / RuPay</div>
              <p className="text-[8px] text-slate-400">CARDNUMBER</p>
              <p className="text-sm font-bold tracking-widest mt-1">
                {cardNumber ? cardNumber.replace(/\D/g, '').replace(/(\d{4})(?=\d)/g, '$1 ') : '•••• •••• •••• ••••'}
              </p>
              <div className="flex justify-between mt-4">
                <div>
                  <p className="text-[6px] text-slate-400">CARDHOLDER</p>
                  <p className="text-[10px] uppercase font-bold truncate max-w-[120px]">{cardName || 'NAME ON CARD'}</p>
                </div>
                <div className="text-right">
                  <p className="text-[6px] text-slate-400">EXPIRES</p>
                  <p className="text-[10px] font-bold">{cardExpiry || 'MM/YY'}</p>
                </div>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 block mb-1">Card Number (16 Digits)</label>
              <input
                type="text"
                maxLength={19}
                placeholder="4111 2222 3333 4444"
                value={cardNumber ? cardNumber.replace(/\D/g, '').replace(/(\d{4})(?=\d)/g, '$1 ') : ''}
                onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, '').slice(0, 16))}
                className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-primary-500 text-slate-800 dark:text-white font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">Expiry Date</label>
                <input
                  type="text"
                  maxLength={5}
                  placeholder="MM/YY"
                  value={cardExpiry}
                  onChange={(e) => {
                    let val = e.target.value.replace(/[^\d/]/g, '').slice(0, 5);
                    if (val.length === 2 && !val.includes('/') && e.target.value.length > cardExpiry.length) {
                      val += '/';
                    }
                    setCardExpiry(val);
                  }}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-primary-500 text-slate-800 dark:text-white font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">CVV Code</label>
                <input
                  type="password"
                  maxLength={3}
                  placeholder="•••"
                  value={cardCvv}
                  onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 3))}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-primary-500 tracking-wider text-slate-800 dark:text-white font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 block mb-1">Cardholder Full Name</label>
              <input
                type="text"
                placeholder="e.g. SOUBHAGYA PRADHAN"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-primary-500 text-slate-800 dark:text-white"
              />
            </div>
          </div>

          {paymentError && (
            <div className="text-xs text-red-500 bg-red-500/10 rounded-xl px-3 py-2 flex items-center gap-1.5 border border-red-500/15">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{paymentError}</span>
            </div>
          )}

          <Button onClick={() => handlePay()} loading={processing} size="lg" className="w-full font-bold cursor-pointer">
            {processing ? 'Processing Card Auth...' : `Authorize & Pay ${formatINR(Number(bill.amount))}`}
          </Button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. NET BANKING FLOW                                                       */}
      {/* ========================================================================= */}
      {method === 'netbanking' && (
        <div className="space-y-4">
          <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800 space-y-3">
            <label className="text-xs font-bold text-slate-400 block">Select NetBanking Provider Bank</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'sbi', label: 'State Bank of India (SBI)' },
                { id: 'hdfc', label: 'HDFC Bank' },
                { id: 'icici', label: 'ICICI Bank' },
                { id: 'axis', label: 'Axis Bank' },
                { id: 'pnb', label: 'Punjab National Bank' },
                { id: 'canara', label: 'Canara Bank' },
                { id: 'bob', label: 'Bank of Baroda' },
                { id: 'odisha_gramya', label: 'Odisha Gramya Bank' },
              ].map((b) => (
                <button
                  key={b.id}
                  onClick={() => setSelectedBank(b.id)}
                  className={`p-3 rounded-xl border text-xs font-bold text-left transition-all cursor-pointer ${
                    selectedBank === b.id
                      ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                      : 'bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                  }`}
                >
                  🏦 {b.label}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={() => handlePay()} loading={processing} size="lg" className="w-full font-bold cursor-pointer">
            {processing ? 'Redirecting to Bank Portal...' : `Pay ${formatINR(Number(bill.amount))} via NetBanking`}
          </Button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. WALLET FLOW                                                            */}
      {/* ========================================================================= */}
      {method === 'wallet' && (
        <div className="space-y-4">
          <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800 space-y-3 text-center">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">SELECT LINKED MOBILE WALLET</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { name: 'Paytm Wallet', balance: '₹4,520' },
                { name: 'Amazon Pay', balance: '₹2,300' },
                { name: 'PhonePe Wallet', balance: '₹1,850' },
                { name: 'Mobikwik Wallet', balance: '₹980' }
              ].map((w) => (
                <div key={w.name} className="p-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-left">
                  <p className="font-bold text-xs text-slate-800 dark:text-white">👛 {w.name}</p>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">Avail: {w.balance}</p>
                </div>
              ))}
            </div>
          </div>

          <Button onClick={() => handlePay()} loading={processing} size="lg" className="w-full font-bold cursor-pointer">
            {processing ? 'Debiting Wallet Balance...' : `Pay ${formatINR(Number(bill.amount))} via Wallet`}
          </Button>
        </div>
      )}

      <p className="text-center text-[10px] text-slate-400">CityZen Unified Municipal Payment Gateway Protocol</p>
    </div>
  );
}
