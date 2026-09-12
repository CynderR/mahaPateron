export const isDeviceOffline = (): boolean =>
  typeof navigator !== 'undefined' && navigator.onLine === false;

export const isUnauthorized = (error: unknown): boolean => {
  const status = (error as { response?: { status?: number } } | null)?.response?.status;
  return status === 401;
};

export const isNetworkError = (error: unknown): boolean => {
  if (isDeviceOffline()) return true;
  const err = error as { response?: unknown; code?: string; message?: string } | null;
  if (err?.response) return false;
  return err?.code === 'ERR_NETWORK' || err?.message === 'Network Error';
};
