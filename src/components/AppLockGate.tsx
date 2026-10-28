import React, { useCallback, useEffect, useState } from 'react';
import { Delete, KeyRound, Lock, ShieldAlert } from 'lucide-react';
import { AppSecurityConfig } from '../types/finance';
import { APP_ICON_DATA_URI } from '../utils/appIconData';
import {
  clearPinLockout,
  getPinLockoutRemainingSeconds,
  recordFailedPinAttempt,
} from '../utils/crypto';

interface AppLockGateProps {
  securityConfig: AppSecurityConfig;
  onVerifyPin: (pin: string) => Promise<boolean>;
  onVerifySecurityAnswers: (a1: string, a2: string) => Promise<boolean>;
  onResetPin: (newPin: string) => Promise<void>;
}

export function AppLockGate({
  securityConfig,
  onVerifyPin,
  onVerifySecurityAnswers,
  onResetPin,
}: AppLockGateProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [lockoutSec, setLockoutSec] = useState<number>(() =>
    getPinLockoutRemainingSeconds('app')
  );
  const [mode, setMode] = useState<'pin' | 'recovery' | 'new-pin'>('pin');

  // Recovery form state
  const [ans1, setAns1] = useState('');
  const [ans2, setAns2] = useState('');
  const [newPin, setNewPin] = useState('');

  useEffect(() => {
    if (lockoutSec <= 0) return;
    const timer = window.setInterval(() => {
      const rem = getPinLockoutRemainingSeconds('app');
      setLockoutSec(rem);
      if (rem <= 0) {
        setError('');
      }
    }, 500);
    return () => window.clearInterval(timer);
  }, [lockoutSec]);

  const handleDigit = useCallback(
    async (digit: string) => {
      if (verifying || lockoutSec > 0 || pin.length >= 4) return;
      const next = pin + digit;
      setPin(next);
      setError('');

      if (next.length === 4) {
        setVerifying(true);
        try {
          const ok = await onVerifyPin(next);
          if (!ok) {
            const { lockSeconds } = recordFailedPinAttempt('app');
            if (lockSeconds > 0) {
              setLockoutSec(lockSeconds);
              setError(`একাধিক ভুল চেষ্টা। ${lockSeconds} সেকেন্ড অপেক্ষা করুন।`);
            } else {
              setError('ভুল পিন নম্বর');
            }
            window.setTimeout(() => setPin(''), 220);
          } else {
            clearPinLockout('app');
          }
        } finally {
          setVerifying(false);
        }
      }
    },
    [lockoutSec, onVerifyPin, pin, verifying]
  );

  const handleBackspace = useCallback(() => {
    if (verifying || lockoutSec > 0) return;
    setPin((p) => p.slice(0, -1));
    setError('');
  }, [lockoutSec, verifying]);

  useEffect(() => {
    if (mode !== 'pin') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        void handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mode, handleDigit, handleBackspace]);

  const handleVerifyRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await onVerifySecurityAnswers(ans1, ans2);
    if (ok) {
      clearPinLockout('app');
      setLockoutSec(0);
      setError('');
      setMode('new-pin');
    } else {
      setError('সিকিউরিটি প্রশ্নের উত্তর মেলেনি');
    }
  };

  const handleSaveNewPin = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newPin.replace(/\D/g, '');
    if (clean.length !== 4) {
      setError('৪ সংখ্যার নতুন পিন দিন');
      return;
    }
    await onResetPin(clean);
  };

  return (
    <div className="fixed inset-0 z-[90] bg-[#071D18] text-white flex flex-col items-center justify-center px-6 select-none">
      {mode === 'pin' && (
        <div className="w-full max-w-xs flex flex-col items-center">
          <div className="relative mb-4">
            <img
              src={APP_ICON_DATA_URI}
              alt="আমার হিসাব"
              className="w-16 h-16 rounded-2xl shadow-lg ring-1 ring-white/15"
            />
            <div className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center shadow-md">
              <Lock className="w-3.5 h-3.5 stroke-[2.5]" />
            </div>
          </div>

          <h1 className="text-lg font-bold tracking-tight">আমার হিসাব সুরক্ষিত</h1>
          <p className="text-xs text-white/60 mt-1">
            আনলক করতে ৪ সংখ্যার পিন দিন
          </p>

          {/* 4 PIN Indicators */}
          <div className="flex items-center gap-4 my-6">
            {[0, 1, 2, 3].map((idx) => {
              const filled = idx < pin.length;
              return (
                <div
                  key={idx}
                  className={`w-3.5 h-3.5 rounded-full transition-transform duration-150 ${
                    filled
                      ? 'bg-emerald-400 scale-110'
                      : 'border border-white/35 bg-transparent'
                  }`}
                />
              );
            })}
          </div>

          <div className="min-h-[28px] mb-3 flex items-center justify-center text-center">
            {lockoutSec > 0 ? (
              <p className="font-num text-xs font-medium text-amber-300 inline-flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                <span>নিরাপত্তা বিরতি: {lockoutSec} সেকেন্ড অপেক্ষা করুন</span>
              </p>
            ) : error ? (
              <p className="text-xs font-medium text-rose-300">{error}</p>
            ) : null}
          </div>

          {/* Tactile Keypad */}
          <div className="grid grid-cols-3 gap-3.5 w-full max-w-[264px]">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
              <button
                key={d}
                type="button"
                disabled={lockoutSec > 0 || verifying}
                onClick={() => void handleDigit(d)}
                className="font-num h-15 sm:h-16 rounded-2xl bg-white/[0.08] hover:bg-white/[0.15] active:scale-95 disabled:opacity-40 text-xl font-bold text-white transition-all"
              >
                {d}
              </button>
            ))}
            <div />
            <button
              type="button"
              disabled={lockoutSec > 0 || verifying}
              onClick={() => void handleDigit('0')}
              className="font-num h-15 sm:h-16 rounded-2xl bg-white/[0.08] hover:bg-white/[0.15] active:scale-95 disabled:opacity-40 text-xl font-bold text-white transition-all"
            >
              0
            </button>
            <button
              type="button"
              disabled={lockoutSec > 0 || verifying}
              onClick={handleBackspace}
              aria-label="মুছুন"
              className="h-15 sm:h-16 rounded-2xl bg-white/[0.04] hover:bg-white/[0.12] disabled:opacity-40 flex items-center justify-center text-white/80 transition-colors"
            >
              <Delete className="w-5 h-5" />
            </button>
          </div>

          {securityConfig.question1 && (
            <button
              type="button"
              onClick={() => {
                setError('');
                setMode('recovery');
              }}
              className="mt-6 min-h-[44px] px-4 text-xs font-medium text-emerald-300/85 hover:text-emerald-200 underline underline-offset-4"
            >
              পিন ভুলে গেছেন?
            </button>
          )}
        </div>
      )}

      {mode === 'recovery' && (
        <form
          onSubmit={handleVerifyRecovery}
          className="w-full max-w-sm rounded-3xl bg-white/10 backdrop-blur-md border border-white/15 p-6 space-y-4"
        >
          <div className="flex items-center gap-2.5">
            <KeyRound className="w-5 h-5 text-emerald-300" />
            <h2 className="text-base font-bold">পিন পুনরুদ্ধার</h2>
          </div>

          <div>
            <label className="block text-xs text-white/75 mb-1.5">
              ১. {securityConfig.question1}
            </label>
            <input
              type="text"
              value={ans1}
              onChange={(e) => {
                setAns1(e.target.value);
                if (error) setError('');
              }}
              placeholder="আপনার উত্তর..."
              autoFocus
              className="w-full min-h-[44px] px-3.5 rounded-2xl bg-white/10 border border-white/20 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-emerald-400"
            />
          </div>

          <div>
            <label className="block text-xs text-white/75 mb-1.5">
              ২. {securityConfig.question2}
            </label>
            <input
              type="text"
              value={ans2}
              onChange={(e) => {
                setAns2(e.target.value);
                if (error) setError('');
              }}
              placeholder="আপনার উত্তর..."
              className="w-full min-h-[44px] px-3.5 rounded-2xl bg-white/10 border border-white/20 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-emerald-400"
            />
          </div>

          {error && <p className="text-xs text-rose-300">{error}</p>}

          <div className="flex items-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => {
                setError('');
                setMode('pin');
              }}
              className="min-h-[44px] flex-1 rounded-2xl bg-white/10 text-xs font-semibold"
            >
              ফিরে যান
            </button>
            <button
              type="submit"
              className="min-h-[44px] flex-1 rounded-2xl bg-emerald-500 text-slate-950 text-xs font-bold"
            >
              যাচাই করুন
            </button>
          </div>
        </form>
      )}

      {mode === 'new-pin' && (
        <form
          onSubmit={handleSaveNewPin}
          className="w-full max-w-sm rounded-3xl bg-white/10 backdrop-blur-md border border-white/15 p-6 space-y-4"
        >
          <h2 className="text-base font-bold">নতুন পিন সেট করুন</h2>
          <p className="text-xs text-white/70">৪ সংখ্যার নতুন পিন লিখুন</p>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={newPin}
            onChange={(e) =>
              setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))
            }
            placeholder="••••"
            autoFocus
            className="font-num w-full min-h-[50px] px-4 rounded-2xl bg-white/10 border border-white/20 text-center text-2xl tracking-[0.5em] text-white focus:outline-none focus:border-emerald-400"
          />
          {error && <p className="text-xs text-rose-300">{error}</p>}
          <button
            type="submit"
            className="w-full min-h-[46px] rounded-2xl bg-emerald-500 text-slate-950 text-sm font-bold"
          >
            নতুন পিন সংরক্ষণ করুন
          </button>
        </form>
      )}
    </div>
  );
}
