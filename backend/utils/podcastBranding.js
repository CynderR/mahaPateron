const fs = require('fs');
const path = require('path');
const { BASE_URL, IMAGE_DIR } = require('../config');

const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');
const PODCAST_COVER_FILENAME = 'podcast-cover.jpg';
// Served from uploads/ like episode art — podcast apps cache failures aggressively.
const PODCAST_ARTWORK_FILENAME = 'podcast-artwork.jpg';
const PODCAST_ART_MIN_PX = 1400;

const resolveCoverSource = () => {
  const configured = process.env.PODCAST_COVER_FILE;
  if (configured) {
    return path.isAbsolute(configured)
      ? configured
      : path.join(PUBLIC_DIR, configured);
  }

  const defaultCover = path.join(PUBLIC_DIR, PODCAST_COVER_FILENAME);
  if (fs.existsSync(defaultCover)) {
    return defaultCover;
  }

  for (const name of ['shyam-akaash-avatar.png', 'logo512.png', 'favicon.png']) {
    const candidate = path.join(PUBLIC_DIR, name);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
};

const getPodcastCoverPath = () => {
  const configured = process.env.PODCAST_COVER_FILE;
  if (configured) {
    const configuredPath = path.isAbsolute(configured)
      ? configured
      : path.join(PUBLIC_DIR, configured);
    if (fs.existsSync(configuredPath)) {
      return configuredPath;
    }
  }

  const defaultCover = path.join(PUBLIC_DIR, PODCAST_COVER_FILENAME);
  return fs.existsSync(defaultCover) ? defaultCover : null;
};

// Sync channel artwork to uploads/images/ (same path pattern as episode covers).
const ensurePodcastChannelArt = () => {
  const publicDest = path.join(PUBLIC_DIR, PODCAST_COVER_FILENAME);
  const uploadsDest = path.join(IMAGE_DIR, PODCAST_ARTWORK_FILENAME);

  let source = getPodcastCoverPath();
  if (!source) {
    source = resolveCoverSource();
    if (source && source !== publicDest) {
      fs.copyFileSync(source, publicDest);
    }
  }

  if (!source) {
    console.warn(
      'Podcast channel art not found — RSS feeds will omit artwork until PODCAST_IMAGE_URL is set.'
    );
    return null;
  }

  const shouldSyncUploads =
    !fs.existsSync(uploadsDest) ||
    fs.statSync(source).mtimeMs > fs.statSync(uploadsDest).mtimeMs;

  if (shouldSyncUploads) {
    fs.copyFileSync(source, uploadsDest);
    console.log(`Podcast channel art synced to uploads/images/${PODCAST_ARTWORK_FILENAME}`);
  }

  return uploadsDest;
};

const getPodcastChannelImageUrl = () => {
  if (process.env.PODCAST_IMAGE_URL) {
    return process.env.PODCAST_IMAGE_URL.replace(/\/$/, '');
  }

  const uploadsPath = path.join(IMAGE_DIR, PODCAST_ARTWORK_FILENAME);
  if (fs.existsSync(uploadsPath)) {
    return `${BASE_URL}/uploads/images/${encodeURIComponent(PODCAST_ARTWORK_FILENAME)}`;
  }

  if (getPodcastCoverPath()) {
    return `${BASE_URL}/${PODCAST_COVER_FILENAME}`;
  }

  return null;
};

const buildEpisodeImageUrl = (imageFilename, channelImageUrl) => {
  if (imageFilename) {
    return `${BASE_URL}/uploads/images/${encodeURIComponent(imageFilename)}`;
  }
  return channelImageUrl;
};

module.exports = {
  PODCAST_COVER_FILENAME,
  PODCAST_ARTWORK_FILENAME,
  getPodcastCoverPath,
  ensurePodcastChannelArt,
  getPodcastChannelImageUrl,
  buildEpisodeImageUrl,
};
