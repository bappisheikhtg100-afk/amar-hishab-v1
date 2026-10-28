import {
  VaultDecryptedMeta,
  VaultItemType,
  VaultStoredRecord,
} from '../types/finance';
import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  decryptBytes,
  encryptBytes,
  generateSaltHex,
  hashSecret,
  hashSecretPBKDF2,
  timingSafeEqual,
} from './crypto';
import { saveBlobOffline } from './fileSaver';

export interface WrappedVaultConfig {
  version?: number;
  pinHash: string;
  saltHex: string;
  recoveryQuestion: string;
  recoveryAnswerHash: string;
  wrappedMasterByPinB64: string;
  wrappedMasterIvPinB64: string;
  wrappedMasterByRecB64?: string;
  wrappedMasterIvRecB64?: string;
}

const VAULT_CONFIG_KEY = 'amar_hisab_vault_config_v2';
const DB_NAME = 'amar_hisab_vault_db';
const DB_VERSION = 1;
const STORE_NAME = 'vault_items';

function openVaultDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function getVaultConfig(): WrappedVaultConfig | null {
  try {
    const raw = localStorage.getItem(VAULT_CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WrappedVaultConfig;
    if (!parsed || typeof parsed.pinHash !== 'string' || typeof parsed.saltHex !== 'string') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function initializeNewVault(
  pin: string,
  recoveryQuestion: string,
  recoveryAnswer: string
): Promise<string> {
  const saltHex = generateSaltHex();
  const masterSecret = generateSaltHex() + generateSaltHex(); // 64-hex random 256-bit key
  const pinHash = await hashSecretPBKDF2('vault_pin::' + pin, saltHex);

  const masterBytes = new TextEncoder().encode(masterSecret).buffer;
  const pinWrap = await encryptBytes(masterBytes, pin, saltHex);

  let wrappedMasterByRecB64: string | undefined;
  let wrappedMasterIvRecB64: string | undefined;
  let recoveryAnswerHash = '';

  if (recoveryAnswer.trim()) {
    const normAns = recoveryAnswer.trim().toLowerCase();
    recoveryAnswerHash = await hashSecretPBKDF2('vault_rec::' + normAns, saltHex);
    const recWrap = await encryptBytes(masterBytes, normAns, saltHex);
    wrappedMasterByRecB64 = arrayBufferToBase64(recWrap.cipherBuffer);
    wrappedMasterIvRecB64 = arrayBufferToBase64(recWrap.iv.buffer as ArrayBuffer);
  }

  const cfg: WrappedVaultConfig = {
    version: 2,
    pinHash,
    saltHex,
    recoveryQuestion: recoveryQuestion.trim(),
    recoveryAnswerHash,
    wrappedMasterByPinB64: arrayBufferToBase64(pinWrap.cipherBuffer),
    wrappedMasterIvPinB64: arrayBufferToBase64(pinWrap.iv.buffer as ArrayBuffer),
    wrappedMasterByRecB64,
    wrappedMasterIvRecB64,
  };

  localStorage.setItem(VAULT_CONFIG_KEY, JSON.stringify(cfg));
  return masterSecret;
}

export async function unlockVaultWithPin(pin: string): Promise<string | null> {
  const cfg = getVaultConfig();
  if (!cfg) return null;

  let matched = false;
  if (cfg.version === 2) {
    const candidate = await hashSecretPBKDF2('vault_pin::' + pin, cfg.saltHex);
    matched = timingSafeEqual(candidate, cfg.pinHash);
  } else {
    // Seamless support for existing v1 Vault PINs
    const candidateV1 = await hashSecret('vault_pin::' + pin);
    matched = timingSafeEqual(candidateV1, cfg.pinHash);
  }

  if (!matched) return null;

  try {
    const cipher = base64ToArrayBuffer(cfg.wrappedMasterByPinB64);
    const iv = new Uint8Array(base64ToArrayBuffer(cfg.wrappedMasterIvPinB64));
    const dec = await decryptBytes(cipher, iv, pin, cfg.saltHex);
    const masterSecret = new TextDecoder().decode(dec);

    // Upgrade v1 pinHash to v2 PBKDF2 transparently once verified
    if (cfg.version !== 2 && !cfg.recoveryAnswerHash) {
      const upgradedHash = await hashSecretPBKDF2('vault_pin::' + pin, cfg.saltHex);
      const upgraded: WrappedVaultConfig = {
        ...cfg,
        version: 2,
        pinHash: upgradedHash,
      };
      localStorage.setItem(VAULT_CONFIG_KEY, JSON.stringify(upgraded));
    }

    return masterSecret;
  } catch {
    return null;
  }
}

export async function changeVaultPin(
  currentPin: string,
  newPin: string
): Promise<boolean> {
  const cfg = getVaultConfig();
  if (!cfg) return false;
  const masterSecret = await unlockVaultWithPin(currentPin);
  if (!masterSecret) return false;

  try {
    const newPinHash =
      cfg.version === 2
        ? await hashSecretPBKDF2('vault_pin::' + newPin, cfg.saltHex)
        : await hashSecret('vault_pin::' + newPin);

    const pinWrap = await encryptBytes(
      new TextEncoder().encode(masterSecret).buffer,
      newPin,
      cfg.saltHex
    );

    const updated: WrappedVaultConfig = {
      ...cfg,
      pinHash: newPinHash,
      wrappedMasterByPinB64: arrayBufferToBase64(pinWrap.cipherBuffer),
      wrappedMasterIvPinB64: arrayBufferToBase64(pinWrap.iv.buffer as ArrayBuffer),
    };
    localStorage.setItem(VAULT_CONFIG_KEY, JSON.stringify(updated));
    return true;
  } catch {
    return false;
  }
}

export async function recoverVaultAndResetPin(
  recoveryAnswer: string,
  newPin: string
): Promise<string | null> {
  const cfg = getVaultConfig();
  if (
    !cfg ||
    !cfg.recoveryAnswerHash ||
    !cfg.wrappedMasterByRecB64 ||
    !cfg.wrappedMasterIvRecB64
  ) {
    return null;
  }
  const normAns = recoveryAnswer.trim().toLowerCase();
  const candidate =
    cfg.version === 2
      ? await hashSecretPBKDF2('vault_rec::' + normAns, cfg.saltHex)
      : await hashSecret('vault_rec::' + normAns);

  if (!timingSafeEqual(candidate, cfg.recoveryAnswerHash)) return null;

  try {
    const cipher = base64ToArrayBuffer(cfg.wrappedMasterByRecB64);
    const iv = new Uint8Array(base64ToArrayBuffer(cfg.wrappedMasterIvRecB64));
    const dec = await decryptBytes(cipher, iv, normAns, cfg.saltHex);
    const masterSecret = new TextDecoder().decode(dec);

    const newPinHash =
      cfg.version === 2
        ? await hashSecretPBKDF2('vault_pin::' + newPin, cfg.saltHex)
        : await hashSecret('vault_pin::' + newPin);

    const pinWrap = await encryptBytes(
      new TextEncoder().encode(masterSecret).buffer,
      newPin,
      cfg.saltHex
    );

    const updated: WrappedVaultConfig = {
      ...cfg,
      pinHash: newPinHash,
      wrappedMasterByPinB64: arrayBufferToBase64(pinWrap.cipherBuffer),
      wrappedMasterIvPinB64: arrayBufferToBase64(pinWrap.iv.buffer as ArrayBuffer),
    };
    localStorage.setItem(VAULT_CONFIG_KEY, JSON.stringify(updated));
    return masterSecret;
  } catch {
    return null;
  }
}

export interface DecryptedVaultItem {
  id: string;
  type: VaultItemType;
  mimeType: string;
  sizeBytes: number;
  createdAt: number;
  meta: VaultDecryptedMeta;
}

export async function addVaultFileItem(
  file: File,
  type: VaultItemType,
  masterSecret: string,
  source: 'camera' | 'device' = 'device'
): Promise<void> {
  const cfg = getVaultConfig();
  if (!cfg) throw new Error('Vault not initialized');

  const fileBuffer = await file.arrayBuffer();
  const metaObj: VaultDecryptedMeta = {
    title: file.name.replace(/\.[^/.]+$/, '') || file.name,
    fileName: file.name,
    updatedAt: Date.now(),
    source,
  };
  const metaBuffer = new TextEncoder().encode(JSON.stringify(metaObj)).buffer;

  const { iv, cipherBuffer: encryptedMeta } = await encryptBytes(
    metaBuffer,
    masterSecret,
    cfg.saltHex
  );
  const payloadEnc = await encryptBytes(fileBuffer, masterSecret, cfg.saltHex);
  const combinedPayload = new Uint8Array(
    12 + payloadEnc.cipherBuffer.byteLength
  );
  combinedPayload.set(payloadEnc.iv, 0);
  combinedPayload.set(new Uint8Array(payloadEnc.cipherBuffer), 12);

  const record: VaultStoredRecord = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    mimeType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
    createdAt: Date.now(),
    iv,
    encryptedMeta,
    encryptedPayload: combinedPayload.buffer,
  };

  const db = await openVaultDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function saveVaultNoteItem(
  title: string,
  noteBody: string,
  masterSecret: string,
  existingId?: string
): Promise<void> {
  const cfg = getVaultConfig();
  if (!cfg) throw new Error('Vault not initialized');

  let originalCreatedAt = Date.now();
  if (existingId) {
    try {
      const dbCheck = await openVaultDB();
      const prev: VaultStoredRecord | undefined = await new Promise((res) => {
        const tx = dbCheck.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(existingId);
        req.onsuccess = () => {
          dbCheck.close();
          res(req.result);
        };
        req.onerror = () => {
          dbCheck.close();
          res(undefined);
        };
      });
      if (prev?.createdAt) originalCreatedAt = prev.createdAt;
    } catch {
      // ignore
    }
  }

  const metaObj: VaultDecryptedMeta = {
    title: title.trim() || 'গোপন নোট',
    noteBody,
    updatedAt: Date.now(),
  };
  const encoded = new TextEncoder().encode(JSON.stringify(metaObj));
  const { iv, cipherBuffer: encryptedMeta } = await encryptBytes(
    encoded.buffer,
    masterSecret,
    cfg.saltHex
  );

  const record: VaultStoredRecord = {
    id: existingId || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: 'note',
    mimeType: 'text/plain',
    sizeBytes: encoded.byteLength,
    createdAt: originalCreatedAt,
    iv,
    encryptedMeta,
  };

  const db = await openVaultDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function renameVaultItem(
  id: string,
  newTitle: string,
  masterSecret: string
): Promise<boolean> {
  const cfg = getVaultConfig();
  if (!cfg || !newTitle.trim()) return false;

  const db = await openVaultDB();
  const record: VaultStoredRecord | undefined = await new Promise((res, rej) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });

  if (!record) {
    db.close();
    return false;
  }

  try {
    const ivArr =
      record.iv instanceof Uint8Array
        ? record.iv
        : new Uint8Array(Object.values(record.iv));
    const decBuf = await decryptBytes(
      record.encryptedMeta,
      ivArr,
      masterSecret,
      cfg.saltHex
    );
    const meta = JSON.parse(
      new TextDecoder().decode(decBuf)
    ) as VaultDecryptedMeta;

    const updatedMeta: VaultDecryptedMeta = {
      ...meta,
      title: newTitle.trim().slice(0, 140),
      updatedAt: Date.now(),
    };
    const encoded = new TextEncoder().encode(JSON.stringify(updatedMeta));
    const { iv: nextIv, cipherBuffer: nextEncryptedMeta } = await encryptBytes(
      encoded.buffer,
      masterSecret,
      cfg.saltHex
    );

    const updatedRecord: VaultStoredRecord = {
      ...record,
      iv: nextIv,
      encryptedMeta: nextEncryptedMeta,
    };

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(updatedRecord);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
    return true;
  } catch {
    db.close();
    return false;
  }
}

export async function listDecryptedVaultItems(
  masterSecret: string
): Promise<DecryptedVaultItem[]> {
  const cfg = getVaultConfig();
  if (!cfg) return [];

  const db = await openVaultDB();
  const records: VaultStoredRecord[] = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => {
      db.close();
      resolve(req.result || []);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });

  const out: DecryptedVaultItem[] = [];
  for (const r of records) {
    try {
      const ivArr =
        r.iv instanceof Uint8Array ? r.iv : new Uint8Array(Object.values(r.iv));
      const decBuf = await decryptBytes(
        r.encryptedMeta,
        ivArr,
        masterSecret,
        cfg.saltHex
      );
      const meta = JSON.parse(
        new TextDecoder().decode(decBuf)
      ) as VaultDecryptedMeta;
      out.push({
        id: r.id,
        type: r.type,
        mimeType: r.mimeType,
        sizeBytes: r.sizeBytes,
        createdAt: r.createdAt,
        meta,
      });
    } catch {
      // ignore corrupted entry
    }
  }
  return out.sort((a, b) => b.createdAt - a.createdAt);
}

export async function decryptVaultItemBlob(
  id: string,
  masterSecret: string
): Promise<Blob | null> {
  const cfg = getVaultConfig();
  if (!cfg) return null;

  const db = await openVaultDB();
  const record: VaultStoredRecord | undefined = await new Promise(
    (resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(id);
      req.onsuccess = () => {
        db.close();
        resolve(req.result);
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    }
  );

  if (!record || !record.encryptedPayload) return null;
  const full = new Uint8Array(record.encryptedPayload);
  const payloadIv = full.slice(0, 12);
  const cipherSlice = full.slice(12).buffer;
  const plainBuf = await decryptBytes(
    cipherSlice,
    payloadIv,
    masterSecret,
    cfg.saltHex
  );
  return new Blob([plainBuf], { type: record.mimeType });
}

export async function deleteVaultItem(id: string): Promise<void> {
  const db = await openVaultDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function exportEncryptedVaultBackup(): Promise<void> {
  const cfg = getVaultConfig();
  if (!cfg) return;
  const db = await openVaultDB();
  const records: VaultStoredRecord[] = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => {
      db.close();
      resolve(req.result || []);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });

  const serialized = records.map((r) => ({
    id: r.id,
    type: r.type,
    mimeType: r.mimeType,
    sizeBytes: r.sizeBytes,
    createdAt: r.createdAt,
    ivB64: arrayBufferToBase64(
      (r.iv instanceof Uint8Array ? r.iv : new Uint8Array(Object.values(r.iv)))
        .buffer as ArrayBuffer
    ),
    metaB64: arrayBufferToBase64(r.encryptedMeta),
    payloadB64: r.encryptedPayload
      ? arrayBufferToBase64(r.encryptedPayload)
      : undefined,
  }));

  const bundle = {
    app: 'AmarHisabEncryptedVault',
    version: 2,
    exportedAt: new Date().toISOString(),
    config: cfg,
    items: serialized,
  };

  const blob = new Blob([JSON.stringify(bundle)], {
    type: 'application/json',
  });
  await saveBlobOffline(
    blob,
    `amar-hisab-vault-${new Date().toISOString().slice(0, 10)}.json`
  );
}

const VALID_VAULT_TYPES = new Set<VaultItemType>([
  'image',
  'video',
  'document',
  'note',
]);

export async function importEncryptedVaultBackup(
  jsonText: string
): Promise<boolean> {
  try {
    const parsed = JSON.parse(jsonText);
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      parsed.app !== 'AmarHisabEncryptedVault' ||
      !parsed.config ||
      typeof parsed.config.pinHash !== 'string' ||
      typeof parsed.config.saltHex !== 'string' ||
      typeof parsed.config.wrappedMasterByPinB64 !== 'string' ||
      typeof parsed.config.wrappedMasterIvPinB64 !== 'string' ||
      !Array.isArray(parsed.items)
    ) {
      return false;
    }

    const safeCfg: WrappedVaultConfig = {
      version: parsed.config.version === 2 ? 2 : undefined,
      pinHash: String(parsed.config.pinHash).slice(0, 128),
      saltHex: String(parsed.config.saltHex).slice(0, 128),
      recoveryQuestion: String(parsed.config.recoveryQuestion || '').slice(0, 200),
      recoveryAnswerHash: String(parsed.config.recoveryAnswerHash || '').slice(
        0,
        128
      ),
      wrappedMasterByPinB64: String(parsed.config.wrappedMasterByPinB64),
      wrappedMasterIvPinB64: String(parsed.config.wrappedMasterIvPinB64),
      wrappedMasterByRecB64:
        typeof parsed.config.wrappedMasterByRecB64 === 'string'
          ? parsed.config.wrappedMasterByRecB64
          : undefined,
      wrappedMasterIvRecB64:
        typeof parsed.config.wrappedMasterIvRecB64 === 'string'
          ? parsed.config.wrappedMasterIvRecB64
          : undefined,
    };

    localStorage.setItem(VAULT_CONFIG_KEY, JSON.stringify(safeCfg));
    const db = await openVaultDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      for (const item of parsed.items) {
        if (
          !item ||
          typeof item.id !== 'string' ||
          !VALID_VAULT_TYPES.has(item.type as VaultItemType) ||
          typeof item.ivB64 !== 'string' ||
          typeof item.metaB64 !== 'string'
        ) {
          continue;
        }
        const rec: VaultStoredRecord = {
          id: item.id.slice(0, 80),
          type: item.type as VaultItemType,
          mimeType: String(item.mimeType || 'application/octet-stream').slice(
            0,
            100
          ),
          sizeBytes: Math.max(0, Number(item.sizeBytes) || 0),
          createdAt: Number.isFinite(Number(item.createdAt))
            ? Number(item.createdAt)
            : Date.now(),
          iv: new Uint8Array(base64ToArrayBuffer(item.ivB64)),
          encryptedMeta: base64ToArrayBuffer(item.metaB64),
          encryptedPayload:
            typeof item.payloadB64 === 'string'
              ? base64ToArrayBuffer(item.payloadB64)
              : undefined,
        };
        store.put(rec);
      }
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
    return true;
  } catch {
    return false;
  }
}
