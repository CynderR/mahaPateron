import { FeedPost } from '../components/PostCard';
import { loadCachedAppCatalog, loadCachedEpisodes } from './sessionCache';
import { loadOfflineIndex, OfflineEpisodeMeta } from './offlineStorage';
import { isNativeApp } from './platform';

const toPost = (ep: OfflineEpisodeMeta): FeedPost => ({
  id: ep.postId,
  title: ep.title,
  description: ep.description,
  duration_secs: ep.duration_secs,
  published_at: ep.published_at || undefined,
  image_filename: ep.image_filename
});

export const loadNativeOfflineBrowse = async (
  query = ''
): Promise<{ posts: FeedPost[]; downloadedIds: Set<string> } | null> => {
  if (!isNativeApp()) return null;

  const [cachedEpisodes, catalog, index] = await Promise.all([
    loadCachedEpisodes(),
    loadCachedAppCatalog(),
    loadOfflineIndex()
  ]);

  const downloadedIds = new Set(Object.keys(index));
  const byId = new Map<string, FeedPost>();

  for (const post of catalog?.posts || []) byId.set(post.id, post);
  for (const post of cachedEpisodes) byId.set(post.id, { ...byId.get(post.id), ...post });
  for (const ep of Object.values(index)) {
    const existing = byId.get(ep.postId);
    byId.set(ep.postId, {
      ...toPost(ep),
      ...existing,
      id: ep.postId,
      title: existing?.title || ep.title,
      image_filename: existing?.image_filename || ep.image_filename
    });
  }

  let posts = Array.from(byId.values()).sort((a, b) =>
    String(b.published_at || '').localeCompare(String(a.published_at || ''))
  );

  const needle = query.trim().toLowerCase();
  if (needle) {
    posts = posts.filter((post) =>
      [post.title, post.description, post.artist, post.album]
        .some((value) => String(value || '').toLowerCase().includes(needle))
    );
  }

  if (posts.length === 0) return null;
  return { posts, downloadedIds };
};

export const loadNativeOfflineQueue = async (): Promise<FeedPost[]> => {
  const browse = await loadNativeOfflineBrowse();
  if (!browse) return [];
  return browse.posts.filter((post) => browse.downloadedIds.has(post.id));
};
