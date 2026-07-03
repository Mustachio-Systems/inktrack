export type IncomeType = 'appointment' | 'walk-in' | 'deposit' | 'tip';

export type PaymentMethod =
  | 'cash'
  | 'card'
  | 'ath-movil'
  | 'zelle'
  | 'venmo'
  | 'paypal';

export type ShopFeeType =
  | 'percentage'
  | 'fixed'
  | 'booth-rent'
  | 'hybrid'
  | 'none';

export type ShopExpenseFrequency = 'weekly' | 'monthly' | 'one-time';

export interface Transaction {
  id: string;
  timestamp: string;
  clientName?: string;
  description?: string | null;
  incomeType: IncomeType;
  paymentMethod: PaymentMethod;
  grossAmount: number;
  shopFeeType?: ShopFeeType;
  shopCutPercentage: number;
  shopFixedFee?: number;
  netAmount: number;
}

export interface ShopExpense {
  id: string;
  name: string;
  amount: number;
  frequency: ShopExpenseFrequency;
  startsOn: string;
  endsOn: string | null;
  createdAt?: string;
}
