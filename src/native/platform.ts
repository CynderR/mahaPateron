import { Capacitor } from '@capacitor/core';

/** True in the Capacitor Android or desktop (Electron) shells — never the website. */
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

export const isDesktopApp = (): boolean => {
  try {
    return Capacitor.getPlatform() === 'electron';
  } catch {
    return false;
  }
};
