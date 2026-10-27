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
} from './crypto';
import { saveBlobOffline } from './fileSaver';

export interface WrappedVaultConfig {
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
    return JSON.parse(raw) as WrappedVaultConfig;
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
  const pinHash = await hashSecret('vault_pin::' + pin);

  const masterBytes = new TextEncoder().encode(masterSecret).buffer;
  const pinWrap = await encryptBytes(masterBytes, pin, saltHex);

  let wrappedMasterByRecB64: string | undefined;
  let wrappedMasterIvRecB64: string | undefined;
  let recoveryAnswerHash = '';

  if (recoveryAnswer.trim()) {
    const normAns = recoveryAnswer.trim().toLowerCase();
    recoveryAnswerHash = await hashSecret('vault_rec::' + normAns);
    const recWrap = await encryptBytes(masterBytes, normAns, saltHex);
    wrappedMasterByRecB64 = arrayBufferToBase64(recWrap.cipherBuffer);
    wrappedMasterIvRecB64 = arrayBufferToBase64(recWrap.iv.buffer as ArrayBuffer);
  }

  const cfg: WrappedVaultConfig = {
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
  const candidate = await hashSecret('vault_pin::' + pin);
  if (candidate !== cfg.pinHash) return null;

  try {
    const cipher = base64ToArrayBuffer(cfg.wrappedMasterByPinB64);
    const iv = new Uint8Array(base64ToArrayBuffer(cfg.wrappedMasterIvPinB64));
    const dec = await decryptBytes(cipher, iv, pin, cfg.saltHex);
    return new TextDecoder().decode(dec);
  } catch {
    return null;
  }
}

export async function recoverVaultAndResetPin(
  recoveryAnswer: string,
  newPin: string
): Promise<string | null> {
  const cfg = getVaultConfig();
  if (!cfg || !cfg.recoveryAnswerHash || !cfg.wrappedMasterByRecB64 || !cfg.wrappedMasterIvRecB64) {
    return null;
  }
  const normAns = recoveryAnswer.trim().toLowerCase();
  const candidate = await hashSecret('vault_rec::' + normAns);
  if (candidate !== cfg.recoveryAnswerHash) return null;

  try {
    const cipher = base64ToArrayBuffer(cfg.wrappedMasterByRecB64);
    const iv = new Uint8Array(base64ToArrayBuffer(cfg.wrappedMasterIvRecB64));
    const dec = await decryptBytes(cipher, iv, normAns, cfg.saltHex);
    const masterSecret = new TextDecoder().decode(dec);

    const newPinHash = await hashSecret('vault_pin::' + newPin);
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
  masterSecret: string
): Promise<void> {
  const cfg = getVaultConfig();
  if (!cfg) throw new Error('Vault not initialized');

  const fileBuffer = await file.arrayBuffer();
  const metaObj: VaultDecryptedMeta = {
    title: file.name.replace(/\.[^/.]+$/, '') || file.name,
    fileName: file.name,
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

  const metaObj: VaultDecryptedMeta = {
    title: title.trim() || 'গোপন নোট',
    noteBody,
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
    createdAt: Date.now(),
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
      reject(tx.error);
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

export async function importEncryptedVaultBackup(jsonText: string): Promise<boolean> {
  try {
    const parsed = JSON.parse(jsonText);
    if (
      !parsed ||
      parsed.app !== 'AmarHisabEncryptedVault' ||
      !parsed.config ||
      !Array.isArray(parsed.items)
    ) {
      return false;
    }
    localStorage.setItem(VAULT_CONFIG_KEY, JSON.stringify(parsed.config));
    const db = await openVaultDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      for (const item of parsed.items) {
        const rec: VaultStoredRecord = {
          id: item.id,
          type: item.type,
          mimeType: item.mimeType,
          sizeBytes: item.sizeBytes,
          createdAt: item.createdAt,
          iv: new Uint8Array(base64ToArrayBuffer(item.ivB64)),
          encryptedMeta: base64ToArrayBuffer(item.metaB64),
          encryptedPayload: item.payloadB64
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
