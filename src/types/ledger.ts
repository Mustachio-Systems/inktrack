export type IncomeType = 'appointment' | 'walk-in' | 'deposit' | 'tip';

// Fully updated to capture PR and global transaction vectors natively
export type PaymentMethod = 'cash' | 'card' | 'ath-movil' | 'zelle' | 'venmo' | 'paypal';

export interface Transaction {
  id: string;
  timestamp: string; 
  clientName?: string;
  description?: string;
  incomeType: IncomeType;
  paymentMethod: PaymentMethod;
  grossAmount: number;
  shopCutPercentage: number; 
  netAmount: number; 
}

export interface DashboardMetrics {
  currentHour: number;
  daily: number;
  weekly: number;
  biWeekly: number;
  monthly: number;
  threeMonth: number;
  yearly: number;
}