import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Pencil,
  Plus,
  ReceiptText,
  Trash2,
} from 'lucide-react';
import { Budget, BudgetItem, NumeralSystem } from '../types/finance';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { ConfirmDialog, ModalSheet } from './ModalSheet';

interface BudgetViewProps {
  budgets: Budget[];
  budgetSummary: {
    totalPlanned: number;
    totalBought: number;
    totalRemaining: number;
    totalItems: number;
    boughtItems: number;
    budgetCount: number;
  };
  numerals: NumeralSystem;
  onAddBudget: (payload: { name: string; limit?: number }) => number;
  onUpdateBudget: (budgetId: number, payload: { name: string; limit?: number }) => void;
  onDeleteBudget: (budgetId: number) => void;
  onAddItem: (budgetId: number, payload: { name: string; cost: number }) => void;
  onToggleItem: (budgetId: number, itemId: number) => void;
  onUpdateItem: (
    budgetId: number,
    itemId: number,
    payload: { name: string; cost: number }
  ) => void;
  onDeleteItem: (budgetId: number, itemId: number) => void;
  onLogBoughtToExpense: (budgetId: number) => void;
}

export function BudgetView({
  budgets,
  budgetSummary,
  numerals,
  onAddBudget,
  onUpdateBudget,
  onDeleteBudget,
  onAddItem,
  onToggleItem,
  onUpdateItem,
  onDeleteItem,
  onLogBoughtToExpense,
}: BudgetViewProps) {
  const [selectedBudgetId, setSelectedBudgetId] = useState<number | null>(() =>
    budgets.length > 0 ? budgets[0].id : null
  );
  const [mobileDetailOpen, setMobileDetailOpen] = useState<boolean>(false);

  const [quickName, setQuickName] = useState('');
  const [quickCost, setQuickCost] = useState('');

  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [bName, setBName] = useState('');
  const [bLimit, setBLimit] = useState('');

  const [editingItem, setEditingItem] = useState<{
    budgetId: number;
    item: BudgetItem;
  } | null>(null);
  const [editItemName, setEditItemName] = useState('');
  const [editItemCost, setEditItemCost] = useState('');

  const [deletingBudget, setDeletingBudget] = useState<Budget | null>(null);
  const [confirmLogBudget, setConfirmLogBudget] = useState<Budget | null>(null);

  const activeBudget = useMemo(() => {
    if (!selectedBudgetId) return budgets[0] || null;
    return budgets.find((b) => b.id === selectedBudgetId) || budgets[0] || null;
  }, [budgets, selectedBudgetId]);

  const activeStats = useMemo(() => {
    if (!activeBudget) {
      return { total: 0, bought: 0, remaining: 0 };
    }
    const total = activeBudget.items.reduce((s, i) => s + i.cost, 0);
    const bought = activeBudget.items
      .filter((i) => i.bought)
      .reduce((s, i) => s + i.cost, 0);
    return {
      total,
      bought,
      remaining: Math.max(0, total - bought),
    };
  }, [activeBudget]);

  const openCreateBudget = () => {
    setEditingBudget(null);
    setBName('');
    setBLimit('');
    setBudgetModalOpen(true);
  };

  const openEditBudget = (budget: Budget) => {
    setEditingBudget(budget);
    setBName(budget.name);
    setBLimit(budget.limit ? String(budget.limit) : '');
    setBudgetModalOpen(true);
  };

  const handleSaveBudget = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bName.trim()) return;
    const normalizedLimit = bLimit.replace(/[০-৯]/g, (d) =>
      String('০১২৩৪৫৬৭৮৯'.indexOf(d))
    );
    const parsedLimit = normalizedLimit ? parseFloat(normalizedLimit) : undefined;

    if (editingBudget) {
      onUpdateBudget(editingBudget.id, { name: bName, limit: parsedLimit });
    } else {
      const id = onAddBudget({ name: bName, limit: parsedLimit });
      setSelectedBudgetId(id);
      setMobileDetailOpen(true);
    }
    setBudgetModalOpen(false);
  };

  const handleQuickAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBudget || !quickName.trim()) return;
    const normalized = quickCost.replace(/[০-৯]/g, (d) =>
      String('০১২৩৪৫৬৭৮৯'.indexOf(d))
    );
    const cost = parseFloat(normalized);
    if (!cost || cost <= 0 || Number.isNaN(cost)) return;
    onAddItem(activeBudget.id, { name: quickName, cost });
    setQuickName('');
    setQuickCost('');
  };

  const handleSaveItemEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    const normalized = editItemCost.replace(/[০-৯]/g, (d) =>
      String('০১২৩৪৫৬৭৮৯'.indexOf(d))
    );
    const cost = parseFloat(normalized);
    if (!editItemName.trim() || !cost || cost <= 0) return;
    onUpdateItem(editingItem.budgetId, editingItem.item.id, {
      name: editItemName,
      cost,
    });
    setEditingItem(null);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">বাজেট</h1>
        <button
          type="button"
          onClick={openCreateBudget}
          className="min-h-[42px] px-4 rounded-2xl bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 text-white text-sm font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>নতুন তালিকা</span>
        </button>
      </div>

      {/* Summary Strip */}
      <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-5">
        <div className="grid grid-cols-3 gap-3 divide-x divide-slate-100 dark:divide-slate-800">
          <div>
            <p className="text-xs text-slate-400">মোট বাজেট</p>
            <p className="font-num mt-1 text-base sm:text-xl font-bold text-slate-900 dark:text-white">
              {formatCurrency(budgetSummary.totalPlanned, numerals)}
            </p>
          </div>
          <div className="pl-3 sm:pl-5">
            <p className="text-xs text-slate-400">কেনা হয়েছে</p>
            <p className="font-num mt-1 text-base sm:text-xl font-bold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(budgetSummary.totalBought, numerals)}
            </p>
          </div>
          <div className="pl-3 sm:pl-5">
            <p className="text-xs text-slate-400">বাকি</p>
            <p className="font-num mt-1 text-base sm:text-xl font-bold text-slate-600 dark:text-slate-300">
              {formatCurrency(budgetSummary.totalRemaining, numerals)}
            </p>
          </div>
        </div>
      </section>

      {/* Master-Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Budget List */}
        <section
          className={`lg:col-span-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-5 ${
            mobileDetailOpen && activeBudget ? 'hidden lg:block' : 'block'
          }`}
        >
          {budgets.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-slate-400">কোনো তালিকা নেই</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {budgets.map((budget) => {
                const total = budget.items.reduce((s, i) => s + i.cost, 0);
                const bought = budget.items
                  .filter((i) => i.bought)
                  .reduce((s, i) => s + i.cost, 0);
                const boughtCount = budget.items.filter((i) => i.bought).length;
                const pct =
                  total > 0 ? Math.min(100, Math.round((bought / total) * 100)) : 0;
                const isSelected = activeBudget?.id === budget.id;

                return (
                  <button
                    key={budget.id}
                    type="button"
                    onClick={() => {
                      setSelectedBudgetId(budget.id);
                      setMobileDetailOpen(true);
                    }}
                    className={`w-full py-3.5 px-3 -mx-3 rounded-2xl text-left transition-colors block ${
                      isSelected
                        ? 'bg-slate-100/90 dark:bg-slate-800/80'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {budget.name}
                      </p>
                      <span className="font-num text-sm font-bold text-slate-900 dark:text-white shrink-0">
                        {formatCurrency(total, numerals)}
                      </span>
                    </div>

                    <p className="font-num mt-0.5 text-xs text-slate-400">
                      {formatNumber(boughtCount, numerals)}/
                      {formatNumber(budget.items.length, numerals)} সম্পন্ন
                    </p>

                    <div className="mt-2.5 h-1 w-full rounded-full bg-slate-200/70 dark:bg-slate-700 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-600"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Active Checklist */}
        <section
          className={`lg:col-span-7 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-5 sm:p-6 ${
            mobileDetailOpen && activeBudget ? 'block' : 'hidden lg:block'
          }`}
        >
          {!activeBudget ? (
            <div className="py-16 text-center">
              <p className="text-sm text-slate-400">একটি তালিকা নির্বাচন করুন</p>
            </div>
          ) : (
            <div>
              <div className="lg:hidden mb-3">
                <button
                  type="button"
                  onClick={() => setMobileDetailOpen(false)}
                  className="min-h-[40px] -ml-1 px-2 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>ফিরে যান</span>
                </button>
              </div>

              <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800/80">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    {activeBudget.name}
                  </h2>
                  <p className="font-num mt-0.5 text-xs text-slate-400">
                    কেনা: {formatCurrency(activeStats.bought, numerals)} · বাকি:{' '}
                    {formatCurrency(activeStats.remaining, numerals)}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {activeStats.bought > 0 && (
                    <button
                      type="button"
                      onClick={() => setConfirmLogBudget(activeBudget)}
                      title="খরচে যুক্ত করুন"
                      className="h-10 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      <ReceiptText className="w-3.5 h-3.5" />
                      <span>খরচে যোগ</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => openEditBudget(activeBudget)}
                    aria-label="সম্পাদনা"
                    className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingBudget(activeBudget)}
                    aria-label="মুছুন"
                    className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Quick Inline Add */}
              <form
                onSubmit={handleQuickAddItem}
                className="my-4 flex items-center gap-2"
              >
                <input
                  type="text"
                  value={quickName}
                  onChange={(e) => setQuickName(e.target.value)}
                  placeholder="আইটেমের নাম..."
                  className="flex-1 min-h-[44px] px-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 text-sm focus:outline-none"
                />
                <input
                  type="text"
                  inputMode="decimal"
                  value={quickCost}
                  onChange={(e) => setQuickCost(e.target.value)}
                  placeholder="৳ দাম"
                  className="font-num w-24 min-h-[44px] px-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 text-sm font-semibold focus:outline-none"
                />
                <button
                  type="submit"
                  aria-label="যোগ করুন"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-2xl bg-slate-900 dark:bg-emerald-600 text-white"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </form>

              {/* Items */}
              {activeBudget.items.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-400">
                  আইটেম যোগ করুন
                </p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {activeBudget.items.map((item) => (
                    <div
                      key={item.id}
                      className="min-h-[54px] py-2.5 flex items-center justify-between gap-2"
                    >
                      <button
                        type="button"
                        onClick={() => onToggleItem(activeBudget.id, item.id)}
                        className="min-h-[44px] flex-1 flex items-center gap-3 text-left min-w-0"
                      >
                        <span
                          className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                            item.bought
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'border-slate-300 dark:border-slate-600'
                          }`}
                        >
                          {item.bought && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                        </span>
                        <span
                          className={`text-sm font-medium truncate ${
                            item.bought
                              ? 'line-through text-slate-400 dark:text-slate-500'
                              : 'text-slate-900 dark:text-slate-100'
                          }`}
                        >
                          {item.name}
                        </span>
                      </button>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingItem({ budgetId: activeBudget.id, item });
                            setEditItemName(item.name);
                            setEditItemCost(String(item.cost));
                          }}
                          className={`font-num px-2 py-1 rounded-lg text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-800 ${
                            item.bought
                              ? 'text-slate-400 line-through'
                              : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {formatCurrency(item.cost, numerals)}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteItem(activeBudget.id, item.id)}
                          aria-label="মুছুন"
                          className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Modals */}
      <ModalSheet
        open={budgetModalOpen}
        onClose={() => setBudgetModalOpen(false)}
        title={editingBudget ? 'তালিকা সম্পাদনা' : 'নতুন বাজেট তালিকা'}
        maxWidthClass="sm:max-w-md"
      >
        <form onSubmit={handleSaveBudget} className="space-y-4">
          <input
            type="text"
            value={bName}
            onChange={(e) => setBName(e.target.value)}
            placeholder="তালিকার নাম *"
            autoFocus
            className="w-full min-h-[46px] px-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 text-sm"
          />
          <input
            type="text"
            inputMode="decimal"
            value={bLimit}
            onChange={(e) => setBLimit(e.target.value)}
            placeholder="সর্বোচ্চ সীমা ৳ (ঐচ্ছিক)"
            className="font-num w-full min-h-[46px] px-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 text-sm"
          />
          <button
            type="submit"
            className="w-full min-h-[48px] rounded-2xl text-sm font-semibold text-white bg-slate-900 dark:bg-emerald-600"
          >
            সংরক্ষণ করুন
          </button>
        </form>
      </ModalSheet>

      <ModalSheet
        open={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
        title="আইটেম সম্পাদনা"
        maxWidthClass="sm:max-w-md"
      >
        <form onSubmit={handleSaveItemEdit} className="space-y-4">
          <input
            type="text"
            value={editItemName}
            onChange={(e) => setEditItemName(e.target.value)}
            className="w-full min-h-[46px] px-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 text-sm"
          />
          <input
            type="text"
            inputMode="decimal"
            value={editItemCost}
            onChange={(e) => setEditItemCost(e.target.value)}
            className="font-num w-full min-h-[46px] px-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 text-sm font-bold"
          />
          <button
            type="submit"
            className="w-full min-h-[48px] rounded-2xl text-sm font-semibold text-white bg-slate-900 dark:bg-emerald-600"
          >
            আপডেট করুন
          </button>
        </form>
      </ModalSheet>

      <ConfirmDialog
        open={Boolean(deletingBudget)}
        title="তালিকা মুছবেন?"
        description={deletingBudget ? `"${deletingBudget.name}" মুছে ফেলা হবে।` : ''}
        onConfirm={() => {
          if (deletingBudget) {
            onDeleteBudget(deletingBudget.id);
            if (selectedBudgetId === deletingBudget.id) {
              setSelectedBudgetId(null);
              setMobileDetailOpen(false);
            }
          }
        }}
        onCancel={() => setDeletingBudget(null)}
      />

      <ConfirmDialog
        open={Boolean(confirmLogBudget)}
        title="খরচে যুক্ত করবেন?"
        description={
          confirmLogBudget
            ? `কেনা আইটেমের মোট খরচ (${formatCurrency(
                activeStats.bought,
                numerals
              )}) চলতি মাসের ব্যয়ে যোগ হবে।`
            : ''
        }
        confirmLabel="যোগ করুন"
        danger={false}
        onConfirm={() => {
          if (confirmLogBudget) onLogBoughtToExpense(confirmLogBudget.id);
        }}
        onCancel={() => setConfirmLogBudget(null)}
      />
    </div>
  );
}
