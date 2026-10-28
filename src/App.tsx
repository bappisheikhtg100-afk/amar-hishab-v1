/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import {
  ArrowLeftRight,
  BellRing,
  Check,
  Home,
  LayoutGrid,
  ListChecks,
  Lock,
  Plus,
  SlidersHorizontal,
  Users,
  X,
} from 'lucide-react';
import { AppLockGate } from './components/AppLockGate';
import { BudgetView } from './components/BudgetView';
import { DebtView } from './components/DebtView';
import { HomeView } from './components/HomeView';
import { IncomeExpenseView } from './components/IncomeExpenseView';
import { MoreHubView } from './components/MoreHubView';
import { SettingsModal } from './components/SettingsModal';
import { SplashScreen } from './components/SplashScreen';
import { TransactionModal } from './components/TransactionModal';
import { useFinanceStore } from './hooks/useFinanceStore';
import { useTodoNotifications } from './hooks/useTodoNotifications';
import {
  AppTab,
  MoreSubView,
  Transaction,
  TransactionType,
} from './types/finance';
import { APP_ICON_DATA_URI } from './utils/appIconData';
import { isExternalPickerRecentlyActive } from './utils/crypto';

const NAV_ITEMS: { id: AppTab; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'হোম', icon: Home },
  { id: 'income-expense', label: 'আয়-ব্যয়', icon: ArrowLeftRight },
  { id: 'debt', label: 'দেনা-পাওনা', icon: Users },
  { id: 'budget', label: 'বাজেট', icon: ListChecks },
  { id: 'more', label: 'মোর', icon: LayoutGrid },
];

export default function App() {
  const store = useFinanceStore();
  const [showSplash, setShowSplash] = useState(true);
  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [moreSubView, setMoreSubView] = useState<MoreSubView>('hub');
  const [privacyCurtain, setPrivacyCurtain] = useState(false);

  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txInitialType, setTxInitialType] =
    useState<TransactionType>('expense');
  const [txInitialAmount, setTxInitialAmount] = useState<number | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const isLocked = Boolean(store.securityConfig?.enabled && store.isAppLocked);

  const todoNotifier = useTodoNotifications(
    store.todos,
    store.markTodoNotified
  );

  // Hide balances in Android Recent Apps task switcher when security is enabled
  useEffect(() => {
    if (!store.securityConfig?.enabled) {
      setPrivacyCurtain(false);
      return;
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (!isExternalPickerRecentlyActive()) {
          setPrivacyCurtain(true);
        }
      } else {
        setPrivacyCurtain(false);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [store.securityConfig?.enabled]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (isLocked) {
      void StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
      void StatusBar.setBackgroundColor({ color: '#071D18' }).catch(() => {});
      return;
    }
    const isDark = store.settings.theme === 'dark';
    void StatusBar.setStyle({
      style: isDark ? Style.Dark : Style.Light,
    }).catch(() => {});
    void StatusBar.setBackgroundColor({
      color: isDark ? '#090D16' : '#F6F7F9',
    }).catch(() => {});
  }, [store.settings.theme, isLocked]);

  const handleTabClick = (tab: AppTab) => {
    setActiveTab(tab);
    if (tab === 'more') {
      setMoreSubView('hub');
    }
  };

  const openAddTransaction = (
    type: TransactionType = 'expense',
    prefillAmount: number | null = null
  ) => {
    setEditingTx(null);
    setTxInitialType(type);
    setTxInitialAmount(prefillAmount);
    setTxModalOpen(true);
  };

  const openEditTransaction = (tx: Transaction) => {
    setEditingTx(tx);
    setTxInitialType(tx.type);
    setTxInitialAmount(null);
    setTxModalOpen(true);
  };

  // STRICT AUTH GATE: Zero protected DOM (no homepage, balances, transactions, or banners)
  // is ever mounted or painted while App Lock is active. AppLockGate sits directly behind
  // SplashScreen so splash fade-out reveals ONLY the PIN pad with zero flash.
  if (isLocked && store.securityConfig) {
    return (
      <div className="min-h-screen bg-[#071D18] text-white flex flex-col">
        {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
        <AppLockGate
          securityConfig={store.securityConfig}
          onVerifyPin={store.verifyAppPin}
          onVerifySecurityAnswers={store.verifySecurityAnswers}
          onResetPin={store.updateAppPinOnly}
        />
        {store.toast && (
          <div
            role="status"
            aria-live="polite"
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[95] px-4 py-2 rounded-full shadow-lg text-xs font-medium whitespace-nowrap bg-white text-slate-900"
          >
            {store.toast.message}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F7F9] dark:bg-[#090D16] text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Cold-launch Minimalist Splash Screen */}
      {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}

      {/* Recent-Apps Switcher Privacy Curtain */}
      {privacyCurtain && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-[95] bg-[#071D18] flex flex-col items-center justify-center select-none"
        >
          <img
            src={APP_ICON_DATA_URI}
            alt=""
            className="w-16 h-16 rounded-2xl mb-3"
          />
          <p className="text-sm font-bold text-white">আমার হিসাব</p>
        </div>
      )}

      {/* Timely Scheduled Todo Alert Banner */}
      {todoNotifier.activeDueTodo && (
        <div
          role="alert"
          className="fixed top-3 left-3 right-3 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-full sm:max-w-md z-[80] rounded-2xl bg-[#0B2620] text-white border border-emerald-400/30 shadow-2xl p-4 flex items-start gap-3"
        >
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0">
            <BellRing className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-medium text-emerald-300">
              নির্ধারিত রিমাইন্ডার
            </p>
            <p className="text-sm font-bold truncate mt-0.5">
              {todoNotifier.activeDueTodo.title}
            </p>
            {todoNotifier.activeDueTodo.note && (
              <p className="text-xs text-white/75 line-clamp-2 mt-0.5">
                {todoNotifier.activeDueTodo.note}
              </p>
            )}
            <div className="flex items-center gap-2 mt-2.5">
              <button
                type="button"
                onClick={() => {
                  if (todoNotifier.activeDueTodo) {
                    store.toggleTodo(todoNotifier.activeDueTodo.id);
                  }
                  todoNotifier.dismissDueTodo();
                }}
                className="min-h-[36px] px-3 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold inline-flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" />
                <span>সম্পন্ন</span>
              </button>
              <button
                type="button"
                onClick={todoNotifier.dismissDueTodo}
                className="min-h-[36px] px-3 rounded-xl bg-white/10 text-xs font-medium text-white/85"
              >
                পরে দেখব
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={todoNotifier.dismissDueTodo}
            aria-label="বন্ধ করুন"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-white/60 hover:text-white shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Desktop Top Bar (Strict 3-Zone Contract: Brand — 5 Nav Links — Primary CTA) */}
      <header className="hidden md:block sticky top-0 z-30 bg-[#F6F7F9]/85 dark:bg-[#090D16]/85 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-800/70">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => handleTabClick('home')}
            className="inline-flex items-center gap-2.5 text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            <img
              src={APP_ICON_DATA_URI}
              alt=""
              className="w-7 h-7 rounded-lg"
            />
            <span>আমার হিসাব</span>
          </button>

          <nav className="flex items-center gap-7 text-sm font-medium">
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleTabClick(item.id)}
                  className={`py-5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'border-slate-900 dark:border-emerald-500 text-slate-900 dark:text-white font-semibold'
                      : 'border-transparent text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => openAddTransaction('expense')}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>নতুন হিসাব</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Minimal Header */}
      <header className="md:hidden sticky top-0 z-30 h-13 bg-[#F6F7F9]/90 dark:bg-[#090D16]/90 backdrop-blur-md px-5 flex items-center justify-between">
        <button
          type="button"
          onClick={() => handleTabClick('home')}
          className="inline-flex items-center gap-2 text-base font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
        >
          <img
            src={APP_ICON_DATA_URI}
            alt=""
            className="w-6 h-6 rounded-md"
          />
          <span>আমার হিসাব</span>
        </button>

        <div className="flex items-center gap-0.5 -mr-2">
          {store.securityConfig?.enabled && (
            <button
              type="button"
              onClick={store.lockAppNow}
              aria-label="অ্যাপ লক করুন"
              className="w-11 h-11 flex items-center justify-center rounded-2xl text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-900 transition-colors"
            >
              <Lock className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="সেটিংস"
            className="w-11 h-11 flex items-center justify-center rounded-2xl text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-900 transition-colors"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 pt-2 pb-24 md:py-8">
        {activeTab === 'home' && (
          <HomeView
            selectedMonth={store.selectedMonth}
            onSelectMonth={store.setSelectedMonth}
            monthSummary={store.monthSummary}
            debtSummary={store.debtSummary}
            budgetSummary={store.budgetSummary}
            numerals={store.settings.numerals}
            cardTheme={store.settings.cardTheme}
            onNavigateTab={handleTabClick}
            onOpenAddTransaction={(type) => openAddTransaction(type)}
            onEditTransaction={openEditTransaction}
          />
        )}

        {activeTab === 'income-expense' && (
          <IncomeExpenseView
            selectedMonth={store.selectedMonth}
            onSelectMonth={store.setSelectedMonth}
            monthSummary={store.monthSummary}
            numerals={store.settings.numerals}
            onOpenAddTransaction={(type) => openAddTransaction(type)}
            onEditTransaction={openEditTransaction}
          />
        )}

        {activeTab === 'debt' && (
          <DebtView
            profiles={store.debtProfiles}
            debtSummary={store.debtSummary}
            numerals={store.settings.numerals}
            onAddProfile={store.addDebtProfile}
            onUpdateProfile={store.updateDebtProfile}
            onDeleteProfile={store.deleteDebtProfile}
            onAddTransaction={store.addDebtTransaction}
            onDeleteTransaction={store.deleteDebtTransaction}
            onSettleProfile={store.settleDebtProfile}
          />
        )}

        {activeTab === 'budget' && (
          <BudgetView
            budgets={store.budgets}
            budgetSummary={store.budgetSummary}
            numerals={store.settings.numerals}
            onAddBudget={store.addBudget}
            onUpdateBudget={store.updateBudget}
            onDeleteBudget={store.deleteBudget}
            onAddItem={store.addBudgetItem}
            onToggleItem={store.toggleBudgetItem}
            onUpdateItem={store.updateBudgetItem}
            onDeleteItem={store.deleteBudgetItem}
            onLogBoughtToExpense={store.logBoughtItemsToExpense}
          />
        )}

        {activeTab === 'more' && (
          <MoreHubView
            subView={moreSubView}
            onChangeSubView={setMoreSubView}
            numerals={store.settings.numerals}
            selectedMonth={store.selectedMonth}
            availableMonths={store.availableMonths}
            onSelectMonth={store.setSelectedMonth}
            transactionsByMonth={store.transactionsByMonth}
            debtProfiles={store.debtProfiles}
            budgets={store.budgets}
            todos={store.todos}
            permissionState={todoNotifier.permissionState}
            onRequestPermission={todoNotifier.requestNotificationPermission}
            onAddTodo={store.addTodo}
            onToggleTodo={store.toggleTodo}
            onDeleteTodo={store.deleteTodo}
            savingsGoals={store.savingsGoals}
            recurringBills={store.recurringBills}
            onAddSavingsGoal={store.addSavingsGoal}
            onAddSavingsEntry={store.addSavingsEntry}
            onDeleteSavingsGoal={store.deleteSavingsGoal}
            onAddRecurringBill={store.addRecurringBill}
            onToggleBillPaid={store.toggleBillPaid}
            onDeleteRecurringBill={store.deleteRecurringBill}
            securityConfig={store.securityConfig}
            onSaveSecurity={store.saveAppSecurity}
            onUpdateAutoLockSeconds={store.updateAutoLockSeconds}
            onDisableSecurity={store.disableAppSecurity}
            onLockNow={store.lockAppNow}
            onLogAmountToFinance={(amount, type) =>
              openAddTransaction(type, amount)
            }
            onOpenSettingsModal={() => setSettingsOpen(true)}
            onNotify={store.showToast}
          />
        )}

        {/* Quiet Desktop Settings Trigger at Bottom */}
        <footer className="hidden md:flex mt-12 pt-5 border-t border-slate-200/50 dark:border-slate-800/60 items-center justify-between text-xs text-slate-400">
          <span className="font-num">Md. Wadud Hossain · 12606098 · NDCD 26</span>
          <div className="flex items-center gap-5">
            {store.securityConfig?.enabled && (
              <button
                type="button"
                onClick={store.lockAppNow}
                className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>অ্যাপ লক</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>সেটিংস ও ব্যাকআপ</span>
            </button>
          </div>
        </footer>
      </main>

      {/* Mobile Clean 5-Tab Bottom Bar */}
      <nav
        aria-label="নেভিগেশন"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0D121D]/95 backdrop-blur-md border-t border-slate-200/60 dark:border-slate-800/80 pb-safe"
      >
        <div className="grid grid-cols-5 items-center h-15 max-w-md mx-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleTabClick(item.id)}
                className={`min-h-[48px] flex flex-col items-center justify-center transition-colors ${
                  isActive
                    ? 'text-slate-900 dark:text-emerald-400'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                <Icon
                  className={`w-5 h-5 ${
                    isActive ? 'stroke-[2.3]' : 'stroke-[1.75]'
                  }`}
                />
                <span
                  className={`text-[10px] tracking-tight mt-1 whitespace-nowrap ${
                    isActive ? 'font-semibold' : 'font-medium'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Subtle Toast */}
      {store.toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full shadow-lg text-xs font-medium whitespace-nowrap bg-slate-900 dark:bg-white text-white dark:text-slate-900"
        >
          {store.toast.message}
        </div>
      )}

      {/* Add / Edit / Delete Transaction Modal */}
      <TransactionModal
        open={txModalOpen}
        onClose={() => {
          setTxModalOpen(false);
          setEditingTx(null);
          setTxInitialAmount(null);
        }}
        defaultMonthKey={store.selectedMonth}
        availableMonths={store.availableMonths}
        numerals={store.settings.numerals}
        editingTransaction={editingTx}
        initialType={txInitialType}
        initialAmount={txInitialAmount}
        onSave={(data) => {
          if (editingTx) {
            store.updateTransaction(
              editingTx.monthKey || store.selectedMonth,
              editingTx.id,
              data
            );
          } else {
            store.addTransaction(data);
          }
        }}
        onDelete={(tx) => {
          store.deleteTransaction(tx.monthKey || store.selectedMonth, tx.id);
        }}
      />

      {/* Settings Modal */}
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={store.settings}
        onUpdateSettings={store.updateSettings}
        onExportBackup={store.exportBackupJson}
        onImportBackup={store.importBackupJson}
        isSecurityEnabled={Boolean(store.securityConfig?.enabled)}
        onOpenSecuritySetup={() => {
          setActiveTab('more');
          setMoreSubView('security');
        }}
        permissionState={todoNotifier.permissionState}
        onRequestNotificationPermission={
          todoNotifier.requestNotificationPermission
        }
      />
    </div>
  );
}
