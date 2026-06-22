// Mobile Chromium (Brave, Chrome) often blocks <audio src="https://...?token=...">.
// Fetch the MP3 with auth headers and play from a same-origin blob URL instead.

const blobCache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

export const prefersBlobPlayback = (): boolean => {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(pointer: coarse)').matches) return true;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
};

export const getStoredAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token') || sessionStorage.getItem('token');
};

export const getCachedStreamBlob = (postId: string): string | null => blobCache.get(postId) ?? null;

export const clearStreamBlob = (postId: string): void => {
  const url = blobCache.get(postId);
  if (url) {
    URL.revokeObjectURL(url);
    blobCache.delete(postId);
  }
  inflight.delete(postId);
};

export async function loadStreamBlob(postId: string, streamUrl: string): Promise<string> {
  const cached = blobCache.get(postId);
  if (cached) return cached;

  const existing = inflight.get(postId);
  if (existing) return existing;

  const promise = (async () => {
    const token = getStoredAuthToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(streamUrl, {
      method: 'GET',
      headers,
      credentials: 'same-origin',
      cache: 'no-store'
    });

    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const data = (await res.json()) as { error?: string };
        if (data?.error) detail = data.error;
      } catch {
        // response was not JSON
      }
      throw new Error(detail);
    }

    const contentType = res.headers.get('Content-Type') || '';
    const blob = await res.blob();

    if (!contentType.includes('audio') && blob.size < 1024) {
      throw new Error('Episode could not be loaded.');
    }

    const blobUrl = URL.createObjectURL(blob);
    blobCache.set(postId, blobUrl);
    return blobUrl;
  })().finally(() => {
    inflight.delete(postId);
  });

  inflight.set(postId, promise);
  return promise;
}
