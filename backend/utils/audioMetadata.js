const FEED_METADATA_LINE = /^(artist|album|year|genre)\s*:\s*(.+)$/i;

const normalizeTag = (value) => {
  const trimmed = value != null ? String(value).trim() : '';
  return trimmed || null;
};

const extractTagsFromMetadata = (metadata) => {
  const common = metadata?.common || {};
  let genre = '';
  if (Array.isArray(common.genre)) {
    genre = common.genre[0] || '';
  } else if (common.genre) {
    genre = String(common.genre);
  }

  return {
    title: normalizeTag(common.title),
    artist: normalizeTag(common.artist),
    album: normalizeTag(common.album),
    year: common.year != null ? String(common.year).trim() : null,
    genre: normalizeTag(genre)
  };
};

const parseMetadataFromDescription = (description) => {
  const result = { artist: null, album: null, year: null, genre: null };
  if (!description) return result;

  for (const line of description.split('\n')) {
    const match = line.trim().match(FEED_METADATA_LINE);
    if (match) {
      result[match[1].toLowerCase()] = match[2].trim();
    }
  }
  return result;
};

const buildDescriptionFromTags = (tags, notes = '') => {
  const lines = [
    tags.artist && `Artist: ${tags.artist}`,
    tags.album && `Album: ${tags.album}`,
    tags.year && `Year: ${tags.year}`,
    tags.genre && `Genre: ${tags.genre}`
  ].filter(Boolean);

  const trimmedNotes = notes != null ? String(notes).trim() : '';
  if (trimmedNotes) {
    if (lines.length) lines.push('');
    lines.push(trimmedNotes);
  }

  return lines.length ? lines.join('\n') : null;
};

const mergeTagFields = (primary = {}, fallback = {}) => ({
  artist: normalizeTag(primary.artist) || normalizeTag(fallback.artist),
  album: normalizeTag(primary.album) || normalizeTag(fallback.album),
  year: normalizeTag(primary.year) || normalizeTag(fallback.year),
  genre: normalizeTag(primary.genre) || normalizeTag(fallback.genre)
});

const resolvePostTags = ({ metadata, description, body = {} } = {}) => {
  const parsed = metadata ? extractTagsFromMetadata(metadata) : {};
  const fromDescription = parseMetadataFromDescription(description);
  const fromBody = {
    artist: body.artist,
    album: body.album,
    year: body.year,
    genre: body.genre
  };

  return mergeTagFields(fromBody, mergeTagFields(parsed, fromDescription));
};

const resolvePostDescription = ({ description, tags, notes }) => {
  if (description != null && String(description).trim()) {
    return String(description).trim();
  }
  return buildDescriptionFromTags(tags, notes);
};

module.exports = {
  extractTagsFromMetadata,
  parseMetadataFromDescription,
  buildDescriptionFromTags,
  mergeTagFields,
  resolvePostTags,
  resolvePostDescription
};
