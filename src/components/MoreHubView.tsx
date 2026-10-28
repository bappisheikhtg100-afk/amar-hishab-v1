import {
  BellRing,
  BookUser,
  Calculator,
  CalendarClock,
  ChevronRight,
  FileDown,
  Lock,
  SlidersHorizontal,
  Target,
} from 'lucide-react';
import {
  AppSecurityConfig,
  Budget,
  DebtProfile,
  MoreSubView,
  NumeralSystem,
  RecurringBill,
  SavingsGoal,
  ScheduledTodo,
  TodoPriority,
  Transaction,
  TransactionType,
} from '../types/finance';
import { formatNumber } from '../utils/formatters';
import { AppSecuritySetupView } from './AppSecuritySetupView';
import { CalculatorVaultView } from './CalculatorVaultView';
import { ContactsView } from './ContactsView';
import { PdfReportsView } from './PdfReportsView';
import { SavingsBillsView } from './SavingsBillsView';
import { TodoView } from './TodoView';

interface MoreHubViewProps {
  subView: MoreSubView;
  onChangeSubView: (next: MoreSubView) => void;
  numerals: NumeralSystem;
  selectedMonth: string;
  availableMonths: string[];
  onSelectMonth: (m: string) => void;
  transactionsByMonth: Record<string, Transaction[]>;
  debtProfiles: DebtProfile[];
  budgets: Budget[];
  // Todos
  todos: ScheduledTodo[];
  permissionState: NotificationPermission;
  onRequestPermission: () => Promise<NotificationPermission>;
  onAddTodo: (payload: {
    title: string;
    note: string;
    scheduledAt: string;
    priority: TodoPriority;
  }) => void;
  onToggleTodo: (id: number) => void;
  onDeleteTodo: (id: number) => void;
  // Savings & Bills
  savingsGoals: SavingsGoal[];
  recurringBills: RecurringBill[];
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
  // Security
  securityConfig: AppSecurityConfig | null;
  onSaveSecurity: (params: {
    pin: string;
    question1: string;
    answer1: string;
    question2: string;
    answer2: string;
    autoLockSeconds?: number;
  }) => Promise<void>;
  onUpdateAutoLockSeconds: (seconds: number) => void;
  onDisableSecurity: () => void;
  onLockNow: () => void;
  // Calculator -> Finance & Settings
  onLogAmountToFinance: (amount: number, type: TransactionType) => void;
  onOpenSettingsModal: () => void;
  onNotify: (msg: string, tone?: 'neutral' | 'success' | 'danger') => void;
}

export function MoreHubView(props: MoreHubViewProps) {
  const { subView, onChangeSubView, numerals } = props;

  if (subView === 'calculator') {
    return (
      <CalculatorVaultView
        onBack={() => onChangeSubView('hub')}
        onLogAmountToFinance={props.onLogAmountToFinance}
        onNotify={props.onNotify}
      />
    );
  }

  if (subView === 'todos') {
    return (
      <TodoView
        todos={props.todos}
        numerals={numerals}
        permissionState={props.permissionState}
        onRequestPermission={props.onRequestPermission}
        onAddTodo={props.onAddTodo}
        onToggleTodo={props.onToggleTodo}
        onDeleteTodo={props.onDeleteTodo}
        onBack={() => onChangeSubView('hub')}
        onNotify={props.onNotify}
      />
    );
  }

  if (subView === 'contacts') {
    return (
      <ContactsView
        numerals={numerals}
        onBack={() => onChangeSubView('hub')}
        onNotify={props.onNotify}
      />
    );
  }

  if (subView === 'savings' || subView === 'bills') {
    return (
      <SavingsBillsView
        initialTab={subView}
        savingsGoals={props.savingsGoals}
        recurringBills={props.recurringBills}
        selectedMonth={props.selectedMonth}
        availableMonths={props.availableMonths}
        onSelectMonth={props.onSelectMonth}
        numerals={numerals}
        onAddSavingsGoal={props.onAddSavingsGoal}
        onAddSavingsEntry={props.onAddSavingsEntry}
        onDeleteSavingsGoal={props.onDeleteSavingsGoal}
        onAddRecurringBill={props.onAddRecurringBill}
        onToggleBillPaid={props.onToggleBillPaid}
        onDeleteRecurringBill={props.onDeleteRecurringBill}
        onBack={() => onChangeSubView('hub')}
      />
    );
  }

  if (subView === 'reports') {
    return (
      <PdfReportsView
        selectedMonth={props.selectedMonth}
        availableMonths={props.availableMonths}
        transactionsByMonth={props.transactionsByMonth}
        debtProfiles={props.debtProfiles}
        budgets={props.budgets}
        numerals={numerals}
        onBack={() => onChangeSubView('hub')}
        onNotify={props.onNotify}
      />
    );
  }

  if (subView === 'security') {
    return (
      <AppSecuritySetupView
        securityConfig={props.securityConfig}
        onSaveSecurity={props.onSaveSecurity}
        onUpdateAutoLockSeconds={props.onUpdateAutoLockSeconds}
        onDisableSecurity={props.onDisableSecurity}
        onLockNow={props.onLockNow}
        onBack={() => onChangeSubView('hub')}
      />
    );
  }

  const pendingTodos = props.todos.filter((t) => !t.completed).length;
  const unpaidBills = props.recurringBills.filter(
    (b) => !b.paidMonths.includes(props.selectedMonth)
  ).length;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Minimal Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
          মোর মেনু
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          প্রয়োজনীয় টুলস, ডিরেক্টরি ও নিরাপত্তা
        </p>
      </div>

      {/* Quick Top Feature Grid (2 Clean Tactile Cards) */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onChangeSubView('calculator')}
          className="text-left rounded-3xl bg-[#0B2620] text-white p-5 hover:bg-[#10352C] transition-colors flex flex-col justify-between min-h-[118px]"
        >
          <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center">
            <Calculator className="w-5 h-5 text-emerald-300" />
          </div>
          <div className="mt-3">
            <p className="text-sm font-bold">ক্যালকুলেটর</p>
            <p className="text-[11px] text-emerald-200/75 mt-0.5">
              দ্রুত হিসাবনিকাশ
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onChangeSubView('contacts')}
          className="text-left rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors flex flex-col justify-between min-h-[118px]"
        >
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
            <BookUser className="w-5 h-5" />
          </div>
          <div className="mt-3">
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              কন্টাক্ট বুক
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              গ্রুপ ও PDF ডিরেক্টরি
            </p>
          </div>
        </button>
      </div>

      {/* Group 1: Planning, Reminders & Reports */}
      <div className="space-y-2">
        <h2 className="text-xs font-medium text-slate-400 px-1">
          পরিকল্পনা ও রিপোর্ট
        </h2>
        <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/80 overflow-hidden">
          <button
            type="button"
            onClick={() => onChangeSubView('todos')}
            className="w-full px-5 py-4 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <BellRing className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  শিডিউল টাস্ক ও রিমাইন্ডার
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  নির্ধারিত সময়ে নোটিফিকেশন
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {pendingTodos > 0 && (
                <span className="font-num text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  {formatNumber(pendingTodos, numerals)}
                </span>
              )}
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => onChangeSubView('savings')}
            className="w-full px-5 py-4 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Target className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  সঞ্চয় লক্ষ্যমাত্রা
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  ভবিষ্যৎ তহবিল জমা ও ট্র্যাকিং
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => onChangeSubView('bills')}
            className="w-full px-5 py-4 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                <CalendarClock className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  মাসিক বাঁধাধরা বিল
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  ভাড়া, বিদ্যুৎ ও ইন্টারনেট বিল চেকলিস্ট
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {unpaidBills > 0 && (
                <span className="font-num text-xs font-bold text-rose-500">
                  {formatNumber(unpaidBills, numerals)} বাকি
                </span>
              )}
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => onChangeSubView('reports')}
            className="w-full px-5 py-4 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
                <FileDown className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  পিডিএফ রিপোর্ট ডাউনলোড
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  মাসিক আয়-ব্যয় ও খাতার A4 স্টেটমেন্ট
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
          </button>
        </section>
      </div>

      {/* Group 2: Security & Settings */}
      <div className="space-y-2">
        <h2 className="text-xs font-medium text-slate-400 px-1">
          নিরাপত্তা ও সেটিংস
        </h2>
        <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/80 overflow-hidden">
          <button
            type="button"
            onClick={() => onChangeSubView('security')}
            className="w-full px-5 py-4 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  অ্যাপ লক ও পিন
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  ৪ সংখ্যার পিন ও সিকিউরিটি প্রশ্ন
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`text-xs font-medium ${
                  props.securityConfig?.enabled
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-400'
                }`}
              >
                {props.securityConfig?.enabled ? 'সক্রিয়' : 'বন্ধ'}
              </span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
          </button>

          <button
            type="button"
            onClick={props.onOpenSettingsModal}
            className="w-full px-5 py-4 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
                <SlidersHorizontal className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  সেটিংস ও ব্যাকআপ
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  কার্ডের রঙ, থিম, নোটিফিকেশন ও ডাটা ব্যাকআপ
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
          </button>
        </section>
      </div>

    </div>
  );
}
