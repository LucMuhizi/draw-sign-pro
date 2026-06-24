import { Capacitor } from '@capacitor/core';

type SharePlugin = {
  Share: {
    share: (opts: {
      title?: string;
      text?: string;
      url?: string;
      dialogTitle?: string;
    }) => Promise<void>;
  };
};

const isNative = Capacitor.isNativePlatform();

let ShareModule: SharePlugin | null = null;

async function getShare(): Promise<SharePlugin | null> {
  if (ShareModule) return ShareModule;
  if (!isNative) return null;
  try {
    ShareModule = await import('@capacitor/share') as unknown as SharePlugin;
    return ShareModule;
  } catch {
    return null;
  }
}

export async function shareDocument(blob: Blob, filename: string) {
  const s = await getShare();
  if (!s) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    return;
  }

  try {
    await s.Share.share({
      title: filename,
      text: `Signed document: ${filename}`,
      dialogTitle: `Share ${filename}`,
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message !== 'canceled' && err.message !== 'Share canceled') {
      console.error('Share error:', err);
    }
  }
}

/**
 * Share a plain text payload (typically a URL or short message).
 *
 * Mirrors shareDocument's native/web fallback semantics:
 * - On Capacitor (Android) -> uses @capacitor/share's native sheet
 *   via the cached ShareModule.
 * - On the web -> falls back to navigator.share() if available,
 *   or copies the text into the clipboard so the caller can paste
 *   it elsewhere.
 */
export async function shareText(text: string, title?: string) {
  const s = await getShare();
  if (s) {
    try {
      await s.Share.share({
        title,
        text,
        dialogTitle: title ?? 'Share',
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.message !== 'canceled' && err.message !== 'Share canceled') {
        console.error('Share text error:', err);
      }
    }
    return;
  }

  // Web fallback path
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ text, title });
      return; // user completed the share
    } catch (err: unknown) {
      // User explicitly cancelled the share sheet — do NOT fall through
      // to copyToClipboard, which would silently hijack their clipboard.
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error('Web share error:', err);
      await copyToClipboard(text);
    }
    return;
  }

  await copyToClipboard(text);
}

async function copyToClipboard(text: string) {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    }
  } catch (err) {
    console.error('Clipboard write failed:', err);
  }
}
