import { Preferences } from '@capacitor/preferences';
import { FeedPost } from '../components/PostCard';
import { isNativeApp } from './platform';
import { AppCatalogResponse } from './appCatalog';

const USER_KEY = 'native_cached_user_v1';
const CATALOG_KEY = 'native_cached_catalog_v1';
const EPISODES_KEY = 'native_cached_episodes_v1';

export type CachedEpisode = FeedPost;

export type CachedCatalog = Pick<
  AppCatalogResponse,
  | 'app_access'
  | 'offline_use'
  | 'episodes_to_keep'
  | 'offline_expires_at'
  | 'offline_days_remaining'
  | 'offline_expired'
  | 'rss_token'
> & {
  savedAt: string;
  posts: CachedEpisode[];
};

const readJson = async <T>(key: string): Promise<T | null> => {
  if (!isNativeApp()) return null;
  const { value } = await Preferences.get({ key });
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

const writeJson = async (key: string, value: unknown): Promise<void> => {
  if (!isNativeApp()) return;
  await Preferences.set({ key, value: JSON.stringify(value) });
};

export const cacheNativeUser = async (user: unknown): Promise<void> => {
  await writeJson(USER_KEY, user);
};

export const loadCachedNativeUser = async (): Promise<unknown | null> => readJson(USER_KEY);

export const clearCachedNativeUser = async (): Promise<void> => {
  if (!isNativeApp()) return;
  await Preferences.remove({ key: USER_KEY });
};

export const cacheAppCatalog = async (catalog: AppCatalogResponse): Promise<void> => {
  const snapshot: CachedCatalog = {
    savedAt: new Date().toISOString(),
    app_access: catalog.app_access,
    offline_use: catalog.offline_use,
    episodes_to_keep: catalog.episodes_to_keep,
    offline_expires_at: catalog.offline_expires_at,
    offline_days_remaining: catalog.offline_days_remaining,
    offline_expired: catalog.offline_expired,
    rss_token: catalog.rss_token,
    posts: catalog.posts.map((post) => ({
      id: post.id,
      title: post.title,
      description: post.description,
      duration_secs: post.duration_secs,
      published_at: post.published_at,
      image_filename: post.image_filename
    }))
  };
  await writeJson(CATALOG_KEY, snapshot);
  await mergeCachedEpisodes(snapshot.posts);
};

export const loadCachedAppCatalog = async (): Promise<CachedCatalog | null> =>
  readJson<CachedCatalog>(CATALOG_KEY);

export const mergeCachedEpisodes = async (posts: CachedEpisode[]): Promise<void> => {
  if (!isNativeApp() || posts.length === 0) return;
  const existing = (await readJson<Record<string, CachedEpisode>>(EPISODES_KEY)) || {};
  for (const post of posts) {
    if (!post?.id) continue;
    existing[post.id] = { ...existing[post.id], ...post };
  }
  await writeJson(EPISODES_KEY, existing);
};

export const loadCachedEpisodes = async (): Promise<CachedEpisode[]> => {
  const map = (await readJson<Record<string, CachedEpisode>>(EPISODES_KEY)) || {};
  return Object.values(map);
};

export const getCachedEpisode = async (postId: string): Promise<CachedEpisode | null> => {
  const map = (await readJson<Record<string, CachedEpisode>>(EPISODES_KEY)) || {};
  return map[postId] || null;
};
