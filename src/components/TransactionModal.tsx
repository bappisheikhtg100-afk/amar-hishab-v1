import React, { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { NumeralSystem, Transaction, TransactionType } from '../types/finance';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  QUICK_EXPENSE_NOTES,
  QUICK_INCOME_NOTES,
  formatMonthForDisplay,
} from '../utils/formatters';
import { CategoryIcon } from './CategoryIcon';
import { ModalSheet } from './ModalSheet';

interface TransactionModalProps {
  open: boolean;
  onClose: () => void;
  defaultMonthKey: string;
  availableMonths: string[];
  numerals: NumeralSystem;
  editingTransaction?: Transaction | null;
  initialType?: TransactionType;
  initialAmount?: number | null;
  onSave: (data: {
    amount: number;
    type: TransactionType;
    note: string;
    category: string;
    monthKey: string;
  }) => void;
  onDelete?: (tx: Transaction) => void;
}

export function TransactionModal({
  open,
  onClose,
  defaultMonthKey,
  availableMonths,
  numerals,
  editingTransaction,
  initialType = 'expense',
  initialAmount = null,
  onSave,
  onDelete,
}: TransactionModalProps) {
  const [type, setType] = useState<TransactionType>(initialType);
  const [amountStr, setAmountStr] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [category, setCategory] = useState<string>('groceries');
  const [monthKey, setMonthKey] = useState<string>(defaultMonthKey);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!open) return;
    setError('');
    if (editingTransaction) {
      setType(editingTransaction.type);
      setAmountStr(String(editingTransaction.amount));
      setNote(editingTransaction.note);
      setCategory(
        editingTransaction.category ||
          (editingTransaction.type === 'income' ? 'salary' : 'groceries')
      );
      setMonthKey(editingTransaction.monthKey || defaultMonthKey);
    } else {
      setType(initialType);
      setAmountStr(
        initialAmount !== null && initialAmount > 0 ? String(initialAmount) : ''
      );
      setNote('');
      setCategory(initialType === 'income' ? 'salary' : 'groceries');
      setMonthKey(defaultMonthKey);
    }
  }, [open, editingTransaction, initialType, initialAmount, defaultMonthKey]);

  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const quickNotes = type === 'income' ? QUICK_INCOME_NOTES : QUICK_EXPENSE_NOTES;

  const handleTypeSwitch = (nextType: TransactionType) => {
    setType(nextType);
    const validIds = (
      nextType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
    ).map((c) => c.id);
    if (!validIds.includes(category)) {
      setCategory(nextType === 'income' ? 'salary' : 'groceries');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedAmount = amountStr.replace(/[০-৯]/g, (d) =>
      String('০১২৩৪৫৬৭৮৯'.indexOf(d))
    );
    const parsedAmount = parseFloat(normalizedAmount);

    if (!parsedAmount || parsedAmount <= 0 || Number.isNaN(parsedAmount)) {
      setError('সঠিক পরিমাণ লিখুন');
      return;
    }
    if (!note.trim()) {
      setError('সংক্ষিপ্ত বিবরণ লিখুন');
      return;
    }

    onSave({
      amount: parsedAmount,
      type,
      note: note.trim(),
      category,
      monthKey,
    });
    onClose();
  };

  return (
    <ModalSheet
      open={open}
      onClose={onClose}
      title={editingTransaction ? 'হিসাব সম্পাদনা' : 'নতুন হিসাব'}
      maxWidthClass="sm:max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Segmented Type Selector */}
        <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/90">
          <button
            type="button"
            onClick={() => handleTypeSwitch('expense')}
            className={`min-h-[42px] px-4 py-2 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap ${
              type === 'expense'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            ব্যয়
          </button>
          <button
            type="button"
            onClick={() => handleTypeSwitch('income')}
            className={`min-h-[42px] px-4 py-2 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap ${
              type === 'income'
                ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            আয়
          </button>
        </div>

        {/* Clean Hero Amount Input */}
        <div className="relative">
          <span className="font-num absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-slate-400 dark:text-slate-500 select-none">
            ৳
          </span>
          <input
            id="tx-amount"
            type="text"
            inputMode="decimal"
            value={amountStr}
            onChange={(e) => {
              setAmountStr(e.target.value);
              if (error) setError('');
            }}
            placeholder="0"
            autoFocus
            className="font-num w-full min-h-[60px] pl-11 pr-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 text-3xl font-bold text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-emerald-500"
          />
        </div>

        {/* Compact Category Grid */}
        <div className="grid grid-cols-4 gap-2">
          {categories.map((cat) => {
            const active = category === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={`min-h-[54px] px-2 py-2 rounded-2xl border flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
                  active
                    ? 'border-slate-900 dark:border-emerald-500 bg-slate-900 dark:bg-emerald-600 text-white'
                    : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <CategoryIcon categoryId={cat.id} type={type} className="w-4 h-4" />
                <span className="truncate max-w-full">{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Note Input + Quick Suggestions */}
        <div>
          <input
            id="tx-note"
            type="text"
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              if (error) setError('');
            }}
            placeholder="বিবরণ লিখুন..."
            className="w-full min-h-[46px] px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-emerald-500"
          />

          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {quickNotes.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => {
                  setNote(q);
                  if (error) setError('');
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs text-slate-600 dark:text-slate-300 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Month Selector */}
        <select
          aria-label="হিসাবের মাস"
          value={monthKey}
          onChange={(e) => setMonthKey(e.target.value)}
          className="font-num w-full min-h-[44px] px-3.5 py-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 text-xs font-medium text-slate-600 dark:text-slate-300 focus:outline-none"
        >
          {availableMonths.map((m) => (
            <option key={m} value={m}>
              {formatMonthForDisplay(m, numerals)}
            </option>
          ))}
        </select>

        {error && (
          <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
            {error}
          </p>
        )}

        {/* Action Row */}
        <div className="flex items-center gap-2.5 pt-1">
          {editingTransaction && onDelete && (
            <button
              type="button"
              onClick={() => {
                onDelete(editingTransaction);
                onClose();
              }}
              aria-label="মুছে ফেলুন"
              className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          <button
            type="submit"
            className="min-h-[48px] flex-1 px-6 py-2.5 rounded-2xl text-sm font-semibold text-white bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 transition-colors"
          >
            {editingTransaction ? 'আপডেট করুন' : 'সংরক্ষণ করুন'}
          </button>
        </div>
      </form>
    </ModalSheet>
  );
}
