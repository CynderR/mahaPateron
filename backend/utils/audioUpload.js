const mm = require('music-metadata');

const AUDIO_MIME = ['audio/mpeg', 'audio/mp3'];
const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'];

const isAllowedAudioMime = (mimetype, originalname) =>
  AUDIO_MIME.includes(mimetype) || /\.mp3$/i.test(originalname || '');

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

module.exports = {
  AUDIO_MIME,
  IMAGE_MIME,
  isAllowedAudioMime,
  parseAudioMetadata,
  validateUploadedAudio
};
