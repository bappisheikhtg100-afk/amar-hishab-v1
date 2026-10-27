import { ContactItem } from '../types/finance';
import { saveBlobOffline } from './fileSaver';

const DB_NAME = 'amar_hisab_contacts_db';
const DB_VERSION = 1;
const STORE_NAME = 'contacts';
const GROUPS_KEY = 'amar_hisab_contact_groups_v1';

export interface ContactGroupMap {
  [groupName: string]: string[]; // array of sub-groups
}

const DEFAULT_GROUPS: ContactGroupMap = {
  পরিবার: ['আত্মীয়', 'ঘনিষ্ঠ'],
  ব্যবসা: ['পাইকারি বিক্রেতা', 'ক্লায়েন্ট', 'সাপ্লায়ার'],
  অফিস: ['সহকর্মী', 'ম্যানেজমেন্ট'],
  জরুরি: ['ডাক্তার ও হাসপাতাল', 'সার্ভিস'],
};

function openContactsDB(): Promise<IDBDatabase> {
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

export function loadContactGroups(): ContactGroupMap {
  try {
    const raw = localStorage.getItem(GROUPS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {
    // ignore
  }
  return DEFAULT_GROUPS;
}

export function saveContactGroups(groups: ContactGroupMap): void {
  try {
    localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
  } catch {
    // ignore
  }
}

export async function listAllContacts(): Promise<ContactItem[]> {
  const db = await openContactsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => {
      db.close();
      const items = (req.result || []) as ContactItem[];
      resolve(items.sort((a, b) => a.name.localeCompare(b.name, 'bn')));
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

export async function upsertContact(contact: ContactItem): Promise<void> {
  const db = await openContactsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(contact);
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

export async function removeContact(id: string): Promise<void> {
  const db = await openContactsDB();
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

export async function compressAvatarFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 180;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsDataURL(file);
  });
}

export async function exportContactsJson(
  contacts: ContactItem[],
  groups: ContactGroupMap
): Promise<void> {
  const payload = {
    app: 'AmarHisabContacts',
    version: 1,
    exportedAt: new Date().toISOString(),
    groups,
    contacts,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  await saveBlobOffline(
    blob,
    `amar-hisab-contacts-${new Date().toISOString().slice(0, 10)}.json`
  );
}

export async function importContactsJson(jsonText: string): Promise<{
  importedCount: number;
  groups: ContactGroupMap;
} | null> {
  try {
    const parsed = JSON.parse(jsonText);
    if (!parsed || !Array.isArray(parsed.contacts)) return null;

    const currentGroups = loadContactGroups();
    const mergedGroups: ContactGroupMap = { ...currentGroups };

    if (parsed.groups && typeof parsed.groups === 'object') {
      Object.entries(parsed.groups as ContactGroupMap).forEach(([g, subs]) => {
        const existingSubs = new Set(mergedGroups[g] || []);
        if (Array.isArray(subs)) {
          subs.forEach((s) => existingSubs.add(s));
        }
        mergedGroups[g] = Array.from(existingSubs);
      });
    }

    const db = await openContactsDB();
    let count = 0;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      for (const c of parsed.contacts as ContactItem[]) {
        if (c && c.name) {
          const g = c.group || 'অন্যান্য';
          const sg = c.subGroup || 'সাধারণ';
          if (!mergedGroups[g]) mergedGroups[g] = [];
          if (!mergedGroups[g].includes(sg)) mergedGroups[g].push(sg);
          store.put({
            ...c,
            id: c.id || `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            group: g,
            subGroup: sg,
            createdAt: c.createdAt || Date.now(),
          });
          count++;
        }
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

    saveContactGroups(mergedGroups);
    return { importedCount: count, groups: mergedGroups };
  } catch {
    return null;
  }
}

export async function clearAllContacts(): Promise<void> {
  const db = await openContactsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
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
