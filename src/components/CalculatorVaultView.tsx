import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowLeft,
  Copy,
  Delete,
  Download,
  FileText,
  Film,
  Image as ImageIcon,
  Lock,
  Plus,
  Shield,
  StickyNote,
  Trash2,
  Upload,
} from 'lucide-react';
import { TransactionType, VaultItemType } from '../types/finance';
import {
  DecryptedVaultItem,
  addVaultFileItem,
  decryptVaultItemBlob,
  deleteVaultItem,
  exportEncryptedVaultBackup,
  getVaultConfig,
  importEncryptedVaultBackup,
  initializeNewVault,
  listDecryptedVaultItems,
  recoverVaultAndResetPin,
  saveVaultNoteItem,
  unlockVaultWithPin,
} from '../utils/vaultDb';
import { saveBlobOffline } from '../utils/fileSaver';
import { ConfirmDialog, ModalSheet } from './ModalSheet';

interface CalculatorVaultViewProps {
  onBack: () => void;
  onLogAmountToFinance: (amount: number, type: TransactionType) => void;
  onNotify: (msg: string, tone?: 'neutral' | 'success' | 'danger') => void;
}

const SECRET_TRIGGER = '1|0|1|0|1|0|+|+|=';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CalculatorVaultView({
  onBack,
  onLogAmountToFinance,
  onNotify,
}: CalculatorVaultViewProps) {
  // --- Calculator State ---
  const [display, setDisplay] = useState('0');
  const [prevValue, setPrevValue] = useState<number | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [waitingNext, setWaitingNext] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const keyBufferRef = useRef<string[]>([]);

  // --- Secret Vault Auth State ---
  const [gateModal, setGateModal] = useState<
    'closed' | 'setup' | 'unlock' | 'recovery'
  >('closed');
  const [vaultPinInput, setVaultPinInput] = useState('');
  const [vaultPinConfirm, setVaultPinConfirm] = useState('');
  const [vaultRecQ, setVaultRecQ] = useState('আপনার গোপন প্রিয় শব্দ কী?');
  const [vaultRecA, setVaultRecA] = useState('');
  const [gateError, setGateError] = useState('');

  // --- Unlocked Vault State ---
  const [masterSecret, setMasterSecret] = useState<string | null>(null);
  const [vaultTab, setVaultTab] = useState<VaultItemType>('image');
  const [vaultItems, setVaultItems] = useState<DecryptedVaultItem[]>([]);
  const [loadingVault, setLoadingVault] = useState(false);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});

  // Media Viewer Modal
  const [previewItem, setPreviewItem] = useState<{
    item: DecryptedVaultItem;
    url?: string;
  } | null>(null);

  // Secret Note Modal
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | undefined>(undefined);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');

  // Delete confirmation
  const [deletingItem, setDeletingItem] = useState<DecryptedVaultItem | null>(null);

  const fileUploadRef = useRef<HTMLInputElement | null>(null);
  const backupImportRef = useRef<HTMLInputElement | null>(null);

  // Clean up decrypted object URLs when locking or unmounting
  const revokeAllObjectUrls = () => {
    Object.values(thumbUrls).forEach((u) => URL.revokeObjectURL(u));
    setThumbUrls({});
    if (previewItem?.url) {
      URL.revokeObjectURL(previewItem.url);
    }
    setPreviewItem(null);
  };

  useEffect(() => {
    return () => {
      Object.values(thumbUrls).forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshVaultItems = async (secret: string) => {
    setLoadingVault(true);
    try {
      const list = await listDecryptedVaultItems(secret);
      setVaultItems(list);

      // Preload image thumbnails in memory
      const imageEntries = list.filter((i) => i.type === 'image').slice(0, 24);
      const nextThumbs: Record<string, string> = {};
      for (const imgItem of imageEntries) {
        const blob = await decryptVaultItemBlob(imgItem.id, secret);
        if (blob) {
          nextThumbs[imgItem.id] = URL.createObjectURL(blob);
        }
      }
      setThumbUrls((old) => {
        Object.values(old).forEach((u) => URL.revokeObjectURL(u));
        return nextThumbs;
      });
    } finally {
      setLoadingVault(false);
    }
  };

  const lockVault = () => {
    revokeAllObjectUrls();
    setMasterSecret(null);
    setVaultItems([]);
    setVaultPinInput('');
  };

  // --- Calculator Logic & Secret Key Detector ---
  const recordKeyAndCheckTrigger = (key: string): boolean => {
    const nextBuf = [...keyBufferRef.current, key].slice(-9);
    keyBufferRef.current = nextBuf;

    if (nextBuf.join('|') === SECRET_TRIGGER) {
      keyBufferRef.current = [];
      setDisplay('0');
      setPrevValue(null);
      setOperator(null);
      setWaitingNext(false);

      const cfg = getVaultConfig();
      setVaultPinInput('');
      setVaultPinConfirm('');
      setVaultRecA('');
      setGateError('');
      setGateModal(cfg ? 'unlock' : 'setup');
      return true;
    }
    return false;
  };

  const computeMath = (a: number, b: number, op: string): number => {
    switch (op) {
      case '+':
        return a + b;
      case '−':
        return a - b;
      case '×':
        return a * b;
      case '÷':
        return b === 0 ? 0 : a / b;
      default:
        return b;
    }
  };

  const handleDigit = (d: string) => {
    if (recordKeyAndCheckTrigger(d)) return;

    if (waitingNext) {
      setDisplay(d === '.' ? '0.' : d);
      setWaitingNext(false);
      return;
    }
    if (d === '.' && display.includes('.')) return;
    if (display === '0' && d !== '.') {
      setDisplay(d === '00' ? '0' : d);
    } else if (display.length < 14) {
      setDisplay(display + d);
    }
  };

  const handleOperator = (op: string) => {
    const normalizedKey = op === '+' ? '+' : op;
    if (recordKeyAndCheckTrigger(normalizedKey)) return;

    const current = parseFloat(display) || 0;
    if (prevValue === null) {
      setPrevValue(current);
    } else if (operator && !waitingNext) {
      const result = computeMath(prevValue, current, operator);
      const formatted = String(Number(result.toFixed(6)));
      setDisplay(formatted);
      setPrevValue(result);
    }
    setOperator(op);
    setWaitingNext(true);
  };

  const handleEquals = () => {
    if (recordKeyAndCheckTrigger('=')) return;

    if (operator === null || prevValue === null) return;
    const current = parseFloat(display) || 0;
    const result = computeMath(prevValue, current, operator);
    const cleanResult = String(Number(result.toFixed(6)));
    setHistory((h) =>
      [`${prevValue} ${operator} ${current} = ${cleanResult}`, ...h].slice(0, 8)
    );
    setDisplay(cleanResult);
    setPrevValue(null);
    setOperator(null);
    setWaitingNext(true);
  };

  const handleClear = () => {
    keyBufferRef.current = [];
    setDisplay('0');
    setPrevValue(null);
    setOperator(null);
    setWaitingNext(false);
  };

  const handleBackspace = () => {
    keyBufferRef.current = [];
    if (waitingNext) return;
    setDisplay((d) => (d.length > 1 ? d.slice(0, -1) : '0'));
  };

  const handlePercent = () => {
    keyBufferRef.current = [];
    const val = parseFloat(display) || 0;
    setDisplay(String(Number((val / 100).toFixed(6))));
  };

  // --- Vault Setup / Unlock Handlers ---
  const handleSetupVault = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = vaultPinInput.replace(/\D/g, '');
    if (clean.length < 4) {
      setGateError('কমপক্ষে ৪ সংখ্যার পিন দিন');
      return;
    }
    if (clean !== vaultPinConfirm.replace(/\D/g, '')) {
      setGateError('দুইবার দেওয়া পিন মেলেনি');
      return;
    }
    const secret = await initializeNewVault(clean, vaultRecQ, vaultRecA);
    setMasterSecret(secret);
    setGateModal('closed');
    await refreshVaultItems(secret);
    onNotify('সিক্রেট ভল্ট প্রস্তুত হয়েছে', 'success');
  };

  const handleUnlockVault = async (e: React.FormEvent) => {
    e.preventDefault();
    const secret = await unlockVaultWithPin(vaultPinInput.trim());
    if (!secret) {
      setGateError('ভুল ভল্ট পিন');
      return;
    }
    setMasterSecret(secret);
    setGateModal('closed');
    await refreshVaultItems(secret);
  };

  const handleRecoverVault = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNewPin = vaultPinInput.replace(/\D/g, '');
    if (cleanNewPin.length < 4) {
      setGateError('কমপক্ষে ৪ সংখ্যার নতুন পিন দিন');
      return;
    }
    const secret = await recoverVaultAndResetPin(vaultRecA, cleanNewPin);
    if (!secret) {
      setGateError('রিকভারি উত্তর সঠিক নয়');
      return;
    }
    setMasterSecret(secret);
    setGateModal('closed');
    await refreshVaultItems(secret);
    onNotify('পিন রিসেট ও ভল্ট আনলক হয়েছে', 'success');
  };

  // --- Vault Item Handlers ---
  const handleVaultFilesUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !masterSecret) return;
    setLoadingVault(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        let detectedType: VaultItemType = vaultTab;
        if (file.type.startsWith('image/')) detectedType = 'image';
        else if (file.type.startsWith('video/')) detectedType = 'video';
        else detectedType = 'document';

        await addVaultFileItem(file, detectedType, masterSecret);
      }
      await refreshVaultItems(masterSecret);
      onNotify('এনক্রিপ্ট করে ভল্টে সংরক্ষিত হয়েছে', 'success');
    } catch {
      onNotify('ফাইল সংরক্ষণে সমস্যা হয়েছে', 'danger');
    } finally {
      setLoadingVault(false);
      e.target.value = '';
    }
  };

  const handleSaveSecretNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterSecret || (!noteTitle.trim() && !noteBody.trim())) return;
    await saveVaultNoteItem(noteTitle, noteBody, masterSecret, editingNoteId);
    setNoteModalOpen(false);
    setEditingNoteId(undefined);
    setNoteTitle('');
    setNoteBody('');
    await refreshVaultItems(masterSecret);
    onNotify('গোপন নোট সংরক্ষিত হয়েছে', 'success');
  };

  const openVaultItemPreview = async (item: DecryptedVaultItem) => {
    if (!masterSecret) return;
    if (item.type === 'note') {
      setEditingNoteId(item.id);
      setNoteTitle(item.meta.title);
      setNoteBody(item.meta.noteBody || '');
      setNoteModalOpen(true);
      return;
    }
    const blob = await decryptVaultItemBlob(item.id, masterSecret);
    if (!blob) return;
    if (previewItem?.url) URL.revokeObjectURL(previewItem.url);
    const url = URL.createObjectURL(blob);
    setPreviewItem({ item, url });
  };

  const downloadDecryptedFile = async (item: DecryptedVaultItem) => {
    if (!masterSecret) return;
    const blob = await decryptVaultItemBlob(item.id, masterSecret);
    if (!blob) return;
    await saveBlobOffline(
      blob,
      item.meta.fileName || item.meta.title || 'vault-file'
    );
  };

  // ============================================================================
  // RENDER: SECRET VAULT MODE (Only when unlocked!)
  // ============================================================================
  if (masterSecret) {
    const filtered = vaultItems.filter((i) => i.type === vaultTab);

    return (
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Dark Obsidian Vault Header */}
        <section className="rounded-3xl bg-gradient-to-br from-[#0B2620] via-[#0F1B24] to-[#090D16] text-white p-5 sm:p-6 border border-emerald-500/20 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-400/25 flex items-center justify-center">
                <Shield className="w-5 h-5 text-emerald-300" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight">সিক্রেট ভল্ট</h1>
                <p className="text-xs text-white/60">
                  AES-256 অফলাইন এনক্রিপ্টেড স্টোরেজ
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void exportEncryptedVaultBackup()}
                className="min-h-[40px] px-3 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-emerald-300" />
                <span>ব্যাকআপ</span>
              </button>
              <button
                type="button"
                onClick={() => backupImportRef.current?.click()}
                className="min-h-[40px] px-3 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
              >
                <Upload className="w-3.5 h-3.5 text-white/80" />
                <span>রিস্টোর</span>
              </button>
              <input
                ref={backupImportRef}
                type="file"
                accept=".json,application/json"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const reader = new FileReader();
                  reader.onload = async () => {
                    if (typeof reader.result === 'string') {
                      const ok = await importEncryptedVaultBackup(reader.result);
                      if (ok) {
                        onNotify('ভল্ট ব্যাকআপ রিস্টোর হয়েছে। পুনরায় আনলক করুন।', 'success');
                        lockVault();
                      } else {
                        onNotify('সঠিক ভল্ট ব্যাকআপ ফাইল দিন', 'danger');
                      }
                    }
                  };
                  reader.readAsText(f);
                  e.target.value = '';
                }}
                className="hidden"
              />
              <button
                type="button"
                onClick={lockVault}
                className="min-h-[40px] px-3.5 rounded-xl bg-rose-500/90 hover:bg-rose-500 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>লক</span>
              </button>
            </div>
          </div>

          {/* 4 Category Tabs */}
          <div className="grid grid-cols-4 gap-1.5 p-1 mt-5 rounded-2xl bg-white/[0.07]">
            {(
              [
                { id: 'image', label: 'ছবি', icon: ImageIcon },
                { id: 'video', label: 'ভিডিও', icon: Film },
                { id: 'document', label: 'ডকুমেন্ট', icon: FileText },
                { id: 'note', label: 'গোপন নোট', icon: StickyNote },
              ] as const
            ).map((t) => {
              const Icon = t.icon;
              const active = vaultTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setVaultTab(t.id)}
                  className={`min-h-[42px] rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                    active
                      ? 'bg-emerald-500 text-slate-950'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{t.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Vault Content Area */}
        <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {vaultTab === 'image'
                ? 'লুকানো ছবি'
                : vaultTab === 'video'
                ? 'লুকানো ভিডিও'
                : vaultTab === 'document'
                ? 'গোপন ডকুমেন্ট ও PDF'
                : 'গোপন নোটসমূহ'}{' '}
              <span className="font-num text-slate-400 font-normal">
                ({filtered.length})
              </span>
            </h2>

            {vaultTab === 'note' ? (
              <button
                type="button"
                onClick={() => {
                  setEditingNoteId(undefined);
                  setNoteTitle('');
                  setNoteBody('');
                  setNoteModalOpen(true);
                }}
                className="min-h-[40px] px-4 rounded-2xl bg-slate-900 dark:bg-emerald-600 text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>নতুন নোট</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => fileUploadRef.current?.click()}
                  className="min-h-[40px] px-4 rounded-2xl bg-slate-900 dark:bg-emerald-600 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>ফাইল যোগ করুন</span>
                </button>
                <input
                  ref={fileUploadRef}
                  type="file"
                  multiple
                  accept={
                    vaultTab === 'image'
                      ? 'image/*'
                      : vaultTab === 'video'
                      ? 'video/*'
                      : '.pdf,.doc,.docx,.txt,.xlsx,.png,.jpg,*/*'
                  }
                  onChange={(e) => void handleVaultFilesUpload(e)}
                  className="hidden"
                />
              </>
            )}
          </div>

          {loadingVault ? (
            <p className="py-12 text-center text-sm text-slate-400">
              ডিক্রিপ্ট হচ্ছে...
            </p>
          ) : filtered.length === 0 ? (
            <div className="py-14 text-center">
              <p className="text-sm text-slate-400">
                এখনো কোনো ফাইল যোগ করা হয়নি
              </p>
            </div>
          ) : vaultTab === 'image' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filtered.map((img) => (
                <div
                  key={img.id}
                  className="group relative aspect-square rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-800"
                >
                  {thumbUrls[img.id] ? (
                    <img
                      src={thumbUrls[img.id]}
                      alt={img.meta.title}
                      onClick={() => void openVaultItemPreview(img)}
                      className="w-full h-full object-cover cursor-pointer"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => void openVaultItemPreview(img)}
                      className="w-full h-full flex flex-col items-center justify-center p-3 text-slate-500"
                    >
                      <ImageIcon className="w-6 h-6 mb-1" />
                      <span className="text-xs truncate max-w-full">
                        {img.meta.title}
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setDeletingItem(img)}
                    aria-label="মুছুন"
                    className="absolute top-2 right-2 w-8 h-8 rounded-xl bg-black/60 text-white flex items-center justify-center hover:bg-rose-600 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {filtered.map((item) => (
                <div
                  key={item.id}
                  className="min-h-[60px] py-3 flex items-center justify-between gap-3"
                >
                  <button
                    type="button"
                    onClick={() => void openVaultItemPreview(item)}
                    className="flex-1 flex items-center gap-3 text-left min-w-0"
                  >
                    <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 shrink-0">
                      {item.type === 'video' ? (
                        <Film className="w-4 h-4" />
                      ) : item.type === 'document' ? (
                        <FileText className="w-4 h-4" />
                      ) : (
                        <StickyNote className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {item.meta.title}
                      </p>
                      <p className="font-num text-xs text-slate-400 truncate mt-0.5">
                        {item.type === 'note'
                          ? (item.meta.noteBody || '').slice(0, 48)
                          : formatFileSize(item.sizeBytes)}
                      </p>
                    </div>
                  </button>

                  <div className="flex items-center gap-1 shrink-0">
                    {item.type === 'note' ? (
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard?.writeText(
                            item.meta.noteBody || ''
                          );
                          onNotify('নোট কপি হয়েছে', 'success');
                        }}
                        aria-label="কপি"
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void downloadDecryptedFile(item)}
                        aria-label="ডাউনলোড"
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-emerald-600"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setDeletingItem(item)}
                      aria-label="মুছুন"
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Media Lightbox / Video / PDF Preview Modal */}
        <ModalSheet
          open={Boolean(previewItem)}
          onClose={() => {
            if (previewItem?.url) URL.revokeObjectURL(previewItem.url);
            setPreviewItem(null);
          }}
          title={previewItem?.item.meta.title || 'প্রিভিউ'}
          maxWidthClass="sm:max-w-2xl"
        >
          {previewItem && (
            <div className="space-y-4">
              {previewItem.item.type === 'image' && previewItem.url && (
                <img
                  src={previewItem.url}
                  alt={previewItem.item.meta.title}
                  className="max-h-[65vh] mx-auto rounded-2xl object-contain"
                />
              )}
              {previewItem.item.type === 'video' && previewItem.url && (
                <video
                  src={previewItem.url}
                  controls
                  autoPlay
                  className="w-full max-h-[65vh] rounded-2xl bg-black"
                />
              )}
              {previewItem.item.type === 'document' && previewItem.url && (
                <div className="space-y-3">
                  {previewItem.item.mimeType === 'application/pdf' ? (
                    <iframe
                      src={previewItem.url}
                      title={previewItem.item.meta.title}
                      className="w-full h-[60vh] rounded-2xl border border-slate-200 dark:border-slate-800"
                    />
                  ) : (
                    <div className="py-8 text-center">
                      <FileText className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm font-medium">
                        {previewItem.item.meta.fileName}
                      </p>
                      <p className="font-num text-xs text-slate-400 mt-1">
                        {formatFileSize(previewItem.item.sizeBytes)}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void downloadDecryptedFile(previewItem.item)}
                  className="min-h-[42px] px-4 rounded-2xl bg-slate-900 dark:bg-emerald-600 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  <span>ফাইল ডাউনলোড করুন</span>
                </button>
              </div>
            </div>
          )}
        </ModalSheet>

        {/* Secret Note Add/Edit Modal */}
        <ModalSheet
          open={noteModalOpen}
          onClose={() => setNoteModalOpen(false)}
          title={editingNoteId ? 'গোপন নোট সম্পাদনা' : 'নতুন গোপন নোট'}
        >
          <form onSubmit={handleSaveSecretNote} className="space-y-4">
            <input
              type="text"
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              placeholder="শিরোনাম (যেমন: ব্যাংক পিন বা জরুরি তথ্য)"
              autoFocus
              className="w-full min-h-[46px] px-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 text-sm"
            />
            <textarea
              rows={5}
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              placeholder="গোপন নোট লিখুন..."
              className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 text-sm focus:outline-none"
            />
            <button
              type="submit"
              className="w-full min-h-[48px] rounded-2xl bg-slate-900 dark:bg-emerald-600 text-white text-sm font-semibold"
            >
              এনক্রিপ্ট ও সংরক্ষণ করুন
            </button>
          </form>
        </ModalSheet>

        <ConfirmDialog
          open={Boolean(deletingItem)}
          title="ভল্ট থেকে মুছে ফেলবেন?"
          description={
            deletingItem
              ? `"${deletingItem.meta.title}" স্থায়ীভাবে মুছে ফেলা হবে।`
              : ''
          }
          onConfirm={async () => {
            if (deletingItem && masterSecret) {
              await deleteVaultItem(deletingItem.id);
              await refreshVaultItems(masterSecret);
            }
          }}
          onCancel={() => setDeletingItem(null)}
        />
      </div>
    );
  }

  // ============================================================================
  // RENDER: STEALTH NORMAL CALCULATOR MODE
  // ============================================================================
  const parsedDisplay = parseFloat(display);
  const canSendToFinance = Number.isFinite(parsedDisplay) && parsedDisplay > 0;
  const savedVaultCfg = getVaultConfig();

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[42px] -ml-2 px-2 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>মোর মেনু</span>
        </button>
        <span className="text-xs font-medium text-slate-400">ক্যালকুলেটর</span>
      </div>

      {/* Minimalist Calculator Surface */}
      <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-5 shadow-xs">
        {/* Display Area */}
        <div className="min-h-[112px] flex flex-col justify-end items-end px-2 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="font-num text-xs text-slate-400 h-5">
            {prevValue !== null && operator ? `${prevValue} ${operator}` : ''}
          </div>
          <div className="font-num text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white break-all text-right mt-1">
            {display}
          </div>

          {/* 1-Tap Log Calculated Result into Monthly Ledger */}
          {canSendToFinance && (
            <div className="flex items-center gap-2 mt-3">
              <button
                type="button"
                onClick={() => onLogAmountToFinance(parsedDisplay, 'income')}
                className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-[11px] font-semibold inline-flex items-center gap-1"
              >
                <ArrowDownLeft className="w-3 h-3" />
                <span>আয়ে যোগ</span>
              </button>
              <button
                type="button"
                onClick={() => onLogAmountToFinance(parsedDisplay, 'expense')}
                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-semibold inline-flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>খরচে যোগ</span>
              </button>
            </div>
          )}
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-4 gap-2.5 pt-4 select-none">
          <button
            type="button"
            onClick={handleClear}
            className="font-num h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 font-bold text-base active:scale-95 transition-transform"
          >
            AC
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            aria-label="মুছুন"
            className="h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center active:scale-95 transition-transform"
          >
            <Delete className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handlePercent}
            className="font-num h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-base active:scale-95 transition-transform"
          >
            %
          </button>
          <button
            type="button"
            onClick={() => handleOperator('÷')}
            className="font-num h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold text-xl active:scale-95 transition-transform"
          >
            ÷
          </button>

          {['7', '8', '9'].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => handleDigit(n)}
              className="font-num h-14 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-white font-bold text-xl active:scale-95 transition-transform"
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            onClick={() => handleOperator('×')}
            className="font-num h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold text-xl active:scale-95 transition-transform"
          >
            ×
          </button>

          {['4', '5', '6'].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => handleDigit(n)}
              className="font-num h-14 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-white font-bold text-xl active:scale-95 transition-transform"
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            onClick={() => handleOperator('−')}
            className="font-num h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold text-xl active:scale-95 transition-transform"
          >
            −
          </button>

          {['1', '2', '3'].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => handleDigit(n)}
              className="font-num h-14 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-white font-bold text-xl active:scale-95 transition-transform"
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            onClick={() => handleOperator('+')}
            className="font-num h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold text-xl active:scale-95 transition-transform"
          >
            +
          </button>

          <button
            type="button"
            onClick={() => handleDigit('00')}
            className="font-num h-14 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 text-slate-900 dark:text-white font-bold text-lg active:scale-95 transition-transform"
          >
            00
          </button>
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="font-num h-14 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 text-slate-900 dark:text-white font-bold text-xl active:scale-95 transition-transform"
          >
            0
          </button>
          <button
            type="button"
            onClick={() => handleDigit('.')}
            className="font-num h-14 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 text-slate-900 dark:text-white font-bold text-xl active:scale-95 transition-transform"
          >
            .
          </button>
          <button
            type="button"
            onClick={handleEquals}
            className="font-num h-14 rounded-2xl bg-slate-900 dark:bg-emerald-600 text-white font-bold text-xl active:scale-95 transition-transform"
          >
            =
          </button>
        </div>
      </section>

      {/* Calculation History */}
      {history.length > 0 && (
        <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400">হিসাবের হিস্ট্রি</span>
            <button
              type="button"
              onClick={() => setHistory([])}
              className="text-xs text-slate-400 hover:text-rose-500"
            >
              মুছুন
            </button>
          </div>
          <div className="space-y-1">
            {history.map((line, idx) => (
              <p
                key={idx}
                className="font-num text-xs text-slate-600 dark:text-slate-300 text-right"
              >
                {line}
              </p>
            ))}
          </div>
        </section>
      )}

      {/* Secret Vault First-Time Setup Modal */}
      <ModalSheet
        open={gateModal === 'setup'}
        onClose={() => setGateModal('closed')}
        title="গোপন ভল্ট পিন সেট করুন"
        maxWidthClass="sm:max-w-md"
      >
        <form onSubmit={handleSetupVault} className="space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            আপনার গোপন ছবি, ভিডিও, ডকুমেন্ট ও নোট সুরক্ষিত রাখতে একটি পিন সেট করুন।
          </p>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={vaultPinInput}
              onChange={(e) => {
                setVaultPinInput(e.target.value.replace(/\D/g, ''));
                if (gateError) setGateError('');
              }}
              placeholder="নতুন পিন (৪-৬ সংখ্যা)"
              autoFocus
              className="font-num w-full min-h-[46px] px-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-sm font-bold"
            />
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={vaultPinConfirm}
              onChange={(e) => {
                setVaultPinConfirm(e.target.value.replace(/\D/g, ''));
                if (gateError) setGateError('');
              }}
              placeholder="পিন নিশ্চিত করুন"
              className="font-num w-full min-h-[46px] px-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-sm font-bold"
            />
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
            <p className="text-xs text-slate-400">পিন ভুলে গেলে উদ্ধারের প্রশ্ন (ঐচ্ছিক)</p>
            <input
              type="text"
              value={vaultRecQ}
              onChange={(e) => setVaultRecQ(e.target.value)}
              className="w-full min-h-[42px] px-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 text-xs"
            />
            <input
              type="text"
              value={vaultRecA}
              onChange={(e) => setVaultRecA(e.target.value)}
              placeholder="উত্তর লিখুন..."
              className="w-full min-h-[42px] px-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 text-xs"
            />
          </div>

          {gateError && <p className="text-xs text-rose-600">{gateError}</p>}

          <button
            type="submit"
            className="w-full min-h-[48px] rounded-2xl bg-slate-900 dark:bg-emerald-600 text-white text-sm font-semibold"
          >
            ভল্ট চালু করুন
          </button>
        </form>
      </ModalSheet>

      {/* Secret Vault Unlock Modal */}
      <ModalSheet
        open={gateModal === 'unlock'}
        onClose={() => setGateModal('closed')}
        title="সিক্রেট ভল্ট আনলক"
        maxWidthClass="sm:max-w-sm"
      >
        <form onSubmit={handleUnlockVault} className="space-y-4">
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={vaultPinInput}
            onChange={(e) => {
              setVaultPinInput(e.target.value.replace(/\D/g, ''));
              if (gateError) setGateError('');
            }}
            placeholder="ভল্ট পিন দিন"
            autoFocus
            className="font-num w-full min-h-[52px] px-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-center text-2xl font-bold tracking-widest"
          />
          {gateError && (
            <p className="text-xs text-center text-rose-600">{gateError}</p>
          )}
          <button
            type="submit"
            className="w-full min-h-[48px] rounded-2xl bg-slate-900 dark:bg-emerald-600 text-white text-sm font-semibold"
          >
            আনলক করুন
          </button>

          {savedVaultCfg?.recoveryAnswerHash && (
            <button
              type="button"
              onClick={() => {
                setGateError('');
                setVaultPinInput('');
                setGateModal('recovery');
              }}
              className="w-full text-center text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              পিন ভুলে গেছেন?
            </button>
          )}
        </form>
      </ModalSheet>

      {/* Secret Vault Recovery Modal */}
      <ModalSheet
        open={gateModal === 'recovery'}
        onClose={() => setGateModal('closed')}
        title="ভল্ট পিন পুনরুদ্ধার"
        maxWidthClass="sm:max-w-sm"
      >
        <form onSubmit={handleRecoverVault} className="space-y-4">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
            {savedVaultCfg?.recoveryQuestion}
          </p>
          <input
            type="text"
            value={vaultRecA}
            onChange={(e) => {
              setVaultRecA(e.target.value);
              if (gateError) setGateError('');
            }}
            placeholder="আপনার উত্তর..."
            autoFocus
            className="w-full min-h-[44px] px-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 text-sm"
          />
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={vaultPinInput}
            onChange={(e) =>
              setVaultPinInput(e.target.value.replace(/\D/g, ''))
            }
            placeholder="নতুন পিন দিন (৪-৬ সংখ্যা)"
            className="font-num w-full min-h-[46px] px-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-sm font-bold"
          />
          {gateError && <p className="text-xs text-rose-600">{gateError}</p>}
          <button
            type="submit"
            className="w-full min-h-[48px] rounded-2xl bg-slate-900 dark:bg-emerald-600 text-white text-sm font-semibold"
          >
            পিন রিসেট ও আনলক করুন
          </button>
        </form>
      </ModalSheet>
    </div>
  );
}
