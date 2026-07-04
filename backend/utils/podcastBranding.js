const fs = require('fs');
const path = require('path');
const { BASE_URL, IMAGE_DIR } = require('../config');

const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');
const PODCAST_COVER_FILENAME = 'podcast-cover.jpg';
const PODCAST_CHANNEL_IMAGE = '_podcast-channel.jpg';

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

const ensurePodcastChannelArt = () => {
  const source = resolveCoverSource();
  if (!source) {
    console.warn(
      'Podcast channel art not found in public/ — RSS feeds will omit artwork until PODCAST_IMAGE_URL is set.'
    );
    return null;
  }

  const dest = path.join(IMAGE_DIR, PODCAST_CHANNEL_IMAGE);
  const shouldCopy =
    !fs.existsSync(dest) ||
    fs.statSync(source).mtimeMs > fs.statSync(dest).mtimeMs;

  if (shouldCopy) {
    fs.copyFileSync(source, dest);
    console.log(`Podcast channel art synced to uploads/images/${PODCAST_CHANNEL_IMAGE}`);
  }

  return dest;
};

const getPodcastChannelImageUrl = () => {
  if (process.env.PODCAST_IMAGE_URL) {
    return process.env.PODCAST_IMAGE_URL.replace(/\/$/, '');
  }

  const dest = path.join(IMAGE_DIR, PODCAST_CHANNEL_IMAGE);
  if (fs.existsSync(dest)) {
    return `${BASE_URL}/uploads/images/${encodeURIComponent(PODCAST_CHANNEL_IMAGE)}`;
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
  PODCAST_CHANNEL_IMAGE,
  ensurePodcastChannelArt,
  getPodcastChannelImageUrl,
  buildEpisodeImageUrl,
};
