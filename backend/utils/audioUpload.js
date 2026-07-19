const fs = require('fs');
const path = require('path');
const mm = require('music-metadata');

const AUDIO_MIME = ['audio/mpeg', 'audio/mp3'];
const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const IMAGE_MIME_TO_EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
};
const SAFE_IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const isAllowedAudioMime = (mimetype, originalname) =>
  AUDIO_MIME.includes(mimetype) || /\.mp3$/i.test(originalname || '');

const extensionForImageMime = (mimetype) => IMAGE_MIME_TO_EXT[mimetype] || null;

const isSafeImageExtension = (ext) => SAFE_IMAGE_EXTS.has(String(ext || '').toLowerCase());

const detectImageTypeFromBuffer = (buf) => {
  if (!buf || buf.length < 3) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { mime: 'image/jpeg', ext: '.jpg' };
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return { mime: 'image/png', ext: '.png' };
  }
  if (
    buf.length >= 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return { mime: 'image/webp', ext: '.webp' };
  }
  return null;
};

const parseAudioMetadata = async (audioPath) => {
  try {
    return await mm.parseFile(audioPath);
  } catch (e) {
    return null;
  }
};

// Reject uploads that are not readable MP3 audio, even when the extension/MIME look valid.
const validateUploadedAudio = async (audioPath) => {
  const metadata = await parseAudioMetadata(audioPath);
  if (!metadata?.format) {
    throw new Error('Uploaded file is not a valid MP3 audio file');
  }

  const container = String(metadata.format.container || '').toLowerCase();
  const codec = String(metadata.format.codec || '').toLowerCase();
  const isMp3 =
    container.includes('mpeg') ||
    codec.includes('mp3') ||
    codec.includes('mpeg') ||
    metadata.format.duration != null;

  if (!isMp3) {
    throw new Error('Only MP3 audio files are allowed');
  }

  return metadata;
};

/** Validate magic bytes and normalize the on-disk extension to a safe image type. */
const finalizeUploadedImage = (imageFile) => {
  if (!imageFile?.path) {
    throw new Error('Image file missing');
  }

  const fd = fs.openSync(imageFile.path, 'r');
  const header = Buffer.alloc(16);
  try {
    fs.readSync(fd, header, 0, 16, 0);
  } finally {
    fs.closeSync(fd);
  }

  const detected = detectImageTypeFromBuffer(header);
  if (!detected) {
    throw new Error('Uploaded file is not a valid JPEG, PNG, or WebP image');
  }

  const currentExt = path.extname(imageFile.filename || imageFile.path).toLowerCase();
  if (currentExt === detected.ext || (currentExt === '.jpeg' && detected.ext === '.jpg')) {
    return imageFile.filename;
  }

  const base = path.basename(imageFile.filename, currentExt);
  const newName = `${base}${detected.ext}`;
  const newPath = path.join(path.dirname(imageFile.path), newName);
  fs.renameSync(imageFile.path, newPath);
  imageFile.filename = newName;
  imageFile.path = newPath;
  return newName;
};

const safeEmbeddedImageExt = (format) => {
  if (!format) return null;
  const normalized = String(format).replace(/^image\//i, '').toLowerCase();
  if (normalized === 'jpeg' || normalized === 'jpg') return 'jpg';
  if (normalized === 'png') return 'png';
  if (normalized === 'webp') return 'webp';
  return null;
};

module.exports = {
  AUDIO_MIME,
  IMAGE_MIME,
  SAFE_IMAGE_EXTS,
  isAllowedAudioMime,
  extensionForImageMime,
  isSafeImageExtension,
  parseAudioMetadata,
  validateUploadedAudio,
  finalizeUploadedImage,
  safeEmbeddedImageExt
};
