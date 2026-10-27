/**
 * Offline Cryptography Helper (Web Crypto API SHA-256 & AES-GCM with pure-TS fallback
 * for non-HTTPS file:// Android WebView contexts).
 */

const SALT_NAMESPACE = 'amar_hisab_v3_sec::';

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
function fallbackHash256(input: string): Uint8Array {
  const enc = new TextEncoder().encode(input);
  const state = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  for (let round = 0; round < 64; round++) {
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

async function deriveWebCryptoKey(pin: string, saltHex: string): Promise<CryptoKey | null> {
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
  const keySeed = fallbackHash256(`${pin}:${saltHex}:${bytesToHex(iv)}`);
  const out = new Uint8Array(data.length);
  let s =
    ((keySeed[0] << 24) | (keySeed[1] << 16) | (keySeed[2] << 8) | keySeed[3]) >>>
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
    cipherBuffer: xorStreamTransform(new Uint8Array(plainBuffer), pin, saltHex, iv),
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
