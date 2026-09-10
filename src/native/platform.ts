import { Capacitor } from '@capacitor/core';

/** True when running inside a Capacitor native shell (Android/iOS). */
export const isNativeApp = (): boolean => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

export const isAndroidApp = (): boolean => {
  try {
    return Capacitor.getPlatform() === 'android';
  } catch {
    return false;
  }
};
