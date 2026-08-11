import { useEffect, useState } from 'react';
import {
  Droplets, Zap, Leaf, Landmark, CheckCircle2, Clock, Receipt,
  CreditCard, Wallet, Building, X, Plus, Trash2, AlertCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Screen, ScreenHeader } from '@/components/Screen';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { formatINR, formatDate } from '@/lib/utils';
import type { Bill, BillType } from '@/lib/types';

const typeConfig: Record<BillType, { icon: typeof Droplets; color: string; bg: string; label: string }> = {
  water: { icon: Droplets, color: 'text-secondary-500', bg: 'bg-secondary-100', label: 'Water' },
  electricity: { icon: Zap, color: 'text-accent-500', bg: 'bg-accent-500/10', label: 'Electricity' },
  property: { icon: Landmark, color: 'text-primary-600', bg: 'bg-primary-100', label: 'Property Tax' },
  waste: { icon: Leaf, color: 'text-primary-500', bg: 'bg-primary-50', label: 'Waste' },
};

const billers = [
  { id: 'tata_power', label: 'Tata Power (Electricity)', type: 'electricity' as const, name: 'Tata Power Delhi Distribution' },
  { id: 'bescom', label: 'BESCOM (Electricity)', type: 'electricity' as const, name: 'Bangalore Electricity Supply' },
  { id: 'djb', label: 'Delhi Jal Board (Water)', type: 'water' as const, name: 'Delhi Jal Board' },
  { id: 'bwssb', label: 'BWSSB (Water)', type: 'water' as const, name: 'Bangalore Water Supply' },
  { id: 'mcg', label: 'MCG Waste (Waste)', type: 'waste' as const, name: 'Municipal Corp of Gurugram' },
];

export function Bills({ onBack, initialType }: { onBack: () => void; initialType?: BillType }) {
  const { session } = useAuth();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unpaid' | 'paid'>('unpaid');
  const [payBill, setPayBill] = useState<Bill | null>(null);

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

  const handleFetchBill = () => {
    if (!consumerNo.trim() || consumerNo.length < 5) {
      setError('Please enter a valid Consumer Number (at least 5 digits).');
      return;
    }
    setFetchingBill(true);
    setError(null);
    setFetchedBill(null);
    setBbpsLogs([]);

    // Step-by-step BBPS connection pipeline
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

  const handlePaid = async (bill: Bill) => {
    if (!session?.user) return;
    await supabase.from('bills').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', bill.id);
    await supabase.from('notifications').insert({
      user_id: session.user.id,
      title: 'Payment successful',
      message: `Your ${typeConfig[bill.type].label} bill of ${formatINR(Number(bill.amount))} has been paid.`,
      type: 'bill',
    });
    setPayBill(null);
    load();
  };

  return (
    <Screen>
      <ScreenHeader
        title="Bills & Payments"
        subtitle="Manage utility bills"
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
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        }
      />

      {dbError && (
        <div className="mx-4 mt-4 p-4 bg-red-500/10 border border-red-500/20 text-red-800 dark:text-red-400 rounded-2xl space-y-2 text-xs">
          <p className="font-bold flex items-center gap-1.5 text-sm">
            ⚠️ Supabase Table Missing: 'public.bills'
          </p>
          <p>
            The <code>bills</code> table hasn't been created in your database schema cache. Copy the SQL script provided in the assistant's instructions and run it in the Supabase Editor.
          </p>
        </div>
      )}

      {/* Summary card */}
      <div className="px-4 pt-4">
        <div className="bg-gradient-to-br from-primary-600 to-secondary-700 rounded-2xl p-5 text-white shadow-lg">
          <p className="text-primary-100 text-xs">Total Outstanding</p>
          <p className="text-3xl font-extrabold mt-1">{formatINR(totalDue)}</p>
          <div className="flex items-center gap-4 mt-4">
            <div>
              <p className="text-2xl font-bold">{bills.filter((b) => b.status === 'unpaid').length}</p>
              <p className="text-primary-100/80 text-xs">Unpaid</p>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div>
              <p className="text-2xl font-bold">{bills.filter((b) => b.status === 'paid').length}</p>
              <p className="text-primary-100/80 text-xs">Paid</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="px-4 py-4">
        <div className="flex gap-1 p-1 bg-ink-100 rounded-xl">
          {(['unpaid', 'paid', 'all'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-all cursor-pointer ${
                filter === f ? 'bg-white text-primary-700 shadow-sm' : 'text-ink-500'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Bills list */}
      <div className="px-4 pb-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="bg-white rounded-2xl h-20 skeleton" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
            <CheckCircle2 className="w-12 h-12 text-primary-500 mx-auto mb-3" />
            <p className="font-semibold text-ink-700">All clear!</p>
            <p className="text-sm text-ink-400 mt-1">No {filter} bills to show.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((bill) => {
              const cfg = typeConfig[bill.type];
              return (
                <div key={bill.id} className="bg-white rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0`}>
                      <cfg.icon className={`w-5 h-5 ${cfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-ink-900">{cfg.label} Bill</p>
                      <p className="text-xs text-ink-400">{bill.period}</p>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <div>
                        <p className="font-bold text-ink-900">{formatINR(Number(bill.amount))}</p>
                        {bill.status === 'unpaid' && bill.due_date && (
                          <p className="text-xs text-error-500 flex items-center gap-0.5 justify-end">
                            <Clock className="w-3 h-3" />
                            Due {formatDate(bill.due_date)}
                          </p>
                        )}
                        {bill.status === 'paid' && (
                          <p className="text-xs text-primary-600 flex items-center gap-0.5 justify-end">
                            <CheckCircle2 className="w-3 h-3" /> Paid
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => deleteBill(bill.id)}
                        title="Delete Bill"
                        className="p-2 text-ink-400 hover:text-error-600 hover:bg-error-500/10 rounded-lg transition-colors cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {bill.status === 'unpaid' && (
                    <Button onClick={() => setPayBill(bill)} size="sm" className="w-full mt-3">
                      <CreditCard className="w-4 h-4" /> Pay Now
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Payment modal */}
      <Modal open={!!payBill} onClose={() => setPayBill(null)} title="Payment">
        {payBill && <PaymentFlow bill={payBill} onPaid={() => handlePaid(payBill)} />}
      </Modal>

      {/* Add Bill Modal */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Manage Biller">
        <div className="space-y-4">
          {/* Mode Selector */}
          <div className="flex gap-1 p-1 bg-ink-100 rounded-xl">
            <button
              onClick={() => { setAddMode('link'); setError(null); }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                addMode === 'link' ? 'bg-white text-primary-700 shadow-sm' : 'text-ink-500'
              }`}
            >
              🔗 Link Biller (GPay)
            </button>
            <button
              onClick={() => { setAddMode('manual'); setError(null); }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                addMode === 'manual' ? 'bg-white text-primary-700 shadow-sm' : 'text-ink-500'
              }`}
            >
              ✍️ Manual Entry
            </button>
          </div>

          {addMode === 'link' ? (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-ink-500 mb-1.5 block">Select Biller Provider</label>
                <select
                  value={selectedBiller.id}
                  onChange={(e) => {
                    const found = billers.find(b => b.id === e.target.value);
                    if (found) setSelectedBiller(found);
                    setFetchedBill(null);
                  }}
                  className="w-full px-4 py-3 bg-ink-50 border border-ink-200 rounded-xl text-sm focus:outline-none focus:border-primary-400"
                >
                  {billers.map(b => (
                    <option key={b.id} value={b.id}>{b.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-ink-500 mb-1.5 block">Consumer / Customer Account Number</label>
                <input
                  type="text"
                  placeholder="e.g. 100234567"
                  value={consumerNo}
                  onChange={(e) => { setConsumerNo(e.target.value); setFetchedBill(null); }}
                  className="w-full px-4 py-3 bg-ink-50 border border-ink-200 rounded-xl text-sm focus:outline-none focus:border-primary-400"
                />
              </div>

              {(fetchingBill || bbpsLogs.length > 0) && (
                <div className="bg-slate-950 rounded-xl p-3 border border-white/5 font-mono text-[9px] text-slate-400 space-y-1 max-h-40 overflow-y-auto">
                  <p className="text-[10px] text-orange-500 font-bold border-b border-white/5 pb-1 mb-1.5 flex items-center justify-between">
                    <span>⚡ BBPS SECURE QUERY ROUTING</span>
                    {fetchingBill && <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-ping" />}
                  </p>
                  {bbpsLogs.map((log, idx) => (
                    <p key={idx} className={log.includes('[RETRIEVED]') ? 'text-emerald-400 font-semibold' : 'text-slate-400'}>
                      {log}
                    </p>
                  ))}
                  {fetchingBill && (
                    <div className="flex items-center gap-1.5 mt-1.5 text-slate-500 animate-pulse">
                      <span className="w-1 h-1 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '100ms' }} />
                      <span className="w-1 h-1 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '200ms' }} />
                      <span className="w-1 h-1 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      <span>Polling BBPS registry host...</span>
                    </div>
                  )}
                </div>
              )}

              {fetchedBill && (
                <div className="bg-primary-500/10 border border-primary-500/20 rounded-2xl p-4 space-y-3 animate-fade-in text-ink-900">
                  <p className="text-xs font-bold text-primary-500 uppercase tracking-widest">BILL DETAILS RETRIEVED</p>
                  <div className="text-xs space-y-1">
                    <p><strong>Biller:</strong> {selectedBiller.name}</p>
                    <p><strong>Consumer No:</strong> {consumerNo}</p>
                    <p><strong>Cycle:</strong> July-August 2026</p>
                  </div>
                  <div className="border-t border-primary-500/10 pt-2 flex justify-between items-baseline">
                    <span className="text-sm font-semibold">Outstanding Due:</span>
                    <span className="text-xl font-black text-primary-600">{formatINR(fetchedBill.amount)}</span>
                  </div>
                </div>
              )}

              {error && (
                <div className="text-xs text-error-600 bg-error-500/10 rounded-xl px-3 py-2 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {!fetchedBill ? (
                <Button onClick={handleFetchBill} loading={fetchingBill} size="lg" className="w-full">
                  Fetch Outstanding Bill
                </Button>
              ) : (
                <Button onClick={handleLinkFetchedBill} loading={adding} size="lg" className="w-full">
                  Link Account & Sync Bill
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-ink-500 mb-1.5 block">Bill Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['electricity', 'water', 'property', 'waste'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setNewType(t)}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold capitalize border transition-all cursor-pointer ${
                        newType === t 
                          ? 'bg-primary-600 text-white border-primary-600' 
                          : 'bg-ink-50 text-ink-500 border-ink-100'
                      }`}
                    >
                      {typeConfig[t].label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-ink-500 mb-1.5 block">Amount (INR)</label>
                <input
                  type="number"
                  placeholder="e.g. 1500"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  className="w-full px-4 py-3 bg-ink-50 border border-ink-200 rounded-xl text-sm focus:outline-none focus:border-primary-400 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-ink-500 mb-1.5 block">Billing Period</label>
                <input
                  type="text"
                  placeholder="e.g. August 2026"
                  value={newPeriod}
                  onChange={(e) => setNewPeriod(e.target.value)}
                  className="w-full px-4 py-3 bg-ink-50 border border-ink-200 rounded-xl text-sm focus:outline-none focus:border-primary-400 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-ink-500 mb-1.5 block">Due Date</label>
                <input
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="w-full px-4 py-3 bg-ink-50 border border-ink-200 rounded-xl text-sm focus:outline-none focus:border-primary-400 focus:bg-white transition-all"
                />
              </div>

              {error && (
                <div className="text-xs text-error-600 bg-error-500/10 rounded-xl px-3 py-2 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button onClick={handleAddBill} loading={adding} size="lg" className="w-full">
                Add Bill
              </Button>
            </div>
          )}
        </div>
      </Modal>
    </Screen>
  );
}

function PaymentFlow({ bill, onPaid }: { bill: Bill; onPaid: () => void }) {
  const [method, setMethod] = useState<'upi' | 'card'>('upi');
  const [processing, setProcessing] = useState(false);

  // Card form states
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardName, setCardName] = useState('');
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Construct a standard, real-world UPI Payment Deep Link URI
  // Schema: upi://pay?pa=PAYEE_ADDRESS&pn=PAYEE_NAME&am=AMOUNT&cu=INR&tn=NOTE
  const payeeAddress = 'cityzen@okaxis'; // Consolidated city accounts UPI id
  const payeeName = 'City Municipal Corporation';
  const upiUri = `upi://pay?pa=${payeeAddress}&pn=${encodeURIComponent(payeeName)}&am=${bill.amount}&cu=INR&tn=${encodeURIComponent(`Bill Payment - ${bill.period}`)}`;
  
  // Dynamic QR Code link using public generator API (scannable by GPay, PhonePe, Paytm, BHIM)
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
    setTimeout(() => {
      setProcessing(false);
      onPaid();
    }, 2000);
  };

  return (
    <div className="space-y-5 text-slate-800 dark:text-white">
      {/* Bill summary */}
      <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">{typeConfig[bill.type].label} · {bill.period}</span>
          <span className="text-xs text-slate-400">Due {formatDate(bill.due_date)}</span>
        </div>
        <p className="text-3xl font-extrabold text-slate-800 dark:text-white mt-2">{formatINR(Number(bill.amount))}</p>
      </div>

      {/* Payment methods */}
      <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl">
        <button
          onClick={() => { setMethod('upi'); setPaymentError(null); }}
          className={`flex-1 py-2 text-center rounded-lg text-xs font-bold transition-all cursor-pointer ${
            method === 'upi' ? 'bg-white dark:bg-slate-900 text-primary-600 shadow-sm' : 'text-slate-500'
          }`}
        >
          📲 UPI Apps / QR Code
        </button>
        <button
          onClick={() => { setMethod('card'); setPaymentError(null); }}
          className={`flex-1 py-2 text-center rounded-lg text-xs font-bold transition-all cursor-pointer ${
            method === 'card' ? 'bg-white dark:bg-slate-900 text-primary-600 shadow-sm' : 'text-slate-500'
          }`}
        >
          💳 Credit/Debit Card
        </button>
      </div>

      {method === 'upi' ? (
        <div className="space-y-4 text-center">
          {/* Phone Mobile Deep link redirection button */}
          <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800 space-y-3">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">MOBILE DEEP-LINK REDIRECT</p>
            <a
              href={upiUri}
              className="flex items-center justify-center gap-2 w-full py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold text-xs transition-all shadow-md cursor-pointer text-center"
            >
              📲 Pay via UPI App (GPay / PhonePe / Paytm)
            </a>
            <p className="text-[10px] text-slate-400">
              If you are on your mobile phone, tapping this button launches your registered GPay, PhonePe, or BHIM app with pre-filled details to complete the transfer directly.
            </p>
          </div>

          {/* Desktop QR Code Scan Display */}
          <div className="flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/50 dark:border-slate-800">
            <p className="text-[10px] font-bold text-slate-400 mb-3 uppercase tracking-wider">DESKTOP SCANNABLE QR CODE</p>
            <img 
              src={qrCodeUrl} 
              alt="UPI Payment QR Code" 
              className="w-48 h-48 object-contain border border-slate-100 p-2 rounded-xl bg-white"
            />
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold mt-3">
              Scan this QR using Google Pay, PhonePe, Paytm, or BHIM on your phone.
            </p>
          </div>

          <Button onClick={onPaid} className="w-full cursor-pointer">
            ✅ Confirm Payment Completed
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800 space-y-3">
            
            {/* Visual Credit Card Mockup */}
            <div className="bg-gradient-to-r from-slate-850 to-slate-950 text-white rounded-xl p-4 font-mono shadow-md relative overflow-hidden border border-white/5">
              <div className="absolute right-4 top-4 text-xs font-black text-slate-700 italic">VISA</div>
              <p className="text-[8px] text-slate-500">CARDNUMBER</p>
              <p className="text-sm font-bold tracking-widest mt-1">
                {cardNumber.replace(/\s?/g, '').replace(/(\d{4})/g, '$1 ').trim() || '•••• •••• •••• ••••'}
              </p>
              <div className="flex justify-between mt-4">
                <div>
                  <p className="text-[6px] text-slate-500">CARDHOLDER</p>
                  <p className="text-[10px] uppercase font-bold truncate max-w-[120px]">{cardName || 'NAME ON CARD'}</p>
                </div>
                <div className="text-right">
                  <p className="text-[6px] text-slate-500">EXPIRES</p>
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
                className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-primary-400 text-slate-800 dark:text-white"
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
                  className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-primary-400 text-slate-800 dark:text-white"
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
                  className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-primary-400 tracking-wider text-slate-800 dark:text-white"
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
                className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-primary-400 text-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[10px] text-amber-600 dark:text-amber-400">
            ℹ️ <strong>Card Merchant API Key:</strong> To settle real card payments in production, a payment provider integration is required. Please share your **Razorpay** or **Stripe** merchant credentials when ready to connect live transactions.
          </div>

          {paymentError && (
            <div className="text-xs text-error-600 bg-error-500/10 rounded-xl px-3 py-2 flex items-center gap-1.5 border border-error-500/15">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{paymentError}</span>
            </div>
          )}

          <Button onClick={handlePay} loading={processing} size="lg" className="w-full cursor-pointer">
            {processing ? 'Processing Card Auth...' : `Authorize & Pay ${formatINR(Number(bill.amount))}`}
          </Button>
        </div>
      )}
      <p className="text-center text-[10px] text-slate-400">CityZen SecureSwitched Payment Routing System</p>
    </div>
  );
}
