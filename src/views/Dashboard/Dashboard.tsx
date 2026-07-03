import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import type {
  IncomeType,
  PaymentMethod,
  ShopExpense,
  ShopExpenseFrequency,
  ShopFeeType,
  Transaction,
} from '../../types/ledger';
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Download,
  Landmark,
  LogOut,
  Pencil,
  Percent,
  Plus,
  ReceiptText,
  RefreshCw,
  Target,
  Trash2,
  TrendingUp,
  Upload,
  Users,
  Wallet,
  X,
} from 'lucide-react';

interface DashboardProps {
  setAuth: (value: boolean) => void;
}

type StatusMessage = { type: 'success' | 'error'; text: string };
type TransactionForm = {
  grossAmount: string;
  incomeType: IncomeType;
  paymentMethod: PaymentMethod;
  clientName: string;
  shopFeeType: ShopFeeType;
  shopCutPercentage: string;
  shopFixedFee: string;
  description: string;
};
type ExpenseForm = {
  name: string;
  amount: string;
  frequency: ShopExpenseFrequency;
  startsOn: string;
  endsOn: string;
};

const INCOME_TAG_STYLES: Record<IncomeType, string> = {
  appointment: 'bg-[#3F6B62]/15 text-[#2F544A] border-[#3F6B62]/40',
  'walk-in': 'bg-[#C39A48]/15 text-[#8A6A2F] border-[#C39A48]/40',
  deposit: 'bg-[#16130F]/10 text-[#16130F]/70 border-[#16130F]/20',
  tip: 'bg-[#A83A2C]/10 text-[#A83A2C] border-[#A83A2C]/30',
};

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  card: 'Card',
  'ath-movil': 'ATH Móvil',
  zelle: 'Zelle',
  venmo: 'Venmo',
  paypal: 'PayPal',
};

const SHOP_FEE_LABELS: Record<ShopFeeType, string> = {
  percentage: 'Percentage split',
  fixed: 'Fixed session fee',
  'booth-rent': 'Booth / chair rent',
  hybrid: 'Hybrid split + fee',
  none: 'No shop fee',
};

const EXPENSE_FREQUENCY_LABELS: Record<ShopExpenseFrequency, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  'one-time': 'One-time',
};

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const result = startOfDay(date);
  result.setDate(result.getDate() + days);
  return result;
}

function startOfWeek(date: Date): Date {
  const local = startOfDay(date);
  return addDays(local, -((local.getDay() + 6) % 7));
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function sameDay(a: Date, b: Date): boolean {
  return toDateKey(a) === toDateKey(b);
}

function inRange(value: string, start: Date, end: Date): boolean {
  const day = startOfDay(new Date(value)).getTime();
  return day >= startOfDay(start).getTime() && day <= startOfDay(end).getTime();
}

function money(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

function sum(items: Transaction[]): number {
  return items.reduce((total, item) => total + item.netAmount, 0);
}

function sumGross(items: Transaction[]): number {
  return items.reduce((total, item) => total + item.grossAmount, 0);
}

function getShopFeeType(transaction: Transaction): ShopFeeType {
  return transaction.shopFeeType ?? 'percentage';
}

function getShopFixedFee(transaction: Transaction): number {
  return Number(transaction.shopFixedFee ?? 0);
}

function calculateNet(
  grossAmount: number,
  shopFeeType: ShopFeeType,
  percentage: number,
  fixedFee: number,
): number {
  const percentageFee =
    shopFeeType === 'percentage' || shopFeeType === 'hybrid'
      ? grossAmount * (percentage / 100)
      : 0;

  const flatFee =
    shopFeeType === 'fixed' || shopFeeType === 'hybrid'
      ? fixedFee
      : 0;

  return Math.max(0, Math.round((grossAmount - percentageFee - flatFee) * 100) / 100);
}

function getTransactionFee(transaction: Transaction): number {
  return Math.max(0, transaction.grossAmount - transaction.netAmount);
}

function getWeekLabel(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6);
  return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

function defaultTransactionForm(): TransactionForm {
  return {
    grossAmount: '',
    incomeType: 'appointment',
    paymentMethod: 'cash',
    clientName: '',
    shopFeeType: 'percentage',
    shopCutPercentage: '40',
    shopFixedFee: '0',
    description: '',
  };
}

function defaultExpenseForm(): ExpenseForm {
  return {
    name: 'Booth rent',
    amount: '',
    frequency: 'weekly',
    startsOn: toDateKey(new Date()),
    endsOn: '',
  };
}

function expenseAppliesInRange(expense: ShopExpense, start: Date, end: Date): boolean {
  const startsOn = new Date(`${expense.startsOn}T00:00:00`);
  const endsOn = expense.endsOn ? new Date(`${expense.endsOn}T00:00:00`) : null;
  return startsOn.getTime() <= end.getTime() && (!endsOn || endsOn.getTime() >= start.getTime());
}

function recurringCostsForWeek(expenses: ShopExpense[], weekStart: Date): number {
  const weekEnd = addDays(weekStart, 6);

  return expenses.reduce((total, expense) => {
    if (!expenseAppliesInRange(expense, weekStart, weekEnd)) return total;

    if (expense.frequency === 'weekly') return total + expense.amount;
    if (expense.frequency === 'one-time' && inRange(expense.startsOn, weekStart, weekEnd)) {
      return total + expense.amount;
    }

    // Monthly recurring expense is charged to the week that contains the
    // monthly anniversary day (or the first visible week if that day does not exist).
    if (expense.frequency === 'monthly') {
      const startDate = new Date(`${expense.startsOn}T00:00:00`);
      const monthAnchor = new Date(weekStart.getFullYear(), weekStart.getMonth(), Math.min(startDate.getDate(), endOfMonth(weekStart).getDate()));
      return inRange(toDateKey(monthAnchor), weekStart, weekEnd) ? total + expense.amount : total;
    }

    return total;
  }, 0);
}

function recurringCostsForMonth(expenses: ShopExpense[], monthStart: Date): number {
  const monthEnd = endOfMonth(monthStart);
  const firstWeek = startOfWeek(monthStart);
  const lastWeek = startOfWeek(monthEnd);
  let total = 0;

  for (const expense of expenses) {
    if (!expenseAppliesInRange(expense, monthStart, monthEnd)) continue;

    if (expense.frequency === 'monthly') {
      total += expense.amount;
      continue;
    }

    if (expense.frequency === 'one-time') {
      if (inRange(expense.startsOn, monthStart, monthEnd)) total += expense.amount;
      continue;
    }

    for (let week = firstWeek; week.getTime() <= lastWeek.getTime(); week = addDays(week, 7)) {
      const weekEnd = addDays(week, 6);
      if (expenseAppliesInRange(expense, week, weekEnd)) total += expense.amount;
    }
  }

  return total;
}

export default function Dashboard({ setAuth }: DashboardProps) {
  const API_URL =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:8787/api/transactions'
      : 'https://inktrack-api.lapgonzalez96.workers.dev/api/transactions';

  const today = useMemo(() => startOfDay(new Date()), []);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [shopExpenses, setShopExpenses] = useState<ShopExpense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [selectedMonth, setSelectedMonth] = useState(() => startOfMonth(today));
  const [selectedWeekStart, setSelectedWeekStart] = useState(() => startOfWeek(today));
  const [selectedDay, setSelectedDay] = useState(today);
  const [weeklyGoal, setWeeklyGoal] = useState(() => {
    const raw = Number(localStorage.getItem('inktrack_weekly_goal'));
    return Number.isFinite(raw) && raw > 0 ? raw : 1000;
  });

  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editingExpense, setEditingExpense] = useState<ShopExpense | null>(null);
  const [transactionForm, setTransactionForm] = useState<TransactionForm>(defaultTransactionForm);
  const [expenseForm, setExpenseForm] = useState<ExpenseForm>(defaultExpenseForm);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const notify = (type: StatusMessage['type'], text: string) => {
    setStatusMessage({ type, text });
    window.setTimeout(() => setStatusMessage(null), 4200);
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

  const fetchEverything = async (quiet = false) => {
    if (quiet) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const [ledgerResponse, expenseResponse] = await Promise.all([
        authFetch(API_URL),
        authFetch(`${API_URL.replace(/\/transactions$/, '')}/shop-expenses`),
      ]);

      if (!ledgerResponse.ok || !expenseResponse.ok) throw new Error('Could not synchronize your ledger.');

      const nextTransactions = (await ledgerResponse.json()) as Transaction[];
      const nextExpenses = (await expenseResponse.json()) as ShopExpense[];

      setTransactions(nextTransactions);
      setShopExpenses(nextExpenses);
      localStorage.setItem('inktrack_ledger', JSON.stringify(nextTransactions));
    } catch (error) {
      console.error(error);
      const cached = localStorage.getItem('inktrack_ledger');

      if (cached) {
        try {
          setTransactions(JSON.parse(cached) as Transaction[]);
          notify('error', 'Cloud sync failed. Showing your local session cache.');
        } catch {
          notify('error', 'Cloud sync failed and local cache could not be read.');
        }
      } else {
        notify('error', 'Cloud sync failed. Try refreshing again.');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchEverything();
    // Initial data load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localStorage.setItem('inktrack_weekly_goal', String(weeklyGoal));
  }, [weeklyGoal]);

  const selectedWeekEnd = useMemo(() => addDays(selectedWeekStart, 6), [selectedWeekStart]);
  const selectedMonthEnd = useMemo(() => endOfMonth(selectedMonth), [selectedMonth]);

  const monthTransactions = useMemo(
    () => transactions.filter((transaction) => inRange(transaction.timestamp, selectedMonth, selectedMonthEnd)),
    [transactions, selectedMonth, selectedMonthEnd],
  );

  const weekTransactions = useMemo(
    () => transactions.filter((transaction) => inRange(transaction.timestamp, selectedWeekStart, selectedWeekEnd)),
    [transactions, selectedWeekStart, selectedWeekEnd],
  );

  const dayTransactions = useMemo(
    () =>
      transactions
        .filter((transaction) => inRange(transaction.timestamp, selectedDay, selectedDay))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [transactions, selectedDay],
  );

  const monthRecurringCosts = useMemo(
    () => recurringCostsForMonth(shopExpenses, selectedMonth),
    [shopExpenses, selectedMonth],
  );

  const weekRecurringCosts = useMemo(
    () => recurringCostsForWeek(shopExpenses, selectedWeekStart),
    [shopExpenses, selectedWeekStart],
  );

  const monthMetrics = useMemo(() => {
    const sessionNet = sum(monthTransactions);
    const gross = sumGross(monthTransactions);
    const sessionFees = monthTransactions.reduce((total, transaction) => total + getTransactionFee(transaction), 0);
    const clients = new Set(
      monthTransactions
        .map((transaction) => (transaction.clientName ?? '').trim().toLowerCase())
        .filter((client) => client && client !== 'anonymous client'),
    );

    return {
      gross,
      sessionNet,
      sessionFees,
      recurringCosts: monthRecurringCosts,
      trueNet: Math.max(0, sessionNet - monthRecurringCosts),
      sessionCount: monthTransactions.length,
      clients: clients.size,
      average: monthTransactions.length ? sessionNet / monthTransactions.length : 0,
    };
  }, [monthTransactions, monthRecurringCosts]);

  const weekMetrics = useMemo(() => {
    const sessionNet = sum(weekTransactions);
    const gross = sumGross(weekTransactions);
    const sessionFees = weekTransactions.reduce((total, transaction) => total + getTransactionFee(transaction), 0);
    const trueNet = Math.max(0, sessionNet - weekRecurringCosts);

    return {
      gross,
      sessionNet,
      sessionFees,
      recurringCosts: weekRecurringCosts,
      trueNet,
      sessionCount: weekTransactions.length,
      average: weekTransactions.length ? sessionNet / weekTransactions.length : 0,
      goalProgress: weeklyGoal > 0 ? Math.min((trueNet / weeklyGoal) * 100, 100) : 0,
    };
  }, [weekTransactions, weekRecurringCosts, weeklyGoal]);

  const weekCards = useMemo(() => {
    const first = startOfWeek(selectedMonth);
    const last = startOfWeek(selectedMonthEnd);
    const cards: Array<{ start: Date; end: Date; sessions: number; gross: number; sessionNet: number; trueNet: number }> = [];

    for (let weekStart = first; weekStart.getTime() <= last.getTime(); weekStart = addDays(weekStart, 7)) {
      const weekEnd = addDays(weekStart, 6);
      const items = transactions.filter((transaction) => inRange(transaction.timestamp, weekStart, weekEnd));
      const sessionNet = sum(items);
      const recurringCosts = recurringCostsForWeek(shopExpenses, weekStart);

      cards.push({
        start: weekStart,
        end: weekEnd,
        sessions: items.length,
        gross: sumGross(items),
        sessionNet,
        trueNet: Math.max(0, sessionNet - recurringCosts),
      });
    }

    return cards;
  }, [transactions, selectedMonth, selectedMonthEnd, shopExpenses]);

  const selectedWeekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const date = addDays(selectedWeekStart, index);
        const items = transactions.filter((transaction) => inRange(transaction.timestamp, date, date));
        return { date, sessions: items.length, net: sum(items) };
      }),
    [transactions, selectedWeekStart],
  );

  const selectMonth = (nextMonth: Date) => {
    const month = startOfMonth(nextMonth);
    setSelectedMonth(month);
    const date = month.getTime() === startOfMonth(today).getTime() ? today : month;
    setSelectedWeekStart(startOfWeek(date));
    setSelectedDay(date);
  };

  const openNewTransaction = () => {
    setEditingTransaction(null);
    setTransactionForm(defaultTransactionForm());
    setIsTransactionModalOpen(true);
  };

  const openEditTransaction = (transaction: Transaction) => {
    const shopFeeType = getShopFeeType(transaction);
    setEditingTransaction(transaction);
    setTransactionForm({
      grossAmount: String(transaction.grossAmount),
      incomeType: transaction.incomeType,
      paymentMethod: transaction.paymentMethod,
      clientName: transaction.clientName ?? '',
      shopFeeType,
      shopCutPercentage: String(transaction.shopCutPercentage ?? 0),
      shopFixedFee: String(getShopFixedFee(transaction)),
      description: transaction.description ?? '',
    });
    setIsTransactionModalOpen(true);
  };

  const closeTransactionModal = () => {
    if (isSubmitting) return;
    setIsTransactionModalOpen(false);
    setEditingTransaction(null);
    setTransactionForm(defaultTransactionForm());
  };

  const submitTransaction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    const grossAmount = Number(transactionForm.grossAmount);
    const shopCutPercentage = Number(transactionForm.shopCutPercentage || 0);
    const shopFixedFee = Number(transactionForm.shopFixedFee || 0);

    if (!Number.isFinite(grossAmount) || grossAmount <= 0) {
      notify('error', 'Enter a valid gross amount.');
      return;
    }
    if (!Number.isFinite(shopCutPercentage) || shopCutPercentage < 0 || shopCutPercentage > 100) {
      notify('error', 'Shop split must be between 0% and 100%.');
      return;
    }
    if (!Number.isFinite(shopFixedFee) || shopFixedFee < 0 || shopFixedFee > grossAmount) {
      notify('error', 'Fixed shop fee must be between $0 and the gross amount.');
      return;
    }

    const isEditing = editingTransaction !== null;
    const timestamp = editingTransaction?.timestamp ?? new Date().toISOString();
    const nextTransaction: Transaction = {
      id: editingTransaction?.id ?? crypto.randomUUID(),
      timestamp,
      clientName: transactionForm.clientName.trim() || 'Anonymous Client',
      description: transactionForm.description.trim(),
      incomeType: transactionForm.incomeType,
      paymentMethod: transactionForm.paymentMethod,
      grossAmount,
      shopFeeType: transactionForm.shopFeeType,
      shopCutPercentage,
      shopFixedFee,
      netAmount: calculateNet(grossAmount, transactionForm.shopFeeType, shopCutPercentage, shopFixedFee),
    };

    const previous = [...transactions];
    const optimistic = isEditing
      ? transactions.map((item) => (item.id === nextTransaction.id ? nextTransaction : item))
      : [nextTransaction, ...transactions];

    setIsSubmitting(true);
    setTransactions(optimistic);
    setIsTransactionModalOpen(false);

    try {
      const response = await authFetch(
        isEditing ? `${API_URL}/${encodeURIComponent(nextTransaction.id)}` : API_URL,
        {
          method: isEditing ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(nextTransaction),
        },
      );

      const payload = (await response.json().catch(() => ({}))) as { error?: string; netAmount?: number };
      if (!response.ok) throw new Error(payload.error || 'Could not save session.');

      const saved = {
        ...nextTransaction,
        netAmount: typeof payload.netAmount === 'number' ? payload.netAmount : nextTransaction.netAmount,
      };

      const next = isEditing
        ? previous.map((item) => (item.id === saved.id ? saved : item))
        : [saved, ...previous];

      setTransactions(next);
      localStorage.setItem('inktrack_ledger', JSON.stringify(next));
      notify('success', isEditing ? 'Session updated.' : 'Session added.');
    } catch (error) {
      console.error(error);
      setTransactions(previous);
      notify('error', error instanceof Error ? error.message : 'Save failed. Changes were rolled back.');
    } finally {
      setIsSubmitting(false);
      setEditingTransaction(null);
      setTransactionForm(defaultTransactionForm());
    }
  };

  const deleteTransaction = async (transaction: Transaction) => {
    const name = transaction.clientName?.trim() || 'this session';
    if (!window.confirm(`Delete ${name}? This cannot be undone.`)) return;

    const previous = [...transactions];
    const next = transactions.filter((item) => item.id !== transaction.id);
    setTransactions(next);

    try {
      const response = await authFetch(`${API_URL}/${encodeURIComponent(transaction.id)}`, { method: 'DELETE' });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Could not delete session.');

      localStorage.setItem('inktrack_ledger', JSON.stringify(next));
      notify('success', 'Session deleted.');
    } catch (error) {
      console.error(error);
      setTransactions(previous);
      notify('error', error instanceof Error ? error.message : 'Delete failed. Session restored.');
    }
  };

  const openNewExpense = () => {
    setEditingExpense(null);
    setExpenseForm(defaultExpenseForm());
    setIsExpenseModalOpen(true);
  };

  const openEditExpense = (expense: ShopExpense) => {
    setEditingExpense(expense);
    setExpenseForm({
      name: expense.name,
      amount: String(expense.amount),
      frequency: expense.frequency,
      startsOn: expense.startsOn,
      endsOn: expense.endsOn ?? '',
    });
    setIsExpenseModalOpen(true);
  };

  const submitExpense = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    const amount = Number(expenseForm.amount);
    if (!expenseForm.name.trim() || !Number.isFinite(amount) || amount <= 0) {
      notify('error', 'Enter a name and a valid cost amount.');
      return;
    }

    const isEditing = editingExpense !== null;
    const payload = {
      name: expenseForm.name.trim(),
      amount,
      frequency: expenseForm.frequency,
      startsOn: expenseForm.startsOn,
      endsOn: expenseForm.endsOn || null,
    };

    setIsSubmitting(true);

    try {
      const base = `${API_URL.replace(/\/transactions$/, '')}/shop-expenses`;
      const response = await authFetch(isEditing ? `${base}/${encodeURIComponent(editingExpense.id)}` : base, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = (await response.json().catch(() => ({}))) as { error?: string; id?: string };
      if (!response.ok) throw new Error(result.error || 'Could not save shop cost.');

      await fetchEverything(true);
      notify('success', isEditing ? 'Shop cost updated.' : 'Shop cost added.');
      setIsExpenseModalOpen(false);
      setEditingExpense(null);
      setExpenseForm(defaultExpenseForm());
    } catch (error) {
      console.error(error);
      notify('error', error instanceof Error ? error.message : 'Could not save shop cost.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteExpense = async (expense: ShopExpense) => {
    if (!window.confirm(`Delete ${expense.name}? This cannot be undone.`)) return;

    const previous = [...shopExpenses];
    setShopExpenses((items) => items.filter((item) => item.id !== expense.id));

    try {
      const response = await authFetch(
        `${API_URL.replace(/\/transactions$/, '')}/shop-expenses/${encodeURIComponent(expense.id)}`,
        { method: 'DELETE' },
      );
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Could not delete shop cost.');
      notify('success', 'Shop cost deleted.');
    } catch (error) {
      console.error(error);
      setShopExpenses(previous);
      notify('error', error instanceof Error ? error.message : 'Could not delete shop cost.');
    }
  };

  const exportLedger = () => {
    const blob = new Blob([JSON.stringify(transactions, null, 2)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = `inktrack_ledger_${toDateKey(new Date())}.json`;
    anchor.click();
    URL.revokeObjectURL(href);
    notify('success', 'Ledger backup exported.');
  };

  const importLedger = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const input = event.target;
    const reader = new FileReader();

    reader.onload = async (loadEvent) => {
      try {
        const parsed: unknown = JSON.parse(loadEvent.target?.result as string);
        if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Choose a non-empty InkTrack JSON backup.');

        if (!window.confirm(`Restore ${parsed.length} session(s) to the cloud ledger? Existing matching IDs are updated.`)) return;

        const response = await authFetch(`${API_URL}/import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transactions: parsed }),
        });

        const result = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
        if (!response.ok) throw new Error(result.error || 'Could not restore backup.');

        await fetchEverything(true);
        notify('success', result.message || 'Ledger restored.');
      } catch (error) {
        console.error(error);
        notify('error', error instanceof Error ? error.message : 'Could not import backup.');
      } finally {
        input.value = '';
      }
    };

    reader.readAsText(file);
  };

  const logout = () => {
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
          <div className={`fixed right-5 top-5 z-[70] flex items-center gap-2 rounded-md border px-4 py-3 shadow-xl ${
            statusMessage.type === 'success'
              ? 'border-[#3F6B62]/40 bg-[#EFE7D8] text-[#2F544A]'
              : 'border-[#A83A2C]/40 bg-[#EFE7D8] text-[#A83A2C]'
          }`}>
            {statusMessage.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <span className="font-mono-ledger text-xs font-semibold">{statusMessage.text}</span>
          </div>
        )}

        <nav className="sticky top-0 z-40 flex items-center justify-between border-b border-[#EFE7D8]/10 bg-[#16130F]/95 px-4 py-4 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#C39A48] bg-[#A83A2C] font-display text-base">i</div>
            <span className="font-display text-lg tracking-wide">inktrack<span className="text-[#C39A48]">.</span><span className="ml-1 align-middle font-mono-ledger text-[10px] uppercase tracking-widest text-[#EFE7D8]/50">Console</span></span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button onClick={() => void fetchEverything(true)} title="Refresh ledger" className="rounded-md p-2.5 text-[#EFE7D8]/50 hover:text-[#C39A48]">
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-[#C39A48]' : ''}`} />
            </button>
            <button onClick={openNewTransaction} className="flex items-center gap-2 rounded-md bg-[#A83A2C] px-3 py-2.5 text-sm font-bold text-[#EFE7D8] shadow-md transition-colors hover:bg-[#c04430] sm:px-4">
              <Plus className="h-4 w-4 stroke-[3]" /><span className="hidden sm:inline">Log Session</span><span className="sm:hidden">Log</span>
            </button>
            <button onClick={logout} title="Sign out" className="rounded-md p-2.5 text-[#EFE7D8]/50 hover:text-[#A83A2C]"><LogOut className="h-5 w-5" /></button>
          </div>
        </nav>

        <main className="mx-auto max-w-7xl space-y-8 px-4 py-7 sm:px-6 sm:py-10">
          <section className="space-y-4">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <p className="font-mono-ledger text-[10px] font-semibold uppercase tracking-[0.2em] text-[#C39A48]">Artist Revenue Planner</p>
                <h1 className="mt-1 font-display text-3xl sm:text-4xl">Month → Week → Day</h1>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#EFE7D8]/55">Session income, shop splits, booth rent, and operating costs in one ledger.</p>
              </div>

              <div className="flex items-center gap-2 self-start rounded-sm border border-[#EFE7D8]/10 bg-[#EFE7D8]/[0.04] p-1 md:self-auto">
                <button onClick={() => selectMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1))} className="rounded-sm p-2 text-[#EFE7D8]/65 hover:text-[#C39A48]"><ChevronLeft className="h-4 w-4" /></button>
                <button onClick={() => selectMonth(today)} className="min-w-[130px] rounded-sm px-3 py-2 font-mono-ledger text-xs font-semibold uppercase tracking-wide">{selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</button>
                <button onClick={() => selectMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1))} className="rounded-sm p-2 text-[#EFE7D8]/65 hover:text-[#C39A48]"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              {[
                { label: 'True month net', value: money(monthMetrics.trueNet), caption: 'After shop costs', icon: Wallet, emphasis: true },
                { label: 'Selected week', value: money(weekMetrics.trueNet), caption: getWeekLabel(selectedWeekStart), icon: CalendarDays },
                { label: 'Session income', value: money(monthMetrics.sessionNet), caption: 'After session fees', icon: TrendingUp },
                { label: 'Shop costs', value: money(monthMetrics.sessionFees + monthMetrics.recurringCosts), caption: 'Splits + rent + costs', icon: Landmark },
                { label: 'Month clients', value: String(monthMetrics.clients), caption: `${monthMetrics.sessionCount} sessions`, icon: Users },
                { label: 'Avg. session', value: money(monthMetrics.average), caption: 'Net before recurring costs', icon: ReceiptText },
              ].map((card) => {
                const Icon = card.icon;
                return (
                  <div key={card.label} className={`rounded-sm border p-4 shadow-lg ${card.emphasis ? 'border-[#A83A2C] bg-[#EFE7D8]' : 'border-[#EFE7D8]/15 bg-[#EFE7D8]/95'}`}>
                    <div className="mb-3 flex items-center justify-between"><span className="font-mono-ledger text-[10px] uppercase tracking-wide text-[#16130F]/50">{card.label}</span><Icon className={`h-4 w-4 ${card.emphasis ? 'text-[#A83A2C]' : 'text-[#2F544A]'}`} /></div>
                    <p className={`font-mono-ledger text-xl font-bold ${card.emphasis ? 'text-[#A83A2C]' : 'text-[#16130F]'}`}>{card.value}</p>
                    <p className="mt-1 text-[10px] text-[#16130F]/50">{card.caption}</p>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
            <div className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div><h2 className="font-mono-ledger text-[11px] font-semibold uppercase tracking-[0.15em] text-[#C39A48]">Weekly Overview</h2><p className="mt-1 text-sm text-[#EFE7D8]/50">Choose a week to see sessions, daily detail, and booth costs.</p></div>
                <span className="rounded-sm border border-[#C39A48]/35 bg-[#C39A48]/10 px-3 py-1.5 font-mono-ledger text-[10px] uppercase tracking-wide text-[#C39A48]">{monthMetrics.sessionCount} sessions this month</span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {weekCards.map((week) => {
                  const selected = sameDay(week.start, selectedWeekStart);
                  return (
                    <button key={toDateKey(week.start)} type="button" onClick={() => { setSelectedWeekStart(week.start); setSelectedDay(week.start); }} className={`group rounded-sm border p-4 text-left transition-all ${selected ? 'border-[#A83A2C] bg-[#EFE7D8] shadow-xl' : 'border-[#EFE7D8]/15 bg-[#EFE7D8]/[0.05] hover:-translate-y-0.5 hover:border-[#C39A48]/50 hover:bg-[#EFE7D8]/10'}`}>
                      <div className="flex justify-between gap-3"><p className={`font-mono-ledger text-[10px] font-semibold uppercase tracking-wide ${selected ? 'text-[#A83A2C]' : 'text-[#C39A48]'}`}>{getWeekLabel(week.start)}</p><ArrowRight className={`h-4 w-4 ${selected ? 'text-[#A83A2C]' : 'text-[#EFE7D8]/40'}`} /></div>
                      <p className={`mt-5 font-mono-ledger text-2xl font-bold ${selected ? 'text-[#16130F]' : 'text-[#EFE7D8]'}`}>{money(week.trueNet)}</p>
                      <p className={`mt-1 text-xs ${selected ? 'text-[#16130F]/55' : 'text-[#EFE7D8]/55'}`}>{week.sessions} sessions · Gross {money(week.gross)}</p>
                      <p className={`mt-4 border-t pt-3 font-mono-ledger text-[10px] ${selected ? 'border-[#16130F]/10 text-[#16130F]/45' : 'border-[#EFE7D8]/10 text-[#EFE7D8]/45'}`}>Session net {money(week.sessionNet)}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <aside className="space-y-4">
              <div className="rounded-sm border border-[#C39A48]/30 bg-[#EFE7D8] p-5 text-[#16130F] shadow-lg">
                <div className="flex items-center justify-between gap-3"><div><p className="font-mono-ledger text-[10px] font-semibold uppercase tracking-[0.15em] text-[#A83A2C]">Weekly Target</p><h2 className="mt-1 font-display text-xl">True Take-home</h2></div><Target className="h-6 w-6 text-[#A83A2C]" /></div>
                <div className="mt-5 flex items-end justify-between gap-3"><div><p className="font-mono-ledger text-2xl font-bold text-[#2F544A]">{money(weekMetrics.trueNet)}</p><p className="mt-1 text-xs text-[#16130F]/55">after {money(weekMetrics.recurringCosts)} recurring shop costs</p></div><label className="w-28"><span className="mb-1 block font-mono-ledger text-[9px] uppercase tracking-wide text-[#16130F]/45">Goal</span><input type="number" min="0" step="50" value={weeklyGoal} onChange={(event) => setWeeklyGoal(Math.max(0, Number(event.target.value) || 0))} className="w-full rounded-sm border border-[#16130F]/15 bg-white px-2 py-1.5 font-mono-ledger text-xs font-bold focus:border-[#A83A2C] focus:outline-none" /></label></div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#16130F]/10"><div className="h-full rounded-full bg-[#A83A2C] transition-[width] duration-500" style={{ width: `${weekMetrics.goalProgress}%` }} /></div>
                <p className="mt-2 font-mono-ledger text-[10px] text-[#16130F]/50">{weeklyGoal <= 0 ? 'Set a goal to measure progress.' : weekMetrics.trueNet >= weeklyGoal ? 'Target reached — great week.' : `${money(weeklyGoal - weekMetrics.trueNet)} remaining.`}</p>
              </div>

              <div className="rounded-sm bg-[#EFE7D8] p-5 text-[#16130F] shadow-lg">
                <div className="flex items-start justify-between gap-3"><div><p className="font-mono-ledger text-[10px] font-semibold uppercase tracking-[0.15em] text-[#16130F]/45">Shop Costs</p><p className="mt-1 text-xs text-[#16130F]/55">Booth rent, supply costs, and fixed shop charges.</p></div><button onClick={openNewExpense} className="rounded-sm border border-[#A83A2C]/35 px-2 py-1.5 text-[#A83A2C] hover:bg-[#A83A2C]/10"><Plus className="h-3.5 w-3.5" /></button></div>
                <div className="mt-4 space-y-3">
                  {shopExpenses.length === 0 ? <p className="text-sm text-[#16130F]/50">No recurring shop costs yet. Add booth rent if you pay a weekly or monthly chair fee.</p> : shopExpenses.slice(0, 4).map((expense) => (
                    <div key={expense.id} className="flex items-center justify-between gap-2 border-b border-dashed border-[#16130F]/15 pb-3 text-xs last:border-0 last:pb-0">
                      <div><p className="font-semibold">{expense.name}</p><p className="font-mono-ledger text-[10px] text-[#16130F]/45">{EXPENSE_FREQUENCY_LABELS[expense.frequency]} · starts {expense.startsOn}</p></div>
                      <div className="flex items-center gap-1"><span className="font-mono-ledger font-bold">{money(expense.amount)}</span><button onClick={() => openEditExpense(expense)} className="rounded p-1 text-[#16130F]/45 hover:text-[#8A6A2F]"><Pencil className="h-3.5 w-3.5" /></button><button onClick={() => void deleteExpense(expense)} className="rounded p-1 text-[#16130F]/45 hover:text-[#A83A2C]"><Trash2 className="h-3.5 w-3.5" /></button></div>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
            <div className="overflow-hidden rounded-sm bg-[#EFE7D8] text-[#16130F] shadow-lg">
              <div className="border-b border-dashed border-[#16130F]/15 px-5 py-5 sm:px-6">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><p className="font-mono-ledger text-[10px] font-semibold uppercase tracking-[0.15em] text-[#A83A2C]">Week Detail</p><h2 className="mt-1 font-display text-2xl">{getWeekLabel(selectedWeekStart)}</h2><p className="mt-1 text-sm text-[#16130F]/55">{weekMetrics.sessionCount} sessions · {money(weekMetrics.gross)} gross · {money(weekMetrics.sessionFees)} session fees</p></div><div className="rounded-sm bg-[#16130F] px-3 py-2 text-right text-[#EFE7D8]"><p className="font-mono-ledger text-[9px] uppercase tracking-wide text-[#EFE7D8]/50">Take-home</p><p className="font-mono-ledger text-lg font-bold">{money(weekMetrics.trueNet)}</p></div></div>
              </div>

              <div className="grid grid-cols-7 divide-x divide-[#16130F]/10 border-b border-dashed border-[#16130F]/15">
                {selectedWeekDays.map((day) => {
                  const active = sameDay(day.date, selectedDay);
                  return <button key={toDateKey(day.date)} type="button" onClick={() => setSelectedDay(day.date)} className={`min-h-[128px] p-2 text-left sm:p-3 ${active ? 'bg-[#A83A2C] text-[#EFE7D8]' : 'hover:bg-[#16130F]/[0.04]'}`}><span className={`font-mono-ledger text-[9px] uppercase tracking-wide ${active ? 'text-[#EFE7D8]/65' : 'text-[#16130F]/45'}`}>{day.date.toLocaleDateString('en-US', { weekday: 'short' })}</span><p className="mt-2 font-mono-ledger text-lg font-bold">{day.date.getDate()}</p><p className={`mt-6 hidden font-mono-ledger text-sm font-bold sm:block ${active ? 'text-[#EFE7D8]' : 'text-[#2F544A]'}`}>{money(day.net)}</p><p className={`mt-1 hidden text-[9px] sm:block ${active ? 'text-[#EFE7D8]/65' : 'text-[#16130F]/45'}`}>{day.sessions} sessions</p></button>;
                })}
              </div>

              <div className="p-5 sm:p-6">
                <div className="flex flex-col justify-between gap-3 border-b border-dashed border-[#16130F]/15 pb-4 sm:flex-row sm:items-end"><div><p className="font-mono-ledger text-[10px] font-semibold uppercase tracking-[0.15em] text-[#A83A2C]">Day Ledger</p><h3 className="mt-1 font-display text-xl">{dayName}</h3></div><div className="font-mono-ledger text-xs"><span className="text-[#16130F]/45">Sessions </span><b>{dayTransactions.length}</b> <span className="ml-3 text-[#16130F]/45">Net </span><b className="text-[#2F544A]">{money(sum(dayTransactions))}</b></div></div>

                {isLoading ? <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-[#16130F]/50"><RefreshCw className="h-5 w-5 animate-spin text-[#A83A2C]" /><span className="font-mono-ledger text-xs">Syncing ledger…</span></div> :
                  dayTransactions.length === 0 ? <div className="flex min-h-48 flex-col items-center justify-center text-center"><CalendarDays className="h-7 w-7 text-[#16130F]/25" /><p className="mt-3 text-sm font-semibold text-[#16130F]/60">No sessions on this day.</p><p className="mt-1 text-xs text-[#16130F]/45">Select another day, or log a new session.</p></div> :
                    <div className="divide-y divide-dashed divide-[#16130F]/15">{dayTransactions.map((transaction) => (
                      <div key={transaction.id} className="flex items-center justify-between gap-4 py-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-bold">{transaction.clientName || 'Anonymous Client'}</p><span className={`rounded-full border px-2 py-0.5 font-mono-ledger text-[9px] font-semibold uppercase tracking-wide ${INCOME_TAG_STYLES[transaction.incomeType]}`}>{transaction.incomeType}</span></div><div className="mt-1 flex flex-wrap items-center gap-2"><p className="max-w-[240px] truncate text-xs text-[#16130F]/55">{transaction.description || 'No session note'}</p><span className="rounded bg-[#16130F] px-1.5 py-0.5 font-mono-ledger text-[9px] uppercase tracking-wide text-[#EFE7D8]">{PAYMENT_LABELS[transaction.paymentMethod]}</span></div><p className="mt-1.5 font-mono-ledger text-[10px] text-[#16130F]/40">{SHOP_FEE_LABELS[getShopFeeType(transaction)]} · {new Date(transaction.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p></div><div className="flex shrink-0 items-center gap-2"><div className="text-right"><p className="font-mono-ledger text-sm font-bold text-[#2F544A]">+{money(transaction.netAmount)}</p><p className="mt-1 font-mono-ledger text-[10px] text-[#16130F]/40">Gross {money(transaction.grossAmount)} · Fee {money(getTransactionFee(transaction))}</p></div><div className="flex flex-col gap-1 border-l border-[#16130F]/10 pl-2"><button onClick={() => openEditTransaction(transaction)} className="rounded p-1.5 text-[#16130F]/45 hover:bg-[#C39A48]/15 hover:text-[#8A6A2F]"><Pencil className="h-3.5 w-3.5" /></button><button onClick={() => void deleteTransaction(transaction)} className="rounded p-1.5 text-[#16130F]/45 hover:bg-[#A83A2C]/10 hover:text-[#A83A2C]"><Trash2 className="h-3.5 w-3.5" /></button></div></div></div>
                    ))}</div>}
              </div>
            </div>

            <aside className="space-y-4">
              <div className="rounded-sm bg-[#EFE7D8] p-5 text-[#16130F] shadow-lg"><h2 className="font-mono-ledger text-[10px] font-semibold uppercase tracking-[0.15em] text-[#16130F]/45">Monthly Health</h2><div className="mt-4 space-y-4"><div className="flex justify-between border-b border-dashed border-[#16130F]/15 pb-3 text-xs"><span className="flex items-center gap-1.5 text-[#16130F]/60"><Wallet className="h-3.5 w-3.5" /> Total gross</span><b className="font-mono-ledger">{money(monthMetrics.gross)}</b></div><div className="flex justify-between border-b border-dashed border-[#16130F]/15 pb-3 text-xs"><span className="flex items-center gap-1.5 text-[#16130F]/60"><Percent className="h-3.5 w-3.5" /> Session shop fees</span><b className="font-mono-ledger text-[#A83A2C]">{money(monthMetrics.sessionFees)}</b></div><div className="flex justify-between border-b border-dashed border-[#16130F]/15 pb-3 text-xs"><span className="flex items-center gap-1.5 text-[#16130F]/60"><Landmark className="h-3.5 w-3.5" /> Recurring costs</span><b className="font-mono-ledger text-[#A83A2C]">{money(monthMetrics.recurringCosts)}</b></div><div className="flex justify-between text-xs"><span className="flex items-center gap-1.5 text-[#16130F]/60"><TrendingUp className="h-3.5 w-3.5" /> True take-home</span><b className="font-mono-ledger text-[#2F544A]">{money(monthMetrics.trueNet)}</b></div></div></div>

              <div className="rounded-sm bg-[#EFE7D8] p-5 text-[#16130F] shadow-lg"><h2 className="font-mono-ledger text-[10px] font-semibold uppercase tracking-[0.15em] text-[#16130F]/45">Data Operations</h2><p className="mt-2 text-xs leading-relaxed text-[#16130F]/60">Export a full session backup, or restore a backup into your cloud ledger.</p><div className="mt-4 grid grid-cols-2 gap-3"><button onClick={exportLedger} className="flex items-center justify-center gap-2 rounded-sm border border-[#16130F]/15 py-2.5 text-xs font-semibold hover:border-[#16130F]/30"><Download className="h-3.5 w-3.5 text-[#2F544A]" /> Export</button><button onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-2 rounded-sm border border-[#16130F]/15 py-2.5 text-xs font-semibold hover:border-[#16130F]/30"><Upload className="h-3.5 w-3.5 text-[#2F544A]" /> Import</button></div><input ref={fileInputRef} type="file" accept=".json" onChange={importLedger} className="hidden" /></div>
            </aside>
          </section>
        </main>

        {isTransactionModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#16130F]/85 p-4 backdrop-blur-sm sm:items-center"><div className="max-h-[90vh] w-full max-w-lg space-y-5 overflow-y-auto rounded-t-sm bg-[#EFE7D8] p-6 text-[#16130F] shadow-2xl sm:rounded-sm"><div className="flex items-center justify-between border-b border-dashed border-[#16130F]/15 pb-4"><div><p className="mb-1 font-mono-ledger text-[10px] uppercase tracking-[0.2em] text-[#16130F]/40">{editingTransaction ? 'Edit Entry' : 'New Entry'}</p><h2 className="font-display text-2xl">{editingTransaction ? 'Update Session' : 'Session Ticket'}</h2></div><button onClick={closeTransactionModal} className="rounded p-1 text-[#16130F]/40 hover:text-[#16130F]"><X className="h-5 w-5" /></button></div>
            <form onSubmit={submitTransaction} className="space-y-4">
              <div><label className="mb-2 block font-mono-ledger text-[11px] font-semibold uppercase tracking-wider text-[#16130F]/50">Gross Amount Collected</label><div className="relative"><DollarSign className="pointer-events-none absolute left-4 top-3.5 h-5 w-5 text-[#A83A2C]" /><input type="number" inputMode="decimal" min="0" step="0.01" required autoFocus value={transactionForm.grossAmount} onChange={(event) => setTransactionForm((form) => ({ ...form, grossAmount: event.target.value }))} placeholder="0.00" className="w-full rounded-sm border border-[#16130F]/15 bg-white py-3.5 pl-12 pr-4 font-mono-ledger text-lg font-bold focus:border-[#A83A2C] focus:outline-none" /></div></div>
              <div className="grid grid-cols-2 gap-3"><div><label className="mb-2 block font-mono-ledger text-[11px] font-semibold uppercase tracking-wider text-[#16130F]/50">Category</label><select value={transactionForm.incomeType} onChange={(event) => setTransactionForm((form) => ({ ...form, incomeType: event.target.value as IncomeType }))} className="w-full rounded-sm border border-[#16130F]/15 bg-white p-3 text-sm focus:border-[#A83A2C] focus:outline-none"><option value="appointment">Appointment</option><option value="walk-in">Walk-In</option><option value="deposit">Deposit</option><option value="tip">Direct Tip</option></select></div><div><label className="mb-2 block font-mono-ledger text-[11px] font-semibold uppercase tracking-wider text-[#16130F]/50">Channel</label><select value={transactionForm.paymentMethod} onChange={(event) => setTransactionForm((form) => ({ ...form, paymentMethod: event.target.value as PaymentMethod }))} className="w-full rounded-sm border border-[#16130F]/15 bg-white p-3 text-sm focus:border-[#A83A2C] focus:outline-none"><option value="cash">Cash (Efectivo)</option><option value="ath-movil">ATH Móvil</option><option value="card">Card</option><option value="zelle">Zelle</option><option value="venmo">Venmo</option><option value="paypal">PayPal</option></select></div></div>
              <div><label className="mb-2 block font-mono-ledger text-[11px] font-semibold uppercase tracking-wider text-[#16130F]/50">Shop Agreement</label><select value={transactionForm.shopFeeType} onChange={(event) => setTransactionForm((form) => ({ ...form, shopFeeType: event.target.value as ShopFeeType }))} className="w-full rounded-sm border border-[#16130F]/15 bg-white p-3 text-sm focus:border-[#A83A2C] focus:outline-none"><option value="percentage">Percentage split</option><option value="fixed">Fixed fee per session</option><option value="booth-rent">Booth / chair rent</option><option value="hybrid">Hybrid: split + fixed fee</option><option value="none">No shop fee</option></select><p className="mt-1.5 text-[11px] text-[#16130F]/45">{transactionForm.shopFeeType === 'booth-rent' ? 'This session keeps 100%. Add the weekly/monthly rent under Shop Costs.' : transactionForm.shopFeeType === 'none' ? 'No session-level shop fee will be deducted.' : 'The fee is calculated on this session only.'}</p></div>
              {(transactionForm.shopFeeType === 'percentage' || transactionForm.shopFeeType === 'hybrid') && <div><label className="mb-2 block font-mono-ledger text-[11px] font-semibold uppercase tracking-wider text-[#16130F]/50">Shop Split %</label><input type="number" min="0" max="100" step="0.01" value={transactionForm.shopCutPercentage} onChange={(event) => setTransactionForm((form) => ({ ...form, shopCutPercentage: event.target.value }))} className="w-full rounded-sm border border-[#16130F]/15 bg-white p-3 font-mono-ledger text-sm focus:border-[#A83A2C] focus:outline-none" /></div>}
              {(transactionForm.shopFeeType === 'fixed' || transactionForm.shopFeeType === 'hybrid') && <div><label className="mb-2 block font-mono-ledger text-[11px] font-semibold uppercase tracking-wider text-[#16130F]/50">Fixed Shop Fee</label><div className="relative"><DollarSign className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#A83A2C]" /><input type="number" min="0" step="0.01" value={transactionForm.shopFixedFee} onChange={(event) => setTransactionForm((form) => ({ ...form, shopFixedFee: event.target.value }))} className="w-full rounded-sm border border-[#16130F]/15 bg-white py-3 pl-9 pr-3 font-mono-ledger text-sm focus:border-[#A83A2C] focus:outline-none" /></div></div>}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div><label className="mb-2 block font-mono-ledger text-[11px] font-semibold uppercase tracking-wider text-[#16130F]/50">Client</label><input type="text" value={transactionForm.clientName} onChange={(event) => setTransactionForm((form) => ({ ...form, clientName: event.target.value }))} placeholder="Marcus M." className="w-full rounded-sm border border-[#16130F]/15 bg-white p-3 text-sm focus:border-[#A83A2C] focus:outline-none" /></div><div className="rounded-sm bg-[#16130F]/[0.04] p-3"><p className="font-mono-ledger text-[10px] uppercase tracking-wide text-[#16130F]/45">Estimated take-home</p><p className="mt-1 font-mono-ledger text-lg font-bold text-[#2F544A]">{money(calculateNet(Number(transactionForm.grossAmount) || 0, transactionForm.shopFeeType, Number(transactionForm.shopCutPercentage) || 0, Number(transactionForm.shopFixedFee) || 0))}</p></div></div>
              <div><label className="mb-2 block font-mono-ledger text-[11px] font-semibold uppercase tracking-wider text-[#16130F]/50">Session Notes</label><textarea value={transactionForm.description} onChange={(event) => setTransactionForm((form) => ({ ...form, description: event.target.value }))} rows={2} placeholder="e.g. Linework completed, shading scheduled next month." className="w-full rounded-sm border border-[#16130F]/15 bg-white p-3 text-sm focus:border-[#A83A2C] focus:outline-none" /></div>
              <button type="submit" disabled={isSubmitting} className="flex w-full items-center justify-center gap-2 rounded-sm bg-[#A83A2C] py-4 text-sm font-bold text-[#EFE7D8] shadow-lg hover:bg-[#c04430] disabled:bg-[#16130F]/20">{isSubmitting ? <><RefreshCw className="h-4 w-4 animate-spin" />{editingTransaction ? 'Saving changes…' : 'Stamping entry…'}</> : editingTransaction ? 'Save Session Changes' : 'Commit Session Entry'}</button>
            </form>
          </div></div>
        )}

        {isExpenseModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#16130F]/85 p-4 backdrop-blur-sm sm:items-center"><div className="w-full max-w-md rounded-sm bg-[#EFE7D8] p-6 text-[#16130F] shadow-2xl"><div className="flex items-center justify-between border-b border-dashed border-[#16130F]/15 pb-4"><div><p className="mb-1 font-mono-ledger text-[10px] uppercase tracking-[0.2em] text-[#16130F]/40">{editingExpense ? 'Edit Shop Cost' : 'New Shop Cost'}</p><h2 className="font-display text-2xl">{editingExpense ? 'Update Cost' : 'Add Booth / Shop Cost'}</h2></div><button onClick={() => !isSubmitting && setIsExpenseModalOpen(false)} className="rounded p-1 text-[#16130F]/40 hover:text-[#16130F]"><X className="h-5 w-5" /></button></div>
            <form onSubmit={submitExpense} className="mt-5 space-y-4"><div><label className="mb-2 block font-mono-ledger text-[11px] font-semibold uppercase tracking-wider text-[#16130F]/50">Cost Name</label><input value={expenseForm.name} onChange={(event) => setExpenseForm((form) => ({ ...form, name: event.target.value }))} placeholder="Weekly booth rent" className="w-full rounded-sm border border-[#16130F]/15 bg-white p-3 text-sm focus:border-[#A83A2C] focus:outline-none" /></div><div className="grid grid-cols-2 gap-3"><div><label className="mb-2 block font-mono-ledger text-[11px] font-semibold uppercase tracking-wider text-[#16130F]/50">Amount</label><input type="number" min="0" step="0.01" value={expenseForm.amount} onChange={(event) => setExpenseForm((form) => ({ ...form, amount: event.target.value }))} className="w-full rounded-sm border border-[#16130F]/15 bg-white p-3 font-mono-ledger text-sm focus:border-[#A83A2C] focus:outline-none" /></div><div><label className="mb-2 block font-mono-ledger text-[11px] font-semibold uppercase tracking-wider text-[#16130F]/50">Frequency</label><select value={expenseForm.frequency} onChange={(event) => setExpenseForm((form) => ({ ...form, frequency: event.target.value as ShopExpenseFrequency }))} className="w-full rounded-sm border border-[#16130F]/15 bg-white p-3 text-sm focus:border-[#A83A2C] focus:outline-none"><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="one-time">One-time</option></select></div></div><div className="grid grid-cols-2 gap-3"><div><label className="mb-2 block font-mono-ledger text-[11px] font-semibold uppercase tracking-wider text-[#16130F]/50">{expenseForm.frequency === 'one-time' ? 'Date Paid' : 'Starts On'}</label><input type="date" value={expenseForm.startsOn} onChange={(event) => setExpenseForm((form) => ({ ...form, startsOn: event.target.value }))} className="w-full rounded-sm border border-[#16130F]/15 bg-white p-3 text-sm focus:border-[#A83A2C] focus:outline-none" /></div><div><label className="mb-2 block font-mono-ledger text-[11px] font-semibold uppercase tracking-wider text-[#16130F]/50">Ends On (optional)</label><input type="date" value={expenseForm.endsOn} onChange={(event) => setExpenseForm((form) => ({ ...form, endsOn: event.target.value }))} className="w-full rounded-sm border border-[#16130F]/15 bg-white p-3 text-sm focus:border-[#A83A2C] focus:outline-none" /></div></div><button type="submit" disabled={isSubmitting} className="flex w-full items-center justify-center gap-2 rounded-sm bg-[#A83A2C] py-3.5 text-sm font-bold text-[#EFE7D8] hover:bg-[#c04430] disabled:bg-[#16130F]/20">{isSubmitting ? <><RefreshCw className="h-4 w-4 animate-spin" />Saving…</> : editingExpense ? 'Save Shop Cost' : 'Add Shop Cost'}</button></form>
          </div></div>
        )}
      </div>
    </div>
  );
}
