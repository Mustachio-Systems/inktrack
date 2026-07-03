import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import type { Transaction, IncomeType, PaymentMethod } from '../../types/ledger';
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Download,
  LogOut,
  Percent,
  Plus,
  ReceiptText,
  RefreshCw,
  Target,
  TrendingUp,
  Upload,
  Users,
  Wallet,
  X,
} from 'lucide-react';

interface DashboardProps {
  setAuth: (val: boolean) => void;
}

type StatusMessage = { type: 'success' | 'error'; text: string };

const INCOME_TAG_STYLES: Record<IncomeType, string> = {
  appointment: 'bg-[#3F6B62]/15 text-[#2F544A] border-[#3F6B62]/40',
  'walk-in': 'bg-[#C39A48]/15 text-[#8A6A2F] border-[#C39A48]/40',
  deposit: 'bg-[#16130F]/10 text-[#16130F]/70 border-[#16130F]/20',
  tip: 'bg-[#A83A2C]/10 text-[#A83A2C] border-[#A83A2C]/30',
};

const INCOME_TYPE_LABELS: Record<IncomeType, string> = {
  appointment: 'Appointments',
  'walk-in': 'Walk-ins',
  deposit: 'Deposits',
  tip: 'Tips',
};

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  card: 'Card',
  'ath-movil': 'ATH Móvil',
  zelle: 'Zelle',
  venmo: 'Venmo',
  paypal: 'PayPal',
};

function localDayStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const copy = localDayStart(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function startOfWeek(date: Date): Date {
  const copy = localDayStart(date);
  const mondayIndex = (copy.getDay() + 6) % 7;
  return addDays(copy, -mondayIndex);
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function inDateRange(transaction: Transaction, start: Date, end: Date): boolean {
  const day = localDayStart(new Date(transaction.timestamp)).getTime();
  return day >= localDayStart(start).getTime() && day <= localDayStart(end).getTime();
}

function formatDateKey(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

function getWeekLabel(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6);
  const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
  return `${weekStart.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })} – ${weekEnd.toLocaleDateString('en-US', {
    month: sameMonth ? undefined : 'short',
    day: 'numeric',
  })}`;
}

function getMonthWeeks(month: Date): Date[] {
  const first = startOfWeek(startOfMonth(month));
  const last = startOfWeek(endOfMonth(month));
  const weeks: Date[] = [];

  for (let cursor = first; cursor.getTime() <= last.getTime(); cursor = addDays(cursor, 7)) {
    weeks.push(cursor);
  }

  return weeks;
}

function sumNet(items: Transaction[]): number {
  return items.reduce((sum, transaction) => sum + transaction.netAmount, 0);
}

function sumGross(items: Transaction[]): number {
  return items.reduce((sum, transaction) => sum + transaction.grossAmount, 0);
}

export default function Dashboard({ setAuth }: DashboardProps) {
  const API_URL =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:8787/api/transactions'
      : 'https://inktrack-api.lapgonzalez96.workers.dev/api/transactions';

  const today = useMemo(() => localDayStart(new Date()), []);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedMonth, setSelectedMonth] = useState<Date>(() => startOfMonth(today));
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(() => startOfWeek(today));
  const [selectedDay, setSelectedDay] = useState<Date>(() => today);
  const [weeklyGoal, setWeeklyGoal] = useState(() => {
    const savedGoal = Number(localStorage.getItem('inktrack_weekly_goal'));
    return Number.isFinite(savedGoal) && savedGoal > 0 ? savedGoal : 1000;
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [grossAmount, setGrossAmount] = useState('');
  const [incomeType, setIncomeType] = useState<IncomeType>('appointment');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [clientName, setClientName] = useState('');
  const [shopCut, setShopCut] = useState('40');
  const [description, setDescription] = useState('');

  const triggerStatus = (type: StatusMessage['type'], text: string) => {
    setStatusMessage({ type, text });
    window.setTimeout(() => setStatusMessage(null), 4000);
  };

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

  const fetchLedger = async () => {
    setIsLoading(true);

    try {
      const response = await authFetch(API_URL);
      if (!response.ok) throw new Error('Data sync exception');

      const data = (await response.json()) as Transaction[];
      setTransactions(data);
      localStorage.setItem('inktrack_ledger', JSON.stringify(data));
    } catch (error) {
      console.error(error);
      triggerStatus('error', 'Edge sync failed. Loaded device backup instead.');

      const saved = localStorage.getItem('inktrack_ledger');
      if (saved) {
        try {
          setTransactions(JSON.parse(saved) as Transaction[]);
        } catch (parseError) {
          console.error('Cache corrupted, skipping parsing logic.', parseError);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLedger();
    // fetchLedger intentionally runs only on first mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localStorage.setItem('inktrack_weekly_goal', String(weeklyGoal));
  }, [weeklyGoal]);

  const selectedWeekEnd = useMemo(() => addDays(selectedWeekStart, 6), [selectedWeekStart]);
  const selectedMonthEnd = useMemo(() => endOfMonth(selectedMonth), [selectedMonth]);

  const monthTransactions = useMemo(
    () => transactions.filter((transaction) => inDateRange(transaction, selectedMonth, selectedMonthEnd)),
    [transactions, selectedMonth, selectedMonthEnd],
  );

  const weekTransactions = useMemo(
    () => transactions.filter((transaction) => inDateRange(transaction, selectedWeekStart, selectedWeekEnd)),
    [transactions, selectedWeekStart, selectedWeekEnd],
  );

  const dayTransactions = useMemo(
    () => transactions
      .filter((transaction) => inDateRange(transaction, selectedDay, selectedDay))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [transactions, selectedDay],
  );

  const monthMetrics = useMemo(() => {
    const net = sumNet(monthTransactions);
    const gross = sumGross(monthTransactions);
    const clientCount = new Set(
      monthTransactions
        .map((transaction) => (transaction.clientName ?? '').trim().toLowerCase())
        .filter((name) => name.length > 0 && name !== 'anonymous client'),
    ).size;

    return {
      net,
      gross,
      shopCut: gross - net,
      sessionCount: monthTransactions.length,
      clientCount,
      averageNet: monthTransactions.length ? net / monthTransactions.length : 0,
    };
  }, [monthTransactions]);

  const weekMetrics = useMemo(() => {
    const net = sumNet(weekTransactions);
    const gross = sumGross(weekTransactions);

    return {
      net,
      gross,
      shopCut: gross - net,
      sessionCount: weekTransactions.length,
      averageNet: weekTransactions.length ? net / weekTransactions.length : 0,
      goalProgress: weeklyGoal > 0 ? Math.min((net / weeklyGoal) * 100, 100) : 0,
    };
  }, [weekTransactions, weeklyGoal]);

  const dayMetrics = useMemo(() => {
    const net = sumNet(dayTransactions);
    const gross = sumGross(dayTransactions);

    return {
      net,
      gross,
      sessionCount: dayTransactions.length,
      shopCut: gross - net,
    };
  }, [dayTransactions]);

  const weekCards = useMemo(
    () =>
      getMonthWeeks(selectedMonth).map((weekStart) => {
        const weekEnd = addDays(weekStart, 6);
        const items = transactions.filter((transaction) => inDateRange(transaction, weekStart, weekEnd));

        return {
          weekStart,
          weekEnd,
          transactions: items,
          net: sumNet(items),
          gross: sumGross(items),
          sessions: items.length,
        };
      }),
    [transactions, selectedMonth],
  );

  const selectedWeekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const date = addDays(selectedWeekStart, index);
        const items = transactions.filter((transaction) => inDateRange(transaction, date, date));

        return {
          date,
          transactions: items,
          net: sumNet(items),
          gross: sumGross(items),
          sessions: items.length,
        };
      }),
    [transactions, selectedWeekStart],
  );

  const typeBreakdown = useMemo(
    () =>
      (Object.keys(INCOME_TYPE_LABELS) as IncomeType[])
        .map((type) => {
          const items = weekTransactions.filter((transaction) => transaction.incomeType === type);
          return {
            key: type,
            label: INCOME_TYPE_LABELS[type],
            net: sumNet(items),
            sessions: items.length,
          };
        })
        .filter((item) => item.sessions > 0)
        .sort((a, b) => b.net - a.net),
    [weekTransactions],
  );

  const paymentBreakdown = useMemo(
    () =>
      (Object.keys(PAYMENT_LABELS) as PaymentMethod[])
        .map((method) => {
          const items = weekTransactions.filter((transaction) => transaction.paymentMethod === method);
          return {
            key: method,
            label: PAYMENT_LABELS[method],
            net: sumNet(items),
          };
        })
        .filter((item) => item.net > 0)
        .sort((a, b) => b.net - a.net),
    [weekTransactions],
  );

  const selectMonth = (nextMonth: Date) => {
    const normalizedMonth = startOfMonth(nextMonth);
    const currentMonth = startOfMonth(today);

    setSelectedMonth(normalizedMonth);

    if (normalizedMonth.getTime() === currentMonth.getTime()) {
      setSelectedWeekStart(startOfWeek(today));
      setSelectedDay(today);
    } else {
      const firstDay = normalizedMonth;
      setSelectedWeekStart(startOfWeek(firstDay));
      setSelectedDay(firstDay);
    }
  };

  const selectWeek = (weekStart: Date) => {
    const weekEnd = addDays(weekStart, 6);
    const firstActiveDay = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)).find((date) =>
      transactions.some((transaction) => inDateRange(transaction, date, date)),
    );

    setSelectedWeekStart(weekStart);

    if (selectedDay.getTime() < weekStart.getTime() || selectedDay.getTime() > weekEnd.getTime()) {
      setSelectedDay(firstActiveDay || weekStart);
    }
  };

  const handleLogIncome = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    const gross = Number(grossAmount);
    const cutPercent = Number(shopCut) || 0;

    if (!Number.isFinite(gross) || gross <= 0) {
      triggerStatus('error', 'Enter a valid amount greater than zero.');
      return;
    }

    if (cutPercent < 0 || cutPercent > 100) {
      triggerStatus('error', 'Shop cut must be between 0% and 100%.');
      return;
    }

    const newTransaction: Transaction = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      clientName: clientName.trim() || 'Anonymous Client',
      description: description.trim(),
      incomeType,
      paymentMethod,
      grossAmount: gross,
      shopCutPercentage: cutPercent,
      netAmount: Math.round(gross * (1 - cutPercent / 100) * 100) / 100,
    };

    const previousTransactions = [...transactions];
    setIsSubmitting(true);
    setTransactions([newTransaction, ...transactions]);
    setSelectedMonth(startOfMonth(new Date()));
    setSelectedWeekStart(startOfWeek(new Date()));
    setSelectedDay(localDayStart(new Date()));
    setIsModalOpen(false);

    setGrossAmount('');
    setClientName('');
    setDescription('');

    try {
      const response = await authFetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTransaction),
      });

      if (!response.ok) throw new Error('D1 write failure');

      localStorage.setItem('inktrack_ledger', JSON.stringify([newTransaction, ...previousTransactions]));
      triggerStatus('success', 'Session added to this week’s ledger.');
    } catch (error) {
      console.error(error);
      setTransactions(previousTransactions);
      triggerStatus('error', 'Write failed — entry was rolled back.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportData = () => {
    try {
      const data = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(transactions, null, 2),
      )}`;
      const anchor = document.createElement('a');
      anchor.href = data;
      anchor.download = `inktrack_ledger_${formatDateKey(new Date())}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      triggerStatus('success', 'Ledger backup exported.');
    } catch (error) {
      console.error(error);
      triggerStatus('error', 'Export ran into an error.');
    }
  };

  const handleImportData = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (loadEvent) => {
      try {
        const parsed = JSON.parse(loadEvent.target?.result as string);

        if (!Array.isArray(parsed)) {
          triggerStatus('error', 'File format mismatch — expected a ledger array.');
          return;
        }

        const imported = parsed as Transaction[];
        setTransactions(imported);
        localStorage.setItem('inktrack_ledger', JSON.stringify(imported));
        triggerStatus('success', `Imported ${imported.length} ledger entries.`);
      } catch (error) {
        console.error(error);
        triggerStatus('error', 'Could not read the backup file.');
      } finally {
        event.target.value = '';
      }
    };

    reader.readAsText(file);
  };

  const handleLogout = () => {
    localStorage.removeItem('inktrack_token');
    setAuth(false);
  };

  const dayName = selectedDay.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="min-h-screen bg-[#16130F] text-[#EFE7D8] selection:bg-[#A83A2C] selection:text-[#EFE7D8]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rye&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        .font-display { font-family: 'Rye', serif; }
        .font-mono-ledger { font-family: 'IBM Plex Mono', monospace; }
        .font-body { font-family: 'IBM Plex Sans', sans-serif; }
      `}</style>

      <div className="font-body">
        {statusMessage && (
          <div
            role="status"
            className={`fixed right-5 top-5 z-[70] flex items-center gap-2 rounded-md border px-4 py-3 shadow-xl ${
              statusMessage.type === 'success'
                ? 'border-[#3F6B62]/40 bg-[#EFE7D8] text-[#2F544A]'
                : 'border-[#A83A2C]/40 bg-[#EFE7D8] text-[#A83A2C]'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <span className="font-mono-ledger text-xs font-semibold">{statusMessage.text}</span>
          </div>
        )}

        <nav className="sticky top-0 z-40 flex items-center justify-between border-b border-[#EFE7D8]/10 bg-[#16130F]/95 px-4 py-4 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#C39A48] bg-[#A83A2C] font-display text-base">
              i
            </div>
            <span className="font-display text-lg tracking-wide">
              inktrack<span className="text-[#C39A48]">.</span>
              <span className="ml-1 align-middle font-mono-ledger text-[10px] uppercase tracking-widest text-[#EFE7D8]/50">
                Console
              </span>
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={fetchLedger}
              title="Refresh ledger from database"
              className="rounded-md p-2.5 text-[#EFE7D8]/50 transition-colors hover:text-[#C39A48] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C39A48]"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin text-[#C39A48]' : ''}`} />
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 rounded-md bg-[#A83A2C] px-3 py-2.5 text-sm font-bold text-[#EFE7D8] shadow-md transition-colors hover:bg-[#c04430] active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C39A48] sm:px-4"
            >
              <Plus className="h-4 w-4 stroke-[3]" />
              <span className="hidden sm:inline">Log Session</span>
              <span className="sm:hidden">Log</span>
            </button>
            <button
              onClick={handleLogout}
              title="Sign out"
              className="rounded-md p-2.5 text-[#EFE7D8]/50 transition-colors hover:text-[#A83A2C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C39A48]"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </nav>

        <main className="mx-auto max-w-7xl space-y-8 px-4 py-7 sm:px-6 sm:py-10">
          <section className="space-y-4">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <p className="font-mono-ledger text-[10px] font-semibold uppercase tracking-[0.2em] text-[#C39A48]">
                  Artist Revenue Planner
                </p>
                <h1 className="mt-1 font-display text-3xl text-[#EFE7D8] sm:text-4xl">
                  Month → Week → Day
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#EFE7D8]/55">
                  Start with the month, pick a weekly block, then open one day to see the exact sessions behind the numbers.
                </p>
              </div>

              <div className="flex items-center gap-2 self-start rounded-sm border border-[#EFE7D8]/10 bg-[#EFE7D8]/[0.04] p-1 md:self-auto">
                <button
                  onClick={() => selectMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1))}
                  aria-label="Previous month"
                  className="rounded-sm p-2 text-[#EFE7D8]/65 transition-colors hover:bg-[#EFE7D8]/10 hover:text-[#C39A48]"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => selectMonth(today)}
                  className="min-w-[130px] rounded-sm px-3 py-2 font-mono-ledger text-xs font-semibold uppercase tracking-wide text-[#EFE7D8] transition-colors hover:bg-[#EFE7D8]/10"
                >
                  {selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </button>
                <button
                  onClick={() => selectMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1))}
                  aria-label="Next month"
                  className="rounded-sm p-2 text-[#EFE7D8]/65 transition-colors hover:bg-[#EFE7D8]/10 hover:text-[#C39A48]"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              {[
                {
                  label: 'Month net',
                  value: formatCurrency(monthMetrics.net),
                  caption: `${monthMetrics.sessionCount} sessions`,
                  icon: Wallet,
                  emphasis: true,
                },
                {
                  label: 'Selected week',
                  value: formatCurrency(weekMetrics.net),
                  caption: getWeekLabel(selectedWeekStart),
                  icon: CalendarDays,
                },
                {
                  label: 'Selected day',
                  value: formatCurrency(dayMetrics.net),
                  caption: `${dayMetrics.sessionCount} sessions today`,
                  icon: TrendingUp,
                },
                {
                  label: 'Average ticket',
                  value: formatCurrency(weekMetrics.averageNet),
                  caption: 'Net per weekly session',
                  icon: ReceiptText,
                },
                {
                  label: 'Month clients',
                  value: String(monthMetrics.clientCount),
                  caption: 'Unique named clients',
                  icon: Users,
                },
                {
                  label: 'Shop split',
                  value: formatCurrency(monthMetrics.shopCut),
                  caption: `${monthMetrics.gross ? ((monthMetrics.shopCut / monthMetrics.gross) * 100).toFixed(0) : 0}% of monthly gross`,
                  icon: Percent,
                },
              ].map((card) => {
                const Icon = card.icon;
                return (
                  <div
                    key={card.label}
                    className={`rounded-sm border p-4 shadow-lg ${
                      card.emphasis
                        ? 'border-[#A83A2C] bg-[#EFE7D8]'
                        : 'border-[#EFE7D8]/15 bg-[#EFE7D8]/95'
                    }`}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="font-mono-ledger text-[10px] uppercase tracking-wide text-[#16130F]/50">
                        {card.label}
                      </span>
                      <Icon className={`h-4 w-4 ${card.emphasis ? 'text-[#A83A2C]' : 'text-[#2F544A]'}`} />
                    </div>
                    <p className={`font-mono-ledger text-xl font-bold ${card.emphasis ? 'text-[#A83A2C]' : 'text-[#16130F]'}`}>
                      {card.value}
                    </p>
                    <p className="mt-1 text-[10px] text-[#16130F]/50">{card.caption}</p>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
            <div className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="font-mono-ledger text-[11px] font-semibold uppercase tracking-[0.15em] text-[#C39A48]">
                    Weekly Overview
                  </h2>
                  <p className="mt-1 text-sm text-[#EFE7D8]/50">
                    Click a weekly block to inspect its daily pace and session ledger.
                  </p>
                </div>
                <span className="rounded-sm border border-[#C39A48]/35 bg-[#C39A48]/10 px-3 py-1.5 font-mono-ledger text-[10px] font-semibold uppercase tracking-wide text-[#C39A48]">
                  {monthMetrics.sessionCount} sessions this month
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {weekCards.map((week) => {
                  const isSelected = sameDay(week.weekStart, selectedWeekStart);
                  const isCurrentWeek = sameDay(week.weekStart, startOfWeek(today));
                  const monthNetForWeek = sumNet(
                    week.transactions.filter((transaction) => inDateRange(transaction, selectedMonth, selectedMonthEnd)),
                  );

                  return (
                    <button
                      type="button"
                      key={formatDateKey(week.weekStart)}
                      onClick={() => selectWeek(week.weekStart)}
                      className={`group rounded-sm border p-4 text-left transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C39A48] ${
                        isSelected
                          ? 'border-[#A83A2C] bg-[#EFE7D8] shadow-xl'
                          : 'border-[#EFE7D8]/15 bg-[#EFE7D8]/[0.05] hover:-translate-y-0.5 hover:border-[#C39A48]/50 hover:bg-[#EFE7D8]/10'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className={`font-mono-ledger text-[10px] font-semibold uppercase tracking-wide ${isSelected ? 'text-[#A83A2C]' : 'text-[#C39A48]'}`}>
                            {getWeekLabel(week.weekStart)}
                          </p>
                          {isCurrentWeek && (
                            <span className={`mt-1 inline-block rounded px-1.5 py-0.5 font-mono-ledger text-[9px] uppercase tracking-wide ${
                              isSelected ? 'bg-[#A83A2C]/10 text-[#A83A2C]' : 'bg-[#C39A48]/15 text-[#C39A48]'
                            }`}>
                              Current week
                            </span>
                          )}
                        </div>
                        <ArrowRight className={`h-4 w-4 transition-transform group-hover:translate-x-0.5 ${isSelected ? 'text-[#A83A2C]' : 'text-[#EFE7D8]/40'}`} />
                      </div>

                      <p className={`mt-5 font-mono-ledger text-2xl font-bold ${isSelected ? 'text-[#16130F]' : 'text-[#EFE7D8]'}`}>
                        {formatCurrency(week.net)}
                      </p>
                      <p className={`mt-1 text-xs ${isSelected ? 'text-[#16130F]/55' : 'text-[#EFE7D8]/55'}`}>
                        {week.sessions} {week.sessions === 1 ? 'session' : 'sessions'} · Gross {formatCurrency(week.gross)}
                      </p>
                      <div className={`mt-4 border-t pt-3 font-mono-ledger text-[10px] ${isSelected ? 'border-[#16130F]/10 text-[#16130F]/45' : 'border-[#EFE7D8]/10 text-[#EFE7D8]/45'}`}>
                        Inside this month: {formatCurrency(monthNetForWeek)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <aside className="space-y-4">
              <div className="rounded-sm border border-[#C39A48]/30 bg-[#EFE7D8] p-5 text-[#16130F] shadow-lg">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-mono-ledger text-[10px] font-semibold uppercase tracking-[0.15em] text-[#A83A2C]">
                      Weekly Target
                    </p>
                    <h2 className="mt-1 font-display text-xl">Revenue Pace</h2>
                  </div>
                  <Target className="h-6 w-6 text-[#A83A2C]" />
                </div>

                <div className="mt-5 flex items-end justify-between gap-3">
                  <div>
                    <p className="font-mono-ledger text-2xl font-bold text-[#2F544A]">
                      {formatCurrency(weekMetrics.net)}
                    </p>
                    <p className="mt-1 text-xs text-[#16130F]/55">
                      of {formatCurrency(weeklyGoal)} weekly goal
                    </p>
                  </div>
                  <label className="w-28">
                    <span className="mb-1 block font-mono-ledger text-[9px] uppercase tracking-wide text-[#16130F]/45">
                      Goal
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="50"
                      value={weeklyGoal}
                      onChange={(event) => setWeeklyGoal(Math.max(0, Number(event.target.value) || 0))}
                      className="w-full rounded-sm border border-[#16130F]/15 bg-white px-2 py-1.5 font-mono-ledger text-xs font-bold text-[#16130F] focus:border-[#A83A2C] focus:outline-none"
                    />
                  </label>
                </div>

                <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#16130F]/10">
                  <div
                    className="h-full rounded-full bg-[#A83A2C] transition-[width] duration-500"
                    style={{ width: `${weekMetrics.goalProgress}%` }}
                  />
                </div>
                <p className="mt-2 font-mono-ledger text-[10px] text-[#16130F]/50">
                  {weeklyGoal <= 0
                    ? 'Set a target to measure progress.'
                    : weekMetrics.net >= weeklyGoal
                      ? 'Target reached — great week.'
                      : `${formatCurrency(weeklyGoal - weekMetrics.net)} remaining to reach your target.`}
                </p>
              </div>

              <div className="rounded-sm bg-[#EFE7D8] p-5 text-[#16130F] shadow-lg">
                <p className="font-mono-ledger text-[10px] font-semibold uppercase tracking-[0.15em] text-[#16130F]/45">
                  Selected Week Mix
                </p>

                <div className="mt-4 space-y-4">
                  {typeBreakdown.length === 0 ? (
                    <p className="text-sm text-[#16130F]/50">No earnings recorded in this week yet.</p>
                  ) : (
                    typeBreakdown.map((item) => {
                      const width = weekMetrics.net ? Math.max((item.net / weekMetrics.net) * 100, 4) : 0;
                      return (
                        <div key={item.key}>
                          <div className="flex justify-between gap-3 text-xs">
                            <span className="text-[#16130F]/60">
                              {item.label} <span className="font-mono-ledger text-[10px]">({item.sessions})</span>
                            </span>
                            <span className="font-mono-ledger font-bold">{formatCurrency(item.net)}</span>
                          </div>
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#16130F]/10">
                            <div className="h-full rounded-full bg-[#3F6B62]" style={{ width: `${width}%` }} />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </aside>
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
            <div className="overflow-hidden rounded-sm bg-[#EFE7D8] text-[#16130F] shadow-lg">
              <div className="border-b border-dashed border-[#16130F]/15 px-5 py-5 sm:px-6">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <p className="font-mono-ledger text-[10px] font-semibold uppercase tracking-[0.15em] text-[#A83A2C]">
                      Week Detail
                    </p>
                    <h2 className="mt-1 font-display text-2xl">{getWeekLabel(selectedWeekStart)}</h2>
                    <p className="mt-1 text-sm text-[#16130F]/55">
                      {weekMetrics.sessionCount} sessions · {formatCurrency(weekMetrics.gross)} gross · {formatCurrency(weekMetrics.shopCut)} shop split
                    </p>
                  </div>
                  <div className="rounded-sm bg-[#16130F] px-3 py-2 text-right text-[#EFE7D8]">
                    <p className="font-mono-ledger text-[9px] uppercase tracking-wide text-[#EFE7D8]/50">Take-home</p>
                    <p className="font-mono-ledger text-lg font-bold">{formatCurrency(weekMetrics.net)}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-7 divide-x divide-[#16130F]/10 border-b border-dashed border-[#16130F]/15">
                {selectedWeekDays.map((day) => {
                  const isSelected = sameDay(day.date, selectedDay);
                  const isToday = sameDay(day.date, today);
                  const outsideMonth = day.date.getMonth() !== selectedMonth.getMonth();

                  return (
                    <button
                      type="button"
                      key={formatDateKey(day.date)}
                      onClick={() => setSelectedDay(day.date)}
                      className={`min-h-[145px] p-2 text-left transition-colors sm:p-3 ${
                        isSelected
                          ? 'bg-[#A83A2C] text-[#EFE7D8]'
                          : 'hover:bg-[#16130F]/[0.04]'
                      } ${outsideMonth && !isSelected ? 'bg-[#16130F]/[0.025] text-[#16130F]/50' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`font-mono-ledger text-[9px] uppercase tracking-wide ${isSelected ? 'text-[#EFE7D8]/65' : 'text-[#16130F]/45'}`}>
                          {day.date.toLocaleDateString('en-US', { weekday: 'short' })}
                        </span>
                        {isToday && (
                          <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-[#C39A48]' : 'bg-[#A83A2C]'}`} />
                        )}
                      </div>
                      <p className={`mt-2 font-mono-ledger text-lg font-bold ${isSelected ? 'text-[#EFE7D8]' : 'text-[#16130F]'}`}>
                        {day.date.getDate()}
                      </p>
                      <p className={`mt-7 hidden font-mono-ledger text-sm font-bold sm:block ${isSelected ? 'text-[#EFE7D8]' : 'text-[#2F544A]'}`}>
                        {formatCurrency(day.net)}
                      </p>
                      <p className={`mt-1 hidden text-[9px] sm:block ${isSelected ? 'text-[#EFE7D8]/65' : 'text-[#16130F]/45'}`}>
                        {day.sessions} {day.sessions === 1 ? 'session' : 'sessions'}
                      </p>
                      <p className={`mt-3 font-mono-ledger text-[9px] sm:hidden ${isSelected ? 'text-[#EFE7D8]/70' : 'text-[#16130F]/45'}`}>
                        {day.sessions || '—'}
                      </p>
                    </button>
                  );
                })}
              </div>

              <div className="p-5 sm:p-6">
                <div className="flex flex-col justify-between gap-3 border-b border-dashed border-[#16130F]/15 pb-4 sm:flex-row sm:items-end">
                  <div>
                    <p className="font-mono-ledger text-[10px] font-semibold uppercase tracking-[0.15em] text-[#A83A2C]">
                      Day Ledger
                    </p>
                    <h3 className="mt-1 font-display text-xl">{dayName}</h3>
                  </div>
                  <div className="flex gap-4 font-mono-ledger text-xs">
                    <span><span className="text-[#16130F]/45">Sessions </span><b>{dayMetrics.sessionCount}</b></span>
                    <span><span className="text-[#16130F]/45">Net </span><b className="text-[#2F544A]">{formatCurrency(dayMetrics.net)}</b></span>
                  </div>
                </div>

                {isLoading ? (
                  <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-[#16130F]/50">
                    <RefreshCw className="h-5 w-5 animate-spin text-[#A83A2C]" />
                    <span className="font-mono-ledger text-xs">Syncing ledger…</span>
                  </div>
                ) : dayTransactions.length === 0 ? (
                  <div className="flex min-h-48 flex-col items-center justify-center text-center">
                    <CalendarDays className="h-7 w-7 text-[#16130F]/25" />
                    <p className="mt-3 text-sm font-semibold text-[#16130F]/60">No sessions on this day.</p>
                    <p className="mt-1 text-xs text-[#16130F]/45">Select another day, or log a new session.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-dashed divide-[#16130F]/15">
                    {dayTransactions.map((transaction) => (
                      <div key={transaction.id} className="flex items-center justify-between gap-4 py-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-bold">{transaction.clientName}</p>
                            <span className={`rounded-full border px-2 py-0.5 font-mono-ledger text-[9px] font-semibold uppercase tracking-wide ${INCOME_TAG_STYLES[transaction.incomeType]}`}>
                              {transaction.incomeType}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <p className="max-w-[230px] truncate text-xs text-[#16130F]/55">
                              {transaction.description || 'No session note'}
                            </p>
                            <span className="rounded bg-[#16130F] px-1.5 py-0.5 font-mono-ledger text-[9px] font-semibold uppercase tracking-wide text-[#EFE7D8]">
                              {PAYMENT_LABELS[transaction.paymentMethod]}
                            </span>
                          </div>
                          <p className="mt-1.5 font-mono-ledger text-[10px] text-[#16130F]/40">
                            {new Date(transaction.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-mono-ledger text-sm font-bold text-[#2F544A]">
                            +{formatCurrency(transaction.netAmount)}
                          </p>
                          <p className="mt-1 font-mono-ledger text-[10px] text-[#16130F]/40">
                            Gross {formatCurrency(transaction.grossAmount)} · −{transaction.shopCutPercentage}%
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <aside className="space-y-4">
              <div className="rounded-sm bg-[#EFE7D8] p-5 text-[#16130F] shadow-lg">
                <h2 className="font-mono-ledger text-[10px] font-semibold uppercase tracking-[0.15em] text-[#16130F]/45">
                  Payment Channels
                </h2>
                <div className="mt-4 space-y-3">
                  {paymentBreakdown.length === 0 ? (
                    <p className="text-sm text-[#16130F]/50">No payment activity this week.</p>
                  ) : (
                    paymentBreakdown.map((item) => (
                      <div key={item.key} className="flex items-center justify-between text-xs">
                        <span className="text-[#16130F]/60">{item.label}</span>
                        <span className="font-mono-ledger font-bold">{formatCurrency(item.net)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-sm bg-[#EFE7D8] p-5 text-[#16130F] shadow-lg">
                <h2 className="font-mono-ledger text-[10px] font-semibold uppercase tracking-[0.15em] text-[#16130F]/45">
                  Monthly Health
                </h2>
                <div className="mt-4 space-y-4">
                  <div className="flex items-center justify-between border-b border-dashed border-[#16130F]/15 pb-3 text-xs">
                    <span className="flex items-center gap-1.5 text-[#16130F]/60">
                      <Wallet className="h-3.5 w-3.5" /> Total gross
                    </span>
                    <span className="font-mono-ledger font-bold">{formatCurrency(monthMetrics.gross)}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-dashed border-[#16130F]/15 pb-3 text-xs">
                    <span className="flex items-center gap-1.5 text-[#16130F]/60">
                      <Percent className="h-3.5 w-3.5" /> Paid to shop
                    </span>
                    <span className="font-mono-ledger font-bold text-[#A83A2C]">{formatCurrency(monthMetrics.shopCut)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-[#16130F]/60">
                      <TrendingUp className="h-3.5 w-3.5" /> Net average/session
                    </span>
                    <span className="font-mono-ledger font-bold text-[#2F544A]">{formatCurrency(monthMetrics.averageNet)}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-sm bg-[#EFE7D8] p-5 text-[#16130F] shadow-lg">
                <h2 className="font-mono-ledger text-[10px] font-semibold uppercase tracking-[0.15em] text-[#16130F]/45">
                  Data Operations
                </h2>
                <p className="mt-2 text-xs leading-relaxed text-[#16130F]/60">
                  Export a backup of your ledger, or restore a prior backup locally.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button
                    onClick={handleExportData}
                    className="flex items-center justify-center gap-2 rounded-sm border border-[#16130F]/15 py-2.5 text-xs font-semibold transition-colors hover:border-[#16130F]/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#A83A2C]"
                  >
                    <Download className="h-3.5 w-3.5 text-[#2F544A]" /> Export
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center justify-center gap-2 rounded-sm border border-[#16130F]/15 py-2.5 text-xs font-semibold transition-colors hover:border-[#16130F]/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#A83A2C]"
                  >
                    <Upload className="h-3.5 w-3.5 text-[#2F544A]" /> Import
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleImportData}
                  className="hidden"
                />
              </div>
            </aside>
          </section>
        </main>

        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#16130F]/85 p-4 backdrop-blur-sm sm:items-center">
            <div className="max-h-[90vh] w-full max-w-lg space-y-5 overflow-y-auto rounded-t-sm bg-[#EFE7D8] p-6 text-[#16130F] shadow-2xl sm:rounded-sm">
              <div className="flex items-center justify-between border-b border-dashed border-[#16130F]/15 pb-4">
                <div>
                  <p className="mb-1 font-mono-ledger text-[10px] uppercase tracking-[0.2em] text-[#16130F]/40">
                    New Entry
                  </p>
                  <h2 className="font-display text-2xl">Session Ticket</h2>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="rounded p-1 text-[#16130F]/40 transition-colors hover:text-[#16130F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#A83A2C]"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleLogIncome} className="space-y-4">
                <div>
                  <label className="mb-2 block font-mono-ledger text-[11px] font-semibold uppercase tracking-wider text-[#16130F]/50">
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
                      onChange={(event) => setGrossAmount(event.target.value)}
                      placeholder="0.00"
                      className="w-full rounded-sm border border-[#16130F]/15 bg-white py-3.5 pl-12 pr-4 font-mono-ledger text-lg font-bold text-[#16130F] focus:border-[#A83A2C] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-2 block font-mono-ledger text-[11px] font-semibold uppercase tracking-wider text-[#16130F]/50">
                      Category
                    </label>
                    <select
                      value={incomeType}
                      onChange={(event) => setIncomeType(event.target.value as IncomeType)}
                      className="w-full rounded-sm border border-[#16130F]/15 bg-white p-3 text-sm text-[#16130F] focus:border-[#A83A2C] focus:outline-none"
                    >
                      <option value="appointment">Appointment</option>
                      <option value="walk-in">Walk-In</option>
                      <option value="deposit">Deposit Only</option>
                      <option value="tip">Direct Tip</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block font-mono-ledger text-[11px] font-semibold uppercase tracking-wider text-[#16130F]/50">
                      Channel
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                      className="w-full rounded-sm border border-[#16130F]/15 bg-white p-3 text-sm text-[#16130F] focus:border-[#A83A2C] focus:outline-none"
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

                <div className="grid grid-cols-3 items-start gap-3">
                  <div className="col-span-2">
                    <label className="mb-2 block font-mono-ledger text-[11px] font-semibold uppercase tracking-wider text-[#16130F]/50">
                      Client
                    </label>
                    <input
                      type="text"
                      value={clientName}
                      onChange={(event) => setClientName(event.target.value)}
                      placeholder="Marcus M."
                      className="w-full rounded-sm border border-[#16130F]/15 bg-white p-3 text-sm text-[#16130F] focus:border-[#A83A2C] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block font-mono-ledger text-[11px] font-semibold uppercase tracking-wider text-[#16130F]/50">
                      Shop Cut %
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={shopCut}
                      onChange={(event) => setShopCut(event.target.value)}
                      placeholder="40"
                      className="w-full rounded-sm border border-[#16130F]/15 bg-white p-3 font-mono-ledger text-sm text-[#16130F] focus:border-[#A83A2C] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block font-mono-ledger text-[11px] font-semibold uppercase tracking-wider text-[#16130F]/50">
                    Session Notes
                  </label>
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="e.g. Linework completed, shading scheduled next month."
                    rows={2}
                    className="w-full rounded-sm border border-[#16130F]/15 bg-white p-3 text-sm text-[#16130F] focus:border-[#A83A2C] focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex w-full items-center justify-center gap-2 rounded-sm bg-[#A83A2C] py-4 text-sm font-bold text-[#EFE7D8] shadow-lg transition-colors hover:bg-[#c04430] active:scale-[0.98] disabled:bg-[#16130F]/20 disabled:text-[#16130F]/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16130F]"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" /> Stamping entry…
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
