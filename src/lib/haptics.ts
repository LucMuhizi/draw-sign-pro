import { Capacitor } from '@capacitor/core';

type HapticsPlugin = {
  Haptics: {
    impact: (opts: { style: string }) => Promise<void>;
    notification: (opts: { type: string }) => Promise<void>;
  };
};

const isNative = Capacitor.isNativePlatform();

let HapticsModule: HapticsPlugin | null = null;

async function getHaptics(): Promise<HapticsPlugin | null> {
  if (HapticsModule) return HapticsModule;
  if (!isNative) return null;
  try {
    HapticsModule = await import('@capacitor/haptics') as unknown as HapticsPlugin;
    return HapticsModule;
  } catch {
    return null;
  }
}

export async function hapticLight() {
  const h = await getHaptics();
  if (!h) return;
  try { await h.Haptics.impact({ style: 'Light' }); } catch {
    // Haptics not available
  }
}

export async function hapticMedium() {
  const h = await getHaptics();
  if (!h) return;
  try { await h.Haptics.impact({ style: 'Medium' }); } catch {
    // Haptics not available
  }
}

export async function hapticHeavy() {
  const h = await getHaptics();
  if (!h) return;
  try { await h.Haptics.impact({ style: 'Heavy' }); } catch {
    // Haptics not available
  }
}

export async function hapticSuccess() {
  const h = await getHaptics();
  if (!h) return;
  try { await h.Haptics.notification({ type: 'success' }); } catch {
    // Haptics not available
  }
}

export async function hapticError() {
  const h = await getHaptics();
  if (!h) return;
  try { await h.Haptics.notification({ type: 'error' }); } catch {
    // Haptics not available
  }
}

export async function hapticWarning() {
  const h = await getHaptics();
  if (!h) return;
  try { await h.Haptics.notification({ type: 'warning' }); } catch {
    // Haptics not available
  }
}
