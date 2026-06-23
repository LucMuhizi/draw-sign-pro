/**
 * PWA Install Prompt — listens for beforeinstallprompt and fires
 * a custom event so the UI can show a native-style install banner.
 *
 * Used in AppInit to register the listener, and in OfflineDemo
 * to trigger the actual install flow.
 */

let deferredPrompt: Event | null = null;
let listenersInitialized = false;

export interface PwaInstallState {
  available: boolean;
  platform: 'ios' | 'android' | 'desktop' | 'unknown';
}

export function getInstallPlatform(): PwaInstallState['platform'] {
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  if (window.matchMedia('(display-mode: standalone)').matches) return 'desktop';
  return 'unknown';
}

export function isInstalled(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as { standalone?: boolean }).standalone === true;
}

export function isInstallAvailable(): boolean {
  return !isInstalled() && deferredPrompt !== null;
}

export function initPwaInstallListener(): () => void {
  if (listenersInitialized) return () => {};
  listenersInitialized = true;

  const handler = (e: Event) => {
    e.preventDefault();
    deferredPrompt = e;
    // Dispatch a custom event so the UI can react
    window.dispatchEvent(new CustomEvent('pwa-install-ready', {
      detail: { platform: getInstallPlatform() },
    }));
  };

  window.addEventListener('beforeinstallprompt', handler);

  // Also handle appinstalled
  const installedHandler = () => {
    deferredPrompt = null;
    window.dispatchEvent(new CustomEvent('pwa-installed'));
  };
  window.addEventListener('appinstalled', installedHandler);

  return () => {
    window.removeEventListener('beforeinstallprompt', handler);
    window.removeEventListener('appinstalled', installedHandler);
    deferredPrompt = null;
    listenersInitialized = false;
  };
}

export async function triggerInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;

  try {
    (deferredPrompt as { prompt: () => Promise<void> }).prompt();
    const result = await (deferredPrompt as { userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }).userChoice;
    deferredPrompt = null;
    return result.outcome === 'accepted';
  } catch {
    return false;
  }
}
