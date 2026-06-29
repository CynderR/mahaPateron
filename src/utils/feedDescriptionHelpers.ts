const FEED_METADATA_LINE = /^(artist|album|year|genre)\s*:/i;
const FEED_METADATA_FIELD = /^(artist|album|year|genre)\s*:\s*(.*)$/i;

export interface FeedMetadata {
  artist: string;
  album: string;
  year: string;
  genre: string;
}

export const parseFeedMetadataFromDescription = (description?: string | null): FeedMetadata => {
  const result: FeedMetadata = { artist: '', album: '', year: '', genre: '' };
  if (!description) return result;

  for (const line of description.split('\n')) {
    const match = line.trim().match(FEED_METADATA_FIELD);
    if (!match) continue;
    const key = match[1].toLowerCase();
    const value = match[2].trim();
    if (key === 'artist') result.artist = value;
    else if (key === 'album') result.album = value;
    else if (key === 'year') result.year = value;
    else if (key === 'genre') result.genre = value;
  }

  return result;
};

/** Artist, Album, Year, and Genre on one line with a 3-character gap between each field. */
export const formatStreamMetadataLine = (meta: FeedMetadata): string => {
  const parts: string[] = [];
  if (meta.artist) parts.push(`Artist: ${meta.artist}`);
  if (meta.album) parts.push(`Album: ${meta.album}`);
  if (meta.year) parts.push(`Year: ${meta.year}`);
  if (meta.genre) parts.push(`Genre: ${meta.genre}`);
  return parts.join('   ');
};

export const formatStreamPlayDescription = (
  description?: string | null
): { metadataLine: string; notes: string } => ({
  metadataLine: formatStreamMetadataLine(parseFeedMetadataFromDescription(description)),
  notes: stripFeedMetadataFromDescription(description)
});

export const stripFeedMetadataFromDescription = (description?: string | null): string => {
  if (!description) return '';

  const lines = description.split('\n').filter((line) => {
    const trimmed = line.trim();
    return trimmed && !FEED_METADATA_LINE.test(trimmed);
  });

  return lines.join('\n').trim();
};

export const feedDescriptionPreview = (description?: string | null): string => {
  const cleaned = stripFeedMetadataFromDescription(description);
  if (!cleaned) return '';
  return cleaned.split('\n').find((line) => line.trim())?.trim() ?? '';
};
