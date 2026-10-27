import { useMemo } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react';
import {
  AppTab,
  CardTheme,
  NumeralSystem,
  Transaction,
  TransactionType,
} from '../types/finance';
import {
  formatCurrency,
  formatMonthForDisplay,
  formatNumber,
  getCategoryLabel,
  shiftMonthKey,
} from '../utils/formatters';
import { CategoryIcon } from './CategoryIcon';

interface HomeViewProps {
  selectedMonth: string;
  onSelectMonth: (monthKey: string) => void;
  monthSummary: {
    transactions: Transaction[];
    income: number;
    expense: number;
    netMonth: number;
    previousBalance: number;
    closingBalance: number;
  };
  debtSummary: {
    totalDebt: number;
    totalCredit: number;
    netPosition: number;
    profileCount: number;
  };
  budgetSummary: {
    totalPlanned: number;
    totalBought: number;
    totalRemaining: number;
    totalItems: number;
    boughtItems: number;
    budgetCount: number;
  };
  numerals: NumeralSystem;
  cardTheme: CardTheme;
  onNavigateTab: (tab: AppTab) => void;
  onOpenAddTransaction: (type?: TransactionType) => void;
  onEditTransaction: (tx: Transaction) => void;
}

export const CARD_STYLES: Record<CardTheme, string> = {
  emerald:
    'bg-gradient-to-br from-[#0B2620] via-[#10382E] to-[#071713] shadow-[0_20px_44px_-14px_rgba(11,38,32,0.48)]',
  mint:
    'bg-gradient-to-br from-[#0D3B32] via-[#135346] to-[#08241E] shadow-[0_20px_44px_-14px_rgba(13,59,50,0.48)]',
  obsidian:
    'bg-gradient-to-br from-[#1C2029] via-[#11141B] to-[#080A0E] shadow-[0_20px_44px_-14px_rgba(15,23,42,0.48)]',
  royal:
    'bg-gradient-to-br from-[#0F2042] via-[#152C5B] to-[#091328] shadow-[0_20px_44px_-14px_rgba(15,32,66,0.48)]',
  burgundy:
    'bg-gradient-to-br from-[#3B0A1E] via-[#56122D] to-[#220511] shadow-[0_20px_44px_-14px_rgba(59,10,30,0.48)]',
  bronze:
    'bg-gradient-to-br from-[#2E2113] via-[#4A351E] to-[#1A120A] shadow-[0_20px_44px_-14px_rgba(46,33,19,0.48)]',
  amethyst:
    'bg-gradient-to-br from-[#23113A] via-[#341957] to-[#130821] shadow-[0_20px_44px_-14px_rgba(35,17,58,0.48)]',
  ocean:
    'bg-gradient-to-br from-[#0A2933] via-[#11404F] to-[#06181F] shadow-[0_20px_44px_-14px_rgba(10,41,51,0.48)]',
  platinum:
    'bg-gradient-to-br from-[#2A303C] via-[#3B4354] to-[#181C24] shadow-[0_20px_44px_-14px_rgba(42,48,60,0.48)]',
};

export function HomeView({
  selectedMonth,
  onSelectMonth,
  monthSummary,
  debtSummary,
  budgetSummary,
  numerals,
  cardTheme,
  onNavigateTab,
  onOpenAddTransaction,
  onEditTransaction,
}: HomeViewProps) {
  const recentTransactions = useMemo(() => {
    return [...monthSummary.transactions].slice(-5).reverse();
  }, [monthSummary.transactions]);

  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    monthSummary.transactions
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        const cat = t.category || 'other_expense';
        map.set(cat, (map.get(cat) || 0) + t.amount);
      });

    const totalExp = monthSummary.expense || 1;
    return Array.from(map.entries())
      .map(([catId, amount]) => ({
        catId,
        label: getCategoryLabel(catId, 'expense'),
        amount,
        percent: Math.min(100, Math.round((amount / totalExp) * 100)),
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 4);
  }, [monthSummary]);

  const budgetPct =
    budgetSummary.totalPlanned > 0
      ? Math.min(
          100,
          Math.round((budgetSummary.totalBought / budgetSummary.totalPlanned) * 100)
        )
      : 0;

  const activeCardStyle = CARD_STYLES[cardTheme] || CARD_STYLES.emerald;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
      {/* Left Column: Credit-Card Summary Box + Quick Actions + Minimal Glance Tiles */}
      <div className="lg:col-span-5 space-y-4 max-w-[440px] lg:max-w-none mx-auto w-full">
        {/* Premium Credit-Card Sized Financial Card (ISO 1.586:1 Aspect Ratio) */}
        <section
          aria-label="মাসিক আয় ব্যয়ের সারাংশ কার্ড"
          className={`relative w-full aspect-[1.586/1] min-h-[214px] rounded-[26px] p-6 text-white ring-1 ring-white/12 overflow-hidden flex flex-col justify-between select-none ${activeCardStyle}`}
        >
          {/* Subtle Metallic Ambient Light Reflection */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 -right-20 w-64 h-64 rounded-full bg-white/[0.07] blur-2xl"
          />

          {/* Top Row: Minimalist Metallic Chip + Month Switcher */}
          <div className="relative z-10 flex items-center justify-between">
            {/* Minimal Smart Card Chip */}
            <div className="flex items-center gap-2.5">
              <div
                aria-hidden="true"
                className="w-9 h-6 rounded-md border border-white/25 bg-gradient-to-br from-amber-200/30 via-white/10 to-amber-100/15 flex items-center justify-center"
              >
                <div className="w-4 h-3 rounded-[2px] border border-white/20" />
              </div>
            </div>

            {/* Integrated Month Selector */}
            <div className="flex items-center gap-0.5 bg-white/[0.08] rounded-full px-1 py-0.5 backdrop-blur-xs">
              <button
                type="button"
                onClick={() => onSelectMonth(shiftMonthKey(selectedMonth, -1))}
                aria-label="আগের মাস"
                className="w-7 h-7 flex items-center justify-center rounded-full text-white/75 hover:text-white hover:bg-white/10 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 text-xs font-medium text-white/90 whitespace-nowrap font-num">
                {formatMonthForDisplay(selectedMonth, numerals)}
              </span>
              <button
                type="button"
                onClick={() => onSelectMonth(shiftMonthKey(selectedMonth, 1))}
                aria-label="পরের মাস"
                className="w-7 h-7 flex items-center justify-center rounded-full text-white/75 hover:text-white hover:bg-white/10 transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Center Row: Net Balance */}
          <div className="relative z-10 my-auto py-1">
            <p className="text-xs font-medium text-white/60">মোট ব্যালেন্স</p>
            <p className="font-num text-[2rem] sm:text-[2.2rem] font-bold tracking-tight text-white leading-tight mt-0.5">
              {formatCurrency(monthSummary.closingBalance, numerals)}
            </p>
          </div>

          {/* Bottom Row: Total Income & Total Expense */}
          <div className="relative z-10 pt-3.5 border-t border-white/10 grid grid-cols-2 gap-4">
            <div>
              <span className="text-[11px] font-medium text-white/55 inline-flex items-center gap-1">
                <ArrowDownLeft className="w-3 h-3 text-emerald-400" />
                মোট আয়
              </span>
              <p className="font-num text-base sm:text-lg font-semibold text-emerald-300 leading-snug mt-0.5">
                {formatCurrency(monthSummary.income, numerals)}
              </p>
            </div>

            <div className="text-right">
              <span className="text-[11px] font-medium text-white/55 inline-flex items-center justify-end gap-1">
                <ArrowUpRight className="w-3 h-3 text-rose-400" />
                মোট ব্যয়
              </span>
              <p className="font-num text-base sm:text-lg font-semibold text-rose-300 leading-snug mt-0.5">
                {formatCurrency(monthSummary.expense, numerals)}
              </p>
            </div>
          </div>
        </section>

        {/* Clean Tactile Action Pair */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onOpenAddTransaction('income')}
            className="min-h-[48px] px-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-900 dark:text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
          >
            <ArrowDownLeft className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>আয় যোগ</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenAddTransaction('expense')}
            className="min-h-[48px] px-4 rounded-2xl bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>ব্যয় যোগ</span>
          </button>
        </div>

        {/* Minimal 2-Tile Glance Strip (Debt & Budget) */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onNavigateTab('debt')}
            className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-4 text-left hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
          >
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>দেনা-পাওনা</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
            <p
              className={`font-num mt-2 text-lg font-bold ${
                debtSummary.netPosition >= 0
                  ? 'text-slate-900 dark:text-white'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {formatCurrency(Math.abs(debtSummary.netPosition), numerals)}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
              {debtSummary.netPosition > 0
                ? 'পাওনা আছে'
                : debtSummary.netPosition < 0
                ? 'দেনা আছে'
                : 'হিসাব সমান'}
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('budget')}
            className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-4 text-left hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
          >
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>বাজেট</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
            <p className="font-num mt-2 text-lg font-bold text-slate-900 dark:text-white">
              {formatCurrency(budgetSummary.totalPlanned, numerals)}
            </p>
            <div className="mt-2 h-1 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-600"
                style={{ width: `${budgetPct}%` }}
              />
            </div>
          </button>
        </div>
      </div>

      {/* Right Column: Clean Recent Activity & Minimal Category Bars */}
      <div className="lg:col-span-7 space-y-5 max-w-[440px] lg:max-w-none mx-auto w-full">
        {/* Recent Transactions */}
        <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-5 sm:p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              সাম্প্রতিক হিসাব
            </h2>
            <button
              type="button"
              onClick={() => onNavigateTab('income-expense')}
              className="min-h-[36px] px-2 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              সব দেখুন
            </button>
          </div>

          {recentTransactions.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-slate-400 dark:text-slate-500">
                এই মাসে কোনো লেনদেন নেই
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {recentTransactions.map((tx) => (
                <button
                  key={tx.id}
                  type="button"
                  onClick={() => onEditTransaction(tx)}
                  className="w-full min-h-[60px] py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-50/70 dark:hover:bg-slate-800/40 -mx-2 px-2 rounded-2xl transition-colors"
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
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
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

        {/* Minimalist Category Breakdown (Only shown when expenses exist) */}
        {categoryBreakdown.length > 0 && (
          <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
              খাতওয়ারী ব্যয়
            </h2>
            <div className="space-y-3.5">
              {categoryBreakdown.map((item) => (
                <div key={item.catId}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {item.label}
                    </span>
                    <span className="font-num font-semibold text-slate-900 dark:text-slate-200">
                      {formatCurrency(item.amount, numerals)}{' '}
                      <span className="text-slate-400 font-normal">
                        ({formatNumber(item.percent, numerals)}%)
                      </span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-slate-900 dark:bg-emerald-500"
                      style={{ width: `${Math.max(4, item.percent)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
