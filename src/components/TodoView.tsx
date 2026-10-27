import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  BellRing,
  Check,
  Clock,
  Plus,
  Trash2,
} from 'lucide-react';
import { NumeralSystem, ScheduledTodo, TodoPriority } from '../types/finance';
import { formatNumber } from '../utils/formatters';
import { ConfirmDialog, ModalSheet } from './ModalSheet';

interface TodoViewProps {
  todos: ScheduledTodo[];
  numerals: NumeralSystem;
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
  onBack: () => void;
  onNotify: (msg: string, tone?: 'neutral' | 'success' | 'danger') => void;
}

function getDefaultDateTimeLocal(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function formatScheduledDisplay(isoStr: string): string {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return isoStr;
  return d.toLocaleString('bn-BD', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

const PRIORITY_META: Record<
  TodoPriority,
  { label: string; dotClass: string; textClass: string }
> = {
  normal: {
    label: 'সাধারণ',
    dotClass: 'bg-emerald-500',
    textClass: 'text-slate-500 dark:text-slate-400',
  },
  high: {
    label: 'গুরুত্বপূর্ণ',
    dotClass: 'bg-amber-500',
    textClass: 'text-amber-600 dark:text-amber-400',
  },
  urgent: {
    label: 'অতি জরুরি',
    dotClass: 'bg-rose-500',
    textClass: 'text-rose-600 dark:text-rose-400',
  },
};

export function TodoView({
  todos,
  numerals,
  permissionState,
  onRequestPermission,
  onAddTodo,
  onToggleTodo,
  onDeleteTodo,
  onBack,
  onNotify,
}: TodoViewProps) {
  const [filter, setFilter] = useState<'upcoming' | 'completed' | 'all'>(
    'upcoming'
  );
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ScheduledTodo | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [scheduledAt, setScheduledAt] = useState(() =>
    getDefaultDateTimeLocal()
  );
  const [priority, setPriority] = useState<TodoPriority>('normal');
  const [error, setError] = useState('');

  const filteredTodos = useMemo(() => {
    const sorted = [...todos].sort((a, b) => {
      const tA = new Date(a.scheduledAt).getTime() || 0;
      const tB = new Date(b.scheduledAt).getTime() || 0;
      return tA - tB;
    });
    if (filter === 'upcoming') return sorted.filter((t) => !t.completed);
    if (filter === 'completed') return sorted.filter((t) => t.completed);
    return sorted;
  }, [todos, filter]);

  const pendingCount = useMemo(
    () => todos.filter((t) => !t.completed).length,
    [todos]
  );

  const openCreateModal = () => {
    setTitle('');
    setNote('');
    setScheduledAt(getDefaultDateTimeLocal());
    setPriority('normal');
    setError('');
    setAddOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('কাজের শিরোনাম লিখুন');
      return;
    }
    if (!scheduledAt) {
      setError('তারিখ ও সময় নির্বাচন করুন');
      return;
    }
    onAddTodo({
      title,
      note,
      scheduledAt,
      priority,
    });
    setAddOpen(false);
  };

  const handleEnableNotifications = async () => {
    const res = await onRequestPermission();
    if (res === 'granted') {
      onNotify('নোটিফিকেশন সক্রিয় হয়েছে', 'success');
    } else {
      onNotify('ব্রাউজার সেটিংস থেকে নোটিফিকেশন অনুমতি দিন', 'neutral');
    }
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
          onClick={openCreateModal}
          className="min-h-[42px] px-4 rounded-2xl bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>নতুন রিমাইন্ডার</span>
        </button>
      </div>

      {/* Header Summary Card */}
      <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-5 sm:p-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-slate-400">শিডিউল টাস্ক</p>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
            বাকি কাজ{' '}
            <span className="font-num text-emerald-600 dark:text-emerald-400">
              {formatNumber(pendingCount, numerals)}
            </span>
            টি
          </h1>
        </div>

        {permissionState !== 'granted' ? (
          <button
            type="button"
            onClick={() => void handleEnableNotifications()}
            className="min-h-[40px] px-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <Bell className="w-3.5 h-3.5" />
            <span>অ্যালার্ম চালু করুন</span>
          </button>
        ) : (
          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <BellRing className="w-4 h-4" />
            <span>অ্যালার্ম চালু</span>
          </div>
        )}
      </section>

      {/* Filter Tabs */}
      <div className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-slate-200/60 dark:bg-slate-900">
        {(
          [
            { id: 'upcoming', label: 'আসন্ন' },
            { id: 'completed', label: 'সম্পন্ন' },
            { id: 'all', label: 'সব' },
          ] as const
        ).map((tab) => {
          const active = filter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`min-h-[40px] rounded-xl text-xs font-semibold transition-colors ${
                active
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Task List */}
      <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/80 overflow-hidden">
        {filteredTodos.length === 0 ? (
          <div className="py-14 px-6 text-center">
            <Clock className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2.5" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              কোনো নির্ধারিত কাজ নেই
            </p>
            <button
              type="button"
              onClick={openCreateModal}
              className="mt-3 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              + প্রথম রিমাইন্ডার সেট করুন
            </button>
          </div>
        ) : (
          filteredTodos.map((todo) => {
            const pMeta = PRIORITY_META[todo.priority || 'normal'];
            const isOverdue =
              !todo.completed &&
              Boolean(todo.scheduledAt) &&
              new Date(todo.scheduledAt).getTime() < Date.now();

            return (
              <div
                key={todo.id}
                className="px-4 sm:px-5 py-3.5 flex items-start gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => onToggleTodo(todo.id)}
                  aria-label={todo.completed ? 'অসম্পন্ন করুন' : 'সম্পন্ন করুন'}
                  className="min-h-[44px] min-w-[44px] -ml-2 -my-1 flex items-center justify-center shrink-0"
                >
                  <span
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      todo.completed
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    {todo.completed && <Check className="w-3 h-3 stroke-[3]" />}
                  </span>
                </button>

                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${pMeta.dotClass}`}
                    />
                    <p
                      className={`text-sm font-semibold truncate ${
                        todo.completed
                          ? 'line-through text-slate-400 dark:text-slate-500'
                          : 'text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      {todo.title}
                    </p>
                  </div>

                  {todo.note && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                      {todo.note}
                    </p>
                  )}

                  <div className="flex items-center gap-3 mt-1.5 text-[11px]">
                    <span
                      className={`inline-flex items-center gap-1 font-medium ${
                        isOverdue
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-slate-400'
                      }`}
                    >
                      <Clock className="w-3 h-3" />
                      <span>{formatScheduledDisplay(todo.scheduledAt)}</span>
                    </span>
                    <span className={`${pMeta.textClass} font-medium`}>
                      {pMeta.label}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setDeleteTarget(todo)}
                  aria-label="মুছে ফেলুন"
                  className="min-h-[44px] min-w-[44px] -mr-2 -my-1 flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-600 transition-colors shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })
        )}
      </section>

      {/* Add Todo Modal */}
      <ModalSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="নতুন শিডিউল টাস্ক"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              কাজের শিরোনাম
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (error) setError('');
              }}
              placeholder="যেমন: বিদ্যুৎ বিল পরিশোধ, ডাক্তারের অ্যাপয়েন্টমেন্ট..."
              autoFocus
              className="w-full min-h-[46px] px-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-slate-900 dark:focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              নির্ধারিত তারিখ ও সময়
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => {
                setScheduledAt(e.target.value);
                if (error) setError('');
              }}
              className="font-num w-full min-h-[46px] px-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-slate-900 dark:focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              গুরুত্ব
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['normal', 'high', 'urgent'] as TodoPriority[]).map((p) => {
                const active = priority === p;
                const meta = PRIORITY_META[p];
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`min-h-[42px] rounded-2xl border text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
                      active
                        ? 'border-slate-900 dark:border-emerald-500 bg-slate-900 dark:bg-emerald-600 text-white'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${meta.dotClass}`} />
                    <span>{meta.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              নোট (ঐচ্ছিক)
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="অতিরিক্ত কোনো তথ্য..."
              className="w-full p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-slate-900 dark:focus:border-emerald-500"
            />
          </div>

          {error && <p className="text-xs font-medium text-rose-600">{error}</p>}

          <button
            type="submit"
            className="w-full min-h-[48px] rounded-2xl bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 text-white text-sm font-semibold transition-colors"
          >
            রিমাইন্ডার সংরক্ষণ করুন
          </button>
        </form>
      </ModalSheet>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="টাস্ক মুছে ফেলবেন?"
        description={
          deleteTarget ? `"${deleteTarget.title}" তালিকা থেকে মুছে যাবে।` : ''
        }
        onConfirm={() => {
          if (deleteTarget) onDeleteTodo(deleteTarget.id);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
