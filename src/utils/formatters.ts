import { CategoryOption, NumeralSystem, TransactionType } from '../types/finance';

export const EXPENSE_CATEGORIES: CategoryOption[] = [
  { id: 'groceries', label: 'বাজার', type: 'expense' },
  { id: 'housing', label: 'ভাড়া ও বিল', type: 'expense' },
  { id: 'transport', label: 'যাতায়াত', type: 'expense' },
  { id: 'health', label: 'চিকিৎসা', type: 'expense' },
  { id: 'shopping', label: 'কেনাকাটা', type: 'expense' },
  { id: 'education', label: 'শিক্ষা', type: 'expense' },
  { id: 'family', label: 'পারিবারিক', type: 'expense' },
  { id: 'other_expense', label: 'অন্যান্য', type: 'expense' },
];

export const INCOME_CATEGORIES: CategoryOption[] = [
  { id: 'salary', label: 'বেতন', type: 'income' },
  { id: 'business', label: 'ব্যবসা', type: 'income' },
  { id: 'freelance', label: 'ফ্রিল্যান্স', type: 'income' },
  { id: 'bonus', label: 'বোনাস', type: 'income' },
  { id: 'investment', label: 'বিনিয়োগ', type: 'income' },
  { id: 'other_income', label: 'অন্যান্য', type: 'income' },
];

export const ALL_CATEGORIES: CategoryOption[] = [
  ...EXPENSE_CATEGORIES,
  ...INCOME_CATEGORIES,
];

export const QUICK_EXPENSE_NOTES = [
  'কাঁচা বাজার',
  'নাস্তা',
  'ভাড়া',
  'বিদ্যুৎ বিল',
  'রিচার্জ',
  'ওষুধ',
];

export const QUICK_INCOME_NOTES = [
  'মাসিক বেতন',
  'প্রজেক্ট পেমেন্ট',
  'ব্যবসা',
  'বোনাস',
];

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export function toBengaliDigits(input: string | number): string {
  return String(input).replace(/\d/g, (d) => BN_DIGITS[Number(d)]);
}

export function formatNumber(
  value: number,
  numerals: NumeralSystem = 'en',
  maxDecimals = 2
): string {
  const safeVal = Number.isFinite(value) ? value : 0;
  const hasFraction = Math.abs(safeVal % 1) > 0.001;
  const formattedEn = safeVal.toLocaleString('en-IN', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: maxDecimals,
  });
  return numerals === 'bn' ? toBengaliDigits(formattedEn) : formattedEn;
}

export function formatCurrency(
  amount: number,
  numerals: NumeralSystem = 'en',
  showSign: 'none' | 'always' | 'negative-only' = 'negative-only'
): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const absFormatted = formatNumber(Math.abs(safeAmount), numerals);

  if (safeAmount < 0) {
    return `−৳ ${absFormatted}`;
  }
  if (showSign === 'always' && safeAmount > 0) {
    return `+৳ ${absFormatted}`;
  }
  return `৳ ${absFormatted}`;
}

export function getCurrentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftMonthKey(monthKey: string, deltaMonths: number): string {
  const [yStr, mStr] = monthKey.split('-');
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10);
  const date = new Date(year, month - 1 + deltaMonths, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

const BN_MONTH_NAMES = [
  'জানুয়ারি',
  'ফেব্রুয়ারি',
  'মার্চ',
  'এপ্রিল',
  'মে',
  'জুন',
  'জুলাই',
  'আগস্ট',
  'সেপ্টেম্বর',
  'অক্টোবর',
  'নভেম্বর',
  'ডিসেম্বর',
];

export function formatMonthForDisplay(
  monthKey: string,
  numerals: NumeralSystem = 'en'
): string {
  const parts = monthKey.split('-');
  if (parts.length !== 2) return monthKey;
  const year = parseInt(parts[0], 10);
  const monthIdx = parseInt(parts[1], 10) - 1;
  const monthName = BN_MONTH_NAMES[monthIdx] ?? parts[1];
  const displayYear = numerals === 'bn' ? toBengaliDigits(year) : String(year);
  return `${monthName} ${displayYear}`;
}

export function formatCurrentTimestamp(): string {
  const now = new Date();
  const day = now.getDate();
  const monthName = BN_MONTH_NAMES[now.getMonth()] || '';
  return `${day} ${monthName}`;
}

const LEGACY_CATEGORY_LABELS: Record<string, string> = {
  utilities: 'ইউটিলিটি বিল',
  food: 'খাবার ও বাজার',
  medical: 'চিকিৎসা',
  rent: 'বাসা ভাড়া',
  entertainment: 'বিনোদন',
};

export function getCategoryLabel(categoryId?: string, type?: TransactionType): string {
  if (!categoryId) {
    return type === 'income' ? 'আয়' : 'খরচ';
  }
  const found = ALL_CATEGORIES.find((c) => c.id === categoryId);
  if (found) return found.label;
  if (LEGACY_CATEGORY_LABELS[categoryId]) {
    return LEGACY_CATEGORY_LABELS[categoryId];
  }
  return categoryId;
}

export function inferCategoryFromNote(note: string, type: TransactionType): string {
  const n = note.toLowerCase();
  if (type === 'income') {
    if (n.includes('বেতন') || n.includes('salary')) return 'salary';
    if (n.includes('ব্যবসা') || n.includes('দোকান')) return 'business';
    if (n.includes('ফ্রিল্যান্স') || n.includes('প্রজেক্ট')) return 'freelance';
    if (n.includes('বোনাস') || n.includes('উপহার')) return 'bonus';
    return 'other_income';
  }
  if (n.includes('বাজার') || n.includes('খাবার') || n.includes('নাস্তা') || n.includes('চাল') || n.includes('মাছ')) {
    return 'groceries';
  }
  if (n.includes('ভাড়া') && (n.includes('বাসা') || n.includes('ঘর'))) return 'housing';
  if (n.includes('বিল') || n.includes('বিদ্যুৎ') || n.includes('গ্যাস') || n.includes('ওয়াইফাই') || n.includes('নেট')) {
    return 'housing';
  }
  if (n.includes('রিকশা') || n.includes('বাস') || n.includes('ভাড়া') || n.includes('যাতায়াত') || n.includes('তেল')) {
    return 'transport';
  }
  if (n.includes('ওষুধ') || n.includes('ডাক্তার') || n.includes('চিকিৎসা')) {
    return 'health';
  }
  if (n.includes('বই') || n.includes('টিউশন') || n.includes('কলেজ') || n.includes('খাতা')) {
    return 'education';
  }
  return 'other_expense';
}
