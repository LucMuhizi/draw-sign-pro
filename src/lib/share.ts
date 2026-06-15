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
