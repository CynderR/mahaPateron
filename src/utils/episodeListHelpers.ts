import { useCallback, useState } from 'react';
import axios from 'axios';
import { FeedPost } from '../components/PostCard';

/** Backend caps page size at 100 (see parseLibraryListOptions in database.js). */
export const EPISODE_PAGE_MAX = 100;

export const normalizePostId = (id: unknown): string => String(id ?? '');

export const postIdsMatch = (a: unknown, b: unknown): boolean => normalizePostId(a) === normalizePostId(b);

export const dedupePostsById = <T extends { id: string | number }>(posts: T[]): T[] => {
  const seen = new Set<string>();
  return posts.filter((post) => {
    const key = normalizePostId(post.id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

type EpisodeListResponse = {
  total: number;
  entries?: { id: string }[];
  posts?: { id: string }[];
};

/** Fetch every episode id for the current list filters (search, sort, etc.). */
export async function fetchAllEpisodeIds(
  url: '/account/library' | '/account/feed' | '/admin/library',
  params: Record<string, string | number>,
  total: number
): Promise<string[]> {
  if (total <= 0) return [];

  const itemKey = url.includes('feed') ? 'posts' : 'entries';
  const pageSize = Math.min(EPISODE_PAGE_MAX, total);
  const ids: string[] = [];
  let page = 1;

  while (ids.length < total) {
    const { data } = await axios.get<EpisodeListResponse>(url, {
      params: { ...params, page, limit: pageSize }
    });
    const items = data[itemKey] ?? [];
    if (items.length === 0) break;
    for (const item of items) {
      ids.push(normalizePostId(item.id));
    }
    if (items.length < pageSize) break;
    page += 1;
  }

  return ids.slice(0, total);
}

export const useEpisodeSelection = () => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = useCallback((id: string, checked: boolean) => {
    const key = normalizePostId(id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[], checked: boolean) => {
    setSelectedIds(checked ? new Set(ids.map((id) => normalizePostId(id))) : new Set());
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  return { selectedIds, toggleSelect, selectAll, clearSelection };
};
