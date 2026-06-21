const FEED_METADATA_LINE = /^(artist|album|year|genre)\s*:/i;

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
