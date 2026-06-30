// Mobile Chromium on Android (Brave, Chrome) often blocks <audio src="https://...?token=...">.
// Fetch the MP3 with auth headers and play from a same-origin blob URL instead.
//
// iOS browsers (Safari, Chrome, Brave, Firefox, etc.) all use WebKit, which streams
// tokenized URLs with HTTP range requests. Preloading the full file as a blob hangs
// on long episodes and leaves the player stuck on "Loading audio…".

const blobCache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();
const prefetchInflight = new Map<string, Promise<void>>();

const PREFETCH_RANGE_BYTES = 512 * 1024;

export const isIOSDevice = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
};

export const isAndroidDevice = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent);
};

export const prefersBlobPlayback = (): boolean => {
  if (typeof window === 'undefined') return false;
  if (isIOSDevice()) return false;
  return isAndroidDevice();
};

export const getStoredAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token') || sessionStorage.getItem('token');
};

export const getCachedStreamBlob = (postId: string): string | null => blobCache.get(postId) ?? null;

export const getInflightStreamBlob = (postId: string): Promise<string> | null => inflight.get(postId) ?? null;

export const clearStreamBlob = (postId: string): void => {
  const url = blobCache.get(postId);
  if (url) {
    URL.revokeObjectURL(url);
    blobCache.delete(postId);
  }
  inflight.delete(postId);
  prefetchInflight.delete(postId);
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

const waitForAudioReady = (audio: HTMLAudioElement): Promise<void> => {
  if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      audio.removeEventListener('canplay', onReady);
      audio.removeEventListener('error', onError);
    };
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('Episode could not be loaded.'));
    };
    audio.addEventListener('canplay', onReady);
    audio.addEventListener('error', onError);
  });
};

export async function resolvePlaybackSource(postId: string, streamUrl: string): Promise<string> {
  if (prefersBlobPlayback()) {
    return loadStreamBlob(postId, streamUrl);
  }
  return streamUrl;
}

export async function playStreamInAudioElement(
  audio: HTMLAudioElement,
  postId: string,
  streamUrl: string
): Promise<void> {
  const src = await resolvePlaybackSource(postId, streamUrl);
  if (audio.src !== src) {
    audio.src = src;
    audio.load();
  }
  await waitForAudioReady(audio);
  await audio.play();
}

export async function prefetchStreamMedia(postId: string, streamUrl: string): Promise<void> {
  if (blobCache.has(postId)) return;

  const blobPromise = inflight.get(postId);
  if (blobPromise) {
    await blobPromise.catch(() => {});
    return;
  }

  const existingPrefetch = prefetchInflight.get(postId);
  if (existingPrefetch) {
    await existingPrefetch.catch(() => {});
    return;
  }

  if (prefersBlobPlayback()) {
    const promise = loadStreamBlob(postId, streamUrl)
      .then(() => undefined)
      .catch(() => undefined);
    prefetchInflight.set(postId, promise);
    await promise;
    prefetchInflight.delete(postId);
    return;
  }

  const promise = (async () => {
    const token = getStoredAuthToken();
    const headers: Record<string, string> = {
      Range: `bytes=0-${PREFETCH_RANGE_BYTES - 1}`
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(streamUrl, {
      method: 'GET',
      headers,
      credentials: 'same-origin',
      cache: 'default'
    });

    if (!res.ok && res.status !== 206) {
      throw new Error(`HTTP ${res.status}`);
    }

    await res.arrayBuffer();
  })()
    .catch(() => {})
    .finally(() => {
      prefetchInflight.delete(postId);
    });

  prefetchInflight.set(postId, promise);
  await promise;
}
