import { isNativeApp } from '../native/platform';

/** App-only catalog limit from admin `episodes_to_keep`. Website is unchanged. */
export const applyAppEpisodesToKeep = <T,>(
  items: T[],
  episodesToKeep?: number | null
): T[] => {
  if (!isNativeApp()) return items;
  if (episodesToKeep == null || !Number.isFinite(episodesToKeep) || episodesToKeep < 1) {
    return items;
  }
  return items.slice(0, episodesToKeep);
};

export const appCatalogTotal = (
  serverTotal: number,
  episodesToKeep?: number | null
): number => {
  if (!isNativeApp()) return serverTotal;
  if (episodesToKeep == null || !Number.isFinite(episodesToKeep) || episodesToKeep < 1) {
    return serverTotal;
  }
  return Math.min(serverTotal, episodesToKeep);
};
