import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AppSecurityConfig,
  AppSettings,
  Budget,
  BudgetItem,
  DebtProfile,
  DebtTransactionType,
  RecurringBill,
  SavingsGoal,
  ScheduledTodo,
  TodoPriority,
  Transaction,
  TransactionType,
} from '../types/finance';
import {
  clearPinLockout,
  generateSaltHex,
  hashSecret,
  hashSecretPBKDF2,
  isExternalPickerRecentlyActive,
  timingSafeEqual,
} from '../utils/crypto';
import {
  clearAllContacts,
  importContactsJson,
  listAllContacts,
  loadContactGroups,
} from '../utils/contactsDb';
import { saveBlobOffline } from '../utils/fileSaver';
import {
  formatCurrentTimestamp,
  getCurrentMonthKey,
  inferCategoryFromNote,
  shiftMonthKey,
} from '../utils/formatters';

const INIT_FLAG_KEY = 'amar_hisab_initialized_v2';
const SETTINGS_KEY = 'amar_hisab_settings_v3';
const TODOS_KEY = 'amar_hisab_todos_v1';
const SAVINGS_KEY = 'amar_hisab_savings_v1';
const BILLS_KEY = 'amar_hisab_bills_v1';
const SECURITY_KEY = 'amar_hisab_security_v1';

function readAllTransactionsFromStorage(): Record<string, Transaction[]> {
  const map: Record<string, Transaction[]> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('transactions_')) {
        const monthKey = key.replace('transactions_', '');
        if (/^\d{4}-\d{2}$/.test(monthKey)) {
          const parsed = JSON.parse(localStorage.getItem(key) || '[]');
          if (Array.isArray(parsed)) {
            map[monthKey] = parsed.map((t: Transaction) => ({
              ...t,
              id: Number(t.id),
              amount: Number(t.amount) || 0,
              monthKey: t.monthKey || monthKey,
              category: t.category || inferCategoryFromNote(t.note || '', t.type),
            }));
          }
        }
      }
    }
  } catch {
    // Ignore malformed entries
  }
  return map;
}

function syncMonthLegacyKeys(monthKey: string, list: Transaction[]) {
  try {
    const income = list
      .filter((t) => t.type === 'income')
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    const expense = list
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    localStorage.setItem(`transactions_${monthKey}`, JSON.stringify(list));
    localStorage.setItem(`income_${monthKey}`, String(income));
    localStorage.setItem(`expense_${monthKey}`, String(expense));
    localStorage.setItem(`balance_${monthKey}`, String(income - expense));
  } catch {
    // Ignore quota issues
  }
}

export interface ToastInfo {
  id: number;
  message: string;
  tone: 'neutral' | 'success' | 'danger';
}

export function useFinanceStore() {
  const [selectedMonth, setSelectedMonth] = useState<string>(() => getCurrentMonthKey());
  const [transactionsByMonth, setTransactionsByMonth] = useState<
    Record<string, Transaction[]>
  >({});
  const [debtProfiles, setDebtProfiles] = useState<DebtProfile[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [todos, setTodos] = useState<ScheduledTodo[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [recurringBills, setRecurringBills] = useState<RecurringBill[]>([]);

  const [securityConfig, setSecurityConfig] = useState<AppSecurityConfig | null>(
    () => {
      try {
        const raw = localStorage.getItem(SECURITY_KEY);
        if (raw) return JSON.parse(raw) as AppSecurityConfig;
      } catch {
        // ignore
      }
      return null;
    }
  );
  const [isAppLocked, setIsAppLocked] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(SECURITY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AppSecurityConfig;
        return Boolean(parsed.enabled && parsed.pinHash);
      }
    } catch {
      // ignore
    }
    return false;
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          theme: parsed.theme || 'light',
          numerals: parsed.numerals || 'en',
          cardTheme: parsed.cardTheme || 'emerald',
        };
      }
    } catch {
      // ignore
    }
    return { theme: 'light', numerals: 'en', cardTheme: 'emerald' };
  });
  const [toast, setToast] = useState<ToastInfo | null>(null);

  const showToast = useCallback(
    (message: string, tone: 'neutral' | 'success' | 'danger' = 'neutral') => {
      const id = Date.now();
      setToast({ id, message, tone });
      setTimeout(() => {
        setToast((prev) => (prev?.id === id ? null : prev));
      }, 2400);
    },
    []
  );

  // Initial load
  useEffect(() => {
    localStorage.setItem(INIT_FLAG_KEY, 'true');
    setTransactionsByMonth(readAllTransactionsFromStorage());

    try {
      const rawProfiles = JSON.parse(localStorage.getItem('debt_profiles') || '[]');
      if (Array.isArray(rawProfiles)) {
        setDebtProfiles(
          rawProfiles.map((p: DebtProfile) => ({
            id: Number(p.id),
            name: p.name || '',
            phone: p.phone || '',
            address: p.address || '',
            debt: Number(p.debt) || 0,
            credit: Number(p.credit) || 0,
            transactions: Array.isArray(p.transactions)
              ? p.transactions.map((t) => ({
                  ...t,
                  id: Number(t.id),
                  amount: Number(t.amount) || 0,
                }))
              : [],
          }))
        );
      }
    } catch {
      setDebtProfiles([]);
    }

    try {
      const rawBudgets = JSON.parse(localStorage.getItem('budgets') || '[]');
      if (Array.isArray(rawBudgets)) {
        setBudgets(
          rawBudgets.map((b: Budget) => ({
            id: Number(b.id),
            name: b.name || '',
            limit: b.limit ? Number(b.limit) : undefined,
            loggedToExpense: Boolean(b.loggedToExpense),
            items: Array.isArray(b.items)
              ? b.items.map((it: BudgetItem) => ({
                  id: Number(it.id),
                  name: it.name || '',
                  cost: Number(it.cost) || 0,
                  bought: Boolean(it.bought),
                }))
              : [],
          }))
        );
      }
    } catch {
      setBudgets([]);
    }

    try {
      const rawTodos = JSON.parse(localStorage.getItem(TODOS_KEY) || '[]');
      if (Array.isArray(rawTodos)) setTodos(rawTodos);
    } catch {
      setTodos([]);
    }

    try {
      const rawSavings = JSON.parse(localStorage.getItem(SAVINGS_KEY) || '[]');
      if (Array.isArray(rawSavings)) {
        setSavingsGoals(rawSavings);
      }
    } catch {
      setSavingsGoals([]);
    }

    try {
      const rawBills = JSON.parse(localStorage.getItem(BILLS_KEY) || '[]');
      if (Array.isArray(rawBills)) {
        setRecurringBills(rawBills);
      }
    } catch {
      setRecurringBills([]);
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // ignore
    }
  }, [settings]);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  // --- App Security / Lock ---
  const saveAppSecurity = useCallback(
    async (params: {
      pin: string;
      question1: string;
      answer1: string;
      question2: string;
      answer2: string;
      autoLockSeconds?: number;
    }) => {
      const saltHex = generateSaltHex();
      const pinHash = await hashSecretPBKDF2('app_pin::' + params.pin, saltHex);
      const answer1Hash = await hashSecretPBKDF2(
        'app_q1::' + params.answer1,
        saltHex
      );
      const answer2Hash = await hashSecretPBKDF2(
        'app_q2::' + params.answer2,
        saltHex
      );
      const cfg: AppSecurityConfig = {
        enabled: true,
        version: 2,
        saltHex,
        autoLockSeconds:
          params.autoLockSeconds !== undefined
            ? params.autoLockSeconds
            : securityConfig?.autoLockSeconds ?? 60,
        pinHash,
        question1: params.question1.trim(),
        answer1Hash,
        question2: params.question2.trim(),
        answer2Hash,
      };
      localStorage.setItem(SECURITY_KEY, JSON.stringify(cfg));
      clearPinLockout('app');
      setSecurityConfig(cfg);
      showToast('অ্যাপ লক পিন সক্রিয় করা হয়েছে', 'success');
    },
    [securityConfig?.autoLockSeconds, showToast]
  );

  const updateAutoLockSeconds = useCallback(
    (seconds: number) => {
      if (!securityConfig) return;
      const updated: AppSecurityConfig = {
        ...securityConfig,
        autoLockSeconds: seconds,
      };
      localStorage.setItem(SECURITY_KEY, JSON.stringify(updated));
      setSecurityConfig(updated);
      showToast('অটো-লক সময় আপডেট হয়েছে', 'success');
    },
    [securityConfig, showToast]
  );

  const updateAppPinOnly = useCallback(
    async (newPin: string) => {
      if (!securityConfig) return;
      const pinHash =
        securityConfig.version === 2 && securityConfig.saltHex
          ? await hashSecretPBKDF2(
              'app_pin::' + newPin,
              securityConfig.saltHex
            )
          : await hashSecret('app_pin::' + newPin);
      const updated: AppSecurityConfig = {
        ...securityConfig,
        enabled: true,
        pinHash,
      };
      localStorage.setItem(SECURITY_KEY, JSON.stringify(updated));
      clearPinLockout('app');
      setSecurityConfig(updated);
      setIsAppLocked(false);
      showToast('নতুন পিন সেট করা হয়েছে', 'success');
    },
    [securityConfig, showToast]
  );

  const disableAppSecurity = useCallback(() => {
    localStorage.removeItem(SECURITY_KEY);
    clearPinLockout('app');
    setSecurityConfig(null);
    setIsAppLocked(false);
    showToast('অ্যাপ লক বন্ধ করা হয়েছে', 'neutral');
  }, [showToast]);

  const verifyAppPin = useCallback(
    async (candidatePin: string): Promise<boolean> => {
      if (!securityConfig) return true;
      let matched = false;
      if (securityConfig.version === 2 && securityConfig.saltHex) {
        const h = await hashSecretPBKDF2(
          'app_pin::' + candidatePin,
          securityConfig.saltHex
        );
        matched = timingSafeEqual(h, securityConfig.pinHash);
      } else {
        const hLegacy = await hashSecret('app_pin::' + candidatePin);
        matched = timingSafeEqual(hLegacy, securityConfig.pinHash);
      }

      if (matched) {
        clearPinLockout('app');
        setIsAppLocked(false);
        return true;
      }
      return false;
    },
    [securityConfig]
  );

  const verifySecurityAnswers = useCallback(
    async (a1: string, a2: string): Promise<boolean> => {
      if (!securityConfig) return false;
      if (securityConfig.version === 2 && securityConfig.saltHex) {
        const h1 = await hashSecretPBKDF2(
          'app_q1::' + a1,
          securityConfig.saltHex
        );
        const h2 = await hashSecretPBKDF2(
          'app_q2::' + a2,
          securityConfig.saltHex
        );
        return (
          timingSafeEqual(h1, securityConfig.answer1Hash) &&
          timingSafeEqual(h2, securityConfig.answer2Hash)
        );
      }
      const h1 = await hashSecret('app_q1::' + a1);
      const h2 = await hashSecret('app_q2::' + a2);
      return (
        timingSafeEqual(h1, securityConfig.answer1Hash) &&
        timingSafeEqual(h2, securityConfig.answer2Hash)
      );
    },
    [securityConfig]
  );

  const lockAppNow = useCallback(() => {
    if (securityConfig?.enabled) {
      setIsAppLocked(true);
    }
  }, [securityConfig]);

  // Background inactivity auto-lock (respects external file picker on Android)
  useEffect(() => {
    if (!securityConfig?.enabled) return;
    const autoLockSec = securityConfig.autoLockSeconds ?? 60;
    if (autoLockSec <= 0) return;

    let hiddenSince: number | null = null;

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (!isExternalPickerRecentlyActive()) {
          hiddenSince = Date.now();
        }
      } else if (document.visibilityState === 'visible') {
        if (
          hiddenSince !== null &&
          !isExternalPickerRecentlyActive() &&
          Date.now() - hiddenSince >= autoLockSec * 1000
        ) {
          setIsAppLocked(true);
        }
        hiddenSince = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibility);
  }, [securityConfig?.enabled, securityConfig?.autoLockSeconds]);

  // --- Clear / Seed ---
  const clearAllData = useCallback(
    (silent = false) => {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (
            k &&
            (k.startsWith('transactions_') ||
              k.startsWith('income_') ||
              k.startsWith('expense_') ||
              k.startsWith('balance_') ||
              k === 'debt_profiles' ||
              k === 'budgets' ||
              k === TODOS_KEY ||
              k === SAVINGS_KEY ||
              k === BILLS_KEY)
          ) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
        localStorage.setItem(INIT_FLAG_KEY, 'true');
      } catch {
        // ignore
      }
      setTransactionsByMonth({});
      setDebtProfiles([]);
      setBudgets([]);
      setTodos([]);
      setSavingsGoals([]);
      setRecurringBills([]);
      if (!silent) {
        showToast('সব হিসাব মুছে ফেলা হয়েছে', 'neutral');
      }
    },
    [showToast]
  );

  const availableMonths = useMemo(() => {
    const set = new Set<string>(Object.keys(transactionsByMonth));
    const cur = getCurrentMonthKey();
    for (let i = -12; i <= 6; i++) {
      set.add(shiftMonthKey(cur, i));
    }
    set.add(selectedMonth);
    return Array.from(set).sort().reverse();
  }, [transactionsByMonth, selectedMonth]);

  const monthSummary = useMemo(() => {
    const currentList = transactionsByMonth[selectedMonth] || [];
    const income = currentList
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const expense = currentList
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    let previousBalance = 0;
    Object.entries(transactionsByMonth).forEach(([mKey, list]) => {
      if (mKey < selectedMonth) {
        const mInc = list
          .filter((t) => t.type === 'income')
          .reduce((s, t) => s + t.amount, 0);
        const mExp = list
          .filter((t) => t.type === 'expense')
          .reduce((s, t) => s + t.amount, 0);
        previousBalance += mInc - mExp;
      }
    });

    const netMonth = income - expense;
    const closingBalance = previousBalance + netMonth;

    return {
      transactions: currentList,
      income,
      expense,
      netMonth,
      previousBalance,
      closingBalance,
    };
  }, [transactionsByMonth, selectedMonth]);

  const debtSummary = useMemo(() => {
    let totalDebt = 0;
    let totalCredit = 0;
    debtProfiles.forEach((p) => {
      totalDebt += Number(p.debt) || 0;
      totalCredit += Number(p.credit) || 0;
    });
    return {
      totalDebt,
      totalCredit,
      netPosition: totalCredit - totalDebt,
      profileCount: debtProfiles.length,
    };
  }, [debtProfiles]);

  const budgetSummary = useMemo(() => {
    let totalPlanned = 0;
    let totalBought = 0;
    let totalItems = 0;
    let boughtItems = 0;
    budgets.forEach((b) => {
      b.items.forEach((it) => {
        const c = Number(it.cost) || 0;
        totalPlanned += c;
        totalItems += 1;
        if (it.bought) {
          totalBought += c;
          boughtItems += 1;
        }
      });
    });
    return {
      totalPlanned,
      totalBought,
      totalRemaining: Math.max(0, totalPlanned - totalBought),
      totalItems,
      boughtItems,
      budgetCount: budgets.length,
    };
  }, [budgets]);

  // --- Transaction CRUD ---
  const addTransaction = useCallback(
    (payload: {
      amount: number;
      type: TransactionType;
      note: string;
      category?: string;
      monthKey?: string;
    }) => {
      const mKey = payload.monthKey || selectedMonth;
      const newTx: Transaction = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        amount: payload.amount,
        type: payload.type,
        note: payload.note.trim(),
        category:
          payload.category || inferCategoryFromNote(payload.note, payload.type),
        time: formatCurrentTimestamp(),
        timestamp: Date.now(),
        monthKey: mKey,
      };

      setTransactionsByMonth((prev) => {
        const updatedList = [...(prev[mKey] || []), newTx];
        syncMonthLegacyKeys(mKey, updatedList);
        return { ...prev, [mKey]: updatedList };
      });
      showToast(payload.type === 'income' ? 'আয় যোগ হয়েছে' : 'খরচ যোগ হয়েছে', 'success');
    },
    [selectedMonth, showToast]
  );

  const updateTransaction = useCallback(
    (
      originalMonthKey: string,
      txId: number,
      updates: {
        amount: number;
        type: TransactionType;
        note: string;
        category: string;
        monthKey: string;
      }
    ) => {
      setTransactionsByMonth((prev) => {
        const sourceList = prev[originalMonthKey] || [];
        const existing = sourceList.find((t) => t.id === txId);
        if (!existing) return prev;

        const updatedTx: Transaction = {
          ...existing,
          amount: updates.amount,
          type: updates.type,
          note: updates.note.trim(),
          category: updates.category,
          monthKey: updates.monthKey,
        };

        if (originalMonthKey === updates.monthKey) {
          const nextList = sourceList.map((t) => (t.id === txId ? updatedTx : t));
          syncMonthLegacyKeys(originalMonthKey, nextList);
          return { ...prev, [originalMonthKey]: nextList };
        } else {
          const nextSource = sourceList.filter((t) => t.id !== txId);
          const nextTarget = [...(prev[updates.monthKey] || []), updatedTx];
          syncMonthLegacyKeys(originalMonthKey, nextSource);
          syncMonthLegacyKeys(updates.monthKey, nextTarget);
          return {
            ...prev,
            [originalMonthKey]: nextSource,
            [updates.monthKey]: nextTarget,
          };
        }
      });
      showToast('হিসাব আপডেট হয়েছে', 'success');
    },
    [showToast]
  );

  const deleteTransaction = useCallback(
    (monthKey: string, txId: number) => {
      setTransactionsByMonth((prev) => {
        const nextList = (prev[monthKey] || []).filter((t) => t.id !== txId);
        syncMonthLegacyKeys(monthKey, nextList);
        return { ...prev, [monthKey]: nextList };
      });
      showToast('হিসাব মুছে ফেলা হয়েছে', 'neutral');
    },
    [showToast]
  );

  // --- Debt / Khata CRUD ---
  const saveDebtProfiles = useCallback((next: DebtProfile[]) => {
    setDebtProfiles(next);
    try {
      localStorage.setItem('debt_profiles', JSON.stringify(next));
    } catch {
      // ignore
    }
  }, []);

  const addDebtProfile = useCallback(
    (payload: { name: string; phone: string; address: string }) => {
      const profile: DebtProfile = {
        id: Date.now(),
        name: payload.name.trim(),
        phone: payload.phone.trim(),
        address: payload.address.trim(),
        debt: 0,
        credit: 0,
        transactions: [],
      };
      saveDebtProfiles([...debtProfiles, profile]);
      showToast('প্রোফাইল তৈরি হয়েছে', 'success');
      return profile.id;
    },
    [debtProfiles, saveDebtProfiles, showToast]
  );

  const updateDebtProfile = useCallback(
    (profileId: number, payload: { name: string; phone: string; address: string }) => {
      const next = debtProfiles.map((p) =>
        p.id === profileId
          ? {
              ...p,
              name: payload.name.trim(),
              phone: payload.phone.trim(),
              address: payload.address.trim(),
            }
          : p
      );
      saveDebtProfiles(next);
      showToast('প্রোফাইল আপডেট হয়েছে', 'success');
    },
    [debtProfiles, saveDebtProfiles, showToast]
  );

  const deleteDebtProfile = useCallback(
    (profileId: number) => {
      saveDebtProfiles(debtProfiles.filter((p) => p.id !== profileId));
      showToast('প্রোফাইল মুছে ফেলা হয়েছে', 'neutral');
    },
    [debtProfiles, saveDebtProfiles, showToast]
  );

  const addDebtTransaction = useCallback(
    (
      profileId: number,
      payload: { type: DebtTransactionType; amount: number; note: string }
    ) => {
      const tx = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        type: payload.type,
        amount: payload.amount,
        note: payload.note.trim(),
        time: formatCurrentTimestamp(),
        timestamp: Date.now(),
      };
      const next = debtProfiles.map((p) => {
        if (p.id !== profileId) return p;
        return {
          ...p,
          debt: payload.type === 'debt' ? p.debt + payload.amount : p.debt,
          credit: payload.type === 'credit' ? p.credit + payload.amount : p.credit,
          transactions: [...p.transactions, tx],
        };
      });
      saveDebtProfiles(next);
      showToast('হিসাব সংরক্ষিত হয়েছে', 'success');
    },
    [debtProfiles, saveDebtProfiles, showToast]
  );

  const deleteDebtTransaction = useCallback(
    (profileId: number, txId: number) => {
      const next = debtProfiles.map((p) => {
        if (p.id !== profileId) return p;
        const target = p.transactions.find((t) => t.id === txId);
        if (!target) return p;
        return {
          ...p,
          debt:
            target.type === 'debt'
              ? Math.max(0, p.debt - target.amount)
              : p.debt,
          credit:
            target.type === 'credit'
              ? Math.max(0, p.credit - target.amount)
              : p.credit,
          transactions: p.transactions.filter((t) => t.id !== txId),
        };
      });
      saveDebtProfiles(next);
      showToast('লেনদেন মুছে ফেলা হয়েছে', 'neutral');
    },
    [debtProfiles, saveDebtProfiles, showToast]
  );

  const settleDebtProfile = useCallback(
    (profileId: number) => {
      const profile = debtProfiles.find((p) => p.id === profileId);
      if (!profile) return;
      const diff = profile.credit - profile.debt;
      if (Math.abs(diff) < 0.01) return;

      const balancingType: DebtTransactionType = diff > 0 ? 'debt' : 'credit';
      const amount = Math.abs(diff);
      addDebtTransaction(profileId, {
        type: balancingType,
        amount,
        note: 'পরিশোধ সম্পন্ন',
      });
    },
    [debtProfiles, addDebtTransaction]
  );

  // --- Budget CRUD ---
  const saveBudgets = useCallback((next: Budget[]) => {
    setBudgets(next);
    try {
      localStorage.setItem('budgets', JSON.stringify(next));
    } catch {
      // ignore
    }
  }, []);

  const addBudget = useCallback(
    (payload: { name: string; limit?: number }) => {
      const newBudget: Budget = {
        id: Date.now(),
        name: payload.name.trim(),
        limit: payload.limit && payload.limit > 0 ? payload.limit : undefined,
        items: [],
      };
      saveBudgets([...budgets, newBudget]);
      showToast('বাজেট তৈরি হয়েছে', 'success');
      return newBudget.id;
    },
    [budgets, saveBudgets, showToast]
  );

  const updateBudget = useCallback(
    (budgetId: number, payload: { name: string; limit?: number }) => {
      const next = budgets.map((b) =>
        b.id === budgetId
          ? {
              ...b,
              name: payload.name.trim(),
              limit: payload.limit && payload.limit > 0 ? payload.limit : undefined,
            }
          : b
      );
      saveBudgets(next);
      showToast('বাজেট আপডেট হয়েছে', 'success');
    },
    [budgets, saveBudgets, showToast]
  );

  const deleteBudget = useCallback(
    (budgetId: number) => {
      saveBudgets(budgets.filter((b) => b.id !== budgetId));
      showToast('বাজেট মুছে ফেলা হয়েছে', 'neutral');
    },
    [budgets, saveBudgets, showToast]
  );

  const addBudgetItem = useCallback(
    (budgetId: number, payload: { name: string; cost: number }) => {
      const item: BudgetItem = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        name: payload.name.trim(),
        cost: payload.cost,
        bought: false,
      };
      const next = budgets.map((b) =>
        b.id === budgetId ? { ...b, items: [...b.items, item] } : b
      );
      saveBudgets(next);
    },
    [budgets, saveBudgets]
  );

  const toggleBudgetItem = useCallback(
    (budgetId: number, itemId: number) => {
      const next = budgets.map((b) => {
        if (b.id !== budgetId) return b;
        return {
          ...b,
          items: b.items.map((it) =>
            it.id === itemId ? { ...it, bought: !it.bought } : it
          ),
        };
      });
      saveBudgets(next);
    },
    [budgets, saveBudgets]
  );

  const updateBudgetItem = useCallback(
    (budgetId: number, itemId: number, payload: { name: string; cost: number }) => {
      const next = budgets.map((b) => {
        if (b.id !== budgetId) return b;
        return {
          ...b,
          items: b.items.map((it) =>
            it.id === itemId
              ? { ...it, name: payload.name.trim(), cost: payload.cost }
              : it
          ),
        };
      });
      saveBudgets(next);
      showToast('আইটেম আপডেট হয়েছে', 'success');
    },
    [budgets, saveBudgets, showToast]
  );

  const deleteBudgetItem = useCallback(
    (budgetId: number, itemId: number) => {
      const next = budgets.map((b) =>
        b.id === budgetId
          ? { ...b, items: b.items.filter((it) => it.id !== itemId) }
          : b
      );
      saveBudgets(next);
    },
    [budgets, saveBudgets]
  );

  const logBoughtItemsToExpense = useCallback(
    (budgetId: number) => {
      const budget = budgets.find((b) => b.id === budgetId);
      if (!budget) return;
      const boughtList = budget.items.filter((i) => i.bought);
      const sum = boughtList.reduce((s, i) => s + i.cost, 0);
      if (sum <= 0) {
        showToast('প্রথমে আইটেমে টিক দিন', 'danger');
        return;
      }
      addTransaction({
        amount: sum,
        type: 'expense',
        note: budget.name,
        category: inferCategoryFromNote(budget.name, 'expense'),
        monthKey: getCurrentMonthKey(),
      });
      const next = budgets.map((b) =>
        b.id === budgetId ? { ...b, loggedToExpense: true } : b
      );
      saveBudgets(next);
    },
    [budgets, addTransaction, saveBudgets, showToast]
  );

  // --- Scheduled Todos CRUD ---
  const saveTodos = useCallback((next: ScheduledTodo[]) => {
    setTodos(next);
    try {
      localStorage.setItem(TODOS_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }, []);

  const addTodo = useCallback(
    (payload: {
      title: string;
      note: string;
      scheduledAt: string;
      priority: TodoPriority;
    }) => {
      const item: ScheduledTodo = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        title: payload.title.trim(),
        note: payload.note.trim(),
        scheduledAt: payload.scheduledAt,
        priority: payload.priority,
        completed: false,
        notified: false,
        createdAt: Date.now(),
      };
      saveTodos([item, ...todos]);
      showToast('রিমাইন্ডার সেট করা হয়েছে', 'success');
    },
    [todos, saveTodos, showToast]
  );

  const toggleTodo = useCallback(
    (id: number) => {
      saveTodos(
        todos.map((t) =>
          t.id === id ? { ...t, completed: !t.completed } : t
        )
      );
    },
    [todos, saveTodos]
  );

  const markTodoNotified = useCallback((id: number) => {
    setTodos((prev) => {
      const next = prev.map((t) =>
        t.id === id ? { ...t, notified: true } : t
      );
      try {
        localStorage.setItem(TODOS_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const deleteTodo = useCallback(
    (id: number) => {
      saveTodos(todos.filter((t) => t.id !== id));
      showToast('টাস্ক মুছে ফেলা হয়েছে', 'neutral');
    },
    [todos, saveTodos, showToast]
  );

  // --- Savings Goals CRUD ---
  const saveSavings = useCallback((next: SavingsGoal[]) => {
    setSavingsGoals(next);
    try {
      localStorage.setItem(SAVINGS_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }, []);

  const addSavingsGoal = useCallback(
    (payload: { name: string; targetAmount: number; deadline?: string }) => {
      const goal: SavingsGoal = {
        id: Date.now(),
        name: payload.name.trim(),
        targetAmount: payload.targetAmount,
        savedAmount: 0,
        deadline: payload.deadline,
        entries: [],
      };
      saveSavings([...savingsGoals, goal]);
      showToast('সঞ্চয় লক্ষ্যমাত্রা তৈরি হয়েছে', 'success');
    },
    [savingsGoals, saveSavings, showToast]
  );

  const addSavingsEntry = useCallback(
    (
      goalId: number,
      payload: { amount: number; type: 'deposit' | 'withdraw'; note: string }
    ) => {
      const next = savingsGoals.map((g) => {
        if (g.id !== goalId) return g;
        const delta =
          payload.type === 'deposit' ? payload.amount : -payload.amount;
        return {
          ...g,
          savedAmount: Math.max(0, g.savedAmount + delta),
          entries: [
            {
              id: Date.now(),
              amount: payload.amount,
              type: payload.type,
              note:
                payload.note.trim() ||
                (payload.type === 'deposit' ? 'টাকা জমা' : 'টাকা উত্তোলন'),
              time: formatCurrentTimestamp(),
            },
            ...g.entries,
          ],
        };
      });
      saveSavings(next);
      showToast(
        payload.type === 'deposit' ? 'সঞ্চয় জমা হয়েছে' : 'সঞ্চয় উত্তোলন হয়েছে',
        'success'
      );
    },
    [savingsGoals, saveSavings, showToast]
  );

  const deleteSavingsGoal = useCallback(
    (goalId: number) => {
      saveSavings(savingsGoals.filter((g) => g.id !== goalId));
      showToast('লক্ষ্যমাত্রা মুছে ফেলা হয়েছে', 'neutral');
    },
    [savingsGoals, saveSavings, showToast]
  );

  // --- Recurring Bills CRUD ---
  const saveBills = useCallback((next: RecurringBill[]) => {
    setRecurringBills(next);
    try {
      localStorage.setItem(BILLS_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }, []);

  const addRecurringBill = useCallback(
    (payload: {
      name: string;
      amount: number;
      dueDay: number;
      category: string;
    }) => {
      const bill: RecurringBill = {
        id: Date.now(),
        name: payload.name.trim(),
        amount: payload.amount,
        dueDay: Math.max(1, Math.min(31, payload.dueDay)),
        category: payload.category || 'housing',
        paidMonths: [],
      };
      saveBills([...recurringBills, bill]);
      showToast('মাসিক বিল যুক্ত হয়েছে', 'success');
    },
    [recurringBills, saveBills, showToast]
  );

  const toggleBillPaid = useCallback(
    (billId: number, monthKey: string, alsoLogExpense: boolean) => {
      const target = recurringBills.find((b) => b.id === billId);
      if (!target) return;
      const alreadyPaid = target.paidMonths.includes(monthKey);
      const next = recurringBills.map((b) => {
        if (b.id !== billId) return b;
        return {
          ...b,
          paidMonths: alreadyPaid
            ? b.paidMonths.filter((m) => m !== monthKey)
            : [...b.paidMonths, monthKey],
        };
      });
      saveBills(next);

      if (!alreadyPaid && alsoLogExpense) {
        addTransaction({
          amount: target.amount,
          type: 'expense',
          note: target.name,
          category: target.category,
          monthKey,
        });
      } else if (!alreadyPaid) {
        showToast('বিল পরিশোধিত চিহ্নিত হয়েছে', 'success');
      }
    },
    [recurringBills, saveBills, addTransaction, showToast]
  );

  const deleteRecurringBill = useCallback(
    (billId: number) => {
      saveBills(recurringBills.filter((b) => b.id !== billId));
      showToast('বিল মুছে ফেলা হয়েছে', 'neutral');
    },
    [recurringBills, saveBills, showToast]
  );

  // --- Unified Backup (Includes Finance, Todos, Goals, Bills & Contacts) ---
  const exportBackupJson = useCallback(() => {
    void (async () => {
      let contacts = [] as Awaited<ReturnType<typeof listAllContacts>>;
      try {
        contacts = await listAllContacts();
      } catch {
        contacts = [];
      }
      const contactGroups = loadContactGroups();
      const payload = {
        app: 'AmarHisab',
        version: 5,
        exportedAt: new Date().toISOString(),
        settings,
        transactionsByMonth,
        debtProfiles,
        budgets,
        todos,
        savingsGoals,
        recurringBills,
        contactGroups,
        contacts,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      });
      await saveBlobOffline(blob, `amar-hisab-${getCurrentMonthKey()}.json`);
      showToast('ব্যাকআপ সংরক্ষিত হয়েছে', 'success');
    })();
  }, [
    settings,
    transactionsByMonth,
    debtProfiles,
    budgets,
    todos,
    savingsGoals,
    recurringBills,
    showToast,
  ]);

  const importBackupJson = useCallback(
    (jsonText: string): boolean => {
      try {
        const parsed = JSON.parse(jsonText);
        if (
          !parsed ||
          typeof parsed !== 'object' ||
          (!parsed.transactionsByMonth &&
            !parsed.debtProfiles &&
            !parsed.budgets &&
            !parsed.contacts)
        ) {
          showToast('সঠিক ব্যাকআপ ফাইল দিন', 'danger');
          return false;
        }
        clearAllData(true);

        if (
          parsed.transactionsByMonth &&
          typeof parsed.transactionsByMonth === 'object'
        ) {
          const rawTxMap = parsed.transactionsByMonth as Record<
            string,
            unknown
          >;
          const cleanTxMap: Record<string, Transaction[]> = {};
          Object.entries(rawTxMap).forEach(([mKey, list]) => {
            if (!/^\d{4}-\d{2}$/.test(mKey) || !Array.isArray(list)) return;
            const sanitizedList: Transaction[] = [];
            for (const rawTx of list) {
              if (!rawTx || typeof rawTx !== 'object') continue;
              const t = rawTx as Partial<Transaction>;
              const amt = Number(t.amount);
              if (!Number.isFinite(amt) || amt < 0) continue;
              const txType: TransactionType =
                t.type === 'income' ? 'income' : 'expense';
              const safeNote = String(t.note || '').trim().slice(0, 240);
              sanitizedList.push({
                id: Number.isFinite(Number(t.id))
                  ? Number(t.id)
                  : Date.now() + Math.floor(Math.random() * 10000),
                amount: amt,
                type: txType,
                note: safeNote,
                category: t.category
                  ? String(t.category).trim().slice(0, 50)
                  : inferCategoryFromNote(safeNote, txType),
                time: String(t.time || formatCurrentTimestamp()).slice(0, 60),
                timestamp: Number.isFinite(Number(t.timestamp))
                  ? Number(t.timestamp)
                  : Date.now(),
                monthKey: mKey,
              });
            }
            cleanTxMap[mKey] = sanitizedList;
            syncMonthLegacyKeys(mKey, sanitizedList);
          });
          setTransactionsByMonth(cleanTxMap);

          const curMonth = getCurrentMonthKey();
          const monthKeys = Object.keys(cleanTxMap).sort();
          if (cleanTxMap[curMonth]) {
            setSelectedMonth(curMonth);
          } else if (monthKeys.length > 0) {
            setSelectedMonth(monthKeys[monthKeys.length - 1]);
          }
        }

        if (Array.isArray(parsed.debtProfiles)) {
          const safeProfiles: DebtProfile[] = parsed.debtProfiles
            .filter((p: unknown) => p && typeof p === 'object')
            .map((p: DebtProfile) => ({
              id: Number.isFinite(Number(p.id))
                ? Number(p.id)
                : Date.now() + Math.floor(Math.random() * 10000),
              name: String(p.name || '').trim().slice(0, 120),
              phone: String(p.phone || '').trim().slice(0, 40),
              address: String(p.address || '').trim().slice(0, 200),
              debt: Math.max(0, Number(p.debt) || 0),
              credit: Math.max(0, Number(p.credit) || 0),
              transactions: Array.isArray(p.transactions)
                ? p.transactions
                    .filter((tx) => tx && typeof tx === 'object')
                    .map((tx) => ({
                      id: Number.isFinite(Number(tx.id))
                        ? Number(tx.id)
                        : Date.now() + Math.floor(Math.random() * 10000),
                      type: (tx.type === 'debt'
                        ? 'debt'
                        : 'credit') as DebtTransactionType,
                      amount: Math.max(0, Number(tx.amount) || 0),
                      note: String(tx.note || '').trim().slice(0, 200),
                      time: String(tx.time || '').slice(0, 60),
                      timestamp: Number.isFinite(Number(tx.timestamp))
                        ? Number(tx.timestamp)
                        : undefined,
                    }))
                : [],
            }));
          saveDebtProfiles(safeProfiles);
        }

        if (Array.isArray(parsed.budgets)) {
          const safeBudgets: Budget[] = parsed.budgets
            .filter((b: unknown) => b && typeof b === 'object')
            .map((b: Budget) => ({
              id: Number.isFinite(Number(b.id))
                ? Number(b.id)
                : Date.now() + Math.floor(Math.random() * 10000),
              name: String(b.name || '').trim().slice(0, 120),
              limit:
                b.limit && Number(b.limit) > 0 ? Number(b.limit) : undefined,
              loggedToExpense: Boolean(b.loggedToExpense),
              items: Array.isArray(b.items)
                ? b.items
                    .filter((it) => it && typeof it === 'object')
                    .map((it: BudgetItem) => ({
                      id: Number.isFinite(Number(it.id))
                        ? Number(it.id)
                        : Date.now() + Math.floor(Math.random() * 10000),
                      name: String(it.name || '').trim().slice(0, 120),
                      cost: Math.max(0, Number(it.cost) || 0),
                      bought: Boolean(it.bought),
                    }))
                : [],
            }));
          saveBudgets(safeBudgets);
        }

        if (Array.isArray(parsed.todos)) {
          const safeTodos: ScheduledTodo[] = parsed.todos
            .filter((t: unknown) => t && typeof t === 'object')
            .map((t: ScheduledTodo) => ({
              id: Number.isFinite(Number(t.id))
                ? Number(t.id)
                : Date.now() + Math.floor(Math.random() * 10000),
              title: String(t.title || '').trim().slice(0, 160),
              note: String(t.note || '').trim().slice(0, 400),
              scheduledAt: String(t.scheduledAt || '').slice(0, 40),
              priority: (['normal', 'high', 'urgent'].includes(t.priority)
                ? t.priority
                : 'normal') as TodoPriority,
              completed: Boolean(t.completed),
              notified: Boolean(t.notified),
              createdAt: Number.isFinite(Number(t.createdAt))
                ? Number(t.createdAt)
                : Date.now(),
            }));
          saveTodos(safeTodos);
        }

        if (Array.isArray(parsed.savingsGoals)) {
          const safeSavings: SavingsGoal[] = parsed.savingsGoals
            .filter((g: unknown) => g && typeof g === 'object')
            .map((g: SavingsGoal) => ({
              id: Number.isFinite(Number(g.id))
                ? Number(g.id)
                : Date.now() + Math.floor(Math.random() * 10000),
              name: String(g.name || '').trim().slice(0, 120),
              targetAmount: Math.max(0, Number(g.targetAmount) || 0),
              savedAmount: Math.max(0, Number(g.savedAmount) || 0),
              deadline: g.deadline ? String(g.deadline).slice(0, 30) : undefined,
              entries: Array.isArray(g.entries)
                ? g.entries
                    .filter((en) => en && typeof en === 'object')
                    .map((en) => ({
                      id: Number.isFinite(Number(en.id))
                        ? Number(en.id)
                        : Date.now() + Math.floor(Math.random() * 10000),
                      amount: Math.max(0, Number(en.amount) || 0),
                      type:
                        en.type === 'withdraw'
                          ? ('withdraw' as const)
                          : ('deposit' as const),
                      note: String(en.note || '').trim().slice(0, 160),
                      time: String(en.time || '').slice(0, 60),
                    }))
                : [],
            }));
          saveSavings(safeSavings);
        }

        if (Array.isArray(parsed.recurringBills)) {
          const safeBills: RecurringBill[] = parsed.recurringBills
            .filter((b: unknown) => b && typeof b === 'object')
            .map((b: RecurringBill) => ({
              id: Number.isFinite(Number(b.id))
                ? Number(b.id)
                : Date.now() + Math.floor(Math.random() * 10000),
              name: String(b.name || '').trim().slice(0, 120),
              amount: Math.max(0, Number(b.amount) || 0),
              dueDay: Math.max(1, Math.min(31, Number(b.dueDay) || 5)),
              category: String(b.category || 'housing').slice(0, 50),
              paidMonths: Array.isArray(b.paidMonths)
                ? b.paidMonths
                    .filter((m) => typeof m === 'string' && /^\d{4}-\d{2}$/.test(m))
                : [],
            }));
          saveBills(safeBills);
        }

        if (parsed.settings && typeof parsed.settings === 'object') {
          const validCardThemes = new Set([
            'emerald',
            'mint',
            'obsidian',
            'royal',
            'burgundy',
            'bronze',
            'amethyst',
            'ocean',
            'platinum',
          ]);
          setSettings((prev) => ({
            theme:
              parsed.settings.theme === 'dark'
                ? 'dark'
                : parsed.settings.theme === 'light'
                ? 'light'
                : prev.theme,
            numerals:
              parsed.settings.numerals === 'bn'
                ? 'bn'
                : parsed.settings.numerals === 'en'
                ? 'en'
                : prev.numerals,
            cardTheme: validCardThemes.has(parsed.settings.cardTheme)
              ? parsed.settings.cardTheme
              : prev.cardTheme,
          }));
        }

        if (Array.isArray(parsed.contacts)) {
          void (async () => {
            try {
              await clearAllContacts();
              await importContactsJson(
                JSON.stringify({
                  groups: parsed.contactGroups || {},
                  contacts: parsed.contacts,
                })
              );
              window.dispatchEvent(new Event('amar-hisab-contacts-updated'));
            } catch {
              // ignore
            }
          })();
        }

        showToast('ডাটা সফলভাবে রিস্টোর হয়েছে', 'success');
        return true;
      } catch {
        showToast('ফাইল পড়া যায়নি', 'danger');
        return false;
      }
    },
    [
      clearAllData,
      saveDebtProfiles,
      saveBudgets,
      saveTodos,
      saveSavings,
      saveBills,
      showToast,
    ]
  );

  return {
    selectedMonth,
    setSelectedMonth,
    availableMonths,
    transactionsByMonth,
    monthSummary,
    debtProfiles,
    debtSummary,
    budgets,
    budgetSummary,
    todos,
    savingsGoals,
    recurringBills,
    securityConfig,
    isAppLocked,
    saveAppSecurity,
    updateAutoLockSeconds,
    updateAppPinOnly,
    disableAppSecurity,
    verifyAppPin,
    verifySecurityAnswers,
    lockAppNow,
    settings,
    updateSettings,
    clearAllData,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addDebtProfile,
    updateDebtProfile,
    deleteDebtProfile,
    addDebtTransaction,
    deleteDebtTransaction,
    settleDebtProfile,
    addBudget,
    updateBudget,
    deleteBudget,
    addBudgetItem,
    toggleBudgetItem,
    updateBudgetItem,
    deleteBudgetItem,
    logBoughtItemsToExpense,
    addTodo,
    toggleTodo,
    markTodoNotified,
    deleteTodo,
    addSavingsGoal,
    addSavingsEntry,
    deleteSavingsGoal,
    addRecurringBill,
    toggleBillPaid,
    deleteRecurringBill,
    exportBackupJson,
    importBackupJson,
    toast,
    showToast,
  };
}
