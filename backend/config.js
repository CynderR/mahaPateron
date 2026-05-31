const path = require('path');
const fs = require('fs');

// Root directory for uploaded media. Defaults to backend/uploads so the app
// works out of the box in development; override with UPLOAD_DIR in production.
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
const AUDIO_DIR = path.join(UPLOAD_DIR, 'audio');
const IMAGE_DIR = path.join(UPLOAD_DIR, 'images');

// Public base URL used to build absolute RSS enclosure and stream links.
// In production this is the subpath origin, e.g. https://4thstate.ca/shyam_akaash.
const BASE_URL = (process.env.BASE_URL || 'http://localhost:5000').replace(/\/$/, '');

const ensureDirs = () => {
  [UPLOAD_DIR, AUDIO_DIR, IMAGE_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

module.exports = { UPLOAD_DIR, AUDIO_DIR, IMAGE_DIR, BASE_URL, ensureDirs };
