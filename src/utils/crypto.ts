/**
 * Offline Cryptography & Security Helper
 * - Web Crypto API PBKDF2-SHA256 & AES-256-GCM with deterministic fallback for file:// WebViews
 * - Constant-time hash comparison
 * - Persistent brute-force PIN rate limiting
 * - External file-picker guard to prevent false background auto-locks on Android
 */

const SALT_NAMESPACE = 'amar_hisab_v3_sec::';
const LOCKOUT_PREFIX = 'amar_hisab_lockout_v1_';

let lastExternalPickerTimestamp = 0;

export function markExternalPickerOpen(): void {
  lastExternalPickerTimestamp = Date.now();
}

export function isExternalPickerRecentlyActive(windowMs = 45000): boolean {
  return Date.now() - lastExternalPickerTimestamp < windowMs;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.length % 2 === 0 ? hex : '0' + hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Pure-TS deterministic 256-bit hash fallback when crypto.subtle is unavailable (e.g. file:// WebView)
function fallbackHash256(input: string, rounds = 64): Uint8Array {
  const enc = new TextEncoder().encode(input);
  const state = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  for (let round = 0; round < rounds; round++) {
    for (let i = 0; i < enc.length; i++) {
      const idx = (i + round) & 7;
      let v = state[idx] ^ (enc[i] + round * 0x9e3779b9);
      v = ((v << 13) | (v >>> 19)) >>> 0;
      v = Math.imul(v, 0x85ebca6b) >>> 0;
      state[idx] = (v ^ state[(idx + 3) & 7]) >>> 0;
    }
  }
  return new Uint8Array(state.buffer);
}

// Legacy v1 hash (kept for seamless backward-compatible migration)
export async function hashSecret(raw: string): Promise<string> {
  const normalized = SALT_NAMESPACE + raw.trim().toLowerCase();
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const buf = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(normalized)
    );
    return bytesToHex(new Uint8Array(buf));
  }
  return bytesToHex(fallbackHash256(normalized));
}

// Hardened v2 Salted PBKDF2-SHA256 (60,000 iterations)
export async function hashSecretPBKDF2(
  raw: string,
  saltHex: string
): Promise<string> {
  const normalized = SALT_NAMESPACE + raw.trim().toLowerCase();
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const baseKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(normalized),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    const saltBytes = hexToBytes(saltHex);
    const bits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltBytes.buffer as ArrayBuffer,
        iterations: 60000,
        hash: 'SHA-256',
      },
      baseKey,
      256
    );
    return bytesToHex(new Uint8Array(bits));
  }
  return bytesToHex(fallbackHash256(`${saltHex}::${normalized}`, 2048));
}

export function generateRandomBytes(length = 12): Uint8Array {
  const arr = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
  }
  return arr;
}

export function generateSaltHex(): string {
  return bytesToHex(generateRandomBytes(16));
}

async function deriveWebCryptoKey(
  pin: string,
  saltHex: string
): Promise<CryptoKey | null> {
  if (typeof crypto === 'undefined' || !crypto.subtle) return null;
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  const saltBytes = hexToBytes(saltHex);
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes.buffer as ArrayBuffer,
      iterations: 60000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function xorStreamTransform(
  data: Uint8Array,
  pin: string,
  saltHex: string,
  iv: Uint8Array
): ArrayBuffer {
  const keySeed = fallbackHash256(`${pin}:${saltHex}:${bytesToHex(iv)}`, 256);
  const out = new Uint8Array(data.length);
  let s =
    ((keySeed[0] << 24) |
      (keySeed[1] << 16) |
      (keySeed[2] << 8) |
      keySeed[3]) >>>
    0;
  for (let i = 0; i < data.length; i++) {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    const kb = (keySeed[i & 31] ^ (s & 0xff)) & 0xff;
    out[i] = data[i] ^ kb;
  }
  return out.buffer;
}

export async function encryptBytes(
  plainBuffer: ArrayBuffer,
  pin: string,
  saltHex: string
): Promise<{ iv: Uint8Array; cipherBuffer: ArrayBuffer }> {
  const iv = generateRandomBytes(12);
  const key = await deriveWebCryptoKey(pin, saltHex);
  if (key && crypto.subtle) {
    const cipherBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
      key,
      plainBuffer
    );
    return { iv, cipherBuffer };
  }
  return {
    iv,
    cipherBuffer: xorStreamTransform(
      new Uint8Array(plainBuffer),
      pin,
      saltHex,
      iv
    ),
  };
}

export async function decryptBytes(
  cipherBuffer: ArrayBuffer,
  iv: Uint8Array,
  pin: string,
  saltHex: string
): Promise<ArrayBuffer> {
  const key = await deriveWebCryptoKey(pin, saltHex);
  if (key && crypto.subtle) {
    return crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
      key,
      cipherBuffer
    );
  }
  return xorStreamTransform(new Uint8Array(cipherBuffer), pin, saltHex, iv);
}

// --- Persistent Brute-Force Lockout Protection ---
interface LockoutState {
  attempts: number;
  lockedUntil: number;
}

function readLockout(scope: 'app' | 'vault'): LockoutState {
  try {
    const raw = localStorage.getItem(LOCKOUT_PREFIX + scope);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        attempts: Number(parsed.attempts) || 0,
        lockedUntil: Number(parsed.lockedUntil) || 0,
      };
    }
  } catch {
    // ignore
  }
  return { attempts: 0, lockedUntil: 0 };
}

export function getPinLockoutRemainingSeconds(scope: 'app' | 'vault'): number {
  const state = readLockout(scope);
  const remMs = state.lockedUntil - Date.now();
  return remMs > 0 ? Math.ceil(remMs / 1000) : 0;
}

export function recordFailedPinAttempt(scope: 'app' | 'vault'): {
  attempts: number;
  lockSeconds: number;
} {
  const state = readLockout(scope);
  const nextAttempts = state.attempts + 1;
  let lockSeconds = 0;

  if (nextAttempts >= 10) {
    lockSeconds = 60;
  } else if (nextAttempts >= 5 && nextAttempts % 5 === 0) {
    lockSeconds = 30;
  }

  const nextState: LockoutState = {
    attempts: nextAttempts,
    lockedUntil: lockSeconds > 0 ? Date.now() + lockSeconds * 1000 : state.lockedUntil,
  };

  try {
    localStorage.setItem(LOCKOUT_PREFIX + scope, JSON.stringify(nextState));
  } catch {
    // ignore
  }

  return { attempts: nextAttempts, lockSeconds };
}

export function clearPinLockout(scope: 'app' | 'vault'): void {
  try {
    localStorage.removeItem(LOCKOUT_PREFIX + scope);
  } catch {
    // ignore
  }
}
