const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const mm = require('music-metadata');
const { v4: uuidv4 } = require('uuid');

const { AUDIO_DIR, IMAGE_DIR, ensureDirs } = require('../config');
const {
  createPost,
  getAllPosts,
  getPostById,
  updatePost,
  softDeletePost
} = require('../database');

const router = express.Router();

ensureDirs();

const AUDIO_MIME = ['audio/mpeg', 'audio/mp3'];
const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_AUDIO_BYTES = 500 * 1024 * 1024; // 500 MB
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, file.fieldname === 'audio' ? AUDIO_DIR : IMAGE_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || (file.fieldname === 'audio' ? '.mp3' : '');
    cb(null, `${uuidv4()}${ext}`);
  }
});

// Validate MIME type server-side (not just the extension).
const fileFilter = (req, file, cb) => {
  if (file.fieldname === 'audio') {
    return cb(null, AUDIO_MIME.includes(file.mimetype));
  }
  if (file.fieldname === 'image') {
    return cb(null, IMAGE_MIME.includes(file.mimetype));
  }
  cb(null, false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_AUDIO_BYTES }
}).fields([
  { name: 'audio', maxCount: 1 },
  { name: 'image', maxCount: 1 }
]);

// Wrap multer so its errors become clean JSON responses.
const handleUpload = (req, res, next) => {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    }
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};

const removeFiles = (files) => {
  Object.values(files || {}).flat().forEach((f) => {
    fs.unlink(f.path, () => {});
  });
};

const parseAudioMetadata = async (audioPath) => {
  try {
    return await mm.parseFile(audioPath);
  } catch (e) {
    console.warn('Could not parse audio metadata:', e.message);
    return null;
  }
};

const normalizeImageExt = (format) => {
  if (!format) return 'jpg';
  const normalized = String(format).replace(/^image\//i, '').toLowerCase();
  if (normalized === 'jpeg') return 'jpg';
  return normalized;
};

const saveEmbeddedCover = (metadata) => {
  const picture = metadata?.common?.picture?.[0];
  if (!picture) return null;

  const ext = normalizeImageExt(picture.format);
  const filename = `${uuidv4()}.${ext}`;
  fs.writeFileSync(path.join(IMAGE_DIR, filename), picture.data);
  return filename;
};

// GET / — list all posts (including unpublished) for the admin.
router.get('/', async (req, res) => {
  try {
    const posts = await getAllPosts();
    res.json({ posts });
  } catch (error) {
    console.error('Admin list posts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST / — multipart upload of a new episode.
router.post('/', handleUpload, async (req, res) => {
  try {
    const { title, description, is_published } = req.body;
    const audioFile = req.files && req.files.audio && req.files.audio[0];
    const imageFile = req.files && req.files.image && req.files.image[0];

    if (!title) {
      removeFiles(req.files);
      return res.status(400).json({ error: 'Title is required' });
    }
    if (!audioFile) {
      removeFiles(req.files);
      return res.status(400).json({ error: 'A valid MP3 audio file is required' });
    }
    if (imageFile && imageFile.size > MAX_IMAGE_BYTES) {
      removeFiles(req.files);
      return res.status(400).json({ error: 'Image exceeds the 10 MB limit' });
    }

    const metadata = await parseAudioMetadata(audioFile.path);
    const duration = metadata?.format?.duration
      ? Math.round(metadata.format.duration)
      : null;
    const imageFilename = imageFile
      ? imageFile.filename
      : saveEmbeddedCover(metadata);

    const post = await createPost({
      title,
      description: description || null,
      audio_filename: audioFile.filename,
      image_filename: imageFilename,
      duration_secs: duration,
      created_by: req.user.id,
      is_published: is_published === 'false' || is_published === false ? false : true
    });

    const created = await getPostById(post.id);
    res.status(201).json({ message: 'Post created', post: created });
  } catch (error) {
    console.error('Admin create post error:', error);
    removeFiles(req.files);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:id — edit metadata and optionally replace files.
router.put('/:id', handleUpload, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await getPostById(id);
    if (!existing) {
      removeFiles(req.files);
      return res.status(404).json({ error: 'Post not found' });
    }

    const { title, description, is_published } = req.body;
    const audioFile = req.files && req.files.audio && req.files.audio[0];
    const imageFile = req.files && req.files.image && req.files.image[0];

    const data = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (is_published !== undefined) {
      data.is_published = is_published === 'true' || is_published === true ? 1 : 0;
    }

    if (audioFile) {
      data.audio_filename = audioFile.filename;
      const metadata = await parseAudioMetadata(audioFile.path);
      data.duration_secs = metadata?.format?.duration
        ? Math.round(metadata.format.duration)
        : null;
      if (!imageFile) {
        const embeddedCover = saveEmbeddedCover(metadata);
        if (embeddedCover) {
          data.image_filename = embeddedCover;
          if (existing.image_filename) {
            fs.unlink(path.join(IMAGE_DIR, existing.image_filename), () => {});
          }
        }
      }
      // Remove the previous audio file.
      fs.unlink(path.join(AUDIO_DIR, existing.audio_filename), () => {});
    }
    if (imageFile) {
      if (imageFile.size > MAX_IMAGE_BYTES) {
        removeFiles(req.files);
        return res.status(400).json({ error: 'Image exceeds the 10 MB limit' });
      }
      data.image_filename = imageFile.filename;
      if (existing.image_filename) {
        fs.unlink(path.join(IMAGE_DIR, existing.image_filename), () => {});
      }
    }

    await updatePost(id, data);
    const updated = await getPostById(id);
    res.json({ message: 'Post updated', post: updated });
  } catch (error) {
    console.error('Admin update post error:', error);
    removeFiles(req.files);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id — soft delete.
router.delete('/:id', async (req, res) => {
  try {
    const result = await softDeletePost(req.params.id);
    if (result.deleted) {
      res.json({ message: 'Post deleted' });
    } else {
      res.status(404).json({ error: 'Post not found' });
    }
  } catch (error) {
    console.error('Admin delete post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
