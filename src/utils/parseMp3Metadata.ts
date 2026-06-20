import jsmediatags from 'jsmediatags/dist/jsmediatags.min.js';

export interface Mp3Metadata {
  title: string;
  artist: string;
  album: string;
  year: string;
  genre: string;
  picture: { data: Uint8Array | number[]; format: string } | null;
}

const fallbackFromFilename = (filename: string): Pick<Mp3Metadata, 'title' | 'year'> => {
  const base = filename.replace(/\.mp3$/i, '');
  const match = base.match(/^(\d{4})(?:-\d{2}-\d{2})?\s*-\s*(.+)$/);
  if (match) {
    return { year: match[1], title: match[2].trim() };
  }
  return { title: base.trim(), year: '' };
};

/** Full display title from filename (keeps date prefix, e.g. 2005-09-28 - Be Vigilant). */
export const titleFromFilename = (filename: string): string =>
  filename.replace(/\.mp3$/i, '').trim();

/** Parse YYYY-MM-DD from the start of a filename for archive backdating. */
export const publishedAtFromFilename = (filename: string): string | null => {
  const match = titleFromFilename(filename).match(/^(\d{4}-\d{2}-\d{2})/);
  if (!match) return null;
  const date = new Date(`${match[1]}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const isMp3File = (file: File): boolean =>
  file.type === 'audio/mpeg' || file.type === 'audio/mp3' || /\.mp3$/i.test(file.name);

const toUint8Array = (data: Uint8Array | number[]): Uint8Array =>
  data instanceof Uint8Array ? data : new Uint8Array(data);

const normalizePictureMime = (format: string): { mime: string; ext: string } => {
  const raw = format.replace(/^image\//i, '').toLowerCase();
  if (raw === 'jpg' || raw === 'jpeg') return { mime: 'image/jpeg', ext: 'jpg' };
  if (raw === 'png') return { mime: 'image/png', ext: 'png' };
  if (raw === 'gif') return { mime: 'image/gif', ext: 'gif' };
  if (raw === 'webp') return { mime: 'image/webp', ext: 'webp' };
  if (format.toLowerCase().startsWith('image/')) {
    const ext = raw === 'jpeg' ? 'jpg' : raw || 'jpg';
    return { mime: format.toLowerCase(), ext };
  }
  return { mime: `image/${raw}`, ext: raw === 'jpeg' ? 'jpg' : raw };
};

export const parseMp3Metadata = (file: File): Promise<Mp3Metadata> => {
  return new Promise((resolve, reject) => {
    jsmediatags.read(file, {
      onSuccess: ({ tags }) => {
        const fallback = fallbackFromFilename(file.name);
        resolve({
          title: tags.title?.trim() || fallback.title || '',
          artist: tags.artist?.trim() || '',
          album: tags.album?.trim() || '',
          year: tags.year ? String(tags.year).trim() : fallback.year || '',
          genre: tags.genre?.trim() || '',
          picture: tags.picture
            ? { data: tags.picture.data, format: tags.picture.format }
            : null
        });
      },
      onError: (error) => {
        const fallback = fallbackFromFilename(file.name);
        if (fallback.title) {
          resolve({
            title: fallback.title,
            artist: '',
            album: '',
            year: fallback.year || '',
            genre: '',
            picture: null
          });
          return;
        }
        reject(new Error(error.info || 'Could not read MP3 tags'));
      }
    });
  });
};

export const pictureToCoverFile = (picture: { data: Uint8Array | number[]; format: string }): File => {
  const bytes = toUint8Array(picture.data);
  const { mime, ext } = normalizePictureMime(picture.format);
  return new File([bytes], `cover.${ext}`, { type: mime });
};

export const pictureToPreviewUrl = (picture: { data: Uint8Array | number[]; format: string }): string => {
  const bytes = toUint8Array(picture.data);
  const { mime } = normalizePictureMime(picture.format);
  return URL.createObjectURL(new Blob([bytes], { type: mime }));
};

export const buildDescription = (
  artist: string,
  album: string,
  year: string,
  genre: string,
  notes: string
): string => {
  const lines = [
    artist && `Artist: ${artist}`,
    album && `Album: ${album}`,
    year && `Year: ${year}`,
    genre && `Genre: ${genre}`
  ].filter(Boolean);

  const trimmedNotes = notes.trim();
  if (trimmedNotes) {
    if (lines.length) lines.push('');
    lines.push(trimmedNotes);
  }

  return lines.join('\n');
};

export { isMp3File };

export const filterMp3Files = (files: FileList | File[]): File[] =>
  Array.from(files).filter(isMp3File).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
