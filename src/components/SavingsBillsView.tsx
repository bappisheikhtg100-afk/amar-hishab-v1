import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  CalendarClock,
  Check,
  Plus,
  Target,
  Trash2,
} from 'lucide-react';
import {
  NumeralSystem,
  RecurringBill,
  SavingsGoal,
} from '../types/finance';
import {
  EXPENSE_CATEGORIES,
  formatCurrency,
  formatMonthForDisplay,
  formatNumber,
} from '../utils/formatters';
import { ConfirmDialog, ModalSheet } from './ModalSheet';

interface SavingsBillsViewProps {
  initialTab: 'savings' | 'bills';
  savingsGoals: SavingsGoal[];
  recurringBills: RecurringBill[];
  selectedMonth: string;
  availableMonths: string[];
  onSelectMonth: (m: string) => void;
  numerals: NumeralSystem;
  onAddSavingsGoal: (payload: {
    name: string;
    targetAmount: number;
    deadline?: string;
  }) => void;
  onAddSavingsEntry: (
    goalId: number,
    payload: { amount: number; type: 'deposit' | 'withdraw'; note: string }
  ) => void;
  onDeleteSavingsGoal: (goalId: number) => void;
  onAddRecurringBill: (payload: {
    name: string;
    amount: number;
    dueDay: number;
    category: string;
  }) => void;
  onToggleBillPaid: (
    billId: number,
    monthKey: string,
    alsoLogExpense: boolean
  ) => void;
  onDeleteRecurringBill: (billId: number) => void;
  onBack: () => void;
}

export function SavingsBillsView({
  initialTab,
  savingsGoals,
  recurringBills,
  selectedMonth,
  availableMonths,
  onSelectMonth,
  numerals,
  onAddSavingsGoal,
  onAddSavingsEntry,
  onDeleteSavingsGoal,
  onAddRecurringBill,
  onToggleBillPaid,
  onDeleteRecurringBill,
  onBack,
}: SavingsBillsViewProps) {
  const [tab, setTab] = useState<'savings' | 'bills'>(initialTab);
  const [logBillToExpense, setLogBillToExpense] = useState(true);

  // Modals
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalDeadline, setGoalDeadline] = useState('');

  const [entryGoal, setEntryGoal] = useState<SavingsGoal | null>(null);
  const [entryType, setEntryType] = useState<'deposit' | 'withdraw'>('deposit');
  const [entryAmount, setEntryAmount] = useState('');
  const [entryNote, setEntryNote] = useState('');

  const [billModalOpen, setBillModalOpen] = useState(false);
  const [billName, setBillName] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billDueDay, setBillDueDay] = useState('5');
  const [billCategory, setBillCategory] = useState('housing');

  const [deleteGoalTarget, setDeleteGoalTarget] =
    useState<SavingsGoal | null>(null);
  const [deleteBillTarget, setDeleteBillTarget] =
    useState<RecurringBill | null>(null);

  const savingsStats = useMemo(() => {
    const saved = savingsGoals.reduce((s, g) => s + g.savedAmount, 0);
    const target = savingsGoals.reduce((s, g) => s + g.targetAmount, 0);
    const pct = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;
    return { saved, target, pct };
  }, [savingsGoals]);

  const billsStats = useMemo(() => {
    let paid = 0;
    let unpaid = 0;
    recurringBills.forEach((b) => {
      if (b.paidMonths.includes(selectedMonth)) {
        paid += b.amount;
      } else {
        unpaid += b.amount;
      }
    });
    return { paid, unpaid, total: paid + unpaid };
  }, [recurringBills, selectedMonth]);

  const handleCreateGoal = (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseFloat(goalTarget);
    if (!goalName.trim() || !target || target <= 0) return;
    onAddSavingsGoal({
      name: goalName,
      targetAmount: target,
      deadline: goalDeadline || undefined,
    });
    setGoalName('');
    setGoalTarget('');
    setGoalDeadline('');
    setGoalModalOpen(false);
  };

  const handleAddEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entryGoal) return;
    const amt = parseFloat(entryAmount);
    if (!amt || amt <= 0) return;
    onAddSavingsEntry(entryGoal.id, {
      amount: amt,
      type: entryType,
      note: entryNote,
    });
    setEntryGoal(null);
    setEntryAmount('');
    setEntryNote('');
  };

  const handleCreateBill = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(billAmount);
    const day = parseInt(billDueDay, 10) || 5;
    if (!billName.trim() || !amt || amt <= 0) return;
    onAddRecurringBill({
      name: billName,
      amount: amt,
      dueDay: day,
      category: billCategory,
    });
    setBillName('');
    setBillAmount('');
    setBillDueDay('5');
    setBillModalOpen(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[42px] -ml-2 px-2 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>মোর মেনু</span>
        </button>

        <button
          type="button"
          onClick={() =>
            tab === 'savings' ? setGoalModalOpen(true) : setBillModalOpen(true)
          }
          className="min-h-[42px] px-4 rounded-2xl bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>{tab === 'savings' ? 'নতুন লক্ষ্য' : 'নতুন বিল'}</span>
        </button>
      </div>

      {/* Mode Switcher */}
      <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-slate-200/60 dark:bg-slate-900">
        <button
          type="button"
          onClick={() => setTab('savings')}
          className={`min-h-[42px] rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
            tab === 'savings'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-500'
          }`}
        >
          <Target className="w-4 h-4" />
          <span>সঞ্চয় লক্ষ্যমাত্রা</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('bills')}
          className={`min-h-[42px] rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
            tab === 'bills'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-500'
          }`}
        >
          <CalendarClock className="w-4 h-4" />
          <span>বাঁধাধরা বিল</span>
        </button>
      </div>

      {/* SAVINGS TAB */}
      {tab === 'savings' && (
        <div className="space-y-4">
          <section className="rounded-3xl bg-[#0B2620] text-white p-5 sm:p-6">
            <div className="flex items-baseline justify-between gap-4">
              <div>
                <p className="text-xs text-emerald-300/80">মোট জমাকৃত সঞ্চয়</p>
                <p className="font-num text-2xl sm:text-3xl font-bold mt-1">
                  {formatCurrency(savingsStats.saved, numerals)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-white/60">মোট লক্ষ্য</p>
                <p className="font-num text-sm font-semibold text-white/90 mt-0.5">
                  {formatCurrency(savingsStats.target, numerals)}
                </p>
              </div>
            </div>
            <div className="mt-4 h-2 rounded-full bg-white/15 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-400 transition-all duration-300"
                style={{ width: `${savingsStats.pct}%` }}
              />
            </div>
          </section>

          {savingsGoals.length === 0 ? (
            <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 py-14 px-6 text-center">
              <Target className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
              <p className="text-sm text-slate-500">কোনো সঞ্চয় লক্ষ্য নেই</p>
            </div>
          ) : (
            savingsGoals.map((goal) => {
              const pct =
                goal.targetAmount > 0
                  ? Math.min(
                      100,
                      Math.round((goal.savedAmount / goal.targetAmount) * 100)
                    )
                  : 0;
              return (
                <section
                  key={goal.id}
                  className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-5 space-y-3.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-bold text-slate-900 dark:text-white">
                        {goal.name}
                      </h2>
                      <p className="font-num text-xs text-slate-400 mt-0.5">
                        {formatCurrency(goal.savedAmount, numerals)} /{' '}
                        {formatCurrency(goal.targetAmount, numerals)} ({pct}%)
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEntryGoal(goal);
                          setEntryType('deposit');
                          setEntryAmount('');
                          setEntryNote('');
                        }}
                        className="min-h-[38px] px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                      >
                        + জমা / উত্তোলন
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteGoalTarget(goal)}
                        aria-label="মুছে ফেলুন"
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  {goal.entries.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-1.5">
                      {goal.entries.slice(0, 3).map((en) => (
                        <div
                          key={en.id}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="text-slate-500 truncate">
                            {en.note} · {en.time}
                          </span>
                          <span
                            className={`font-num font-semibold shrink-0 ${
                              en.type === 'deposit'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {en.type === 'deposit' ? '+' : '−'}
                            {formatCurrency(en.amount, numerals)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              );
            })
          )}
        </div>
      )}

      {/* RECURRING BILLS TAB */}
      {tab === 'bills' && (
        <div className="space-y-4">
          <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-slate-400">মাসিক বিলের হিসাব</p>
                <div className="flex items-baseline gap-3 mt-1">
                  <span className="font-num text-xl font-bold text-rose-600 dark:text-rose-400">
                    বাকি {formatCurrency(billsStats.unpaid, numerals)}
                  </span>
                  <span className="font-num text-xs text-emerald-600 dark:text-emerald-400">
                    পরিশোধিত {formatCurrency(billsStats.paid, numerals)}
                  </span>
                </div>
              </div>

              <select
                value={selectedMonth}
                onChange={(e) => onSelectMonth(e.target.value)}
                className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
              >
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {formatMonthForDisplay(m, numerals)}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none pt-2 border-t border-slate-100 dark:border-slate-800">
              <input
                type="checkbox"
                checked={logBillToExpense}
                onChange={(e) => setLogBillToExpense(e.target.checked)}
                className="w-4 h-4 rounded accent-emerald-600"
              />
              <span>পরিশোধে টিক দিলে স্বয়ংক্রিয়ভাবে মাসিক খরচে যুক্ত হবে</span>
            </label>
          </section>

          <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/80 overflow-hidden">
            {recurringBills.length === 0 ? (
              <div className="py-14 px-6 text-center">
                <CalendarClock className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                <p className="text-sm text-slate-500">কোনো মাসিক বিল যুক্ত নেই</p>
              </div>
            ) : (
              recurringBills.map((bill) => {
                const isPaid = bill.paidMonths.includes(selectedMonth);
                return (
                  <div
                    key={bill.id}
                    className="p-4 sm:px-5 flex items-center gap-3"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        onToggleBillPaid(
                          bill.id,
                          selectedMonth,
                          logBillToExpense
                        )
                      }
                      aria-label={isPaid ? 'অপরিশোধিত করুন' : 'পরিশোধিত করুন'}
                      className="min-h-[44px] min-w-[44px] -ml-2 flex items-center justify-center shrink-0"
                    >
                      <span
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                          isPaid
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        {isPaid && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </span>
                    </button>

                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-semibold truncate ${
                          isPaid
                            ? 'line-through text-slate-400'
                            : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {bill.name}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        প্রতি মাসের{' '}
                        <span className="font-num">
                          {formatNumber(bill.dueDay, numerals)}
                        </span>{' '}
                        তারিখ
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="font-num text-sm font-bold text-slate-900 dark:text-white">
                        {formatCurrency(bill.amount, numerals)}
                      </p>
                      <span
                        className={`text-[11px] font-medium ${
                          isPaid ? 'text-emerald-600' : 'text-rose-500'
                        }`}
                      >
                        {isPaid ? 'পরিশোধিত' : 'বাকি'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setDeleteBillTarget(bill)}
                      aria-label="মুছে ফেলুন"
                      className="min-h-[44px] min-w-[40px] -mr-2 flex items-center justify-center text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })
            )}
          </section>
        </div>
      )}

      {/* New Savings Goal Modal */}
      <ModalSheet
        open={goalModalOpen}
        onClose={() => setGoalModalOpen(false)}
        title="নতুন সঞ্চয় লক্ষ্য"
        maxWidthClass="sm:max-w-md"
      >
        <form onSubmit={handleCreateGoal} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              লক্ষ্যের নাম
            </label>
            <input
              type="text"
              value={goalName}
              onChange={(e) => setGoalName(e.target.value)}
              placeholder="যেমন: জরুরি ফান্ড, ল্যাপটপ, ভ্রমণ..."
              required
              className="w-full min-h-[44px] px-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              লক্ষ্যমাত্রা পরিমাণ (৳)
            </label>
            <input
              type="number"
              min="1"
              step="any"
              value={goalTarget}
              onChange={(e) => setGoalTarget(e.target.value)}
              placeholder="50000"
              required
              className="font-num w-full min-h-[44px] px-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              সম্ভাব্য তারিখ (ঐচ্ছিক)
            </label>
            <input
              type="date"
              value={goalDeadline}
              onChange={(e) => setGoalDeadline(e.target.value)}
              className="font-num w-full min-h-[44px] px-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-sm"
            />
          </div>
          <button
            type="submit"
            className="w-full min-h-[46px] rounded-2xl bg-slate-900 dark:bg-emerald-600 text-white text-sm font-semibold"
          >
            লক্ষ্য সংরক্ষণ করুন
          </button>
        </form>
      </ModalSheet>

      {/* Deposit / Withdraw Savings Modal */}
      <ModalSheet
        open={Boolean(entryGoal)}
        onClose={() => setEntryGoal(null)}
        title={entryGoal ? entryGoal.name : 'সঞ্চয় এন্ট্রি'}
        maxWidthClass="sm:max-w-md"
      >
        <form onSubmit={handleAddEntry} className="space-y-4">
          <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setEntryType('deposit')}
              className={`min-h-[40px] rounded-xl text-xs font-semibold ${
                entryType === 'deposit'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-500'
              }`}
            >
              টাকা জমা
            </button>
            <button
              type="button"
              onClick={() => setEntryType('withdraw')}
              className={`min-h-[40px] rounded-xl text-xs font-semibold ${
                entryType === 'withdraw'
                  ? 'bg-rose-600 text-white'
                  : 'text-slate-500'
              }`}
            >
              উত্তোলন
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              পরিমাণ (৳)
            </label>
            <input
              type="number"
              min="1"
              step="any"
              value={entryAmount}
              onChange={(e) => setEntryAmount(e.target.value)}
              placeholder="0"
              required
              autoFocus
              className="font-num w-full min-h-[46px] px-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-lg font-bold"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              নোট (ঐচ্ছিক)
            </label>
            <input
              type="text"
              value={entryNote}
              onChange={(e) => setEntryNote(e.target.value)}
              placeholder="বিবরণ..."
              className="w-full min-h-[44px] px-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-sm"
            />
          </div>

          <button
            type="submit"
            className="w-full min-h-[46px] rounded-2xl bg-slate-900 dark:bg-emerald-600 text-white text-sm font-semibold"
          >
            সংরক্ষণ করুন
          </button>
        </form>
      </ModalSheet>

      {/* New Recurring Bill Modal */}
      <ModalSheet
        open={billModalOpen}
        onClose={() => setBillModalOpen(false)}
        title="নতুন মাসিক বিল"
        maxWidthClass="sm:max-w-md"
      >
        <form onSubmit={handleCreateBill} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              বিলের নাম
            </label>
            <input
              type="text"
              value={billName}
              onChange={(e) => setBillName(e.target.value)}
              placeholder="যেমন: বাসা ভাড়া, বিদ্যুৎ বিল, ওয়াইফাই..."
              required
              className="w-full min-h-[44px] px-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                পরিমাণ (৳)
              </label>
              <input
                type="number"
                min="1"
                step="any"
                value={billAmount}
                onChange={(e) => setBillAmount(e.target.value)}
                placeholder="1200"
                required
                className="font-num w-full min-h-[44px] px-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                মাসের তারিখ (১-৩১)
              </label>
              <input
                type="number"
                min="1"
                max="31"
                value={billDueDay}
                onChange={(e) => setBillDueDay(e.target.value)}
                required
                className="font-num w-full min-h-[44px] px-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              খরচের খাত
            </label>
            <select
              value={billCategory}
              onChange={(e) => setBillCategory(e.target.value)}
              className="w-full min-h-[44px] px-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-sm"
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="w-full min-h-[46px] rounded-2xl bg-slate-900 dark:bg-emerald-600 text-white text-sm font-semibold"
          >
            বিল যুক্ত করুন
          </button>
        </form>
      </ModalSheet>

      <ConfirmDialog
        open={Boolean(deleteGoalTarget)}
        title="লক্ষ্যমাত্রা মুছবেন?"
        description={
          deleteGoalTarget ? `"${deleteGoalTarget.name}" মুছে যাবে।` : ''
        }
        onConfirm={() => {
          if (deleteGoalTarget) onDeleteSavingsGoal(deleteGoalTarget.id);
        }}
        onCancel={() => setDeleteGoalTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(deleteBillTarget)}
        title="বিল মুছবেন?"
        description={
          deleteBillTarget ? `"${deleteBillTarget.name}" মুছে যাবে।` : ''
        }
        onConfirm={() => {
          if (deleteBillTarget) onDeleteRecurringBill(deleteBillTarget.id);
        }}
        onCancel={() => setDeleteBillTarget(null)}
      />
    </div>
  );
}
