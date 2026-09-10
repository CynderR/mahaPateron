/** Offline-use entitlement for the native app. */
export type OfflineUseMode = 'false' | 'true' | 'days';

export const parseOfflineUse = (
  value?: string | number | boolean | null
): { mode: OfflineUseMode; days: number } => {
  if (value === true || value === 1 || value === '1' || value === 'true') {
    return { mode: 'true', days: 14 };
  }
  if (value === false || value === 0 || value === '0' || value === 'false' || value == null || value === '') {
    return { mode: 'false', days: 14 };
  }
  const days = parseInt(String(value).trim(), 10);
  if (Number.isFinite(days) && days > 0) {
    return { mode: 'days', days };
  }
  return { mode: 'false', days: 14 };
};

export const serializeOfflineUse = (mode: OfflineUseMode, days: number): string => {
  if (mode === 'true') return 'true';
  if (mode === 'days') return String(Math.max(1, Math.floor(days) || 1));
  return 'false';
};

export const memberHasAppAccess = (value?: boolean | number | null): boolean =>
  value === true || value === 1;
