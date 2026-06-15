import { Capacitor } from '@capacitor/core';
import type { CameraPlugin, CameraResultType, CameraSource } from '@capacitor/camera';

type CameraPluginType = {
  Camera: CameraPlugin;
};

let CameraModule: CameraPluginType | null = null;

async function getCamera(): Promise<CameraPluginType | null> {
  if (CameraModule) return CameraModule;
  if (!Capacitor.isNativePlatform()) return null;
  try {
    CameraModule = await import('@capacitor/camera') as unknown as CameraPluginType;
    return CameraModule;
  } catch {
    return null;
  }
}

export async function scanDocument(): Promise<string | null> {
  const cam = await getCamera();
  if (!cam) return null;

  try {
    const photo = await cam.Camera.getPhoto({
      quality: 85,
      allowEditing: false,
      resultType: 'DATA_URL' as unknown as CameraResultType,
      source: 'CAMERA' as unknown as CameraSource,
      width: 2048,
      height: 2048,
      correctOrientation: true,
    });
    const result = photo as unknown as { dataUrl?: string };
    return result.dataUrl || null;
  } catch (err: unknown) {
    if (err instanceof Error && err.message !== 'User cancelled photos app') {
      console.error('Camera scan error:', err);
    }
    return null;
  }
}

export function isCameraAvailable(): boolean {
  if (!Capacitor.isNativePlatform()) {
    return typeof navigator !== 'undefined' && 'mediaDevices' in navigator && !!navigator.mediaDevices.getUserMedia;
  }
  return true;
}
