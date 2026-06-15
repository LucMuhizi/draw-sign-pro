import { Capacitor } from '@capacitor/core';

const LOCK_ENABLED_KEY = 'draw-sign-pro-biometric-lock';

type BiometricAuthPlugin = {
  BiometricAuth: {
    checkBiometry: () => Promise<{
      isAvailable: boolean;
      strongBiometryIsAvailable: boolean;
      biometryType: number;
      biometryTypes: number[];
      deviceIsSecure: boolean;
      reason: string;
      code: string;
    }>;
    authenticate: (opts?: {
      reason?: string;
      cancelTitle?: string;
      allowDeviceCredential?: boolean;
      iosFallbackTitle?: string;
      androidTitle?: string;
      androidSubtitle?: string;
      androidConfirmationRequired?: boolean;
    }) => Promise<void>;
  };
};

let BiometricAuth: BiometricAuthPlugin | null = null;

async function getBiometricAuth(): Promise<BiometricAuthPlugin | null> {
  if (BiometricAuth) return BiometricAuth;
  try {
    BiometricAuth = await import('@aparajita/capacitor-biometric-auth') as unknown as BiometricAuthPlugin;
    return BiometricAuth;
  } catch {
    return null;
  }
}

export function isLockEnabled(): boolean {
  try {
    return localStorage.getItem(LOCK_ENABLED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setLockEnabled(enabled: boolean): void {
  try {
    if (enabled) {
      localStorage.setItem(LOCK_ENABLED_KEY, 'true');
    } else {
      localStorage.removeItem(LOCK_ENABLED_KEY);
    }
  } catch {
    // Storage not available
  }
}

export async function isBiometricAvailable(): Promise<boolean> {
  const auth = await getBiometricAuth();
  if (!auth) return false;
  try {
    const result = await auth.BiometricAuth.checkBiometry();
    return result.isAvailable;
  } catch {
    return false;
  }
}

export async function authenticateWithBiometrics(reason = 'Access your signatures'): Promise<boolean> {
  const auth = await getBiometricAuth();
  if (!auth) return true;
  try {
    await auth.BiometricAuth.authenticate({
      reason,
      androidTitle: 'SignDocu',
      androidSubtitle: 'Verify your identity',
      allowDeviceCredential: true,
    });
    return true;
  } catch {
    return false;
  }
}

export async function checkBiometricLock(): Promise<boolean> {
  if (!isLockEnabled()) return true;
  return await authenticateWithBiometrics();
}
