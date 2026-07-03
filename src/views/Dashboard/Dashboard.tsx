import { useState, useMemo, useEffect, useRef } from 'react';
// 🛡️ Enforce explicit type-only imports to satisfy verbatimModuleSyntax standards
import type { Transaction, IncomeType, PaymentMethod } from '../../types/ledger';
import {
  DollarSign,
  Plus,
  LogOut,
  Wallet,
  Percent,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
} from 'lucide-react';

interface DashboardProps {
  setAuth: (val: boolean) => void;
}

const INCOME_TAG_STYLES: Record<IncomeType, string> = {
  appointment: 'bg-[#3F6B62]/15 text-[#2F544A] border-[#3F6B62]/40',
  'walk-in': 'bg-[#C39A48]/15 text-[#8A6A2F] border-[#C39A48]/40',
  deposit: 'bg-[#16130F]/10 text-[#16130F]/70 border-[#16130F]/20',
  tip: 'bg-[#A83A2C]/10 text-[#A83A2C] border-[#A83A2C]/30',
};

export default function Dashboard({ setAuth }: DashboardProps) {
  // Dynamic API routing boundary: automatically falls back to local simulator if running in dev mode
  const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8787/api/transactions'
    : 'https://inktrack-api.lapgonzalez96.workers.dev/api/transactions';

  // 💾 CORE LEDGER STATE LAYER
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // UI State Managers
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Transaction Input Buffer states
  const [grossAmount, setGrossAmount] = useState('');
  const [incomeType, setIncomeType] = useState<IncomeType>('appointment');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [clientName, setClientName] = useState('');
  const [shopCut, setShopCut] = useState('40');
  const [description, setDescription] = useState('');

  // 🔐 Auth-aware fetch wrapper. Attaches the session token and forces a
  // logout if the API reports the token is missing/expired, instead of
  // silently failing and masking it behind the local cache fallback.
  const authFetch = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('inktrack_token');
    const response = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (response.status === 401) {
      localStorage.removeItem('inktrack_token');
      setAuth(false);
    }
    return response;
  };

  // 🔄 ASYNC INITIALIZATION LINK: Read database records on boot
  const fetchLedger = async () => {
    setIsLoading(true);
    try {
      const response = await authFetch(API_URL);
      if (!response.ok) throw new Error('Data sync exception');

      // 🛡️ Resolve 'unknown' assignment by explicitly asserting the data shape array structure
      const data = (await response.json()) as Transaction[];

      setTransactions(data);
      // Synchronize backing store for local offline redundancy
      localStorage.setItem('inktrack_ledger', JSON.stringify(data));
    } catch (err) {
      triggerStatus('error', 'Edge sync failed. Booting from local device memory cache.');
      // Local fallback matrix reading straight from cache
      const saved = localStorage.getItem('inktrack_ledger');
      if (saved) {
        try {
          setTransactions(JSON.parse(saved) as Transaction[]);
        } catch (parseErr) {
          console.error("Cache corrupted, skipping parsing logic.", parseErr);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLedger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 🧮 Time-Interval Calculation Matrix Engine
  const metrics = useMemo(() => {
    const now = new Date();
    let hr = 0, day = 0, wk = 0, biWk = 0, mo = 0, triMo = 0, yr = 0;

    transactions.forEach(t => {
      const tDate = new Date(t.timestamp);
      const diffMs = now.getTime() - tDate.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      const diffDays = diffHours / 24;

      const val = t.netAmount;

      if (diffHours <= 1) hr += val;
      if (diffDays <= 1) day += val;
      if (diffDays <= 7) wk += val;
      if (diffDays <= 14) biWk += val;
      if (diffDays <= 30) mo += val;
      if (diffDays <= 90) triMo += val;
      if (diffDays <= 365) yr += val;
    });

    return { hr, day, wk, biWk, mo, triMo, yr };
  }, [transactions]);

  // Form Submission
  const handleLogIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const gross = parseFloat(grossAmount);
    if (isNaN(gross) || gross <= 0) return;

    const cutPercent = parseFloat(shopCut) || 0;
    const net = gross * (1 - cutPercent / 100);

    const newTx: Transaction = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      clientName: clientName || 'Anonymous Client',
      description: description || '',
      incomeType,
      paymentMethod,
      grossAmount: gross,
      shopCutPercentage: cutPercent,
      netAmount: net,
    };

    setIsSubmitting(true);

    // 🛡️ OPTIMISTIC UI COMMIT PROTOCOL: Update state instantly for sleek viewport experience
    const baselineBackup = [...transactions];
    setTransactions([newTx, ...transactions]);
    setIsModalOpen(false);

    // Clear field buffers immediately
    setGrossAmount('');
    setClientName('');
    setDescription('');

    try {
      const response = await authFetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTx),
      });

      if (!response.ok) throw new Error('D1 Runtime write failure');

      // Update redundant local storage state tracking
      localStorage.setItem('inktrack_ledger', JSON.stringify([newTx, ...baselineBackup]));
      triggerStatus('success', 'Session stamped into the ledger.');
    } catch (err) {
      // Rollback UI layout instantly on transaction write exception to preserve structural data integrity
      setTransactions(baselineBackup);
      triggerStatus('error', 'Write failed — entry rolled back. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper notice trigger
  const triggerStatus = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // 💾 EXPORT LEDGER UTILITY (JSON Backup)
  const handleExportData = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(transactions, null, 2));
      const downloadAnchor = document.createElement('a');
      const dateStamp = new Date().toISOString().split('T')[0];

      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `inktrack_ledger_${dateStamp}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      triggerStatus('success', 'Ledger backup exported.');
    } catch (err) {
      triggerStatus('error', 'Export ran into an error.');
    }
  };

  // 💾 UPLOAD/IMPORT LEDGER UTILITY
  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          const validatedData = parsed as Transaction[];
          setTransactions(validatedData);
          localStorage.setItem('inktrack_ledger', JSON.stringify(validatedData));
          triggerStatus('success', `Import verified: loaded ${validatedData.length} entries.`);
        } else {
          triggerStatus('error', 'File format mismatch — expected an array.');
        }
      } catch (err) {
        triggerStatus('error', 'Could not read file. Check the JSON syntax.');
      }
    };
    reader.readAsText(file);
  };

  const handleLogout = () => {
    localStorage.removeItem('inktrack_token');
    setAuth(false);
  };

  const money = (n: number) => n.toFixed(2);

  return (
    <div className="bg-[#16130F] text-[#EFE7D8] min-h-screen font-[Inter,sans-serif] selection:bg-[#A83A2C] selection:text-[#EFE7D8]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rye&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        .font-display { font-family: 'Rye', serif; }
        .font-mono-ledger { font-family: 'IBM Plex Mono', monospace; }
        .font-body { font-family: 'IBM Plex Sans', sans-serif; }
      `}</style>

      <div className="font-body">
        {/* Flash notification */}
        {statusMessage && (
          <div
            role="status"
            className={`fixed top-6 right-6 z-50 flex items-center gap-2 border px-4 py-3 rounded-md shadow-xl transition-all ${
              statusMessage.type === 'success'
                ? 'bg-[#EFE7D8] border-[#3F6B62]/40 text-[#2F544A]'
                : 'bg-[#EFE7D8] border-[#A83A2C]/40 text-[#A83A2C]'
            }`}
          >
            {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span className="font-mono-ledger text-xs font-semibold">{statusMessage.text}</span>
          </div>
        )}

        {/* Nav */}
        <nav className="border-b border-[#EFE7D8]/10 bg-[#16130F]/95 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full border-2 border-[#C39A48] bg-[#A83A2C] flex items-center justify-center font-display text-base">
              i
            </div>
            <span className="font-display text-lg tracking-wide">
              inktrack<span className="text-[#C39A48]">.</span>
              <span className="font-mono-ledger text-[11px] text-[#EFE7D8]/50 tracking-widest align-middle ml-1 uppercase">
                Console
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchLedger}
              title="Refresh ledger from database"
              className="text-[#EFE7D8]/50 hover:text-[#C39A48] p-2.5 transition-colors rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C39A48]"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#C39A48]' : ''}`} />
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-[#A83A2C] hover:bg-[#c04430] text-[#EFE7D8] font-bold px-4 py-2.5 rounded-md text-sm flex items-center gap-2 transition-colors shadow-md active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C39A48]"
            >
              <Plus className="w-4 h-4 stroke-[3]" /> Log Session
            </button>
            <button
              onClick={handleLogout}
              title="Sign out"
              className="text-[#EFE7D8]/50 hover:text-[#A83A2C] p-2.5 transition-colors rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C39A48]"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto px-6 py-10 space-y-10">

          {/* Metric ticket strip */}
          <section>
            <h2 className="font-mono-ledger text-[11px] font-semibold uppercase tracking-[0.15em] text-[#C39A48] mb-4">
              Earnings Rollup — Take-Home Net
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {[
                { label: 'Hour', val: metrics.hr },
                { label: 'Today', val: metrics.day, highlight: true },
                { label: 'Week', val: metrics.wk },
                { label: 'Bi-Weekly', val: metrics.biWk },
                { label: 'Month', val: metrics.mo },
                { label: '3 Months', val: metrics.triMo },
                { label: 'Yearly Est.', val: metrics.yr },
              ].map((card, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-sm border ${
                    card.highlight
                      ? 'bg-[#EFE7D8] border-[#A83A2C] shadow-lg'
                      : 'bg-[#EFE7D8]/95 border-[#EFE7D8]/20'
                  }`}
                >
                  <span className="font-mono-ledger text-[10px] uppercase tracking-wide text-[#16130F]/50 block mb-1">
                    {card.label}
                  </span>
                  <span
                    className={`font-mono-ledger text-lg font-bold tracking-tight ${
                      card.highlight ? 'text-[#A83A2C]' : 'text-[#16130F]'
                    }`}
                  >
                    ${money(card.val)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* Session feed */}
            <div className="lg:col-span-2 space-y-4">
              <h3 className="font-mono-ledger text-[11px] font-semibold uppercase tracking-[0.15em] text-[#C39A48]">
                Session Feed
              </h3>
              <div className="bg-[#EFE7D8] text-[#16130F] rounded-sm overflow-hidden shadow-lg">
                {isLoading ? (
                  <div className="p-12 text-center text-[#16130F]/50 text-sm flex flex-col items-center justify-center gap-3">
                    <RefreshCw className="w-5 h-5 animate-spin text-[#A83A2C]" />
                    <span className="font-mono-ledger text-xs">Syncing ledger…</span>
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="p-10 text-center text-[#16130F]/50 text-sm">
                    No sessions logged yet. Tap{' '}
                    <span className="font-semibold text-[#A83A2C]">Log Session</span> to start
                    your ledger.
                  </div>
                ) : (
                  <div className="divide-y divide-dashed divide-[#16130F]/15">
                    {transactions.map((t) => (
                      <div
                        key={t.id}
                        className="p-5 flex items-center justify-between hover:bg-[#16130F]/[0.03] transition-colors"
                      >
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm">{t.clientName}</span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full border font-mono-ledger font-semibold uppercase tracking-wide ${INCOME_TAG_STYLES[t.incomeType]}`}
                            >
                              {t.incomeType}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs text-[#16130F]/55 truncate max-w-[220px]">
                              {t.description || 'No job context provided'}
                            </p>
                            <span className="text-[10px] bg-[#16130F] text-[#EFE7D8] px-2 py-0.5 rounded font-mono-ledger font-semibold uppercase tracking-wide">
                              {t.paymentMethod === 'ath-movil' ? 'ATH Móvil' : t.paymentMethod}
                            </span>
                          </div>

                          <p className="text-[10px] text-[#16130F]/40 font-mono-ledger">
                            {new Date(t.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                        <div className="text-right shrink-0 pl-4">
                          <span className="font-mono-ledger text-sm font-bold text-[#2F544A] block">
                            +${money(t.netAmount)}
                          </span>
                          {t.shopCutPercentage > 0 && (
                            <span className="text-[10px] text-[#16130F]/40 block font-mono-ledger">
                              Gross ${t.grossAmount} (&minus;{t.shopCutPercentage}%)
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <div>
                <h3 className="font-mono-ledger text-[11px] font-semibold uppercase tracking-[0.15em] text-[#C39A48] mb-3">
                  Shop Efficiency
                </h3>
                <div className="bg-[#EFE7D8] text-[#16130F] p-6 rounded-sm shadow-lg space-y-4">
                  <div className="flex justify-between items-center text-xs border-b border-dashed border-[#16130F]/15 pb-3">
                    <span className="text-[#16130F]/60 flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5" /> Total gross generated
                    </span>
                    <span className="font-mono-ledger font-bold">
                      ${money(transactions.reduce((acc, t) => acc + t.grossAmount, 0))}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[#16130F]/60 flex items-center gap-1.5">
                      <Percent className="w-3.5 h-3.5" /> Total paid to shop split
                    </span>
                    <span className="font-mono-ledger font-bold text-[#A83A2C]">
                      ${money(transactions.reduce((acc, t) => acc + (t.grossAmount - t.netAmount), 0))}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-mono-ledger text-[11px] font-semibold uppercase tracking-[0.15em] text-[#C39A48] mb-3">
                  Data Operations
                </h3>
                <div className="bg-[#EFE7D8] text-[#16130F] p-5 rounded-sm shadow-lg space-y-3">
                  <p className="text-xs text-[#16130F]/60 leading-relaxed">
                    Export a backup of your ledger, or restore from a previous backup file.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={handleExportData}
                      className="flex items-center justify-center gap-2 border border-[#16130F]/15 hover:border-[#16130F]/30 text-[#16130F] font-semibold py-2.5 rounded-sm text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#A83A2C]"
                    >
                      <Download className="w-3.5 h-3.5 text-[#2F544A]" /> Export
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center justify-center gap-2 border border-[#16130F]/15 hover:border-[#16130F]/30 text-[#16130F] font-semibold py-2.5 rounded-sm text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#A83A2C]"
                    >
                      <Upload className="w-3.5 h-3.5 text-[#2F544A]" /> Import
                    </button>
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImportData}
                    accept=".json"
                    className="hidden"
                  />
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Log session modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-[#16130F]/85 backdrop-blur-sm flex justify-center items-end sm:items-center p-4">
            <div className="bg-[#EFE7D8] text-[#16130F] w-full max-w-lg rounded-t-sm sm:rounded-sm p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center border-b border-dashed border-[#16130F]/15 pb-4">
                <div>
                  <p className="font-mono-ledger text-[10px] uppercase tracking-[0.2em] text-[#16130F]/40 mb-1">
                    New Entry
                  </p>
                  <h3 className="font-display text-2xl">Session Ticket</h3>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-[#16130F]/40 hover:text-[#16130F] p-1 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#A83A2C]"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleLogIncome} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-mono-ledger font-semibold text-[#16130F]/50 uppercase tracking-wider mb-2">
                    Gross Amount Collected
                  </label>

                  <div className="relative">
                    <DollarSign className="pointer-events-none absolute left-4 top-3.5 h-5 w-5 text-[#A83A2C]" />

                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      required
                      autoFocus
                      value={grossAmount}
                      onChange={(e) => setGrossAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-white border border-[#16130F]/15 rounded-sm py-3.5 pl-12 pr-4 text-lg font-mono-ledger font-bold text-[#16130F] focus:outline-none focus:border-[#A83A2C]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-mono-ledger font-semibold text-[#16130F]/50 uppercase tracking-wider mb-2">
                      Category
                    </label>
                    <select
                      value={incomeType}
                      onChange={e => setIncomeType(e.target.value as IncomeType)}
                      className="w-full bg-white border border-[#16130F]/15 rounded-sm p-3 text-sm text-[#16130F] focus:outline-none focus:border-[#A83A2C]"
                    >
                      <option value="appointment">Appointment</option>
                      <option value="walk-in">Walk-In</option>
                      <option value="deposit">Deposit Only</option>
                      <option value="tip">Direct Tip</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono-ledger font-semibold text-[#16130F]/50 uppercase tracking-wider mb-2">
                      Channel
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                      className="w-full bg-white border border-[#16130F]/15 rounded-sm p-3 text-sm text-[#16130F] focus:outline-none focus:border-[#A83A2C]"
                    >
                      <option value="cash">Cash (Efectivo)</option>
                      <option value="ath-movil">ATH Móvil</option>
                      <option value="card">Card (Datáfono)</option>
                      <option value="zelle">Zelle</option>
                      <option value="venmo">Venmo</option>
                      <option value="paypal">PayPal</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 items-start">
                  <div className="col-span-2">
                    <label className="block text-[11px] font-mono-ledger font-semibold text-[#16130F]/50 uppercase tracking-wider mb-2">
                      Client
                    </label>
                    <input
                      type="text"
                      value={clientName}
                      onChange={e => setClientName(e.target.value)}
                      placeholder="Marcus M."
                      className="w-full bg-white border border-[#16130F]/15 rounded-sm p-3 text-sm text-[#16130F] focus:outline-none focus:border-[#A83A2C]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono-ledger font-semibold text-[#16130F]/50 uppercase tracking-wider mb-2">
                      Shop Cut %
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={shopCut}
                      onChange={e => setShopCut(e.target.value)}
                      placeholder="40"
                      className="w-full bg-white border border-[#16130F]/15 rounded-sm p-3 text-sm text-[#16130F] focus:outline-none focus:border-[#A83A2C] font-mono-ledger"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-mono-ledger font-semibold text-[#16130F]/50 uppercase tracking-wider mb-2">
                    Session Notes
                  </label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="e.g. Linework completed, shading scheduled next month."
                    rows={2}
                    className="w-full bg-white border border-[#16130F]/15 rounded-sm p-3 text-sm text-[#16130F] focus:outline-none focus:border-[#A83A2C]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-[#A83A2C] hover:bg-[#c04430] disabled:bg-[#16130F]/20 disabled:text-[#16130F]/40 text-[#EFE7D8] font-bold py-4 rounded-sm text-sm transition-colors shadow-lg active:scale-[0.98] flex items-center justify-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16130F]"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Stamping entry…
                    </>
                  ) : (
                    'Commit Session Entry'
                  )}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}