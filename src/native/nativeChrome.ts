import { SystemBars, SystemBarsStyle } from '@capacitor/core';
import { isNativeApp } from './platform';

/**
 * Mark the document as the Capacitor shell. The website never gets this class,
 * so Android status-bar chrome stays out of the browser UI.
 */
export const applyNativeAppClass = (): void => {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('native-app', isNativeApp());
};

/**
 * Keep status-bar icons readable on the native grey inset.
 * Dark style = light icons (dark bar). Light style = dark icons (light bar).
 */
export const syncNativeStatusBarStyle = (theme: 'light' | 'dark'): void => {
  if (!isNativeApp()) return;
  const style = theme === 'light' ? SystemBarsStyle.Light : SystemBarsStyle.Dark;
  void SystemBars.setStyle({ style }).catch(() => undefined);
};
