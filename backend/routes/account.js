const express = require('express');

const { BASE_URL } = require('../config');
const { accessFlags, streamPreviewSeconds, userIsNotSubscribed } = require('../utils/accessPermissions');
const {
  getUserById,
  getUserByEmail,
  getUserByUsername,
  getPublishedPostsForUser,
  getPublishedPostsForUserPaginated,
  getLibraryForUserPaginated,
  getLibraryMetadataFilters,
  getPostById,
  userCanAccessPost,
  updateUserFields,
  softDeleteUser
} = require('../database');
const { cancelStripeSubscriptionForUser } = require('../utils/stripeBilling');

const router = express.Router();

// GET /feed — published episodes plus the viewer's access flags.
router.get('/feed', async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { canStream, canRss, canDownload } = accessFlags(user);
    const previewSecs = streamPreviewSeconds(user);
    const mapPost = (p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      duration_secs: p.duration_secs,
      published_at: p.published_at,
      image_filename: p.image_filename || null
    });
    const accessMeta = {
      is_paying: !!user.is_paying,
      back_catalog_access: !!user.back_catalog_access,
      canStream,
      canRss,
      canDownload,
      streamPreviewSeconds: previewSecs
    };

    const { page, limit, q } = req.query;
    if (page != null || q) {
      const result = await getPublishedPostsForUserPaginated(user, {
        page,
        limit,
        search: q
      });
      return res.json({
        ...accessMeta,
        total: result.total,
        page: result.page,
        limit: result.limit,
        posts: result.posts.map(mapPost)
      });
    }

    const posts = await getPublishedPostsForUser(user);
    res.json({
      ...accessMeta,
      posts: posts.map(mapPost)
    });
  } catch (error) {
    console.error('Account feed error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /episodes/:id — single episode for the streaming page.
router.get('/episodes/:id', async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const post = await getPostById(req.params.id);
    if (!post || !post.is_published) {
      return res.status(404).json({ error: 'Episode not found' });
    }

    const { canStream, canRss, canDownload } = accessFlags(user);
    const accessible = userIsNotSubscribed(user) || userCanAccessPost(user, post);
    const previewSecs = streamPreviewSeconds(user);

    res.json({
      is_paying: !!user.is_paying,
      canStream,
      canRss,
      canDownload,
      accessible,
      streamPreviewSeconds: previewSecs,
      post: {
        id: post.id,
        title: post.title,
        description: post.description,
        duration_secs: post.duration_secs,
        published_at: post.published_at,
        image_filename: post.image_filename || null
      }
    });
  } catch (error) {
    console.error('Account episode error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /library/filters — distinct metadata values for library filters.
router.get('/library/filters', async (req, res) => {
  try {
    const filters = await getLibraryMetadataFilters({ publishedOnly: true });
    res.json(filters);
  } catch (error) {
    console.error('Account library filters error:', error.message || error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /library — paginated episode catalog with per-item access flags.
router.get('/library', async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { page, limit, q, sort, dir, artist, album, year, genre } = req.query;
    const result = await getLibraryForUserPaginated(user, {
      page,
      limit,
      search: q,
      sortField: sort,
      sortDir: dir,
      artist,
      album,
      year,
      genre
    });
    const { canStream, canRss, canDownload } = accessFlags(user);
    const previewSecs = streamPreviewSeconds(user);

    res.json({
      is_paying: !!user.is_paying,
      back_catalog_access: !!user.back_catalog_access,
      canStream,
      canRss,
      canDownload,
      streamPreviewSeconds: previewSecs,
      total: result.total,
      catalogTotal: result.catalogTotal,
      accessible: result.accessible,
      page: result.page,
      limit: result.limit,
      entries: result.entries
    });
  } catch (error) {
    console.error('Account library error:', error.message || error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /rss — the user's personal RSS URL and access status.
router.get('/rss', async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { canRss } = accessFlags(user);
    res.json({
      rssUrl: `${BASE_URL}/rss/${user.rss_token}`,
      canRss,
      is_paying: !!user.is_paying
    });
  } catch (error) {
    console.error('Account rss error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /settings — update profile fields the user is allowed to change.
router.put('/settings', async (req, res) => {
  try {
    const userId = req.user.id;
    const { username, email } = req.body;
    const data = {};

    if (username !== undefined) {
      const existing = await getUserByUsername(username);
      if (existing && existing.id !== userId) {
        return res.status(400).json({ error: 'Username already taken' });
      }
      data.username = username;
    }
    if (email !== undefined) {
      const existing = await getUserByEmail(email);
      if (existing && existing.id !== userId) {
        return res.status(400).json({ error: 'Email already taken' });
      }
      data.email = email;
    }

    await updateUserFields(userId, data);
    const updated = await getUserById(userId);
    const { password, password_reset_token, password_reset_expires, ...safe } = updated;
    res.json({ message: 'Settings updated', user: safe });
  } catch (error) {
    console.error('Account settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE / — anonymize, cancel Stripe subscription, and soft-delete the account.
router.delete('/', async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    await cancelStripeSubscriptionForUser(user);

    const anonymized = `deleted_user_${user.id}`;
    await updateUserFields(user.id, {
      username: anonymized,
      email: `${anonymized}@deleted.invalid`,
      whatsapp_id: null,
      signal_id: null,
      is_paying: 0,
      stripe_sub_id: null
    });
    await softDeleteUser(user.id);

    res.json({ message: 'Account deleted' });
  } catch (error) {
    console.error('Account delete error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
