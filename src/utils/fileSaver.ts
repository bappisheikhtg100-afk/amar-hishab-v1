import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

interface AndroidBridgeInterface {
  saveFileBase64?: (
    base64Data: string,
    fileName: string,
    mimeType: string
  ) => boolean;
}

function getAndroidBridge(): AndroidBridgeInterface | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { AndroidBridge?: AndroidBridgeInterface })
    .AndroidBridge;
}

export function isRunningInNativeApk(): boolean {
  return (
    Capacitor.isNativePlatform() || Boolean(getAndroidBridge()?.saveFileBase64)
  );
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = String(reader.result || '');
      const commaIdx = res.indexOf(',');
      resolve(commaIdx >= 0 ? res.slice(commaIdx + 1) : res);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function saveBlobOffline(
  blob: Blob,
  fileName: string
): Promise<void> {
  // 1. Official Capacitor Native Android / iOS Filesystem + Share sheet
  if (Capacitor.isNativePlatform()) {
    const base64Data = await blobToBase64(blob);
    let savedUri = '';

    try {
      const docWrite = await Filesystem.writeFile({
        path: `AmarHisab/${fileName}`,
        data: base64Data,
        directory: Directory.Documents,
        recursive: true,
      });
      savedUri = docWrite.uri;
    } catch {
      const cacheWrite = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Cache,
        recursive: true,
      });
      savedUri = cacheWrite.uri;
    }

    try {
      await Share.share({
        title: fileName,
        url: savedUri,
        dialogTitle: 'ফাইল সংরক্ষণ বা শেয়ার করুন',
      });
    } catch {
      // User dismissed share dialog; file is still saved in Documents/AmarHisab
    }
    return;
  }

  // 2. Legacy WebView bridge fallback
  const bridge = getAndroidBridge();
  if (bridge?.saveFileBase64) {
    const base64Data = await blobToBase64(blob);
    bridge.saveFileBase64(
      base64Data,
      fileName,
      blob.type || 'application/octet-stream'
    );
    return;
  }

  // 3. Standard Web / PWA download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
