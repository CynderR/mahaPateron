const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const mm = require('music-metadata');
const { v4: uuidv4 } = require('uuid');

const { AUDIO_DIR, IMAGE_DIR, ensureDirs } = require('../config');
const {
  createPost,
  getPostById,
  getLibraryEntriesPaginated,
  getLibraryMetadataFilters,
  countAllLibraryEntries,
  countPublishedInLibrary,
  getShareTokensForPostIds,
  updatePost,
  softDeletePost
} = require('../database');
const { resolvePostTags, resolvePostDescription } = require('../utils/audioMetadata');

const router = express.Router();

ensureDirs();

const AUDIO_MIME = ['audio/mpeg', 'audio/mp3'];
const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_AUDIO_BYTES = 500 * 1024 * 1024;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, file.fieldname === 'audio' ? AUDIO_DIR : IMAGE_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || (file.fieldname === 'audio' ? '.mp3' : '');
    cb(null, `${uuidv4()}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.fieldname === 'audio') {
    const ok =
      AUDIO_MIME.includes(file.mimetype) || /\.mp3$/i.test(file.originalname || '');
    return cb(null, ok);
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

const parsePublishedAt = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const mapLibraryEntry = (entry) => ({
  id: entry.post_id || entry.id,
  title: entry.title,
  description: entry.description,
  duration_secs: entry.duration_secs,
  published_at: entry.published_at,
  image_filename: entry.image_filename || null,
  artist: entry.artist || null,
  album: entry.album || null,
  year: entry.year || null,
  genre: entry.genre || null,
  is_published: !!entry.is_published,
  share_token: entry.share_token || null
});

// GET /filters — distinct metadata values for library filters.
router.get('/filters', async (req, res) => {
  try {
    const filters = await getLibraryMetadataFilters({ publishedOnly: false });
    res.json(filters);
  } catch (error) {
    console.error('Admin library filters error:', error.message || error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET / — paginated library list for the admin dashboard.
router.get('/', async (req, res) => {
  try {
    const { page, limit, q, sort, dir, artist, album, year, genre } = req.query;
    const [result, catalogTotal, published] = await Promise.all([
      getLibraryEntriesPaginated({
        page,
        limit,
        search: q,
        sortField: sort,
        sortDir: dir,
        publishedOnly: false,
        artist,
        album,
        year,
        genre
      }),
      countAllLibraryEntries(),
      countPublishedInLibrary()
    ]);

    const shareTokens = await getShareTokensForPostIds(result.entries.map((entry) => entry.post_id));

    res.json({
      total: result.total,
      catalogTotal,
      published,
      page: result.page,
      limit: result.limit,
      entries: result.entries.map((entry) =>
        mapLibraryEntry({ ...entry, share_token: shareTokens[entry.post_id] || null })
      )
    });
  } catch (error) {
    console.error('Admin library list error:', error.message || error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST / — manually add a new episode to the library.
router.post('/', handleUpload, async (req, res) => {
  try {
    const { title, description, is_published, published_at, artist, album, year, genre, notes } = req.body;
    const audioFile = req.files && req.files.audio && req.files.audio[0];
    const imageFile = req.files && req.files.image && req.files.image[0];

    if (!title || !String(title).trim()) {
      removeFiles(req.files);
      return res.status(400).json({ error: 'Title is required' });
    }
    if (!audioFile) {
      removeFiles(req.files);
      return res.status(400).json({ error: 'An MP3 audio file is required' });
    }
    if (imageFile && imageFile.size > MAX_IMAGE_BYTES) {
      removeFiles(req.files);
      return res.status(400).json({ error: 'Image exceeds the 10 MB limit' });
    }

    const parsedPublishedAt = parsePublishedAt(published_at);
    if (published_at && !parsedPublishedAt) {
      removeFiles(req.files);
      return res.status(400).json({ error: 'Invalid published date' });
    }

    const metadata = await parseAudioMetadata(audioFile.path);
    const duration = metadata?.format?.duration ? Math.round(metadata.format.duration) : null;
    const imageFilename = imageFile ? imageFile.filename : saveEmbeddedCover(metadata);
    const tags = resolvePostTags({ metadata, description, body: { artist, album, year, genre } });
    const resolvedDescription = resolvePostDescription({ description, tags, notes });

    const post = await createPost({
      title: String(title).trim(),
      description: resolvedDescription,
      artist: tags.artist,
      album: tags.album,
      year: tags.year,
      genre: tags.genre,
      audio_filename: audioFile.filename,
      image_filename: imageFilename,
      duration_secs: duration,
      created_by: req.user.id,
      is_published: is_published === 'false' || is_published === false ? false : true,
      published_at: parsedPublishedAt || undefined
    });

    const created = await getPostById(post.id);
    res.status(201).json({ message: 'Library entry created', entry: mapLibraryEntry(created) });
  } catch (error) {
    console.error('Admin library create error:', error);
    removeFiles(req.files);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:id — update library metadata and optionally replace media files.
router.put('/:id', handleUpload, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await getPostById(id);
    if (!existing) {
      removeFiles(req.files);
      return res.status(404).json({ error: 'Library entry not found' });
    }

    const { title, description, is_published, published_at, artist, album, year, genre, notes } = req.body;
    const audioFile = req.files && req.files.audio && req.files.audio[0];
    const imageFile = req.files && req.files.image && req.files.image[0];

    const data = {};
    if (title !== undefined) data.title = String(title).trim();
    if (description !== undefined) data.description = description ? String(description).trim() : null;
    if (artist !== undefined) data.artist = artist ? String(artist).trim() : null;
    if (album !== undefined) data.album = album ? String(album).trim() : null;
    if (year !== undefined) data.year = year ? String(year).trim() : null;
    if (genre !== undefined) data.genre = genre ? String(genre).trim() : null;
    if (is_published !== undefined) {
      data.is_published = is_published === 'true' || is_published === true ? 1 : 0;
    }
    if (published_at !== undefined) {
      const parsedPublishedAt = parsePublishedAt(published_at);
      if (published_at && !parsedPublishedAt) {
        removeFiles(req.files);
        return res.status(400).json({ error: 'Invalid published date' });
      }
      data.published_at = parsedPublishedAt;
    }

    if (audioFile) {
      data.audio_filename = audioFile.filename;
      const metadata = await parseAudioMetadata(audioFile.path);
      data.duration_secs = metadata?.format?.duration ? Math.round(metadata.format.duration) : null;
      const tags = resolvePostTags({
        metadata,
        description: data.description ?? existing.description,
        body: { artist, album, year, genre }
      });
      data.artist = tags.artist;
      data.album = tags.album;
      data.year = tags.year;
      data.genre = tags.genre;
      if (description === undefined && !existing.description) {
        data.description = resolvePostDescription({ tags, notes });
      }
      if (!imageFile) {
        const embeddedCover = saveEmbeddedCover(metadata);
        if (embeddedCover) {
          data.image_filename = embeddedCover;
          if (existing.image_filename) {
            fs.unlink(path.join(IMAGE_DIR, existing.image_filename), () => {});
          }
        }
      }
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
    res.json({ message: 'Library entry updated', entry: mapLibraryEntry(updated) });
  } catch (error) {
    console.error('Admin library update error:', error);
    removeFiles(req.files);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id — remove an entry from the library.
router.delete('/:id', async (req, res) => {
  try {
    const result = await softDeletePost(req.params.id);
    if (result.deleted) {
      res.json({ message: 'Library entry deleted' });
    } else {
      res.status(404).json({ error: 'Library entry not found' });
    }
  } catch (error) {
    console.error('Admin library delete error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
