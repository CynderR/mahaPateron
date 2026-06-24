const express = require('express');
const {
  getPostByShareToken,
  getPublishedPosts,
  getPostById,
  getLibraryEntriesPaginated,
  countPublishedInLibrary
} = require('../database');

const router = express.Router();

const SHARE_ACCESS = {
  canStream: true,
  canRss: false,
  canDownload: false
};

const mapPublicPost = (post) => ({
  id: post.id,
  title: post.title,
  description: post.description,
  duration_secs: post.duration_secs,
  published_at: post.published_at,
  image_filename: post.image_filename || null
});

const mapPublicLibraryEntry = (entry) => ({
  id: entry.post_id,
  title: entry.title,
  description: entry.description,
  duration_secs: entry.duration_secs,
  published_at: entry.published_at,
  image_filename: entry.image_filename || null,
  artist: entry.artist || null,
  album: entry.album || null,
  year: entry.year || null,
  genre: entry.genre || null,
  accessible: true
});

const validateShareAnchor = async (shareToken) => {
  const post = await getPostByShareToken(shareToken);
  if (!post || !post.is_published) return null;
  return post;
};

const shareMeta = (anchor) => ({
  share_token: anchor.share_token,
  is_paying: true,
  back_catalog_access: true,
  ...SHARE_ACCESS
});

// GET /:shareToken/feed — published sounds feed for share viewers.
router.get('/:shareToken/feed', async (req, res) => {
  try {
    const anchor = await validateShareAnchor(req.params.shareToken);
    if (!anchor) {
      return res.status(404).json({ error: 'Episode not found' });
    }

    res.json({
      ...shareMeta(anchor),
      post: mapPublicPost(anchor),
      posts: (await getPublishedPosts()).map(mapPublicPost)
    });
  } catch (error) {
    console.error('Public share feed error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:shareToken/library — full published catalog for share viewers.
router.get('/:shareToken/library', async (req, res) => {
  try {
    const anchor = await validateShareAnchor(req.params.shareToken);
    if (!anchor) {
      return res.status(404).json({ error: 'Episode not found' });
    }

    const { page, limit, q, sort, dir } = req.query;
    const result = await getLibraryEntriesPaginated({
      page,
      limit,
      search: q,
      sortField: sort,
      sortDir: dir,
      publishedOnly: true
    });
    const catalogTotal = await countPublishedInLibrary();

    res.json({
      ...shareMeta(anchor),
      total: result.total,
      catalogTotal,
      accessible: catalogTotal,
      page: result.page,
      limit: result.limit,
      entries: result.entries.map(mapPublicLibraryEntry)
    });
  } catch (error) {
    console.error('Public share library error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:shareToken/episodes/:id — episode metadata for the share stream page.
router.get('/:shareToken/episodes/:id', async (req, res) => {
  try {
    const anchor = await validateShareAnchor(req.params.shareToken);
    if (!anchor) {
      return res.status(404).json({ error: 'Episode not found' });
    }

    const post = await getPostById(req.params.id);
    if (!post || !post.is_published) {
      return res.status(404).json({ error: 'Episode not found' });
    }

    res.json({
      ...shareMeta(anchor),
      accessible: true,
      post: mapPublicPost(post)
    });
  } catch (error) {
    console.error('Public share episode error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:shareToken — legacy metadata endpoint (feed shape).
router.get('/:shareToken', async (req, res) => {
  try {
    const anchor = await validateShareAnchor(req.params.shareToken);
    if (!anchor) {
      return res.status(404).json({ error: 'Episode not found' });
    }

    res.json({
      ...shareMeta(anchor),
      post: mapPublicPost(anchor),
      posts: (await getPublishedPosts()).map(mapPublicPost)
    });
  } catch (error) {
    console.error('Public share error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
