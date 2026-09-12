import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { buildImageUrl } from '../config';
import { isNativeApp } from './platform';

const INDEX_KEY = 'offline_cover_index_v1';
const COVER_DIR = 'covers';

interface CoverMeta {
  postId: string;
  image_filename: string;
  path: string;
  uri: string;
}

const coverUrlCache = new Map<string, string>();

export const getCachedCoverUrl = (postId: string): string | null => coverUrlCache.get(postId) ?? null;

const rememberCoverUrl = (postId: string, uri: string) => {
  try {
    coverUrlCache.set(postId, Capacitor.convertFileSrc(uri));
  } catch {
    // ignore
  }
};

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read cover image'));
    reader.onloadend = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(blob);
  });

const loadCoverIndex = async (): Promise<Record<string, CoverMeta>> => {
  if (!isNativeApp()) return {};
  const { value } = await Preferences.get({ key: INDEX_KEY });
  if (!value) return {};
  try {
    const index = JSON.parse(value) as Record<string, CoverMeta>;
    Object.values(index).forEach((meta) => {
      if (meta?.uri) rememberCoverUrl(meta.postId, meta.uri);
    });
    return index;
  } catch {
    return {};
  }
};

const saveCoverIndex = async (index: Record<string, CoverMeta>) => {
  await Preferences.set({ key: INDEX_KEY, value: JSON.stringify(index) });
};

const ensureCoverDir = async () => {
  try {
    await Filesystem.mkdir({ path: COVER_DIR, directory: Directory.Data, recursive: true });
  } catch {
    // already exists
  }
};

export const hydrateCoverCache = async (): Promise<void> => {
  await loadCoverIndex();
};

export const cacheCoverImage = async (
  postId: string,
  imageFilename?: string | null
): Promise<string | null> => {
  if (!isNativeApp() || !postId || !imageFilename) return getCachedCoverUrl(postId);
  const index = await loadCoverIndex();
  const existing = index[postId];
  if (existing?.uri) {
    rememberCoverUrl(postId, existing.uri);
    return coverUrlCache.get(postId) ?? null;
  }

  const res = await fetch(buildImageUrl(imageFilename), { cache: 'force-cache' });
  if (!res.ok) return null;
  const blob = await res.blob();
  if (blob.size < 32) return null;

  await ensureCoverDir();
  const ext = imageFilename.split('.').pop()?.replace(/[^a-z0-9]/gi, '') || 'jpg';
  const path = `${COVER_DIR}/${postId}.${ext}`;
  await Filesystem.writeFile({
    path,
    data: await blobToBase64(blob),
    directory: Directory.Data
  });
  const { uri } = await Filesystem.getUri({ path, directory: Directory.Data });
  index[postId] = { postId, image_filename: imageFilename, path, uri };
  await saveCoverIndex(index);
  rememberCoverUrl(postId, uri);
  return coverUrlCache.get(postId) ?? null;
};

export const prefetchCoverImages = (posts: Array<{ id: string; image_filename?: string | null }>): void => {
  if (!isNativeApp() || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
  void (async () => {
    for (const post of posts) {
      try {
        await cacheCoverImage(post.id, post.image_filename);
      } catch {
        // keep going
      }
    }
  })();
};

export const resolveEpisodeImageUrl = (
  postId: string,
  imageFilename?: string | null
): string | null => {
  const local = getCachedCoverUrl(postId);
  if (local) return local;
  if (imageFilename) return buildImageUrl(imageFilename);
  return null;
};
