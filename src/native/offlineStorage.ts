import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { buildAppDownloadUrl } from '../config';
import { getStoredTokenSync } from './tokenStorage';
import { isNativeApp } from './platform';
import { cacheCoverImage } from './coverCache';
import { mergeCachedEpisodes } from './sessionCache';

const INDEX_KEY = 'offline_episode_index_v1';
const SETTINGS_KEY = 'offline_download_settings_v1';
const EPISODE_DIR = 'episodes';

export interface OfflineEpisodeMeta {
  postId: string;
  title: string;
  description?: string | null;
  published_at?: string | null;
  duration_secs?: number | null;
  image_filename?: string | null;
  bytes: number;
  downloaded_at: string;
  uri: string;
  path: string;
}

export interface OfflineDownloadSettings {
  autoDownload: boolean;
  deleteOlderThanDays: number | null;
}

const defaultSettings: OfflineDownloadSettings = {
  autoDownload: false,
  deleteOlderThanDays: null
};

type ProgressListener = (postId: string, progress: number | null) => void;

const progressListeners = new Set<ProgressListener>();
const downloadInflight = new Map<string, Promise<OfflineEpisodeMeta>>();
/** Sync cache of Capacitor.convertFileSrc URLs for the player. */
const offlinePlaybackUrlCache = new Map<string, string>();

export const getCachedOfflinePlaybackUrl = (postId: string): string | null =>
  offlinePlaybackUrlCache.get(postId) ?? null;

const cachePlaybackUrl = (postId: string, uri: string) => {
  try {
    offlinePlaybackUrlCache.set(postId, Capacitor.convertFileSrc(uri));
  } catch {
    // ignore
  }
};

export const subscribeDownloadProgress = (listener: ProgressListener): (() => void) => {
  progressListeners.add(listener);
  return () => progressListeners.delete(listener);
};

const emitProgress = (postId: string, progress: number | null) => {
  progressListeners.forEach((listener) => listener(postId, progress));
};

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read episode data'));
    reader.onloadend = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(blob);
  });

export const loadOfflineIndex = async (): Promise<Record<string, OfflineEpisodeMeta>> => {
  if (!isNativeApp()) return {};
  const { value } = await Preferences.get({ key: INDEX_KEY });
  if (!value) return {};
  try {
    const index = JSON.parse(value) as Record<string, OfflineEpisodeMeta>;
    Object.values(index).forEach((meta) => {
      if (meta?.uri) cachePlaybackUrl(meta.postId, meta.uri);
    });
    return index;
  } catch {
    return {};
  }
};

const saveOfflineIndex = async (index: Record<string, OfflineEpisodeMeta>) => {
  await Preferences.set({ key: INDEX_KEY, value: JSON.stringify(index) });
};

export const loadOfflineSettings = async (): Promise<OfflineDownloadSettings> => {
  if (!isNativeApp()) return { ...defaultSettings };
  const { value } = await Preferences.get({ key: SETTINGS_KEY });
  if (!value) return { ...defaultSettings };
  try {
    return { ...defaultSettings, ...(JSON.parse(value) as OfflineDownloadSettings) };
  } catch {
    return { ...defaultSettings };
  }
};

export const saveOfflineSettings = async (settings: OfflineDownloadSettings): Promise<void> => {
  if (!isNativeApp()) return;
  await Preferences.set({ key: SETTINGS_KEY, value: JSON.stringify(settings) });
};

export const getOfflineEpisode = async (postId: string): Promise<OfflineEpisodeMeta | null> => {
  const index = await loadOfflineIndex();
  return index[postId] || null;
};

export const getOfflinePlaybackUrl = async (postId: string): Promise<string | null> => {
  if (!isNativeApp()) return null;
  const cached = offlinePlaybackUrlCache.get(postId);
  if (cached) return cached;
  const meta = await getOfflineEpisode(postId);
  if (!meta) return null;
  cachePlaybackUrl(postId, meta.uri);
  return offlinePlaybackUrlCache.get(postId) ?? null;
};

const ensureEpisodeDir = async () => {
  try {
    await Filesystem.mkdir({
      path: EPISODE_DIR,
      directory: Directory.Data,
      recursive: true
    });
  } catch {
    // Directory may already exist
  }
};

export interface DownloadEpisodeInput {
  postId: string;
  title: string;
  description?: string | null;
  published_at?: string | null;
  duration_secs?: number | null;
  image_filename?: string | null;
  rssToken: string;
}

export const downloadEpisodeToDevice = async (
  input: DownloadEpisodeInput
): Promise<OfflineEpisodeMeta> => {
  if (!isNativeApp()) {
    throw new Error('Downloads are only available in the mobile app');
  }

  const existing = downloadInflight.get(input.postId);
  if (existing) return existing;

  const promise = (async () => {
    const index = await loadOfflineIndex();
    if (index[input.postId]) {
      return index[input.postId];
    }

    await ensureEpisodeDir();
    emitProgress(input.postId, 0);

    const url = buildAppDownloadUrl(input.postId, input.rssToken);
    const token = getStoredTokenSync();
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(url, { method: 'GET', headers, cache: 'no-store' });
    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const data = (await res.json()) as { error?: string };
        if (data?.error) detail = data.error;
      } catch {
        // not JSON
      }
      throw new Error(detail);
    }

    const contentLength = Number(res.headers.get('Content-Length') || 0);
    const reader = res.body?.getReader();
    let blob: Blob;

    if (reader) {
      const chunks: Uint8Array[] = [];
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          received += value.length;
          if (contentLength > 0) {
            emitProgress(input.postId, Math.min(0.99, received / contentLength));
          }
        }
      }
      blob = new Blob(chunks as BlobPart[], { type: 'audio/mpeg' });
    } else {
      blob = await res.blob();
    }

    if (blob.size < 1024) {
      throw new Error('Downloaded file was empty or invalid');
    }

    const path = `${EPISODE_DIR}/${input.postId}.mp3`;
    const base64 = await blobToBase64(blob);
    await Filesystem.writeFile({
      path,
      data: base64,
      directory: Directory.Data
    });
    const { uri } = await Filesystem.getUri({ path, directory: Directory.Data });

    const meta: OfflineEpisodeMeta = {
      postId: input.postId,
      title: input.title,
      description: input.description || null,
      published_at: input.published_at || null,
      duration_secs: input.duration_secs ?? null,
      image_filename: input.image_filename || null,
      bytes: blob.size,
      downloaded_at: new Date().toISOString(),
      uri,
      path
    };

    index[input.postId] = meta;
    await saveOfflineIndex(index);
    cachePlaybackUrl(input.postId, uri);
    await mergeCachedEpisodes([
      {
        id: input.postId,
        title: input.title,
        description: input.description,
        duration_secs: input.duration_secs,
        published_at: input.published_at || undefined,
        image_filename: input.image_filename
      }
    ]);
    void cacheCoverImage(input.postId, input.image_filename).catch(() => undefined);
    emitProgress(input.postId, 1);
    return meta;
  })().finally(() => {
    downloadInflight.delete(input.postId);
    emitProgress(input.postId, null);
  });

  downloadInflight.set(input.postId, promise);
  return promise;
};

export const removeOfflineEpisode = async (postId: string): Promise<void> => {
  if (!isNativeApp()) return;
  const index = await loadOfflineIndex();
  const meta = index[postId];
  if (meta) {
    try {
      await Filesystem.deleteFile({ path: meta.path, directory: Directory.Data });
    } catch {
      // File may already be gone
    }
    delete index[postId];
    offlinePlaybackUrlCache.delete(postId);
    await saveOfflineIndex(index);
  }
};

export const clearAllOfflineEpisodes = async (): Promise<void> => {
  const index = await loadOfflineIndex();
  for (const postId of Object.keys(index)) {
    await removeOfflineEpisode(postId);
  }
};

export const deleteOfflineOlderThanDays = async (days: number): Promise<number> => {
  if (!isNativeApp() || !Number.isFinite(days) || days < 1) return 0;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const index = await loadOfflineIndex();
  let removed = 0;
  for (const meta of Object.values(index)) {
    const stamp = new Date(meta.downloaded_at).getTime();
    if (Number.isFinite(stamp) && stamp < cutoff) {
      await removeOfflineEpisode(meta.postId);
      removed += 1;
    }
  }
  return removed;
};

export const totalOfflineBytes = async (): Promise<number> => {
  const index = await loadOfflineIndex();
  return Object.values(index).reduce((sum, row) => sum + (row.bytes || 0), 0);
};

export const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
};

export const isDownloadInProgress = (postId: string): boolean => downloadInflight.has(postId);
