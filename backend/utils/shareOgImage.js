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
 * Return a filename under IMAGE_DIR that is safe for Signal/WhatsApp og:image
 * (JPEG, ideally ≤ 1MB). Large episode covers are resized/compressed once and cached.
 */
const ensureShareOgImageFilename = async (imageFilename) => {
  if (!imageFilename) return null;

  const sourcePath = path.join(IMAGE_DIR, imageFilename);
  if (!fs.existsSync(sourcePath)) return null;

  try {
    const { size } = fs.statSync(sourcePath);
    if (size > 0 && size <= MAX_OG_IMAGE_BYTES) {
      return imageFilename;
    }
  } catch {
    return null;
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
    console.warn('Share OG: sharp unavailable, cannot shrink cover:', error.message);
    return null;
  }

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
    `Share OG: compressed preview still over ${MAX_OG_IMAGE_BYTES} bytes for ${imageFilename}`
  );
  return isUsableOgFile(previewPath, sourcePath) ? previewName : null;
};

module.exports = {
  MAX_OG_IMAGE_BYTES,
  ensureShareOgImageFilename,
  ogPreviewFilename,
};
