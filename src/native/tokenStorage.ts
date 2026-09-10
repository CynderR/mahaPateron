import { Preferences } from '@capacitor/preferences';
import { isNativeApp } from './platform';

const TOKEN_KEY = 'token';
const REMEMBER_ME_KEY = 'rememberMe';

/** Read JWT from native Preferences (app) or web storage (website). */
export const getStoredToken = async (): Promise<string | null> => {
  if (isNativeApp()) {
    const { value } = await Preferences.get({ key: TOKEN_KEY });
    return value;
  }
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
};

/** Sync helper used by stream loader — Preferences may not be ready; fall back to memory/local. */
export const getStoredTokenSync = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
};

export const persistToken = async (token: string, rememberMe: boolean): Promise<void> => {
  if (isNativeApp()) {
    // Native always persists across restarts (app sessions are long-lived).
    await Preferences.set({ key: TOKEN_KEY, value: token });
    await Preferences.set({ key: REMEMBER_ME_KEY, value: 'true' });
    // Mirror into localStorage so sync readers (streamLoader) still work.
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(REMEMBER_ME_KEY, 'true');
    sessionStorage.removeItem(TOKEN_KEY);
    return;
  }

  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  if (rememberMe) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(REMEMBER_ME_KEY, 'true');
  } else {
    sessionStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(REMEMBER_ME_KEY, 'false');
  }
};

export const clearStoredToken = async (): Promise<void> => {
  if (isNativeApp()) {
    await Preferences.remove({ key: TOKEN_KEY });
    await Preferences.remove({ key: REMEMBER_ME_KEY });
  }
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
};
