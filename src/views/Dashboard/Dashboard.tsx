import { useState, useMemo, useEffect, useRef } from 'react';
import type { Transaction, IncomeType, PaymentMethod } from '../../types/ledger';
import { 
  DollarSign, 
  Plus, 
  LogOut, 
  Wallet, 
  Percent, 
  Download, 
  Upload, 
  FileText,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface DashboardProps {
  setAuth: (val: boolean) => void;
}

export default function Dashboard({ setAuth }: DashboardProps) {
  // 💾 LOCAL PERSISTENCE LAYER: Initial state reads directly from localStorage cache
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('inktrack_ledger');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse ledger from cache", e);
      }
    }
    // Baseline sample seed data if cache is empty
    return [
      {
        id: '1',
        timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        clientName: 'Marcus Miller',
        description: 'Traditional Eagle Outline',
        incomeType: 'appointment',
        paymentMethod: 'card',
        grossAmount: 350,
        shopCutPercentage: 40,
        netAmount: 210,
      },
      {
        id: '2',
        timestamp: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
        clientName: 'Sarah Jenkins',
        description: 'Finger Flash Placement',
        incomeType: 'walk-in',
        paymentMethod: 'cash',
        grossAmount: 120,
        shopCutPercentage: 0,
        netAmount: 120,
      }
    ];
  });

  // Write variations cleanly back to device memory whenever state shifts
  useEffect(() => {
    localStorage.setItem('inktrack_ledger', JSON.stringify(transactions));
  }, [transactions]);

  // UI State Managers
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Transaction Input Buffer states
  const [grossAmount, setGrossAmount] = useState('');
  const [incomeType, setIncomeType] = useState<IncomeType>('appointment');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [clientName, setClientName] = useState('');
  const [shopCut, setShopCut] = useState('40'); 
  const [description, setDescription] = useState('');

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
  const handleLogIncome = (e: React.FormEvent) => {
    e.preventDefault();
    const gross = parseFloat(grossAmount);
    if (isNaN(gross) || gross <= 0) return;

    const cutPercent = parseFloat(shopCut) || 0;
    const net = gross * (1 - cutPercent / 100);

    const newTx: Transaction = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      clientName: clientName || 'Anonymous Client',
      description,
      incomeType,
      paymentMethod,
      grossAmount: gross,
      shopCutPercentage: cutPercent,
      netAmount: net,
    };

    setTransactions([newTx, ...transactions]);
    setIsModalOpen(false);
    
    // Reset buffers
    setGrossAmount('');
    setClientName('');
    setDescription('');
    triggerStatus('success', 'Session committed to local secure ledger.');
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
      triggerStatus('success', 'Ledger backup JSON generated successfully.');
    } catch (err) {
      triggerStatus('error', 'Export calculation script ran into an error.');
    }
  };

  // 💾 UPLOAD/IMPORT LEDGER UTILITY
  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          // Strict QA structure checks could go here
          setTransactions(parsed);
          triggerStatus('success', `Import verified: Loaded ${parsed.length} ledger logs.`);
        } else {
          triggerStatus('error', 'Format mismatch: File array format invalid.');
        }
      } catch (err) {
        triggerStatus('error', 'Failed to read file. Verify JSON syntax values.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="bg-zinc-950 text-zinc-50 min-h-screen font-sans selection:bg-emerald-500 selection:text-zinc-950">
      
      {/* Universal Flash Context Notification */}
      {statusMessage && (
        <div className={`fixed top-24 right-6 z-50 flex items-center gap-2 border px-4 py-3 rounded-xl shadow-xl transition-all animate-fade-in-up ${
          statusMessage.type === 'success' ? 'bg-zinc-900 border-emerald-500/30 text-emerald-400' : 'bg-zinc-900 border-red-500/30 text-red-400'
        }`}>
          {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span className="text-xs font-bold">{statusMessage.text}</span>
        </div>
      )}

      {/* Nav */}
      <nav className="border-b border-zinc-900 bg-zinc-900/30 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 bg-emerald-500 rounded-md flex items-center justify-center font-black text-zinc-950 text-sm">i</div>
          <span className="font-black text-lg tracking-tight">inktrack<span className="text-emerald-400">.</span>Console</span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold px-4 py-2 rounded-xl text-sm flex items-center gap-2 transition-all shadow-lg"
          >
            <Plus className="w-4 h-4 stroke-[3]" /> Log Session
          </button>
          <button onClick={() => setAuth(false)} className="text-zinc-500 hover:text-zinc-300 p-2 transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-10 space-y-10">
        
        {/* Metric Rollup Matrix */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-4">Earnings Rollup Matrix (Take-Home Net)</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {[
              { label: 'Hour Rate', val: metrics.hr },
              { label: 'Today', val: metrics.day, highlight: true },
              { label: 'This Week', val: metrics.wk },
              { label: 'Bi-Weekly', val: metrics.biWk },
              { label: 'Monthly', val: metrics.mo },
              { label: '3 Months', val: metrics.triMo },
              { label: 'Yearly Estimate', val: metrics.yr },
            ].map((card, idx) => (
              <div key={idx} className={`p-4 rounded-xl border ${card.highlight ? 'bg-zinc-900 border-emerald-500/30 shadow-lg' : 'bg-zinc-900/40 border-zinc-900'}`}>
                <span className="text-xs font-semibold text-zinc-500 block mb-1">{card.label}</span>
                <span className={`text-xl font-bold tracking-tight ${card.highlight ? 'text-emerald-400' : 'text-zinc-100'}`}>
                  ${card.val.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Action Layout splits */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Feed */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500">Real-time Session Feed</h3>
            <div className="bg-zinc-900/30 border border-zinc-900 rounded-2xl overflow-hidden">
              {transactions.length === 0 ? (
                <div className="p-8 text-center text-zinc-600 text-sm">No transaction instances recorded.</div>
              ) : (
                <div className="divide-y divide-zinc-900">
                  {transactions.map((t) => (
                    <div key={t.id} className="p-5 flex items-center justify-between hover:bg-zinc-900/40 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-zinc-200 text-sm">{t.clientName}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium uppercase tracking-wide ${
                            t.incomeType === 'walk-in' ? 'bg-amber-950/40 text-amber-400 border-amber-900/50' : 'bg-blue-950/40 text-blue-400 border-blue-900/50'
                          }`}>
                            {t.incomeType}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <p className="text-xs text-zinc-500">{t.description || 'No job context provided'}</p>
                          <span className="text-[10px] bg-zinc-950 text-zinc-400 px-2 py-0.5 rounded border border-zinc-800 font-mono font-bold">
                            {t.paymentMethod === 'ath-movil' ? '⚡ ATH MÓVIL' : `💳 ${t.paymentMethod.toUpperCase()}`}
                          </span>
                        </div>

                        <p className="text-[10px] text-zinc-600 font-mono">{new Date(t.timestamp).toLocaleTimeString()}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-emerald-400 block">+${t.netAmount.toFixed(2)}</span>
                        {t.shopCutPercentage > 0 && (
                          <span className="text-[10px] text-zinc-500 block font-mono">Gross: ${t.grossAmount} (-{t.shopCutPercentage}%)</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Panels Sidebars */}
          <div className="space-y-6">
            
            {/* Efficiency Box */}
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-3">Shop Efficiency Diagnostics</h3>
              <div className="bg-zinc-900/60 border border-zinc-800 p-6 rounded-2xl space-y-4">
                <div className="flex justify-between items-center text-xs border-b border-zinc-800 pb-3">
                  <span className="text-zinc-400 flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5" /> Total Gross Generated</span>
                  <span className="font-bold text-zinc-200">${transactions.reduce((acc, t) => acc + t.grossAmount, 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400 flex items-center gap-1.5"><Percent className="w-3.5 h-3.5" /> Total Paid to House Split</span>
                  <span className="font-bold text-zinc-400">${transactions.reduce((acc, t) => acc + (t.grossAmount - t.netAmount), 0).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Data Portability Box */}
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-3">Data Operations</h3>
              <div className="bg-zinc-900/40 border border-zinc-900 p-5 rounded-2xl space-y-3">
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Export encryption matrix instances locally or populate your running ledger via an existing session backup file.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={handleExportData}
                    className="flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-bold py-2.5 rounded-xl text-xs transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-400" /> Export JSON
                  </button>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-bold py-2.5 rounded-xl text-xs transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5 text-emerald-400" /> Upload File
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

      {/* Log Form Modal Component */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-center items-end sm:items-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-lg rounded-t-2xl sm:rounded-2xl p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-black tracking-tight">Record New Session Revenue</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-500 text-xs hover:text-zinc-300 font-bold uppercase">Cancel</button>
            </div>

            <form onSubmit={handleLogIncome} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Gross Amount Collected ($)</label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-3.5 h-5 w-5 text-emerald-400" />
                  <input type="number" required value={grossAmount} onChange={e => setGrossAmount(e.target.value)} placeholder="0.00" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3.5 pl-12 pr-4 text-lg focus:outline-none focus:border-emerald-500 text-zinc-100 font-bold" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Category</label>
                  <select value={incomeType} onChange={e => setIncomeType(e.target.value as IncomeType)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-300 focus:outline-none focus:border-emerald-500">
                    <option value="appointment">Appointment</option>
                    <option value="walk-in">Walk-In</option>
                    <option value="deposit">Deposit Only</option>
                    <option value="tip">Direct Tip</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Channel</label>
                  <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as PaymentMethod)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-300 focus:outline-none focus:border-emerald-500">
                    <option value="cash">💵 Cash (Efectivo)</option>
                    <option value="ath-movil">📱 ATH Móvil</option>
                    <option value="card">💳 Card Terminal (Datáfono)</option>
                    <option value="zelle">📱 Zelle</option>
                    <option value="venmo">📱 Venmo</option>
                    <option value="paypal">📱 PayPal</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 items-center">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Client Identity</label>
                  <input type="text" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Marcus M." className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Shop Cut %</label>
                  <input type="number" value={shopCut} onChange={e => setShopCut(e.target.value)} placeholder="40" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500 font-mono" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Session Notes / Placement Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Linework completed, shading scheduled next month." rows={2} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500" />
              </div>

              <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-black py-4 rounded-xl text-md transition-all shadow-lg">Commit Session Entry</button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}