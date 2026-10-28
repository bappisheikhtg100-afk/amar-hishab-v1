export type AppTab = 'home' | 'income-expense' | 'debt' | 'budget' | 'more';

export type MoreSubView =
  | 'hub'
  | 'calculator'
  | 'todos'
  | 'contacts'
  | 'savings'
  | 'bills'
  | 'reports'
  | 'security'
  | 'settings';

export type TransactionType = 'income' | 'expense';

export type NumeralSystem = 'bn' | 'en';

export type ThemeMode = 'light' | 'dark';

export type CardTheme =
  | 'emerald'
  | 'mint'
  | 'obsidian'
  | 'royal'
  | 'burgundy'
  | 'bronze'
  | 'amethyst'
  | 'ocean'
  | 'platinum';

export interface AppSettings {
  theme: ThemeMode;
  numerals: NumeralSystem;
  cardTheme: CardTheme;
}

export interface Transaction {
  id: number;
  amount: number;
  type: TransactionType;
  note: string;
  category?: string;
  time: string;
  timestamp?: number;
  monthKey: string;
}

export type DebtTransactionType = 'debt' | 'credit';

export interface DebtTransaction {
  id: number;
  type: DebtTransactionType;
  amount: number;
  note: string;
  time: string;
  timestamp?: number;
}

export interface DebtProfile {
  id: number;
  name: string;
  phone: string;
  address: string;
  debt: number;
  credit: number;
  transactions: DebtTransaction[];
}

export interface BudgetItem {
  id: number;
  name: string;
  cost: number;
  bought: boolean;
}

export interface Budget {
  id: number;
  name: string;
  limit?: number;
  loggedToExpense?: boolean;
  items: BudgetItem[];
}

export interface CategoryOption {
  id: string;
  label: string;
  type: TransactionType;
}

export type TodoPriority = 'normal' | 'high' | 'urgent';

export interface ScheduledTodo {
  id: number;
  title: string;
  note: string;
  scheduledAt: string; // ISO or YYYY-MM-DDTHH:mm
  priority: TodoPriority;
  completed: boolean;
  notified: boolean;
  createdAt: number;
}

export interface SavingsEntry {
  id: number;
  amount: number;
  type: 'deposit' | 'withdraw';
  note: string;
  time: string;
}

export interface SavingsGoal {
  id: number;
  name: string;
  targetAmount: number;
  savedAmount: number;
  deadline?: string;
  entries: SavingsEntry[];
}

export interface RecurringBill {
  id: number;
  name: string;
  amount: number;
  dueDay: number; // 1..31
  category: string;
  paidMonths: string[]; // e.g. ['2026-10']
}

export interface ContactItem {
  id: string;
  name: string;
  phone: string;
  secondaryPhone?: string;
  email?: string;
  address?: string;
  organization?: string;
  bloodGroup?: string;
  notes?: string;
  group: string;
  subGroup: string;
  photoDataUrl?: string;
  createdAt: number;
}

export interface AppSecurityConfig {
  enabled: boolean;
  pinHash: string;
  saltHex?: string;
  version?: number;
  autoLockSeconds?: number;
  question1: string;
  answer1Hash: string;
  question2: string;
  answer2Hash: string;
}

export type VaultItemType = 'image' | 'video' | 'document' | 'note';

export interface VaultDecryptedMeta {
  title: string;
  fileName?: string;
  noteBody?: string;
  updatedAt?: number;
  source?: 'camera' | 'device';
}

export interface VaultStoredRecord {
  id: string;
  type: VaultItemType;
  mimeType: string;
  sizeBytes: number;
  createdAt: number;
  iv: Uint8Array;
  encryptedMeta: ArrayBuffer;
  encryptedPayload?: ArrayBuffer;
}

export interface VaultConfig {
  pinHash: string;
  saltHex: string;
  recoveryQuestion: string;
  recoveryAnswerHash: string;
}
