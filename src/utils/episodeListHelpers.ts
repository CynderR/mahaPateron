import { useCallback, useState } from 'react';
import axios from 'axios';

/** Backend caps page size at 100 (see parseLibraryListOptions in database.js). */
export const EPISODE_PAGE_MAX = 100;

type EpisodeListResponse = {
  total: number;
  entries?: { id: string }[];
  posts?: { id: string }[];
};

/** Fetch every episode id for the current list filters (search, sort, etc.). */
export async function fetchAllEpisodeIds(
  url: '/account/library' | '/account/feed',
  params: Record<string, string | number>,
  total: number
): Promise<string[]> {
  if (total <= 0) return [];

  const itemKey = url.includes('library') ? 'entries' : 'posts';
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
      ids.push(item.id);
    }
    if (items.length < pageSize) break;
    page += 1;
  }

  return ids.slice(0, total);
}

export const useEpisodeSelection = () => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[], checked: boolean) => {
    setSelectedIds(checked ? new Set(ids) : new Set());
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  return { selectedIds, toggleSelect, selectAll, clearSelection };
};
