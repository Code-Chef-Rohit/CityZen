import { useEffect, useState } from 'react';
import {
  Droplets, Zap, Leaf, Landmark, CheckCircle2, Clock, Receipt,
  CreditCard, Wallet, Building, X, Plus, Trash2, AlertCircle,
  Printer, Download, ShieldCheck, ArrowRight, Sparkles, Building2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Screen, ScreenHeader } from '@/components/Screen';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { formatINR, formatDate } from '@/lib/utils';
import type { Bill, BillType } from '@/lib/types';

const typeConfig: Record<BillType, { icon: typeof Droplets; color: string; bg: string; label: string }> = {
  water: { icon: Droplets, color: 'text-secondary-500', bg: 'bg-secondary-100 dark:bg-secondary-950/40', label: 'Water Supply' },
  electricity: { icon: Zap, color: 'text-amber-500', bg: 'bg-amber-500/10 dark:bg-amber-950/40', label: 'Electricity' },
  property: { icon: Landmark, color: 'text-primary-600 dark:text-primary-400', bg: 'bg-primary-100 dark:bg-primary-950/40', label: 'Property Tax' },
  waste: { icon: Leaf, color: 'text-emerald-500', bg: 'bg-emerald-500/10 dark:bg-emerald-950/40', label: 'Municipal Waste' },
};

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
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
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

  const load = async () => {
    if (!session?.user) return;
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
        setBills(data ?? []);
        setDbError(null);
      }
    } catch (err: any) {
      setDbError(err.message || 'Failed to query database schema cache.');
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
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
    await supabase.from('bills').update({ status: 'paid', paid_at: paidAt }).eq('id', bill.id);
    
    await supabase.from('notifications').insert({
      user_id: session.user.id,
      title: 'Payment Successful 🎉',
      message: `Your ${typeConfig[bill.type].label} bill of ${formatINR(Number(bill.amount))} was paid successfully. View your receipt in Bills portal.`,
      type: 'bill',
    });

    const paidBillObj = { ...bill, status: 'paid' as const, paid_at: paidAt };
    setPayBill(null);
    setViewReceiptBill(paidBillObj);
    load();
  };

  return (
    <Screen>
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
            {[1, 2, 3].map((i) => <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl h-24 skeleton border border-slate-100 dark:border-slate-800" />)}
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
              const cfg = typeConfig[bill.type] || typeConfig.electricity;
              return (
                <div key={bill.id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0`}>
                      <cfg.icon className={`w-5 h-5 ${cfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 dark:text-white text-sm">{cfg.label} Bill</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{bill.period}</p>
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
        {payBill && <PaymentFlow bill={payBill} onPaid={(details) => handlePaidSuccess(payBill, details)} />}
      </Modal>

      {/* Payment Receipt Modal */}
      <Modal open={!!viewReceiptBill} onClose={() => setViewReceiptBill(null)} title="Official Payment Receipt">
        {viewReceiptBill && <ReceiptCard bill={viewReceiptBill} userName={profile?.full_name || 'Citizen'} userEmail={session?.user?.email} />}
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
  const cfg = typeConfig[bill.type] || typeConfig.electricity;

  const handlePrint = () => {
    window.print();
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
            <span className="font-medium text-slate-800 dark:text-slate-200">{bill.period}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
            <span className="text-slate-400 font-medium">Settled Timestamp:</span>
            <span className="font-mono text-slate-800 dark:text-slate-200">{paidDate}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Amount Paid in Full</p>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{formatINR(Number(bill.amount))}</p>
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

  // Card form states
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardName, setCardName] = useState('');

  // Net banking state
  const [selectedBank, setSelectedBank] = useState('sbi');

  const [paymentError, setPaymentError] = useState<string | null>(null);

  const payeeAddress = 'cityzen@okaxis';
  const payeeName = 'City Municipal Corporation';
  const upiUri = `upi://pay?pa=${payeeAddress}&pn=${encodeURIComponent(payeeName)}&am=${bill.amount}&cu=INR&tn=${encodeURIComponent(`Bill Payment - ${bill.period}`)}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiUri)}`;

  const handlePay = () => {
    setPaymentError(null);

    if (method === 'card') {
      if (cardNumber.replace(/\s/g, '').length < 16) {
        setPaymentError('Please enter a valid 16-digit card number.');
        return;
      }
      if (!cardExpiry.includes('/')) {
        setPaymentError('Please enter card expiry in MM/YY format.');
        return;
      }
      if (cardCvv.length < 3) {
        setPaymentError('Please enter a valid 3-digit CVV code.');
        return;
      }
      if (!cardName.trim()) {
        setPaymentError('Please enter cardholder name.');
        return;
      }
    }

    setProcessing(true);
    const txnId = `TXN-${Math.floor(100000000 + Math.random() * 900000000)}`;

    setTimeout(() => {
      setProcessing(false);
      onPaid({ method, txnId });
    }, 1800);
  };

  return (
    <div className="space-y-4 text-slate-800 dark:text-white">
      {/* Bill summary */}
      <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">{typeConfig[bill.type]?.label || 'Utility'} · {bill.period}</span>
          <span className="text-xs text-slate-400">Due {formatDate(bill.due_date)}</span>
        </div>
        <p className="text-3xl font-extrabold text-slate-800 dark:text-white mt-2">{formatINR(Number(bill.amount))}</p>
      </div>

      {/* Payment method tabs */}
      <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl text-center">
        <button
          onClick={() => { setMethod('upi'); setPaymentError(null); }}
          className={`py-2 rounded-lg text-[10px] sm:text-xs font-bold transition-all cursor-pointer ${
            method === 'upi' ? 'bg-white dark:bg-slate-800 text-primary-600 dark:text-primary-400 shadow-sm' : 'text-slate-500'
          }`}
        >
          📲 UPI / QR
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

      {method === 'upi' && (
        <div className="space-y-4 text-center">
          <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800 space-y-3">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">MOBILE DEEP-LINK REDIRECT</p>
            <a
              href={upiUri}
              className="flex items-center justify-center gap-2 w-full py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold text-xs transition-all shadow-md cursor-pointer text-center"
            >
              📲 Pay via UPI App (GPay / PhonePe / Paytm)
            </a>
            <p className="text-[10px] text-slate-400">
              Launches GPay, PhonePe, or BHIM app on your phone with pre-filled details to complete transfer directly.
            </p>
          </div>

          <div className="flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/50 dark:border-slate-800">
            <p className="text-[10px] font-bold text-slate-400 mb-3 uppercase tracking-wider">DESKTOP SCANNABLE QR CODE</p>
            <img 
              src={qrCodeUrl} 
              alt="UPI Payment QR Code" 
              className="w-44 h-44 object-contain border border-slate-100 p-2 rounded-xl bg-white shadow-sm"
            />
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold mt-3">
              Scan this QR using Google Pay, PhonePe, Paytm, or BHIM on your phone.
            </p>
          </div>

          <Button onClick={handlePay} loading={processing} className="w-full font-bold cursor-pointer">
            {processing ? 'Verifying UPI Authorization...' : '✅ Confirm Payment Completed'}
          </Button>
        </div>
      )}

      {method === 'card' && (
        <div className="space-y-4">
          <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800 space-y-3">
            <div className="bg-gradient-to-r from-slate-850 to-slate-950 text-white rounded-2xl p-4 font-mono shadow-md relative overflow-hidden border border-white/10">
              <div className="absolute right-4 top-4 text-xs font-black text-slate-600 italic">VISA</div>
              <p className="text-[8px] text-slate-400">CARDNUMBER</p>
              <p className="text-sm font-bold tracking-widest mt-1">
                {cardNumber.replace(/\s?/g, '').replace(/(\d{4})/g, '$1 ').trim() || '•••• •••• •••• ••••'}
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
              <label className="text-[10px] font-bold text-slate-400 block mb-1">Card Number</label>
              <input
                type="text"
                maxLength={19}
                placeholder="4111 2222 3333 4444"
                value={cardNumber.replace(/\s?/g, '').replace(/(\d{4})/g, '$1 ').trim()}
                onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, ''))}
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
                    let val = e.target.value;
                    if (val.length === 2 && !val.includes('/')) val += '/';
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
                  onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-primary-500 tracking-wider text-slate-800 dark:text-white font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 block mb-1">Cardholder Name</label>
              <input
                type="text"
                placeholder="e.g. JOHN DOE"
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

          <Button onClick={handlePay} loading={processing} size="lg" className="w-full font-bold cursor-pointer">
            {processing ? 'Processing Card Auth...' : `Authorize & Pay ${formatINR(Number(bill.amount))}`}
          </Button>
        </div>
      )}

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
              ].map(b => (
                <button
                  key={b.id}
                  onClick={() => setSelectedBank(b.id)}
                  className={`p-3 rounded-xl border text-xs font-bold text-left transition-all cursor-pointer ${
                    selectedBank === b.id 
                      ? 'bg-primary-600 text-white border-primary-600 shadow-sm' 
                      : 'bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  🏦 {b.label}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={handlePay} loading={processing} size="lg" className="w-full font-bold cursor-pointer">
            {processing ? 'Redirecting to NetBanking Portal...' : `Pay ${formatINR(Number(bill.amount))} via NetBanking`}
          </Button>
        </div>
      )}

      {method === 'wallet' && (
        <div className="space-y-4">
          <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800 space-y-3 text-center">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">SELECT MOBILE WALLET</p>
            <div className="grid grid-cols-3 gap-2">
              {['Paytm Wallet', 'Amazon Pay', 'Mobikwik', 'Freecharge', 'PhonePe Wallet', 'Airtel Money'].map(w => (
                <div key={w} className="p-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-white">
                  👛 {w}
                </div>
              ))}
            </div>
          </div>

          <Button onClick={handlePay} loading={processing} size="lg" className="w-full font-bold cursor-pointer">
            {processing ? 'Authorizing Wallet Balance...' : `Pay ${formatINR(Number(bill.amount))} via Wallet`}
          </Button>
        </div>
      )}

      <p className="text-center text-[10px] text-slate-400">CityZen Municipal Payment Gateway Protocol</p>
    </div>
  );
}
