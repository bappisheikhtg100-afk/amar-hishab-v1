import { useMemo, useState } from 'react';
import { ArrowLeft, FileDown, FileSpreadsheet } from 'lucide-react';
import {
  Budget,
  DebtProfile,
  NumeralSystem,
  Transaction,
} from '../types/finance';
import {
  formatCurrency,
  formatMonthForDisplay,
  formatNumber,
} from '../utils/formatters';
import { generateMonthlyFinancePdf } from '../utils/pdfExporter';

interface PdfReportsViewProps {
  selectedMonth: string;
  availableMonths: string[];
  transactionsByMonth: Record<string, Transaction[]>;
  debtProfiles: DebtProfile[];
  budgets: Budget[];
  numerals: NumeralSystem;
  onBack: () => void;
  onNotify: (msg: string, tone?: 'neutral' | 'success' | 'danger') => void;
}

export function PdfReportsView({
  selectedMonth,
  availableMonths,
  transactionsByMonth,
  debtProfiles,
  budgets,
  numerals,
  onBack,
  onNotify,
}: PdfReportsViewProps) {
  const [reportMonth, setReportMonth] = useState(selectedMonth);
  const [includeDebt, setIncludeDebt] = useState(true);
  const [includeBudgets, setIncludeBudgets] = useState(true);
  const [generating, setGenerating] = useState(false);

  const previewStats = useMemo(() => {
    const list = transactionsByMonth[reportMonth] || [];
    const income = list
      .filter((t) => t.type === 'income')
      .reduce((s, t) => s + t.amount, 0);
    const expense = list
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0);

    let previousBalance = 0;
    Object.entries(transactionsByMonth).forEach(([mKey, mList]) => {
      if (mKey < reportMonth) {
        const inc = mList
          .filter((t) => t.type === 'income')
          .reduce((s, t) => s + t.amount, 0);
        const exp = mList
          .filter((t) => t.type === 'expense')
          .reduce((s, t) => s + t.amount, 0);
        previousBalance += inc - exp;
      }
    });

    return {
      transactions: list,
      income,
      expense,
      previousBalance,
      closingBalance: previousBalance + (income - expense),
    };
  }, [transactionsByMonth, reportMonth]);

  const handleDownload = async () => {
    setGenerating(true);
    try {
      await generateMonthlyFinancePdf({
        monthKey: reportMonth,
        income: previewStats.income,
        expense: previewStats.expense,
        previousBalance: previewStats.previousBalance,
        closingBalance: previewStats.closingBalance,
        transactions: previewStats.transactions,
        debtProfiles,
        budgets,
        includeDebt,
        includeBudgets,
        numerals,
      });
      onNotify('মাসিক পিডিএফ রিপোর্ট ডাউনলোড হয়েছে', 'success');
    } catch {
      onNotify('পিডিএফ তৈরিতে সমস্যা হয়েছে', 'danger');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="min-h-[42px] -ml-2 px-2 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>মোর মেনু</span>
        </button>
      </div>

      <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-5 sm:p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#0B2620] text-emerald-300 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-white">
              অফলাইন পিডিএফ স্টেটমেন্ট
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              A4 প্রিন্ট-রেডি মাসিক হিসাব বিবরণী ডাউনলোড করুন
            </p>
          </div>
        </div>

        {/* Month Selector */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            বিবরণীর মাস নির্বাচন করুন
          </label>
          <select
            value={reportMonth}
            onChange={(e) => setReportMonth(e.target.value)}
            className="w-full min-h-[46px] px-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-sm font-semibold"
          >
            {availableMonths.map((m) => (
              <option key={m} value={m}>
                {formatMonthForDisplay(m, numerals)}
              </option>
            ))}
          </select>
        </div>

        {/* Quick Live Preview */}
        <div className="grid grid-cols-3 gap-2.5 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
          <div>
            <p className="text-[11px] text-slate-400">মোট আয়</p>
            <p className="font-num text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {formatCurrency(previewStats.income, numerals)}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-slate-400">মোট ব্যয়</p>
            <p className="font-num text-sm font-bold text-rose-600 dark:text-rose-400 mt-0.5">
              {formatCurrency(previewStats.expense, numerals)}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-slate-400">লেনদেন</p>
            <p className="font-num text-sm font-bold text-slate-900 dark:text-white mt-0.5">
              {formatNumber(previewStats.transactions.length, numerals)}টি
            </p>
          </div>
        </div>

        {/* Include Checkboxes */}
        <div className="space-y-3 pt-1">
          <label className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeDebt}
              onChange={(e) => setIncludeDebt(e.target.checked)}
              className="w-4 h-4 rounded accent-emerald-600"
            />
            <span>দেনা-পাওনা খাতার সারাংশ যুক্ত করুন</span>
          </label>

          <label className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeBudgets}
              onChange={(e) => setIncludeBudgets(e.target.checked)}
              className="w-4 h-4 rounded accent-emerald-600"
            />
            <span>বাজেট চেকলিস্ট যুক্ত করুন</span>
          </label>
        </div>

        <button
          type="button"
          disabled={generating}
          onClick={() => void handleDownload()}
          className="w-full min-h-[50px] rounded-2xl bg-[#0B2620] hover:bg-[#12382F] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
        >
          <FileDown className="w-4 h-4 text-emerald-300" />
          <span>
            {generating ? 'পিডিএফ তৈরি হচ্ছে...' : 'পিডিএফ রিপোর্ট ডাউনলোড করুন'}
          </span>
        </button>
      </section>
    </div>
  );
}
