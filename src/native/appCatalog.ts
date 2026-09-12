import axios from 'axios';
import { parseOfflineUse } from '../utils/appAccess';
import {
  downloadEpisodeToDevice,
  loadOfflineIndex,
  loadOfflineSettings,
  OfflineEpisodeMeta
} from './offlineStorage';
import { isNativeApp } from './platform';
import { cacheAppCatalog, loadCachedAppCatalog } from './sessionCache';
import { prefetchCoverImages } from './coverCache';
import { isNetworkError } from './network';

export interface AppCatalogPost {
  id: string;
  title: string;
  description?: string;
  duration_secs?: number;
  published_at?: string;
  image_filename?: string | null;
}

export interface AppCatalogResponse {
  app_access: boolean;
  offline_use: string;
  episodes_to_keep: number | null;
  offline_expires_at: string | null;
  offline_days_remaining: number | null;
  offline_expired: boolean;
  app_last_authenticated_at: string | null;
  rss_token: string | null;
  posts: AppCatalogPost[];
}

export const fetchAppCatalog = async (): Promise<AppCatalogResponse> => {
  try {
    const { data } = await axios.get<AppCatalogResponse>('/app/catalog');
    if (isNativeApp()) {
      await cacheAppCatalog(data);
      prefetchCoverImages(data.posts);
    }
    return data;
  } catch (error) {
    if (isNativeApp() && isNetworkError(error)) {
      const cached = await loadCachedAppCatalog();
      if (cached) {
        return {
          app_access: cached.app_access,
          offline_use: cached.offline_use,
          episodes_to_keep: cached.episodes_to_keep ?? null,
          offline_expires_at: cached.offline_expires_at,
          offline_days_remaining: cached.offline_days_remaining,
          offline_expired: cached.offline_expired,
          app_last_authenticated_at: null,
          rss_token: cached.rss_token,
          posts: cached.posts.map((post) => ({
            id: post.id,
            title: post.title,
            description: post.description ?? undefined,
            duration_secs: post.duration_secs ?? undefined,
            published_at: post.published_at,
            image_filename: post.image_filename
          }))
        };
      }
    }
    throw error;
  }
};

export const refreshAppHeartbeat = async (): Promise<Partial<AppCatalogResponse>> => {
  const { data } = await axios.post<Partial<AppCatalogResponse>>('/app/heartbeat');
  return data;
};

/** Whether the user may start a new download given current offline_use policy. */
export const canStartDownload = (offlineUse: string | null | undefined, online: boolean): boolean => {
  const { mode } = parseOfflineUse(offlineUse);
  if (mode === 'false') return online;
  if (mode === 'days') return online; // need network to pull files; playback gated separately
  return online;
};

/** Whether cached playback is allowed under offline_use + expiry. */
export const canPlayOffline = (
  offlineUse: string | null | undefined,
  offlineExpired: boolean
): boolean => {
  const { mode } = parseOfflineUse(offlineUse);
  if (mode === 'true') return true;
  if (mode === 'false') return true; // already-downloaded files can play
  return !offlineExpired;
};

let autoDownloadRunning = false;

/**
 * When auto-download is enabled, pull missing catalog episodes while online.
 * Runs sequentially to avoid saturating storage/network.
 */
export const runAutoDownloadIfEnabled = async (
  catalog: AppCatalogResponse
): Promise<OfflineEpisodeMeta[]> => {
  if (!isNativeApp() || autoDownloadRunning) return [];
  if (!catalog.rss_token || !navigator.onLine) return [];
  if (catalog.offline_expired) return [];

  const settings = await loadOfflineSettings();
  if (!settings.autoDownload) return [];
  if (!canStartDownload(catalog.offline_use, true)) return [];

  autoDownloadRunning = true;
  const downloaded: OfflineEpisodeMeta[] = [];
  try {
    const index = await loadOfflineIndex();
    for (const post of catalog.posts) {
      if (index[post.id]) continue;
      try {
        const meta = await downloadEpisodeToDevice({
          postId: post.id,
          title: post.title,
          published_at: post.published_at,
          duration_secs: post.duration_secs,
          image_filename: post.image_filename,
          rssToken: catalog.rss_token
        });
        downloaded.push(meta);
        index[post.id] = meta;
      } catch (err) {
        console.warn('Auto-download failed for', post.id, err);
        // Continue with remaining episodes
      }
    }
  } finally {
    autoDownloadRunning = false;
  }
  return downloaded;
};
