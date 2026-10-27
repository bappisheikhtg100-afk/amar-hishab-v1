import React, { useState } from 'react';
import { ArrowLeft, Lock, ShieldCheck, Unlock } from 'lucide-react';
import { AppSecurityConfig } from '../types/finance';
import { ConfirmDialog } from './ModalSheet';

interface AppSecuritySetupViewProps {
  securityConfig: AppSecurityConfig | null;
  onSaveSecurity: (params: {
    pin: string;
    question1: string;
    answer1: string;
    question2: string;
    answer2: string;
  }) => Promise<void>;
  onDisableSecurity: () => void;
  onLockNow: () => void;
  onBack: () => void;
}

const PRESET_QUESTIONS_1 = [
  'আপনার প্রিয় শিক্ষকের নাম কী?',
  'আপনার শৈশবের ডাকনাম কী?',
  'আপনার প্রথম স্কুলের নাম কী?',
];

const PRESET_QUESTIONS_2 = [
  'আপনার জন্মস্থান কোন জেলায়?',
  'আপনার প্রিয় বই বা সিনেমার নাম কী?',
  'আপনার প্রিয় খাবারের নাম কী?',
];

export function AppSecuritySetupView({
  securityConfig,
  onSaveSecurity,
  onDisableSecurity,
  onLockNow,
  onBack,
}: AppSecuritySetupViewProps) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [q1, setQ1] = useState(
    securityConfig?.question1 || PRESET_QUESTIONS_1[0]
  );
  const [a1, setA1] = useState('');
  const [q2, setQ2] = useState(
    securityConfig?.question2 || PRESET_QUESTIONS_2[0]
  );
  const [a2, setA2] = useState('');
  const [error, setError] = useState('');
  const [confirmDisable, setConfirmDisable] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = pin.replace(/\D/g, '');
    if (cleanPin.length !== 4) {
      setError('৪ সংখ্যার পিন দিন (যেমন: 1234)');
      return;
    }
    if (cleanPin !== confirmPin.replace(/\D/g, '')) {
      setError('দুইবার দেওয়া পিন মেলেনি');
      return;
    }
    if (!a1.trim() || !a2.trim()) {
      setError('পিন ভুলে গেলে উদ্ধারের জন্য দুটি প্রশ্নেরই উত্তর লিখুন');
      return;
    }

    await onSaveSecurity({
      pin: cleanPin,
      question1: q1,
      answer1: a1,
      question2: q2,
      answer2: a2,
    });
    setPin('');
    setConfirmPin('');
    setA1('');
    setA2('');
    setError('');
  };

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[42px] -ml-2 px-2 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>মোর মেনু</span>
        </button>

        {securityConfig?.enabled && (
          <button
            type="button"
            onClick={onLockNow}
            className="min-h-[40px] px-3.5 rounded-2xl bg-slate-900 dark:bg-emerald-600 text-white text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>এখনই লক করুন</span>
          </button>
        )}
      </div>

      {/* Status Card */}
      <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center ${
                securityConfig?.enabled
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
              }`}
            >
              {securityConfig?.enabled ? (
                <ShieldCheck className="w-5 h-5" />
              ) : (
                <Unlock className="w-5 h-5" />
              )}
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 dark:text-white">
                অ্যাপ পিন লক
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                {securityConfig?.enabled
                  ? 'সক্রিয় আছে — অ্যাপ ওপেন করলে পিন চাইবে'
                  : 'নিষ্ক্রিয় আছে — নিচে পিন ও সিকিউরিটি প্রশ্ন সেট করুন'}
              </p>
            </div>
          </div>

          {securityConfig?.enabled && (
            <button
              type="button"
              onClick={() => setConfirmDisable(true)}
              className="min-h-[38px] px-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-semibold"
            >
              বন্ধ করুন
            </button>
          )}
        </div>
      </section>

      {/* Setup / Update Form */}
      <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-5 sm:p-6">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-4">
          {securityConfig?.enabled
            ? 'পিন ও সিকিউরিটি প্রশ্ন পরিবর্তন করুন'
            : 'নতুন পিন ও সিকিউরিটি প্রশ্ন সেট করুন'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                ৪ সংখ্যার পিন
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value.replace(/\D/g, '').slice(0, 4));
                  if (error) setError('');
                }}
                placeholder="••••"
                className="font-num w-full min-h-[46px] px-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-lg font-bold tracking-widest"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                পিন নিশ্চিত করুন
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={confirmPin}
                onChange={(e) => {
                  setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4));
                  if (error) setError('');
                }}
                placeholder="••••"
                className="font-num w-full min-h-[46px] px-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-lg font-bold tracking-widest"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <p className="text-xs font-medium text-slate-400">
              পিন ভুলে গেলে রিকভারির জন্য ২টি প্রশ্ন ও উত্তর
            </p>

            <div>
              <select
                value={q1}
                onChange={(e) => setQ1(e.target.value)}
                className="w-full min-h-[42px] px-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 text-xs font-medium mb-2"
              >
                {PRESET_QUESTIONS_1.map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={a1}
                onChange={(e) => {
                  setA1(e.target.value);
                  if (error) setError('');
                }}
                placeholder="১ম প্রশ্নের উত্তর..."
                className="w-full min-h-[44px] px-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-sm"
              />
            </div>

            <div>
              <select
                value={q2}
                onChange={(e) => setQ2(e.target.value)}
                className="w-full min-h-[42px] px-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 text-xs font-medium mb-2"
              >
                {PRESET_QUESTIONS_2.map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={a2}
                onChange={(e) => {
                  setA2(e.target.value);
                  if (error) setError('');
                }}
                placeholder="২য় প্রশ্নের উত্তর..."
                className="w-full min-h-[44px] px-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-sm"
              />
            </div>
          </div>

          {error && <p className="text-xs font-medium text-rose-600">{error}</p>}

          <button
            type="submit"
            className="w-full min-h-[48px] rounded-2xl bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 text-white text-sm font-semibold transition-colors"
          >
            পিন ও সিকিউরিটি সংরক্ষণ করুন
          </button>
        </form>
      </section>

      <ConfirmDialog
        open={confirmDisable}
        title="অ্যাপ লক বন্ধ করবেন?"
        description="পিন লক বন্ধ করলে অ্যাপ ওপেন করার সময় আর পিন চাইবে না।"
        confirmLabel="হ্যাঁ, বন্ধ করুন"
        onConfirm={onDisableSecurity}
        onCancel={() => setConfirmDisable(false)}
      />
    </div>
  );
}
