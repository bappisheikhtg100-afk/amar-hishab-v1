import React, { useRef } from 'react';
import {
  BellRing,
  Check,
  Download,
  Lock,
  Moon,
  Smartphone,
  Sun,
  Upload,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { AppSettings, CardTheme } from '../types/finance';
import { isRunningInNativeApk } from '../utils/fileSaver';
import { ModalSheet } from './ModalSheet';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onExportBackup: () => void;
  onImportBackup: (jsonText: string) => boolean;
  isSecurityEnabled?: boolean;
  onOpenSecuritySetup?: () => void;
  permissionState?: NotificationPermission;
  onRequestNotificationPermission?: () => Promise<NotificationPermission>;
}

const CARD_OPTIONS: { id: CardTheme; label: string; preview: string }[] = [
  {
    id: 'emerald',
    label: 'এমেরাল্ড',
    preview: 'bg-gradient-to-br from-[#0B2620] via-[#10382E] to-[#071713]',
  },
  {
    id: 'mint',
    label: 'মিন্ট',
    preview: 'bg-gradient-to-br from-[#0D3B32] via-[#135346] to-[#08241E]',
  },
  {
    id: 'obsidian',
    label: 'অবসিডিয়ান',
    preview: 'bg-gradient-to-br from-[#1C2029] via-[#11141B] to-[#080A0E]',
  },
  {
    id: 'royal',
    label: 'রয়্যাল ব্লু',
    preview: 'bg-gradient-to-br from-[#0F2042] via-[#152C5B] to-[#091328]',
  },
  {
    id: 'burgundy',
    label: 'বার্গান্ডি',
    preview: 'bg-gradient-to-br from-[#3B0A1E] via-[#56122D] to-[#220511]',
  },
  {
    id: 'bronze',
    label: 'ব্রোঞ্জ গোল্ড',
    preview: 'bg-gradient-to-br from-[#2E2113] via-[#4A351E] to-[#1A120A]',
  },
  {
    id: 'amethyst',
    label: 'অ্যামেথিস্ট',
    preview: 'bg-gradient-to-br from-[#23113A] via-[#341957] to-[#130821]',
  },
  {
    id: 'ocean',
    label: 'ডিপ ওশান',
    preview: 'bg-gradient-to-br from-[#0A2933] via-[#11404F] to-[#06181F]',
  },
  {
    id: 'platinum',
    label: 'প্লাটিনাম',
    preview: 'bg-gradient-to-br from-[#2A303C] via-[#3B4354] to-[#181C24]',
  },
];

export function SettingsModal({
  open,
  onClose,
  settings,
  onUpdateSettings,
  onExportBackup,
  onImportBackup,
  isSecurityEnabled,
  onOpenSecuritySetup,
  permissionState,
  onRequestNotificationPermission,
}: SettingsModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { isInstallable, isInstalled, install } = usePWAInstall();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const ok = onImportBackup(reader.result);
        if (ok) onClose();
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <ModalSheet
      open={open}
      onClose={onClose}
      title="সেটিংস ও ব্যাকআপ"
      maxWidthClass="sm:max-w-md"
    >
      <div className="space-y-5">
        {/* Card Finish Picker (9 Luxury Finishes) */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-2">
            হোম কার্ডের প্রিমিয়াম রঙ
          </label>
          <div className="grid grid-cols-3 gap-2">
            {CARD_OPTIONS.map((opt) => {
              const active = settings.cardTheme === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onUpdateSettings({ cardTheme: opt.id })}
                  className={`p-2 rounded-2xl border text-center transition-colors ${
                    active
                      ? 'border-slate-900 dark:border-emerald-500 bg-slate-50 dark:bg-slate-800/90'
                      : 'border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div
                    className={`relative h-8 w-full rounded-xl mb-1.5 flex items-center justify-center ${opt.preview}`}
                  >
                    {active && (
                      <Check className="w-3.5 h-3.5 text-emerald-300 stroke-[2.8]" />
                    )}
                  </div>
                  <span className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate">
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Theme Mode */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-2">
            থিম মোড
          </label>
          <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => onUpdateSettings({ theme: 'light' })}
              className={`min-h-[40px] rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
                settings.theme === 'light'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              <span>Light</span>
            </button>
            <button
              type="button"
              onClick={() => onUpdateSettings({ theme: 'dark' })}
              className={`min-h-[40px] rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
                settings.theme === 'dark'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-500'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              <span>Dark</span>
            </button>
          </div>
        </div>

        {/* Numeral Format */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-2">
            সংখ্যার ধরন
          </label>
          <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => onUpdateSettings({ numerals: 'en' })}
              className={`font-num min-h-[40px] rounded-xl text-xs font-semibold transition-colors ${
                settings.numerals === 'en'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500'
              }`}
            >
              12,500 (স্পষ্ট)
            </button>
            <button
              type="button"
              onClick={() => onUpdateSettings({ numerals: 'bn' })}
              className={`min-h-[40px] rounded-xl text-xs font-semibold transition-colors ${
                settings.numerals === 'bn'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500'
              }`}
            >
              ১২,৫০০ (বাংলা)
            </button>
          </div>
        </div>

        {/* Security & Notification Permissions */}
        <div className="space-y-2 pt-1">
          {onOpenSecuritySetup && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenSecuritySetup();
              }}
              className="w-full min-h-[44px] px-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center justify-between gap-2 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <span className="inline-flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-emerald-600" />
                <span>অ্যাপ পিন লক ও নিরাপত্তা</span>
              </span>
              <span
                className={`text-[11px] font-medium ${
                  isSecurityEnabled
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-400'
                }`}
              >
                {isSecurityEnabled ? 'সক্রিয়' : 'বন্ধ'}
              </span>
            </button>
          )}

          {onRequestNotificationPermission && (
            <button
              type="button"
              onClick={() => {
                if (permissionState !== 'granted') {
                  void onRequestNotificationPermission();
                }
              }}
              className="w-full min-h-[44px] px-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center justify-between gap-2 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <span className="inline-flex items-center gap-2">
                <BellRing className="w-3.5 h-3.5 text-amber-500" />
                <span>অফলাইন রিমাইন্ডার নোটিফিকেশন</span>
              </span>
              <span
                className={`text-[11px] font-medium ${
                  permissionState === 'granted'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-amber-600 dark:text-amber-400'
                }`}
              >
                {permissionState === 'granted' ? 'অনুমোদিত' : 'চালু করুন'}
              </span>
            </button>
          )}

          {!isRunningInNativeApk() && isInstallable && !isInstalled && (
            <button
              type="button"
              onClick={() => void install()}
              className="w-full min-h-[44px] px-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center justify-center gap-2"
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
              <span>হোম স্ক্রিনে ইনস্টল করুন</span>
            </button>
          )}
        </div>

        {/* Data Backup & Restore */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80">
          <label className="block text-xs font-medium text-slate-400 mb-2">
            অফলাইন ডাটা ব্যাকআপ ও ইমপোর্ট
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onExportBackup}
              className="min-h-[44px] px-3 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center justify-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>ব্যাকআপ ডাউনলোড</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[44px] px-3 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center justify-center gap-1.5 transition-colors"
            >
              <Upload className="w-3.5 h-3.5 text-slate-500" />
              <span>ডাটা রিস্টোর / ইমপোর্ট</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </div>

        {/* Developer Credit */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 text-center">
          <p className="font-num text-[11px] text-slate-400">
            Md. Wadud Hossain · 12606098 · NDCD 26
          </p>
        </div>
      </div>
    </ModalSheet>
  );
}
