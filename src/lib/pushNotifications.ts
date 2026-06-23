import { Capacitor } from '@capacitor/core';
import { hapticLight } from './haptics';

interface PushNotificationData {
  data?: Record<string, unknown>;
  notification?: { data: Record<string, unknown> };
  value?: string;
}

type PushPlugin = {
  PushNotifications: {
    register: () => Promise<{ token?: string }>;
    requestPermissions: () => Promise<{ granted: boolean }>;
    checkPermissions: () => Promise<{ reception: 'granted' | 'denied' | 'prompt' }>;
    removeAllListeners: () => Promise<void>;
    addListener: (eventName: string, callback: (data: PushNotificationData) => void) => Promise<{ remove: () => void }>;
  };
};

let PushPlugin: PushPlugin | null = null;

async function getPushPlugin(): Promise<PushPlugin | null> {
  if (PushPlugin) return PushPlugin;
  if (!Capacitor.isNativePlatform()) return null;
  try {
    PushPlugin = await import('@capacitor/push-notifications') as unknown as PushPlugin;
    return PushPlugin;
  } catch {
    return null;
  }
}

let deviceToken: string | null = null;

export async function registerForPush(): Promise<string | null> {
  const push = await getPushPlugin();
  if (!push) return null;

  try {
    const permResult = await push.PushNotifications.checkPermissions();
    if (permResult.reception !== 'granted') {
      const reqResult = await push.PushNotifications.requestPermissions();
      if (!reqResult.granted) return null;
    }

    const regResult = await push.PushNotifications.register();
    deviceToken = regResult.token || null;
    return deviceToken;
  } catch {
    return null;
  }
}

export function getDeviceToken(): string | null {
  return deviceToken;
}

export async function setupPushListeners(
  onNotification: (data: Record<string, unknown>) => void,
  onTokenRefresh?: (token: string) => void,
): Promise<void> {
  const push = await getPushPlugin();
  if (!push) return;

  try {
    await push.PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationData) => {
      hapticLight();
      onNotification(notification?.data || {});
    });

    await push.PushNotifications.addListener('pushNotificationActionPerformed', (action: PushNotificationData) => {
      onNotification(action?.notification?.data || {});
    });

    await push.PushNotifications.addListener('registration', (reg: PushNotificationData) => {
      deviceToken = reg.value || null;
      onTokenRefresh?.(deviceToken || '');
    });
  } catch {
    // Push not supported
  }
}

export async function cleanupPushListeners(): Promise<void> {
  const push = await getPushPlugin();
  if (!push) return;
  try {
    await push.PushNotifications.removeAllListeners();
  } catch {
    // Ignore
  }
}
