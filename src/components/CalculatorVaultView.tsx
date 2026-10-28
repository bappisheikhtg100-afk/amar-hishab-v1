import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowLeft,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Copy,
  Delete,
  Download,
  Eye,
  EyeOff,
  FileText,
  Film,
  FolderPlus,
  Grid2x2,
  Image as ImageIcon,
  KeyRound,
  List,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  StickyNote,
  Trash2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { TransactionType, VaultItemType } from '../types/finance';
import {
  clearPinLockout,
  getPinLockoutRemainingSeconds,
  isExternalPickerRecentlyActive,
  markExternalPickerOpen,
  recordFailedPinAttempt,
} from '../utils/crypto';
import { saveBlobOffline } from '../utils/fileSaver';
import {
  DecryptedVaultItem,
  addVaultFileItem,
  changeVaultPin,
  decryptVaultItemBlob,
  deleteVaultItem,
  exportEncryptedVaultBackup,
  getVaultConfig,
  importEncryptedVaultBackup,
  initializeNewVault,
  listDecryptedVaultItems,
  recoverVaultAndResetPin,
  renameVaultItem,
  saveVaultNoteItem,
  unlockVaultWithPin,
} from '../utils/vaultDb';
import { ConfirmDialog, ModalSheet } from './ModalSheet';

interface CalculatorVaultViewProps {
  onBack: () => void;
  onLogAmountToFinance: (amount: number, type: TransactionType) => void;
  onNotify: (msg: string, tone?: 'neutral' | 'success' | 'danger') => void;
}

type VaultFilterTab = 'all' | VaultItemType;

const SECRET_TRIGGER = '1|0|1|0|1|0|+|+|=';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatShortBanglaDate(ts: number): string {
  try {
    return new Date(ts).toLocaleDateString('bn-BD', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

export function CalculatorVaultView({
  onBack,
  onLogAmountToFinance,
  onNotify,
}: CalculatorVaultViewProps) {
  // --- Stealth Calculator State ---
  const [display, setDisplay] = useState('0');
  const [prevValue, setPrevValue] = useState<number | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [waitingNext, setWaitingNext] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const keyBufferRef = useRef<string[]>([]);

  // --- Secret Vault Auth Gate State ---
  const [gateModal, setGateModal] = useState<
    'closed' | 'setup' | 'unlock' | 'recovery'
  >('closed');
  const [vaultPinInput, setVaultPinInput] = useState('');
  const [vaultPinConfirm, setVaultPinConfirm] = useState('');
  const [vaultRecQ, setVaultRecQ] = useState('আপনার গোপন প্রিয় শব্দ কী?');
  const [vaultRecA, setVaultRecA] = useState('');
  const [gateError, setGateError] = useState('');
  const [verifyingPin, setVerifyingPin] = useState(false);
  const [vaultLockoutSec, setVaultLockoutSec] = useState<number>(() =>
    getPinLockoutRemainingSeconds('vault')
  );

  // --- Unlocked Vault Workspace State ---
  const [masterSecret, setMasterSecret] = useState<string | null>(null);
  const [vaultTab, setVaultTab] = useState<VaultFilterTab>('all');
  const [viewLayout, setViewLayout] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [vaultItems, setVaultItems] = useState<DecryptedVaultItem[]>([]);
  const [loadingVault, setLoadingVault] = useState(false);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const [revealedNoteIds, setRevealedNoteIds] = useState<Record<string, boolean>>({});
  const [showGalleryNotice, setShowGalleryNotice] = useState(false);

  // --- Modals & Overlays inside Unlocked Vault ---
  const [guideOpen, setGuideOpen] = useState(false);
  const [vaultSettingsOpen, setVaultSettingsOpen] = useState(false);
  const [oldPinField, setOldPinField] = useState('');
  const [newPinField, setNewPinField] = useState('');
  const [confirmNewPinField, setConfirmNewPinField] = useState('');
  const [pinChangeError, setPinChangeError] = useState('');

  // Full-screen Lightbox Preview
  const [previewItem, setPreviewItem] = useState<{
    item: DecryptedVaultItem;
    url?: string;
  } | null>(null);
  const [zoomed, setZoomed] = useState(false);

  // Rename Modal
  const [renamingItem, setRenamingItem] = useState<DecryptedVaultItem | null>(null);
  const [renameText, setRenameText] = useState('');

  // Secret Note Modal
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | undefined>(undefined);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');

  // Delete Confirmation
  const [deletingItem, setDeletingItem] = useState<DecryptedVaultItem | null>(null);

  // In-App Private Encrypted Camera State
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState('');
  const [capturingPhoto, setCapturingPhoto] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileUploadRef = useRef<HTMLInputElement | null>(null);
  const cameraFallbackInputRef = useRef<HTMLInputElement | null>(null);
  const backupImportRef = useRef<HTMLInputElement | null>(null);
  const thumbUrlsRef = useRef<Record<string, string>>({});
  const previewUrlRef = useRef<string | undefined>(undefined);
  const activeLoadTokenRef = useRef(0);

  // Keep refs synced for leak-free cleanup on lock or unmount
  useEffect(() => {
    thumbUrlsRef.current = thumbUrls;
  }, [thumbUrls]);

  useEffect(() => {
    previewUrlRef.current = previewItem?.url;
  }, [previewItem]);

  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const revokeAllObjectUrls = useCallback(() => {
    Object.values(thumbUrlsRef.current).forEach((u) => URL.revokeObjectURL(u));
    thumbUrlsRef.current = {};
    setThumbUrls({});
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = undefined;
    }
    setPreviewItem(null);
    setZoomed(false);
  }, []);

  const lockVault = useCallback(() => {
    activeLoadTokenRef.current += 1;
    stopCameraStream();
    setCameraOpen(false);
    revokeAllObjectUrls();
    setMasterSecret(null);
    setVaultItems([]);
    setRevealedNoteIds({});
    setSearchQuery('');
    setShowGalleryNotice(false);
    setGuideOpen(false);
    setVaultSettingsOpen(false);
    setNoteModalOpen(false);
    setRenamingItem(null);
    setDeletingItem(null);
    setVaultPinInput('');
  }, [revokeAllObjectUrls, stopCameraStream]);

  useEffect(() => {
    return () => {
      activeLoadTokenRef.current += 1;
      stopCameraStream();
      Object.values(thumbUrlsRef.current).forEach((u) => URL.revokeObjectURL(u));
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, [stopCameraStream]);

  // Brute-force lockout countdown for Vault gate
  useEffect(() => {
    if (vaultLockoutSec <= 0) return;
    const timer = window.setInterval(() => {
      const rem = getPinLockoutRemainingSeconds('vault');
      setVaultLockoutSec(rem);
      if (rem <= 0) {
        setGateError('');
      }
    }, 500);
    return () => window.clearInterval(timer);
  }, [vaultLockoutSec]);

  // Automatic background lock for Vault after 30s hidden (unless external file picker is open)
  useEffect(() => {
    if (!masterSecret) return;
    let hiddenSince: number | null = null;

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (!isExternalPickerRecentlyActive()) {
          hiddenSince = Date.now();
        }
      } else if (hiddenSince !== null) {
        const elapsedSec = (Date.now() - hiddenSince) / 1000;
        hiddenSince = null;
        if (elapsedSec >= 30 && !isExternalPickerRecentlyActive()) {
          lockVault();
          onNotify('নিরাপত্তার স্বার্থে সিক্রেট ভল্ট অটো-লক হয়েছে', 'neutral');
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [lockVault, masterSecret, onNotify]);

  // Start/restart camera stream when Private Camera modal opens or flips
  useEffect(() => {
    if (!cameraOpen || !masterSecret) {
      stopCameraStream();
      return;
    }

    let cancelled = false;
    setCameraError('');

    const startCamera = async () => {
      stopCameraStream();
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError(
          'এই ব্রাউজারে সরাসরি ক্যামেরা সমর্থিত নয়। নিচের বাটন থেকে ছবি তুলুন।'
        );
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: cameraFacing },
            width: { ideal: 1920 },
            height: { ideal: 1440 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch {
        if (!cancelled) {
          setCameraError(
            'ক্যামেরা পারমিশন পাওয়া যায়নি। ফোনের সেটিংস থেকে ক্যামেরা অনুমতি দিন।'
          );
        }
      }
    };

    void startCamera();
    return () => {
      cancelled = true;
      stopCameraStream();
    };
  }, [cameraFacing, cameraOpen, masterSecret, stopCameraStream]);

  const refreshVaultItems = useCallback(async (secret: string) => {
    const loadToken = ++activeLoadTokenRef.current;
    setLoadingVault(true);
    try {
      const list = await listDecryptedVaultItems(secret);
      if (loadToken !== activeLoadTokenRef.current) return;
      setVaultItems(list);

      // Decrypt all image thumbnails progressively without artificial 24-item cap
      const imageEntries = list.filter((i) => i.type === 'image');
      const nextThumbs: Record<string, string> = {};

      for (const imgItem of imageEntries) {
        if (loadToken !== activeLoadTokenRef.current) {
          Object.values(nextThumbs).forEach((u) => URL.revokeObjectURL(u));
          return;
        }
        const blob = await decryptVaultItemBlob(imgItem.id, secret);
        if (blob) {
          nextThumbs[imgItem.id] = URL.createObjectURL(blob);
        }
      }

      if (loadToken !== activeLoadTokenRef.current) {
        Object.values(nextThumbs).forEach((u) => URL.revokeObjectURL(u));
        return;
      }

      setThumbUrls((old) => {
        Object.values(old).forEach((u) => URL.revokeObjectURL(u));
        return nextThumbs;
      });
    } finally {
      if (loadToken === activeLoadTokenRef.current) {
        setLoadingVault(false);
      }
    }
  }, []);

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
      setVaultLockoutSec(getPinLockoutRemainingSeconds('vault'));
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

  const handleCalcDigit = (d: string) => {
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
    if (recordKeyAndCheckTrigger(op)) return;

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

  const handleCalcBackspace = () => {
    keyBufferRef.current = [];
    if (waitingNext) return;
    setDisplay((d) => (d.length > 1 ? d.slice(0, -1) : '0'));
  };

  const handlePercent = () => {
    keyBufferRef.current = [];
    const val = parseFloat(display) || 0;
    setDisplay(String(Number((val / 100).toFixed(6))));
  };

  // --- Vault Gate PIN Handlers (Supports 4–6 digit PINs smoothly) ---
  const submitVaultUnlockPin = useCallback(
    async (candidatePin: string, recordFailure: boolean) => {
      if (verifyingPin || vaultLockoutSec > 0) return;
      if (candidatePin.length < 4) {
        if (recordFailure) {
          setGateError('কমপক্ষে ৪ সংখ্যার ভল্ট পিন দিন');
        }
        return;
      }

      setVerifyingPin(true);
      try {
        const secret = await unlockVaultWithPin(candidatePin);
        if (secret) {
          clearPinLockout('vault');
          setVaultLockoutSec(0);
          setGateError('');
          setVaultPinInput('');
          setMasterSecret(secret);
          setGateModal('closed');
          await refreshVaultItems(secret);
          return;
        }

        if (recordFailure) {
          const { lockSeconds } = recordFailedPinAttempt('vault');
          if (lockSeconds > 0) {
            setVaultLockoutSec(lockSeconds);
            setGateError(`একাধিক ভুল চেষ্টা। ${lockSeconds} সেকেন্ড অপেক্ষা করুন।`);
          } else {
            setGateError('ভুল ভল্ট পিন');
          }
          window.setTimeout(() => setVaultPinInput(''), 220);
        }
      } finally {
        setVerifyingPin(false);
      }
    },
    [refreshVaultItems, vaultLockoutSec, verifyingPin]
  );

  const handleVaultGateDigit = useCallback(
    async (digit: string) => {
      if (verifyingPin || vaultLockoutSec > 0 || vaultPinInput.length >= 6) return;
      const next = vaultPinInput + digit;
      setVaultPinInput(next);
      setGateError('');

      if (next.length >= 4) {
        // Auto-unlock immediately on matching 4/5/6-digit PIN; only count failure at 6 digits or explicit confirm
        await submitVaultUnlockPin(next, next.length === 6);
      }
    },
    [submitVaultUnlockPin, vaultLockoutSec, vaultPinInput, verifyingPin]
  );

  const handleVaultGateBackspace = useCallback(() => {
    if (verifyingPin || vaultLockoutSec > 0) return;
    setVaultPinInput((prev) => prev.slice(0, -1));
    setGateError('');
  }, [vaultLockoutSec, verifyingPin]);

  useEffect(() => {
    if (gateModal !== 'unlock') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        void handleVaultGateDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleVaultGateBackspace();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        void submitVaultUnlockPin(vaultPinInput, true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setGateModal('closed');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    gateModal,
    handleVaultGateBackspace,
    handleVaultGateDigit,
    submitVaultUnlockPin,
    vaultPinInput,
  ]);

  const handleSetupVault = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = vaultPinInput.replace(/\D/g, '');
    if (clean.length < 4 || clean.length > 6) {
      setGateError('৪ থেকে ৬ সংখ্যার পিন দিন');
      return;
    }
    if (clean !== vaultPinConfirm.replace(/\D/g, '')) {
      setGateError('দুইবার দেওয়া পিন মেলেনি');
      return;
    }
    const secret = await initializeNewVault(clean, vaultRecQ, vaultRecA);
    clearPinLockout('vault');
    setMasterSecret(secret);
    setGateModal('closed');
    await refreshVaultItems(secret);
    onNotify('সিক্রেট ভল্ট প্রস্তুত হয়েছে', 'success');
  };

  const handleRecoverVault = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNewPin = vaultPinInput.replace(/\D/g, '');
    if (cleanNewPin.length < 4 || cleanNewPin.length > 6) {
      setGateError('৪ থেকে ৬ সংখ্যার নতুন পিন দিন');
      return;
    }
    const secret = await recoverVaultAndResetPin(vaultRecA, cleanNewPin);
    if (!secret) {
      setGateError('রিকভারি উত্তর সঠিক নয়');
      return;
    }
    clearPinLockout('vault');
    setVaultLockoutSec(0);
    setMasterSecret(secret);
    setGateModal('closed');
    await refreshVaultItems(secret);
    onNotify('পিন রিসেট ও ভল্ট আনলক হয়েছে', 'success');
  };

  const handleChangeVaultPinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const oldClean = oldPinField.replace(/\D/g, '');
    const newClean = newPinField.replace(/\D/g, '');
    const confirmClean = confirmNewPinField.replace(/\D/g, '');

    if (newClean.length < 4 || newClean.length > 6) {
      setPinChangeError('নতুন পিন ৪ থেকে ৬ সংখ্যার হতে হবে');
      return;
    }
    if (newClean !== confirmClean) {
      setPinChangeError('নতুন পিন দুইবার মেলেনি');
      return;
    }
    const ok = await changeVaultPin(oldClean, newClean);
    if (!ok) {
      setPinChangeError('বর্তমান ভল্ট পিন সঠিক নয়');
      return;
    }
    setOldPinField('');
    setNewPinField('');
    setConfirmNewPinField('');
    setPinChangeError('');
    setVaultSettingsOpen(false);
    onNotify('ভল্ট পিন সফলভাবে পরিবর্তিত হয়েছে', 'success');
  };

  // --- Vault File, Camera & Note Handlers ---
  const handleVaultFilesUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    source: 'device' | 'camera' = 'device'
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !masterSecret) return;
    setLoadingVault(true);
    let importedMediaFromGallery = false;

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        let detectedType: VaultItemType = 'document';
        if (file.type.startsWith('image/')) {
          detectedType = 'image';
          if (source === 'device') importedMediaFromGallery = true;
        } else if (file.type.startsWith('video/')) {
          detectedType = 'video';
          if (source === 'device') importedMediaFromGallery = true;
        }

        await addVaultFileItem(file, detectedType, masterSecret, source);
      }
      await refreshVaultItems(masterSecret);
      if (importedMediaFromGallery) {
        setShowGalleryNotice(true);
      }
      onNotify(
        source === 'camera'
          ? 'ছবিটি সরাসরি এনক্রিপ্ট করে ভল্টে সংরক্ষিত হয়েছে'
          : `${files.length}টি ফাইল এনক্রিপ্ট করে ভল্টে সংরক্ষিত হয়েছে`,
        'success'
      );
    } catch {
      onNotify('ফাইল সংরক্ষণে সমস্যা হয়েছে', 'danger');
    } finally {
      setLoadingVault(false);
      e.target.value = '';
    }
  };

  const handleCaptureEncryptedPhoto = async () => {
    if (!videoRef.current || !masterSecret || capturingPhoto) return;
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    setCapturingPhoto(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context unavailable');

      if (cameraFacing === 'user') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob: Blob | null = await new Promise((res) =>
        canvas.toBlob(res, 'image/jpeg', 0.92)
      );
      if (!blob) throw new Error('Failed to encode photo');

      const stamp = new Date()
        .toISOString()
        .replace(/[:.]/g, '-')
        .slice(0, 19);
      const file = new File([blob], `Vault_Photo_${stamp}.jpg`, {
        type: 'image/jpeg',
      });

      await addVaultFileItem(file, 'image', masterSecret, 'camera');
      await refreshVaultItems(masterSecret);
      setCameraOpen(false);
      onNotify(
        'গ্যালারি ছাড়াই ছবি সরাসরি ভল্টে এনক্রিপ্ট হয়েছে',
        'success'
      );
    } catch {
      onNotify('ছবি সংরক্ষণে সমস্যা হয়েছে', 'danger');
    } finally {
      setCapturingPhoto(false);
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
    onNotify('গোপন নোট এনক্রিপ্ট করে সংরক্ষিত হয়েছে', 'success');
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterSecret || !renamingItem || !renameText.trim()) return;
    const ok = await renameVaultItem(
      renamingItem.id,
      renameText.trim(),
      masterSecret
    );
    if (ok) {
      await refreshVaultItems(masterSecret);
      if (previewItem && previewItem.item.id === renamingItem.id) {
        setPreviewItem({
          ...previewItem,
          item: {
            ...previewItem.item,
            meta: { ...previewItem.item.meta, title: renameText.trim() },
          },
        });
      }
      onNotify('শিরোনাম আপডেট হয়েছে', 'success');
    }
    setRenamingItem(null);
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
    if (previewItem?.url) {
      URL.revokeObjectURL(previewItem.url);
    }
    const url = URL.createObjectURL(blob);
    setZoomed(false);
    setPreviewItem({ item, url });
  };

  const downloadDecryptedFile = async (item: DecryptedVaultItem) => {
    if (!masterSecret) return;
    const blob = await decryptVaultItemBlob(item.id, masterSecret);
    if (!blob) return;
    markExternalPickerOpen();
    await saveBlobOffline(
      blob,
      item.meta.fileName || item.meta.title || 'vault-file'
    );
  };

  // Filtered items & summary counts
  const counts = useMemo(() => {
    const map = { all: vaultItems.length, image: 0, video: 0, document: 0, note: 0 };
    let bytes = 0;
    for (const item of vaultItems) {
      map[item.type] += 1;
      bytes += item.sizeBytes || 0;
    }
    return { ...map, totalBytes: bytes };
  }, [vaultItems]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return vaultItems.filter((item) => {
      if (vaultTab !== 'all' && item.type !== vaultTab) return false;
      if (!q) return true;
      const inTitle = item.meta.title.toLowerCase().includes(q);
      const inFile = (item.meta.fileName || '').toLowerCase().includes(q);
      const inNote = (item.meta.noteBody || '').toLowerCase().includes(q);
      return inTitle || inFile || inNote;
    });
  }, [searchQuery, vaultItems, vaultTab]);

  const previewableMediaItems = useMemo(
    () => filteredItems.filter((i) => i.type !== 'note'),
    [filteredItems]
  );

  const currentPreviewIndex = useMemo(() => {
    if (!previewItem) return -1;
    return previewableMediaItems.findIndex((i) => i.id === previewItem.item.id);
  }, [previewItem, previewableMediaItems]);

  const navigatePreview = async (delta: -1 | 1) => {
    if (currentPreviewIndex < 0) return;
    const nextItem = previewableMediaItems[currentPreviewIndex + delta];
    if (nextItem) {
      await openVaultItemPreview(nextItem);
    }
  };

  // ============================================================================
  // RENDER 1: UNLOCKED BANK-GRADE SECRET VAULT WORKSPACE
  // ============================================================================
  if (masterSecret) {
    const showPhotoGrid =
      viewLayout === 'grid' &&
      filteredItems.length > 0 &&
      filteredItems.every((i) => i.type === 'image');

    return (
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Hidden File Inputs */}
        <input
          ref={fileUploadRef}
          type="file"
          multiple
          accept={
            vaultTab === 'image'
              ? 'image/*'
              : vaultTab === 'video'
              ? 'video/*'
              : vaultTab === 'document'
              ? '.pdf,.doc,.docx,.txt,.xlsx,.csv,.zip,*/*'
              : 'image/*,video/*,.pdf,.doc,.docx,.txt,.xlsx,*/*'
          }
          onChange={(e) => void handleVaultFilesUpload(e, 'device')}
          className="hidden"
        />
        <input
          ref={cameraFallbackInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => void handleVaultFilesUpload(e, 'camera')}
          className="hidden"
        />
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
                  onNotify(
                    'ভল্ট ব্যাকআপ রিস্টোর হয়েছে। পিন দিয়ে আনলক করুন।',
                    'success'
                  );
                  lockVault();
                } else {
                  onNotify('সঠিক এনক্রিপ্টেড ভল্ট ব্যাকআপ ফাইল দিন', 'danger');
                }
              }
            };
            reader.readAsText(f);
            e.target.value = '';
          }}
          className="hidden"
        />

        {/* Bank-Grade Obsidian-Emerald Command Header */}
        <section className="rounded-3xl bg-gradient-to-br from-[#071D18] via-[#0B2620] to-[#091219] text-white p-5 sm:p-6 border border-emerald-500/20 shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-400/25 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6 text-emerald-300" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-bold tracking-tight truncate">
                    সিক্রেট ভল্ট
                  </h1>
                </div>
                <p className="font-num tabular-nums text-xs text-white/65 mt-0.5 truncate">
                  AES-256 অফলাইন ভল্ট · {counts.all}টি আইটেম ·{' '}
                  {formatFileSize(counts.totalBytes)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setGuideOpen(true)}
                aria-label="ভল্ট গাইড"
                title="ভল্ট যেভাবে কাজ করে"
                className="min-h-[44px] min-w-[44px] rounded-2xl bg-white/[0.08] hover:bg-white/[0.14] text-white/85 flex items-center justify-center transition-colors"
              >
                <CircleHelp className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setPinChangeError('');
                  setVaultSettingsOpen(true);
                }}
                aria-label="ভল্ট সেটিংস ও ব্যাকআপ"
                title="ভল্ট সেটিংস ও ব্যাকআপ"
                className="min-h-[44px] min-w-[44px] rounded-2xl bg-white/[0.08] hover:bg-white/[0.14] text-white/85 flex items-center justify-center transition-colors"
              >
                <Settings2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={lockVault}
                className="min-h-[44px] px-4 rounded-2xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
              >
                <Lock className="w-3.5 h-3.5 stroke-[2.3]" />
                <span>লক</span>
              </button>
            </div>
          </div>

          {/* 3 Primary Encrypted Action Tiles */}
          <div className="grid grid-cols-3 gap-2.5 mt-5">
            <button
              type="button"
              onClick={() => setCameraOpen(true)}
              className="min-h-[58px] px-3 py-2.5 rounded-2xl bg-white/[0.09] hover:bg-white/[0.15] border border-white/10 text-left flex flex-col justify-between transition-colors active:scale-[0.98]"
            >
              <Camera className="w-4 h-4 text-emerald-300" />
              <span className="text-xs font-semibold text-white truncate mt-1.5">
                ক্যামেরায় তুলুন
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                markExternalPickerOpen();
                fileUploadRef.current?.click();
              }}
              className="min-h-[58px] px-3 py-2.5 rounded-2xl bg-white/[0.09] hover:bg-white/[0.15] border border-white/10 text-left flex flex-col justify-between transition-colors active:scale-[0.98]"
            >
              <FolderPlus className="w-4 h-4 text-emerald-300" />
              <span className="text-xs font-semibold text-white truncate mt-1.5">
                ফাইল যোগ করুন
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingNoteId(undefined);
                setNoteTitle('');
                setNoteBody('');
                setNoteModalOpen(true);
              }}
              className="min-h-[58px] px-3 py-2.5 rounded-2xl bg-white/[0.09] hover:bg-white/[0.15] border border-white/10 text-left flex flex-col justify-between transition-colors active:scale-[0.98]"
            >
              <StickyNote className="w-4 h-4 text-emerald-300" />
              <span className="text-xs font-semibold text-white truncate mt-1.5">
                গোপন নোট
              </span>
            </button>
          </div>

          {/* Interactive 5-Segment Filter Bar */}
          <div className="grid grid-cols-5 gap-1 p-1 mt-4 rounded-2xl bg-black/25">
            {(
              [
                { id: 'all', label: 'সব', count: counts.all },
                { id: 'image', label: 'ছবি', count: counts.image },
                { id: 'video', label: 'ভিডিও', count: counts.video },
                { id: 'document', label: 'ডকুমেন্ট', count: counts.document },
                { id: 'note', label: 'নোট', count: counts.note },
              ] as const
            ).map((tab) => {
              const active = vaultTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setVaultTab(tab.id)}
                  className={`min-h-[42px] px-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-colors ${
                    active
                      ? 'bg-white text-slate-950 shadow-xs'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  <span className="truncate">{tab.label}</span>
                  <span
                    className={`font-num tabular-nums text-[10px] ${
                      active ? 'text-slate-500' : 'text-white/45'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Post-Import Gallery Copy Explanation Notice */}
        {showGalleryNotice && (
          <section className="rounded-3xl bg-emerald-950/95 text-white border border-emerald-500/30 p-4 sm:p-5 flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <p className="text-xs sm:text-sm font-bold text-emerald-300">
                ভল্টে স্বতন্ত্র এনক্রিপ্টেড কপি সংরক্ষিত হয়েছে
              </p>
              <p className="text-xs text-white/80 leading-relaxed">
                অ্যান্ড্রয়েডের নিরাপত্তার নিয়মে কোনো অ্যাপ নিজে থেকে গ্যালারির মূল ছবি ডিলিট করতে পারে না। আপনার ফাইলের আলাদা এনক্রিপ্টেড কপি এখন ভল্টে সম্পূর্ণ সুরক্ষিত আছে — তাই গ্যালারি থেকে মূল ছবিটি এখন নিশ্চিন্তে মুছে দিতে পারেন।
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowGalleryNotice(false)}
              className="min-h-[40px] px-3.5 rounded-xl bg-emerald-400 text-slate-950 text-xs font-bold shrink-0"
            >
              বুঝেছি
            </button>
          </section>
        )}

        {/* Vault Workspace Surface */}
        <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-5 sm:p-6">
          {/* Search & View Layout Controls */}
          <div className="flex items-center gap-2.5 mb-5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="শিরোনাম বা গোপন নোট খুঁজুন..."
                className="w-full min-h-[44px] pl-10 pr-9 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-600"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="খোঁজা মুছুন"
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white absolute right-1 top-1/2 -translate-y-1/2"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {(vaultTab === 'all' || vaultTab === 'image') && (
              <div className="flex items-center p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setViewLayout('grid')}
                  aria-label="গ্রিড ভিউ"
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                    viewLayout === 'grid'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-400'
                  }`}
                >
                  <Grid2x2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewLayout('list')}
                  aria-label="লিস্ট ভিউ"
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                    viewLayout === 'list'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-400'
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {loadingVault ? (
            <div className="py-16 text-center space-y-2">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                AES-256 ডেটা ডিক্রিপ্ট হচ্ছে...
              </p>
              <p className="text-xs text-slate-400">অনুগ্রহ করে একটু অপেক্ষা করুন</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-14 px-4 text-center max-w-sm mx-auto space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center mx-auto">
                <Lock className="w-5 h-5" />
              </div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                {searchQuery
                  ? 'খুঁজে কোনো ফাইল বা নোট পাওয়া যায়নি'
                  : 'এই বিভাগে এখনো কিছু সংরক্ষিত নেই'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                গ্যালারিতে কোনো কপি না রেখে সরাসরি ছবি লুকাতে ‘ক্যামেরায় তুলুন’ ব্যবহার করুন, অথবা ডিভাইস থেকে যেকোনো ছবি, ভিডিও, PDF বা গোপন নোট যোগ করুন।
              </p>
            </div>
          ) : showPhotoGrid ? (
            /* Pure Photo Grid View */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filteredItems.map((img) => (
                <div
                  key={img.id}
                  className="group relative aspect-square rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-800"
                >
                  <button
                    type="button"
                    onClick={() => void openVaultItemPreview(img)}
                    className="w-full h-full block text-left"
                  >
                    {thumbUrls[img.id] ? (
                      <img
                        src={thumbUrls[img.id]}
                        alt={img.meta.title}
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-3 text-slate-400">
                        <ImageIcon className="w-6 h-6 mb-1.5" />
                        <span className="text-xs truncate max-w-full">
                          {img.meta.title}
                        </span>
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent p-3 pt-8">
                      <p className="text-xs font-semibold text-white truncate">
                        {img.meta.title}
                      </p>
                      <p className="font-num tabular-nums text-[10px] text-white/75 truncate mt-0.5">
                        {formatFileSize(img.sizeBytes)}
                        {img.meta.source === 'camera' ? ' · ভল্ট ক্যামেরা' : ''}
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeletingItem(img)}
                    aria-label="মুছুন"
                    className="absolute top-2 right-2 w-9 h-9 rounded-xl bg-black/55 hover:bg-rose-600 text-white flex items-center justify-center backdrop-blur-xs transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            /* Structured Mixed / List View */
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {filteredItems.map((item) => {
                const isNote = item.type === 'note';
                const isRevealed = Boolean(revealedNoteIds[item.id]);

                return (
                  <div
                    key={item.id}
                    className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                  >
                    <button
                      type="button"
                      onClick={() => void openVaultItemPreview(item)}
                      className="flex-1 flex items-center gap-3.5 text-left min-w-0"
                    >
                      {item.type === 'image' && thumbUrls[item.id] ? (
                        <img
                          src={thumbUrls[item.id]}
                          alt={item.meta.title}
                          className="w-12 h-12 rounded-2xl object-cover border border-slate-200/70 dark:border-slate-700 shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 shrink-0">
                          {item.type === 'image' ? (
                            <ImageIcon className="w-5 h-5" />
                          ) : item.type === 'video' ? (
                            <Film className="w-5 h-5" />
                          ) : item.type === 'document' ? (
                            <FileText className="w-5 h-5" />
                          ) : (
                            <StickyNote className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                          )}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {item.meta.title}
                        </p>
                        {isNote ? (
                          <p className="font-num text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {isRevealed
                              ? item.meta.noteBody || '(খালি নোট)'
                              : '••••••••••••••••'}
                          </p>
                        ) : (
                          <p className="font-num tabular-nums text-xs text-slate-400 truncate mt-0.5">
                            {formatFileSize(item.sizeBytes)} ·{' '}
                            {formatShortBanglaDate(item.createdAt)}
                            {item.meta.source === 'camera' ? ' · ভল্ট ক্যামেরা' : ''}
                          </p>
                        )}
                      </div>
                    </button>

                    <div className="flex items-center gap-0.5 shrink-0">
                      {isNote ? (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setRevealedNoteIds((prev) => ({
                                ...prev,
                                [item.id]: !prev[item.id],
                              }))
                            }
                            aria-label={isRevealed ? 'লুকান' : 'দেখুন'}
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                          >
                            {isRevealed ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void navigator.clipboard?.writeText(
                                item.meta.noteBody || ''
                              );
                              onNotify('নোট ক্লিপবোর্ডে কপি হয়েছে', 'success');
                            }}
                            aria-label="কপি"
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-emerald-600 transition-colors"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setRenamingItem(item);
                              setRenameText(item.meta.title);
                            }}
                            aria-label="নাম পরিবর্তন"
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void downloadDecryptedFile(item)}
                            aria-label="ডিভাইসে সেভ করুন"
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-emerald-600 transition-colors"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => setDeletingItem(item)}
                        aria-label="মুছুন"
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Full-Screen Dark Encrypted Media Lightbox */}
        {previewItem && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-[80] bg-[#05080F]/95 backdrop-blur-md text-white flex flex-col"
          >
            {/* Top Toolbar */}
            <div className="px-4 sm:px-6 py-3.5 border-b border-white/10 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold truncate">
                  {previewItem.item.meta.title}
                </p>
                <p className="font-num tabular-nums text-[11px] text-white/60 truncate">
                  {formatFileSize(previewItem.item.sizeBytes)} ·{' '}
                  {formatShortBanglaDate(previewItem.item.createdAt)}
                </p>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {previewItem.item.type === 'image' && (
                  <button
                    type="button"
                    onClick={() => setZoomed((z) => !z)}
                    aria-label="জুম"
                    className="w-11 h-11 rounded-xl hover:bg-white/10 flex items-center justify-center text-white/85"
                  >
                    {zoomed ? (
                      <ZoomOut className="w-4 h-4" />
                    ) : (
                      <ZoomIn className="w-4 h-4" />
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setRenamingItem(previewItem.item);
                    setRenameText(previewItem.item.meta.title);
                  }}
                  aria-label="নাম পরিবর্তন"
                  className="w-11 h-11 rounded-xl hover:bg-white/10 flex items-center justify-center text-white/85"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => void downloadDecryptedFile(previewItem.item)}
                  aria-label="ডিভাইসে সেভ"
                  className="w-11 h-11 rounded-xl hover:bg-white/10 flex items-center justify-center text-emerald-300"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeletingItem(previewItem.item)}
                  aria-label="মুছুন"
                  className="w-11 h-11 rounded-xl hover:bg-rose-500/20 flex items-center justify-center text-rose-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (previewItem.url) URL.revokeObjectURL(previewItem.url);
                    setPreviewItem(null);
                    setZoomed(false);
                  }}
                  aria-label="বন্ধ করুন"
                  className="w-11 h-11 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Center Media Canvas */}
            <div className="relative flex-1 overflow-auto flex items-center justify-center p-4">
              {previewItem.item.type === 'image' && previewItem.url && (
                <img
                  src={previewItem.url}
                  alt={previewItem.item.meta.title}
                  onDoubleClick={() => setZoomed((z) => !z)}
                  className={`rounded-xl transition-transform duration-200 ${
                    zoomed
                      ? 'scale-[1.85] cursor-zoom-out'
                      : 'max-h-[78vh] max-w-full object-contain cursor-zoom-in'
                  }`}
                />
              )}

              {previewItem.item.type === 'video' && previewItem.url && (
                <video
                  src={previewItem.url}
                  controls
                  autoPlay
                  playsInline
                  className="w-full max-w-3xl max-h-[76vh] rounded-2xl bg-black"
                />
              )}

              {previewItem.item.type === 'document' && previewItem.url && (
                <div className="w-full max-w-3xl">
                  {previewItem.item.mimeType === 'application/pdf' ? (
                    <iframe
                      src={previewItem.url}
                      title={previewItem.item.meta.title}
                      className="w-full h-[74vh] rounded-2xl bg-white border border-white/15"
                    />
                  ) : (
                    <div className="rounded-3xl bg-white/[0.06] border border-white/10 p-8 text-center max-w-sm mx-auto space-y-4">
                      <FileText className="w-12 h-12 text-emerald-300 mx-auto" />
                      <div>
                        <p className="text-base font-bold text-white break-all">
                          {previewItem.item.meta.fileName ||
                            previewItem.item.meta.title}
                        </p>
                        <p className="font-num tabular-nums text-xs text-white/60 mt-1">
                          {formatFileSize(previewItem.item.sizeBytes)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void downloadDecryptedFile(previewItem.item)}
                        className="w-full min-h-[46px] px-4 rounded-2xl bg-emerald-400 text-slate-950 text-xs font-bold inline-flex items-center justify-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        <span>ডিক্রিপ্ট করে ডিভাইসে সেভ করুন</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Previous / Next Navigation */}
              {currentPreviewIndex > 0 && (
                <button
                  type="button"
                  onClick={() => void navigatePreview(-1)}
                  aria-label="আগের ফাইল"
                  className="fixed left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-2xl bg-black/60 hover:bg-black/80 border border-white/15 flex items-center justify-center text-white"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}
              {currentPreviewIndex >= 0 &&
                currentPreviewIndex < previewableMediaItems.length - 1 && (
                  <button
                    type="button"
                    onClick={() => void navigatePreview(1)}
                    aria-label="পরের ফাইল"
                    className="fixed right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-2xl bg-black/60 hover:bg-black/80 border border-white/15 flex items-center justify-center text-white"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                )}
            </div>
          </div>
        )}

        {/* In-App Private Encrypted Camera Modal (Zero Gallery Trace) */}
        {cameraOpen && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-[85] bg-black text-white flex flex-col"
          >
            <div className="px-4 py-3.5 flex items-center justify-between border-b border-white/10">
              <div>
                <h2 className="text-sm font-bold">ভল্ট প্রাইভেট ক্যামেরা</h2>
                <p className="text-[11px] text-emerald-300">
                  গ্যালারিতে সেভ না হয়ে সরাসরি AES-256 ভল্টে লক হবে
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCameraOpen(false)}
                aria-label="বন্ধ করুন"
                className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-slate-950">
              {cameraError ? (
                <div className="max-w-xs text-center px-6 space-y-4">
                  <Camera className="w-10 h-10 text-emerald-400 mx-auto" />
                  <p className="text-xs text-white/80 leading-relaxed">
                    {cameraError}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      markExternalPickerOpen();
                      setCameraOpen(false);
                      cameraFallbackInputRef.current?.click();
                    }}
                    className="w-full min-h-[46px] px-4 rounded-2xl bg-emerald-400 text-slate-950 text-xs font-bold"
                  >
                    সিস্টেম ক্যামেরা দিয়ে তুলুন
                  </button>
                </div>
              ) : (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${
                    cameraFacing === 'user' ? '-scale-x-100' : ''
                  }`}
                />
              )}
            </div>

            {!cameraError && (
              <div className="px-6 py-6 bg-black/90 border-t border-white/10 flex items-center justify-between max-w-md w-full mx-auto pb-safe">
                <button
                  type="button"
                  onClick={() =>
                    setCameraFacing((f) =>
                      f === 'environment' ? 'user' : 'environment'
                    )
                  }
                  aria-label="ক্যামেরা ঘোরান"
                  className="w-12 h-12 rounded-2xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  disabled={capturingPhoto}
                  onClick={() => void handleCaptureEncryptedPhoto()}
                  aria-label="ছবি তুলুন"
                  className="w-18 h-18 rounded-full border-4 border-emerald-400 p-1.5 flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50"
                >
                  <span className="w-full h-full rounded-full bg-white block" />
                </button>

                <div className="w-12 h-12" />
              </div>
            )}
          </div>
        )}

        {/* How Vault Works Info Sheet */}
        <ModalSheet
          open={guideOpen}
          onClose={() => setGuideOpen(false)}
          title="সিক্রেট ভল্ট যেভাবে কাজ করে"
        >
          <div className="space-y-4 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-4 space-y-1.5">
              <p className="font-bold text-slate-900 dark:text-white">
                ১. গ্যালারির ছবি কেন নিজে থেকে মুছে যায় না?
              </p>
              <p>
                অ্যান্ড্রয়েড ১১+ এর নিরাপত্তার নিয়মে (Scoped Storage) কোনো অ্যাপ গোপনে আপনার ফোনের গ্যালারি বা DCIM ফোল্ডারের মূল ছবি ডিলিট করতে পারে না। আপনি ফাইল যোগ করলে ভল্ট তার নিজস্ব ডাটাবেসে ছবিটির একটি স্বাধীন <strong>AES-256 এনক্রিপ্টেড কপি</strong> তৈরি করে নেয়। তাই ভল্টে যোগ করার পর আপনি গ্যালারি থেকে মূল ছবিটি ডিলিট করে দিলেও ভল্টের ভেতর তা ১০০% নিরাপদ ও অক্ষত থাকে।
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-4 space-y-1.5">
              <p className="font-bold text-slate-900 dark:text-white">
                ২. গ্যালারিতে কোনো কপি না রাখতে চাইলে কী করব?
              </p>
              <p>
                ভল্টের ভেতর উপরের <strong>‘ক্যামেরায় তুলুন’</strong> বাটন ব্যবহার করে সরাসরি ছবি তুলুন। এতে ছবিটি ফোনের গ্যালারিতে কখনোই যাবে না — সরাসরি এনক্রিপ্ট হয়ে ভল্টে লক হবে।
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-4 space-y-1.5">
              <p className="font-bold text-slate-900 dark:text-white">
                ৩. ফোন পরিবর্তন করলে ভল্টের ফাইল কীভাবে নেব?
              </p>
              <p>
                ভল্টের উপরের সেটিংস আইকন থেকে <strong>এনক্রিপ্টেড ভল্ট ব্যাকআপ (.json)</strong> ডাউনলোড করে রাখুন। নতুন ফোনে রিস্টোর করে আপনার ভল্ট পিন দিলেই সব ছবি, ভিডিও, ডকুমেন্ট ও নোট ফিরে পাবেন।
              </p>
            </div>
          </div>
        </ModalSheet>

        {/* Vault Security & Encrypted Backup Sheet */}
        <ModalSheet
          open={vaultSettingsOpen}
          onClose={() => setVaultSettingsOpen(false)}
          title="ভল্ট নিরাপত্তা ও ব্যাকআপ"
        >
          <div className="space-y-6">
            {/* Encrypted Backup Actions */}
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                এনক্রিপ্টেড ভল্ট ব্যাকআপ
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                ব্যাকআপ ফাইলেও আপনার সব ছবি ও নোট AES-256 এনক্রিপ্টেড অবস্থায় থাকে; পিন ছাড়া কেউ খুলতে পারবে না।
              </p>
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    markExternalPickerOpen();
                    void exportEncryptedVaultBackup();
                  }}
                  className="min-h-[46px] px-3.5 rounded-2xl bg-slate-900 dark:bg-emerald-600 text-white text-xs font-semibold inline-flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>ব্যাকআপ সেভ</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    markExternalPickerOpen();
                    backupImportRef.current?.click();
                  }}
                  className="min-h-[46px] px-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs font-semibold inline-flex items-center justify-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  <span>ব্যাকআপ রিস্টোর</span>
                </button>
              </div>
            </div>

            {/* Change Vault PIN */}
            <form
              onSubmit={handleChangeVaultPinSubmit}
              className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3"
            >
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                ভল্ট পিন পরিবর্তন করুন
              </h3>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={oldPinField}
                onChange={(e) => {
                  setOldPinField(e.target.value.replace(/\D/g, ''));
                  if (pinChangeError) setPinChangeError('');
                }}
                placeholder="বর্তমান ভল্ট পিন"
                className="font-num w-full min-h-[46px] px-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-sm"
              />
              <div className="grid grid-cols-2 gap-2.5">
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={newPinField}
                  onChange={(e) => {
                    setNewPinField(e.target.value.replace(/\D/g, ''));
                    if (pinChangeError) setPinChangeError('');
                  }}
                  placeholder="নতুন পিন (৪-৬ সংখ্যা)"
                  className="font-num w-full min-h-[46px] px-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-sm"
                />
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={confirmNewPinField}
                  onChange={(e) => {
                    setConfirmNewPinField(e.target.value.replace(/\D/g, ''));
                    if (pinChangeError) setPinChangeError('');
                  }}
                  placeholder="নতুন পিন নিশ্চিত করুন"
                  className="font-num w-full min-h-[46px] px-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-sm"
                />
              </div>
              {pinChangeError && (
                <p className="text-xs text-rose-600">{pinChangeError}</p>
              )}
              <button
                type="submit"
                className="w-full min-h-[46px] rounded-2xl bg-slate-900 dark:bg-emerald-600 text-white text-xs font-bold"
              >
                নতুন পিন সংরক্ষণ করুন
              </button>
            </form>
          </div>
        </ModalSheet>

        {/* Rename Item Modal */}
        <ModalSheet
          open={Boolean(renamingItem)}
          onClose={() => setRenamingItem(null)}
          title="শিরোনাম পরিবর্তন করুন"
          maxWidthClass="sm:max-w-sm"
        >
          <form onSubmit={handleRenameSubmit} className="space-y-4">
            <input
              type="text"
              value={renameText}
              onChange={(e) => setRenameText(e.target.value)}
              placeholder="নতুন শিরোনাম লিখুন"
              autoFocus
              className="w-full min-h-[46px] px-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-sm"
            />
            <button
              type="submit"
              className="w-full min-h-[46px] rounded-2xl bg-slate-900 dark:bg-emerald-600 text-white text-sm font-semibold"
            >
              সংরক্ষণ করুন
            </button>
          </form>
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
              placeholder="শিরোনাম (যেমন: ব্যাংক অ্যাকাউন্ট বা পাসওয়ার্ড নোট)"
              autoFocus
              className="w-full min-h-[46px] px-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 text-sm"
            />
            <textarea
              rows={6}
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              placeholder="আপনার গোপন তথ্য এখানে লিখুন..."
              className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 text-sm focus:outline-none focus:border-emerald-600"
            />
            <button
              type="submit"
              className="w-full min-h-[48px] rounded-2xl bg-slate-900 dark:bg-emerald-600 text-white text-sm font-semibold"
            >
              AES-256 এনক্রিপ্ট ও সংরক্ষণ করুন
            </button>
          </form>
        </ModalSheet>

        {/* Delete Item Confirmation */}
        <ConfirmDialog
          open={Boolean(deletingItem)}
          title="ভল্ট থেকে স্থায়ীভাবে মুছবেন?"
          description={
            deletingItem
              ? `"${deletingItem.meta.title}" ভল্ট থেকে স্থায়ীভাবে মুছে ফেলা হবে।`
              : ''
          }
          onConfirm={async () => {
            if (deletingItem && masterSecret) {
              const targetId = deletingItem.id;
              if (previewItem?.item.id === targetId) {
                if (previewItem.url) URL.revokeObjectURL(previewItem.url);
                setPreviewItem(null);
              }
              await deleteVaultItem(targetId);
              await refreshVaultItems(masterSecret);
              onNotify('ভল্ট থেকে মুছে ফেলা হয়েছে', 'neutral');
            }
          }}
          onCancel={() => setDeletingItem(null)}
        />
      </div>
    );
  }

  // ============================================================================
  // RENDER 2: STEALTH NORMAL CALCULATOR + FULL-SCREEN VAULT SECURITY GATE
  // ============================================================================
  const parsedDisplay = parseFloat(display);
  const canSendToFinance = Number.isFinite(parsedDisplay) && parsedDisplay > 0;
  const savedVaultCfg = getVaultConfig();
  const dotSlots = Math.max(4, vaultPinInput.length);

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[44px] -ml-2 px-2 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>মোর মেনু</span>
        </button>
        <span className="text-xs font-medium text-slate-400">ক্যালকুলেটর</span>
      </div>

      {/* Minimalist Stealth Calculator Surface */}
      <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-5 shadow-xs">
        <div className="min-h-[112px] flex flex-col justify-end items-end px-2 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="font-num tabular-nums text-xs text-slate-400 h-5">
            {prevValue !== null && operator ? `${prevValue} ${operator}` : ''}
          </div>
          <div className="font-num tabular-nums text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white break-all text-right mt-1">
            {display}
          </div>

          {canSendToFinance && (
            <div className="flex items-center gap-2 mt-3">
              <button
                type="button"
                onClick={() => onLogAmountToFinance(parsedDisplay, 'income')}
                className="min-h-[34px] px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-[11px] font-semibold inline-flex items-center gap-1"
              >
                <ArrowDownLeft className="w-3 h-3" />
                <span>আয়ে যোগ</span>
              </button>
              <button
                type="button"
                onClick={() => onLogAmountToFinance(parsedDisplay, 'expense')}
                className="min-h-[34px] px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-semibold inline-flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>খরচে যোগ</span>
              </button>
            </div>
          )}
        </div>

        {/* Calculator Keypad */}
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
            onClick={handleCalcBackspace}
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
              onClick={() => handleCalcDigit(n)}
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
              onClick={() => handleCalcDigit(n)}
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
              onClick={() => handleCalcDigit(n)}
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
            onClick={() => handleCalcDigit('00')}
            className="font-num h-14 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 text-slate-900 dark:text-white font-bold text-lg active:scale-95 transition-transform"
          >
            00
          </button>
          <button
            type="button"
            onClick={() => handleCalcDigit('0')}
            className="font-num h-14 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 text-slate-900 dark:text-white font-bold text-xl active:scale-95 transition-transform"
          >
            0
          </button>
          <button
            type="button"
            onClick={() => handleCalcDigit('.')}
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

      {history.length > 0 && (
        <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400">
              হিসাবের হিস্ট্রি
            </span>
            <button
              type="button"
              onClick={() => setHistory([])}
              className="min-h-[36px] px-2 text-xs text-slate-400 hover:text-rose-500"
            >
              মুছুন
            </button>
          </div>
          <div className="space-y-1">
            {history.map((line, idx) => (
              <p
                key={idx}
                className="font-num tabular-nums text-xs text-slate-600 dark:text-slate-300 text-right"
              >
                {line}
              </p>
            ))}
          </div>
        </section>
      )}

      {/* Full-Bleed Bank-Grade Vault Security Gate (Unlock / Setup / Recovery) */}
      {gateModal !== 'closed' && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[85] bg-gradient-to-b from-[#061814] via-[#071D18] to-[#090F17] text-white flex flex-col px-6 py-6 select-none overflow-y-auto"
        >
          <div className="max-w-md w-full mx-auto flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setGateModal('closed');
                setVaultPinInput('');
                setGateError('');
              }}
              className="min-h-[44px] -ml-2 px-3 rounded-2xl text-xs font-semibold text-white/75 hover:text-white inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>ক্যালকুলেটরে ফিরুন</span>
            </button>
            <span className="font-num text-[11px] text-emerald-300/80">
              AES-256 VAULT
            </span>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center py-6">
            {gateModal === 'unlock' && (
              <div className="w-full max-w-xs flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center mb-4 shadow-lg">
                  <ShieldCheck className="w-8 h-8 text-emerald-300" />
                </div>

                <h2 className="text-lg font-bold tracking-tight">
                  সিক্রেট ভল্ট আনলক
                </h2>
                <p className="text-xs text-white/60 mt-1 text-center">
                  প্রবেশ করতে আপনার ভল্ট পিন দিন
                </p>

                {/* Masked PIN Dots */}
                <div className="flex items-center gap-3.5 my-6 min-h-[20px]">
                  {Array.from({ length: dotSlots }).map((_, idx) => {
                    const filled = idx < vaultPinInput.length;
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

                {/* Error / Lockout Feedback */}
                <div className="min-h-[28px] mb-3 flex items-center justify-center text-center">
                  {vaultLockoutSec > 0 ? (
                    <p className="font-num tabular-nums text-xs font-medium text-amber-300 inline-flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                      <span>নিরাপত্তা বিরতি: {vaultLockoutSec} সেকেন্ড অপেক্ষা করুন</span>
                    </p>
                  ) : gateError ? (
                    <p className="text-xs font-medium text-rose-300">
                      {gateError}
                    </p>
                  ) : null}
                </div>

                {/* Tactile Vault Keypad */}
                <div className="grid grid-cols-3 gap-3.5 w-full max-w-[264px]">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                    <button
                      key={d}
                      type="button"
                      disabled={vaultLockoutSec > 0 || verifyingPin}
                      onClick={() => void handleVaultGateDigit(d)}
                      className="font-num h-15 rounded-2xl bg-white/[0.08] hover:bg-white/[0.15] active:scale-95 disabled:opacity-40 text-xl font-bold text-white transition-all"
                    >
                      {d}
                    </button>
                  ))}

                  <button
                    type="button"
                    disabled={
                      vaultLockoutSec > 0 ||
                      verifyingPin ||
                      vaultPinInput.length < 4
                    }
                    onClick={() => void submitVaultUnlockPin(vaultPinInput, true)}
                    aria-label="আনলক নিশ্চিত করুন"
                    className="h-15 rounded-2xl bg-emerald-500/20 hover:bg-emerald-500/35 disabled:opacity-25 flex items-center justify-center text-emerald-300 transition-colors"
                  >
                    <Check className="w-5 h-5" />
                  </button>

                  <button
                    type="button"
                    disabled={vaultLockoutSec > 0 || verifyingPin}
                    onClick={() => void handleVaultGateDigit('0')}
                    className="font-num h-15 rounded-2xl bg-white/[0.08] hover:bg-white/[0.15] active:scale-95 disabled:opacity-40 text-xl font-bold text-white transition-all"
                  >
                    0
                  </button>

                  <button
                    type="button"
                    disabled={vaultLockoutSec > 0 || verifyingPin}
                    onClick={handleVaultGateBackspace}
                    aria-label="মুছুন"
                    className="h-15 rounded-2xl bg-white/[0.05] hover:bg-white/[0.12] disabled:opacity-40 flex items-center justify-center text-white/80 transition-colors"
                  >
                    <Delete className="w-5 h-5" />
                  </button>
                </div>

                {savedVaultCfg?.recoveryAnswerHash && (
                  <button
                    type="button"
                    onClick={() => {
                      setGateError('');
                      setVaultPinInput('');
                      setGateModal('recovery');
                    }}
                    className="mt-6 min-h-[44px] px-4 text-xs font-medium text-emerald-300/85 hover:text-emerald-200 underline underline-offset-4"
                  >
                    ভল্ট পিন ভুলে গেছেন?
                  </button>
                )}
              </div>
            )}

            {gateModal === 'setup' && (
              <form
                onSubmit={handleSetupVault}
                className="w-full max-w-sm rounded-3xl bg-white/[0.07] border border-white/15 p-6 space-y-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-300 shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold">
                      সিক্রেট ভল্ট সেটআপ করুন
                    </h2>
                    <p className="text-xs text-white/65">
                      AES-256 অফলাইন এনক্রিপ্টেড প্রাইভেট স্টোরেজ
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
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
                    className="font-num w-full min-h-[46px] px-3.5 rounded-2xl bg-white/10 border border-white/15 text-sm font-bold text-white placeholder:text-white/45 focus:outline-none focus:border-emerald-400"
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
                    className="font-num w-full min-h-[46px] px-3.5 rounded-2xl bg-white/10 border border-white/15 text-sm font-bold text-white placeholder:text-white/45 focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <div className="pt-3 border-t border-white/10 space-y-2.5">
                  <p className="text-xs text-white/65">
                    পিন ভুলে গেলে উদ্ধারের প্রশ্ন (ঐচ্ছিক কিন্তু সুপারিশকৃত)
                  </p>
                  <input
                    type="text"
                    value={vaultRecQ}
                    onChange={(e) => setVaultRecQ(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 rounded-2xl bg-white/10 border border-white/15 text-xs text-white focus:outline-none focus:border-emerald-400"
                  />
                  <input
                    type="text"
                    value={vaultRecA}
                    onChange={(e) => setVaultRecA(e.target.value)}
                    placeholder="আপনার গোপন উত্তর লিখুন..."
                    className="w-full min-h-[44px] px-3.5 rounded-2xl bg-white/10 border border-white/15 text-xs text-white placeholder:text-white/45 focus:outline-none focus:border-emerald-400"
                  />
                </div>

                {gateError && (
                  <p className="text-xs text-rose-300">{gateError}</p>
                )}

                <button
                  type="submit"
                  className="w-full min-h-[48px] rounded-2xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-sm font-bold transition-colors"
                >
                  এনক্রিপ্টেড ভল্ট চালু করুন
                </button>
              </form>
            )}

            {gateModal === 'recovery' && (
              <form
                onSubmit={handleRecoverVault}
                className="w-full max-w-sm rounded-3xl bg-white/[0.07] border border-white/15 p-6 space-y-4"
              >
                <div className="flex items-center gap-2.5">
                  <KeyRound className="w-5 h-5 text-emerald-300" />
                  <h2 className="text-base font-bold">ভল্ট পিন পুনরুদ্ধার</h2>
                </div>

                <p className="text-xs text-white/80 font-medium">
                  প্রশ্ন: {savedVaultCfg?.recoveryQuestion}
                </p>

                <input
                  type="text"
                  value={vaultRecA}
                  onChange={(e) => {
                    setVaultRecA(e.target.value);
                    if (gateError) setGateError('');
                  }}
                  placeholder="আপনার গোপন উত্তর দিন"
                  autoFocus
                  className="w-full min-h-[46px] px-4 rounded-2xl bg-white/10 border border-white/15 text-sm text-white placeholder:text-white/45 focus:outline-none focus:border-emerald-400"
                />

                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={vaultPinInput}
                  onChange={(e) => {
                    setVaultPinInput(e.target.value.replace(/\D/g, ''));
                    if (gateError) setGateError('');
                  }}
                  placeholder="নতুন পিন দিন (৪-৬ সংখ্যা)"
                  className="font-num w-full min-h-[46px] px-4 rounded-2xl bg-white/10 border border-white/15 text-sm font-bold text-white placeholder:text-white/45 focus:outline-none focus:border-emerald-400"
                />

                {gateError && (
                  <p className="text-xs text-rose-300">{gateError}</p>
                )}

                <div className="flex items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setGateError('');
                      setVaultPinInput('');
                      setGateModal('unlock');
                    }}
                    className="min-h-[46px] flex-1 rounded-2xl bg-white/10 text-xs font-semibold text-white"
                  >
                    ফিরে যান
                  </button>
                  <button
                    type="submit"
                    className="min-h-[46px] flex-1 rounded-2xl bg-emerald-400 text-slate-950 text-xs font-bold"
                  >
                    পিন রিসেট ও আনলক
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
