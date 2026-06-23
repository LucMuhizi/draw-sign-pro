import { Capacitor } from '@capacitor/core';

type DocumentScannerPlugin = {
  DocumentScanner: {
    scanDocument: () => Promise<{ scannedImages: string[] }>;
  };
};

let ScannerModule: DocumentScannerPlugin | null = null;

async function getScanner(): Promise<DocumentScannerPlugin | null> {
  if (ScannerModule) return ScannerModule;
  if (!Capacitor.isNativePlatform()) return null;
  try {
    ScannerModule = await import('@southdevs/capacitor-document-scanner') as unknown as DocumentScannerPlugin;
    return ScannerModule;
  } catch {
    return null;
  }
}

export async function scanDocumentWithEdges(): Promise<string | null> {
  const scanner = await getScanner();
  if (!scanner) return null;
  try {
    const result = await scanner.DocumentScanner.scanDocument();
    return result.scannedImages?.[0] || null;
  } catch (err: unknown) {
    if (err instanceof Error && !err.message.includes('cancel')) {
      console.error('Scanner error:', err);
    }
    return null;
  }
}

export function enhanceImage(dataUrl: string, contrast = 1.3): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(dataUrl); return; }

      ctx.filter = `contrast(${contrast}) brightness(1.1) saturate(1.1)`;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const gray = r * 0.299 + g * 0.587 + b * 0.114;
        const threshold = gray > 128 ? 255 : 0;
        const blend = gray * 0.3 + threshold * 0.7;
        data[i] = data[i + 1] = data[i + 2] = Math.round(blend);
      }
      ctx.putImageData(imageData, 0, 0);

      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.src = dataUrl;
  });
}
