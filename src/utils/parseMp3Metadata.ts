import jsmediatags from 'jsmediatags/dist/jsmediatags.min.js';

export interface Mp3Metadata {
  title: string;
  artist: string;
  album: string;
  year: string;
  genre: string;
  picture: { data: Uint8Array; format: string } | null;
}

const fallbackFromFilename = (filename: string): Pick<Mp3Metadata, 'title' | 'year'> => {
  const base = filename.replace(/\.mp3$/i, '');
  const match = base.match(/^(\d{4})(?:-\d{2}-\d{2})?\s*-\s*(.+)$/);
  if (match) {
    return { year: match[1], title: match[2].trim() };
  }
  return { title: base.trim(), year: '' };
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

export const pictureToCoverFile = (picture: { data: Uint8Array; format: string }): File => {
  const format = picture.format.replace(/^image\//, '');
  const mime = picture.format.startsWith('image/') ? picture.format : `image/${format}`;
  const ext = format === 'jpeg' ? 'jpg' : format;
  return new File([picture.data], `cover.${ext}`, { type: mime });
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
