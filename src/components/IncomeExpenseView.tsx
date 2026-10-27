import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Search, X } from 'lucide-react';
import { NumeralSystem, Transaction, TransactionType } from '../types/finance';
import {
  formatCurrency,
  formatMonthForDisplay,
  getCategoryLabel,
  shiftMonthKey,
} from '../utils/formatters';
import { CategoryIcon } from './CategoryIcon';

interface IncomeExpenseViewProps {
  selectedMonth: string;
  onSelectMonth: (monthKey: string) => void;
  monthSummary: {
    transactions: Transaction[];
    income: number;
    expense: number;
    netMonth: number;
  };
  numerals: NumeralSystem;
  onOpenAddTransaction: (type?: TransactionType) => void;
  onEditTransaction: (tx: Transaction) => void;
}

export function IncomeExpenseView({
  selectedMonth,
  onSelectMonth,
  monthSummary,
  numerals,
  onOpenAddTransaction,
  onEditTransaction,
}: IncomeExpenseViewProps) {
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...monthSummary.transactions]
      .reverse()
      .filter((tx) => {
        if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
        if (q) {
          const catName = getCategoryLabel(tx.category, tx.type).toLowerCase();
          return (
            tx.note.toLowerCase().includes(q) ||
            catName.includes(q) ||
            String(tx.amount).includes(q)
          );
        }
        return true;
      });
  }, [monthSummary.transactions, typeFilter, searchQuery]);

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Minimal Header Row: Month Switcher + Add */}
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-1">
          <button
            type="button"
            onClick={() => onSelectMonth(shiftMonthKey(selectedMonth, -1))}
            aria-label="আগের মাস"
            className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-num px-3 text-sm font-semibold text-slate-900 dark:text-white whitespace-nowrap">
            {formatMonthForDisplay(selectedMonth, numerals)}
          </span>
          <button
            type="button"
            onClick={() => onSelectMonth(shiftMonthKey(selectedMonth, 1))}
            aria-label="পরের মাস"
            className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => onOpenAddTransaction('expense')}
          className="min-h-[44px] px-4 rounded-2xl bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 text-white text-sm font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>যোগ করুন</span>
        </button>
      </div>

      {/* Clean 3-Stat Bar */}
      <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-5">
        <div className="grid grid-cols-3 gap-3 divide-x divide-slate-100 dark:divide-slate-800">
          <div>
            <p className="text-xs text-slate-400 dark:text-slate-500">আয়</p>
            <p className="font-num mt-1 text-base sm:text-xl font-bold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(monthSummary.income, numerals)}
            </p>
          </div>
          <div className="pl-3 sm:pl-5">
            <p className="text-xs text-slate-400 dark:text-slate-500">ব্যয়</p>
            <p className="font-num mt-1 text-base sm:text-xl font-bold text-rose-600 dark:text-rose-400">
              {formatCurrency(monthSummary.expense, numerals)}
            </p>
          </div>
          <div className="pl-3 sm:pl-5">
            <p className="text-xs text-slate-400 dark:text-slate-500">উদ্বৃত্ত</p>
            <p
              className={`font-num mt-1 text-base sm:text-xl font-bold ${
                monthSummary.netMonth < 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-900 dark:text-white'
              }`}
            >
              {formatCurrency(monthSummary.netMonth, numerals)}
            </p>
          </div>
        </div>
      </section>

      {/* Ledger Surface */}
      <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-5 sm:p-6">
        {/* Segmented Filter + Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800/80">
          <div className="grid grid-cols-3 sm:flex items-center gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/90">
            {(
              [
                { id: 'all', label: 'সব' },
                { id: 'income', label: 'আয়' },
                { id: 'expense', label: 'ব্যয়' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTypeFilter(tab.id)}
                className={`min-h-[36px] px-4 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                  typeFilter === tab.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative sm:w-60">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="খুঁজুন..."
              className="w-full min-h-[40px] pl-9 pr-8 py-1.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-emerald-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Clean Uncluttered Rows (Tap row to Edit / Delete) */}
        {filteredTransactions.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-slate-400 dark:text-slate-500">
              কোনো হিসাব পাওয়া যায়নি
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/70 pt-1">
            {filteredTransactions.map((tx) => (
              <button
                key={tx.id}
                type="button"
                onClick={() => onEditTransaction(tx)}
                className="w-full min-h-[62px] py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-50/80 dark:hover:bg-slate-800/40 -mx-2 px-2 rounded-2xl transition-colors"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                      tx.type === 'income'
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <CategoryIcon categoryId={tx.category} type={tx.type} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {tx.note}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">
                      {getCategoryLabel(tx.category, tx.type)} · {tx.time}
                    </p>
                  </div>
                </div>

                <span
                  className={`font-num text-sm sm:text-base font-bold shrink-0 ${
                    tx.type === 'income'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-900 dark:text-slate-100'
                  }`}
                >
                  {tx.type === 'income' ? '+' : '−'}
                  {formatCurrency(tx.amount, numerals)}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
