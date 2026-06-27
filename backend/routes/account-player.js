const express = require('express');

const { BASE_URL } = require('../config');
const { accessFlags } = require('../utils/accessPermissions');
const {
  getUserById,
  getPostById,
  userCanAccessPost,
  getUserFavorites,
  addUserFavorite,
  removeUserFavorite,
  getUserPlaylists,
  getPlaylistById,
  createPlaylist,
  deletePlaylist,
  getPlaylistItems,
  addPlaylistItem,
  removePlaylistItem,
  getLatestAccessiblePostForUser
} = require('../database');

const router = express.Router();

const mapPost = (post) => ({
  id: post.id,
  title: post.title,
  description: post.description,
  duration_secs: post.duration_secs,
  published_at: post.published_at,
  image_filename: post.image_filename || null
});

// GET /favorites
router.get('/favorites', async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const rows = await getUserFavorites(user.id);
    const posts = [];
    for (const row of rows) {
      const post = await getPostById(row.post_id);
      if (post && post.is_published && userCanAccessPost(user, post)) {
        posts.push(mapPost(post));
      }
    }
    res.json({ favorites: posts.map((p) => p.id), posts });
  } catch (error) {
    console.error('Favorites list error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /favorites/:postId
router.post('/favorites/:postId', async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const post = await getPostById(req.params.postId);
    if (!post || !post.is_published || !userCanAccessPost(user, post)) {
      return res.status(404).json({ error: 'Episode not found' });
    }

    await addUserFavorite(user.id, post.id);
    res.json({ message: 'Added to favorites', post_id: post.id });
  } catch (error) {
    console.error('Favorite add error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /favorites/:postId
router.delete('/favorites/:postId', async (req, res) => {
  try {
    await removeUserFavorite(req.user.id, req.params.postId);
    res.json({ message: 'Removed from favorites' });
  } catch (error) {
    console.error('Favorite remove error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /playlists
router.get('/playlists', async (req, res) => {
  try {
    const playlists = await getUserPlaylists(req.user.id);
    const withItems = await Promise.all(
      playlists.map(async (pl) => {
        const items = await getPlaylistItems(pl.id);
        return { ...pl, item_count: items.length, items };
      })
    );
    res.json({ playlists: withItems });
  } catch (error) {
    console.error('Playlists list error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /playlists
router.post('/playlists', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Playlist name is required' });

    const playlist = await createPlaylist(req.user.id, name);
    res.status(201).json({ playlist: { ...playlist, item_count: 0, items: [] } });
  } catch (error) {
    console.error('Playlist create error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /playlists/:id
router.delete('/playlists/:id', async (req, res) => {
  try {
    const result = await deletePlaylist(req.params.id, req.user.id);
    if (!result.deleted) return res.status(404).json({ error: 'Playlist not found' });
    res.json({ message: 'Playlist deleted' });
  } catch (error) {
    console.error('Playlist delete error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /playlists/:id/items
router.post('/playlists/:id/items', async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    const playlist = await getPlaylistById(req.params.id, req.user.id);
    if (!playlist) return res.status(404).json({ error: 'Playlist not found' });

    const postId = req.body.post_id;
    const post = await getPostById(postId);
    if (!post || !post.is_published || !userCanAccessPost(user, post)) {
      return res.status(404).json({ error: 'Episode not found' });
    }

    await addPlaylistItem(playlist.id, post.id);
    const items = await getPlaylistItems(playlist.id);
    res.json({ message: 'Added to playlist', items });
  } catch (error) {
    console.error('Playlist add item error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /playlists/:id/items/:postId
router.delete('/playlists/:id/items/:postId', async (req, res) => {
  try {
    const playlist = await getPlaylistById(req.params.id, req.user.id);
    if (!playlist) return res.status(404).json({ error: 'Playlist not found' });

    await removePlaylistItem(playlist.id, req.params.postId);
    const items = await getPlaylistItems(playlist.id);
    res.json({ message: 'Removed from playlist', items });
  } catch (error) {
    console.error('Playlist remove item error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /latest-episode — most recent accessible post + download URL
router.get('/latest-episode', async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { canStream, canDownload } = accessFlags(user);
    const post = await getLatestAccessiblePostForUser(user);
    if (!post) {
      return res.json({ post: null, is_new: false, canStream, canDownload, is_paying: !!user.is_paying });
    }

    const downloadUrl = canDownload
      ? `${BASE_URL}/stream/${post.id}?token=${encodeURIComponent(user.rss_token)}&download=1`
      : null;

    res.json({
      post: mapPost(post),
      download_url: downloadUrl,
      is_paying: !!user.is_paying,
      canStream,
      canDownload
    });
  } catch (error) {
    console.error('Latest episode error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
