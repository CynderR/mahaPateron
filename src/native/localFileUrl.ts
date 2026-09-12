import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';

const blobUrlByPath = new Map<string, string>();

export const isWebAccessibleFileUrl = (url: string | null | undefined): boolean => {
  if (!url) return false;
  return /^(https?:|blob:|capacitor:|capacitor-electron:|ionic:)/i.test(url);
};

const base64ToBlob = (base64: string, mime: string): Blob => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
};

/** Capacitor.convertFileSrc works on Android; Electron's web Filesystem only has a path. */
export const toWebFileUrl = (uri: string): string | null => {
  try {
    const converted = Capacitor.convertFileSrc(uri);
    return isWebAccessibleFileUrl(converted) ? converted : null;
  } catch {
    return null;
  }
};

export const rememberBlobUrl = (path: string, url: string): void => {
  const previous = blobUrlByPath.get(path);
  if (previous && previous !== url) {
    URL.revokeObjectURL(previous);
  }
  blobUrlByPath.set(path, url);
};

export const readLocalFileAsObjectUrl = async (
  path: string,
  mime: string
): Promise<string | null> => {
  const cached = blobUrlByPath.get(path);
  if (cached) return cached;
  try {
    const result = await Filesystem.readFile({ path, directory: Directory.Data });
    const data = result.data;
    const blob = typeof data === 'string' ? base64ToBlob(data, mime) : (data as Blob);
    const url = URL.createObjectURL(blob);
    rememberBlobUrl(path, url);
    return url;
  } catch {
    return null;
  }
};

export const revokeLocalFileObjectUrl = (path: string): void => {
  const url = blobUrlByPath.get(path);
  if (!url) return;
  URL.revokeObjectURL(url);
  blobUrlByPath.delete(path);
};
