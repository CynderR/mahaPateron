const fs = require('fs');
const path = require('path');
const { IMAGE_DIR } = require('../config');

// Signal Desktop drops og:image when Content-Length / body exceeds 1MiB.
// See signalapp/Signal-Desktop linkPreviewFetch MAX_IMAGE_BYTES_TO_LOAD.
const MAX_OG_IMAGE_BYTES = 1000 * 1024;
const OG_MAX_EDGE_PX = 1200;

const ogPreviewFilename = (imageFilename) => {
  const base = path.basename(String(imageFilename || ''), path.extname(imageFilename || ''));
  const safe = base.replace(/[^a-zA-Z0-9._-]+/g, '').slice(0, 80) || 'cover';
  return `og-${safe}.jpg`;
};

const isUsableOgFile = (filePath, sourcePath) => {
  try {
    if (!fs.existsSync(filePath)) return false;
    const destStat = fs.statSync(filePath);
    if (destStat.size <= 0 || destStat.size > MAX_OG_IMAGE_BYTES) return false;
    if (sourcePath && fs.existsSync(sourcePath)) {
      const srcStat = fs.statSync(sourcePath);
      if (destStat.mtimeMs < srcStat.mtimeMs) return false;
    }
    return true;
  } catch {
    return false;
  }
};

/**
 * Return a filename under IMAGE_DIR for og:image.
 * Prefer the post cover always; when it exceeds Signal's ~1MB limit, write a
 * compressed `og-*.jpg` sibling. On compression failure, still return the
 * original cover (never the channel artwork).
 */
const ensureShareOgImageFilename = async (imageFilename) => {
  if (!imageFilename) return null;

  const sourcePath = path.join(IMAGE_DIR, imageFilename);
  if (!fs.existsSync(sourcePath)) {
    console.warn(`Share OG: post cover missing on disk: ${sourcePath}`);
    return null;
  }

  let sourceSize = 0;
  try {
    sourceSize = fs.statSync(sourcePath).size;
  } catch (error) {
    console.warn(`Share OG: cannot stat cover ${imageFilename}:`, error.message);
    return imageFilename;
  }

  if (sourceSize > 0 && sourceSize <= MAX_OG_IMAGE_BYTES) {
    return imageFilename;
  }

  const previewName = ogPreviewFilename(imageFilename);
  const previewPath = path.join(IMAGE_DIR, previewName);
  if (isUsableOgFile(previewPath, sourcePath)) {
    return previewName;
  }

  let sharp;
  try {
    sharp = require('sharp');
  } catch (error) {
    console.warn(
      'Share OG: sharp unavailable — using full-size post cover (Signal may omit image):',
      error.message
    );
    return imageFilename;
  }

  try {
    let quality = 82;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await sharp(sourcePath)
        .rotate()
        .resize(OG_MAX_EDGE_PX, OG_MAX_EDGE_PX, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality, mozjpeg: true })
        .toFile(previewPath);

      const { size } = fs.statSync(previewPath);
      if (size <= MAX_OG_IMAGE_BYTES) {
        return previewName;
      }
      quality -= 12;
      if (quality < 40) break;
    }

    console.warn(
      `Share OG: compressed preview still over ${MAX_OG_IMAGE_BYTES} bytes for ${imageFilename}; using original`
    );
  } catch (error) {
    console.warn(
      `Share OG: failed to compress ${imageFilename} — using original:`,
      error.message
    );
  }

  return imageFilename;
};

module.exports = {
  MAX_OG_IMAGE_BYTES,
  ensureShareOgImageFilename,
  ogPreviewFilename,
};
