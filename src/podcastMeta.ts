const publicUrl = process.env.PUBLIC_URL || '';

export const PODCAST_AUTHOR = 'Shyam Akaash';
export const PODCAST_LOCATION = 'Montreal Canada';
export const PODCAST_PROFILE_TITLE = PODCAST_AUTHOR;
export const PODCAST_PROFILE_BIO = 'Satsang talks from Swami Shyam';
export const PODCAST_GENRE = 'Spiritual';
export const PODCAST_BANNER_URL = `${publicUrl}/shyam-akaash-banner.png`;

export const formatDuration = (secs?: number | null): string => {
  if (secs === null || secs === undefined) return '';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

export const seedHeights = (seedStr: string, count: number): number[] => {
  let seed = seedStr.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return Array.from({ length: count }, () => {
    seed = (seed * 9301 + 49297) % 233280;
    return 18 + (seed % 72);
  });
};
