// Mobile Chromium on Android (Brave, Chrome) often blocks <audio src="https://...?token=...">.
// Fetch the MP3 with auth headers and play from a same-origin blob URL instead.
//
// iOS browsers (Safari, Chrome, Brave, Firefox, etc.) all use WebKit, which streams
// tokenized URLs with HTTP range requests. Preloading the full file as a blob hangs
// on long episodes and leaves the player stuck on "Loading audio…".
//
// Android full-blob autoplay must stay lean: holding several episode blobs OOMs the
// tab and surfaces "NetworkError when attempting to fetch resource".

const blobCache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();
const abortControllers = new Map<string, AbortController>();
const prefetchInflight = new Map<string, Promise<void>>();

const PREFETCH_RANGE_BYTES = 2 * 1024 * 1024;
/** Current + next only — more than this exhausts Android memory after a few tracks. */
const MAX_BLOB_CACHE_ENTRIES = 2;
const BLOB_FETCH_ATTEMPTS = 3;
const BLOB_FETCH_RETRY_MS = 700;

let warmTargetPostId: string | null = null;

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

/** When true, refuse to play without a blob. Currently unused — see playbackSourceUrl. */
export const prefersBlobPlayback = (): boolean => false;

/** Android soft-handoff often needs an auth'd fetch → blob instead of tokenized <audio src>. */
export const shouldTryBlobFallback = (): boolean => isAndroidDevice();

export const getStoredAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token') || sessionStorage.getItem('token');
};

export const getCachedStreamBlob = (postId: string): string | null => blobCache.get(postId) ?? null;

export const getInflightStreamBlob = (postId: string): Promise<string> | null => inflight.get(postId) ?? null;

export const isNetworkFetchError = (err: unknown): boolean => {
  if (!err) return false;
  const message = err instanceof Error ? err.message : String(err);
  const name = err instanceof Error ? err.name : '';
  return (
    name === 'TypeError' ||
    name === 'AbortError' ||
    /networkerror|failed to fetch|network request failed|load failed|aborted/i.test(message)
  );
};

const revokeBlobUrl = (postId: string): void => {
  const url = blobCache.get(postId);
  if (url) {
    URL.revokeObjectURL(url);
    blobCache.delete(postId);
  }
};

const abortBlobFetch = (postId: string): void => {
  const controller = abortControllers.get(postId);
  if (controller) {
    controller.abort();
    abortControllers.delete(postId);
  }
};

export const clearStreamBlob = (postId: string): void => {
  abortBlobFetch(postId);
  revokeBlobUrl(postId);
  inflight.delete(postId);
  prefetchInflight.delete(postId);
  if (warmTargetPostId === postId) {
    warmTargetPostId = null;
  }
};

/** Keep only the active / next blobs; abort and revoke everything else. */
export const retainStreamBlobs = (keepPostIds: Array<string | null | undefined>): void => {
  const keep = new Set(
    keepPostIds.map((id) => String(id || '').trim()).filter(Boolean)
  );

  for (const postId of Array.from(blobCache.keys())) {
    if (!keep.has(postId)) {
      clearStreamBlob(postId);
    }
  }

  for (const postId of Array.from(inflight.keys())) {
    if (!keep.has(postId)) {
      clearStreamBlob(postId);
    }
  }

  if (warmTargetPostId && !keep.has(warmTargetPostId)) {
    warmTargetPostId = null;
  }
};

const trimBlobCache = (preferredKeep: string[]): void => {
  if (blobCache.size <= MAX_BLOB_CACHE_ENTRIES) return;

  const preferred = new Set(preferredKeep.filter(Boolean));
  for (const postId of Array.from(blobCache.keys())) {
    if (blobCache.size <= MAX_BLOB_CACHE_ENTRIES) break;
    if (preferred.has(postId)) continue;
    clearStreamBlob(postId);
  }

  // Still over limit: drop oldest insertion order except the newest preferred.
  for (const postId of Array.from(blobCache.keys())) {
    if (blobCache.size <= MAX_BLOB_CACHE_ENTRIES) break;
    if (preferredKeep[preferredKeep.length - 1] === postId) continue;
    clearStreamBlob(postId);
  }
};

const delay = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

/** True when we still hold this object URL in cache (revoked URLs are removed). */
export const isStreamBlobUsable = async (blobUrl: string): Promise<boolean> => {
  for (const url of blobCache.values()) {
    if (url === blobUrl) return true;
  }
  return false;
};

/**
 * Return a usable blob URL for the episode, refreshing the cache if the prior
 * object URL was revoked / garbage-collected.
 */
export async function ensureStreamBlob(
  postId: string,
  streamUrl: string,
  options?: { retainPostIds?: Array<string | null | undefined> }
): Promise<string> {
  const cached = blobCache.get(postId);
  if (cached) {
    if (await isStreamBlobUsable(cached)) return cached;
    clearStreamBlob(postId);
  }
  return loadStreamBlob(postId, streamUrl, options);
}

/** Seconds before track end to start warming the next Android blob. */
export const ANDROID_AUTOPLAY_WARM_REMAINING_SECS = 180;

const fetchStreamBlobOnce = async (postId: string, streamUrl: string, signal: AbortSignal): Promise<string> => {
  const token = getStoredAuthToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(streamUrl, {
    method: 'GET',
    headers,
    credentials: 'same-origin',
    cache: 'no-store',
    signal
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

  if (signal.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  const blobUrl = URL.createObjectURL(blob);
  // Replace any stale entry for this id.
  revokeBlobUrl(postId);
  blobCache.set(postId, blobUrl);
  trimBlobCache([postId, warmTargetPostId].filter(Boolean) as string[]);
  return blobUrl;
};

export async function loadStreamBlob(
  postId: string,
  streamUrl: string,
  options?: { retainPostIds?: Array<string | null | undefined> }
): Promise<string> {
  const cached = blobCache.get(postId);
  if (cached) return cached;

  const existing = inflight.get(postId);
  if (existing) return existing;

  const retainIds = [...(options?.retainPostIds || []), postId];

  const promise = (async () => {
    let lastError: unknown;

    for (let attempt = 1; attempt <= BLOB_FETCH_ATTEMPTS; attempt += 1) {
      const controller = new AbortController();
      abortControllers.set(postId, controller);

      try {
        const blobUrl = await fetchStreamBlobOnce(postId, streamUrl, controller.signal);
        return blobUrl;
      } catch (err) {
        lastError = err;
        if (controller.signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
          throw err instanceof Error ? err : new DOMException('Aborted', 'AbortError');
        }

        const retryable = isNetworkFetchError(err) && attempt < BLOB_FETCH_ATTEMPTS;
        if (!retryable) {
          throw err instanceof Error ? err : new Error('Could not load this episode.');
        }

        // Drop non-retained blobs so Android has RAM for the retry download.
        retainStreamBlobs(retainIds);
        await delay(BLOB_FETCH_RETRY_MS * attempt);
      } finally {
        if (abortControllers.get(postId) === controller) {
          abortControllers.delete(postId);
        }
      }
    }

    if (isNetworkFetchError(lastError)) {
      throw new Error('Network error while loading audio. Tap play to try again.');
    }
    throw lastError instanceof Error ? lastError : new Error('Could not load this episode.');
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

/** Warm the HTTP cache with the first ~2 MB of an episode. */
export const prefetchEpisodeStream = (postId: string, streamUrl: string): void => {
  prefetchStreamMedia(postId, streamUrl).catch(() => {});
};

/**
 * Prepare the next episode for autoplay handoff.
 * Android: one full blob warm at a time (abort prior warm). Other platforms: Range prefetch.
 */
export const warmEpisodeForAutoplay = (
  postId: string,
  streamUrl: string,
  options?: { keepPostId?: string | null }
): Promise<void> => {
  if (shouldTryBlobFallback()) {
    const keepId = options?.keepPostId ?? null;
    if (warmTargetPostId && warmTargetPostId !== postId) {
      clearStreamBlob(warmTargetPostId);
    }
    warmTargetPostId = postId;
    retainStreamBlobs([keepId, postId]);
    return loadStreamBlob(postId, streamUrl, { retainPostIds: [keepId] })
      .then(() => undefined)
      .catch((err) => {
        if (warmTargetPostId === postId) {
          warmTargetPostId = null;
        }
        throw err;
      });
  }
  return prefetchStreamMedia(postId, streamUrl).catch(() => {});
};

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
