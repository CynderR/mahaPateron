const express = require('express');

const {
  getUserById,
  getPublishedPostsForUser,
  updateUserFields
} = require('../database');
const {
  memberHasAppAccess,
  buildOfflineEntitlement,
  applyEpisodesToKeep
} = require('../utils/appAccess');
const { accessFlags, streamPreviewSeconds } = require('../utils/accessPermissions');

const router = express.Router();

const mapCatalogPost = (p) => ({
  id: p.id,
  title: p.title,
  description: p.description,
  duration_secs: p.duration_secs,
  published_at: p.published_at,
  image_filename: p.image_filename || null,
  audio_filename: p.audio_filename || null
});

// GET /catalog — entitlement + filtered episode list for the native app.
// Also stamps app_last_authenticated_at so the offline-days window advances.
router.get('/catalog', async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!memberHasAppAccess(user)) {
      return res.status(403).json({
        error: 'This account is website-only. Ask an admin for app access.',
        app_access: false
      });
    }

    const nowIso = new Date().toISOString();
    await updateUserFields(user.id, { app_last_authenticated_at: nowIso });
    user.app_last_authenticated_at = nowIso;

    const entitlement = buildOfflineEntitlement(user);
    const allPosts = await getPublishedPostsForUser(user);
    const posts = applyEpisodesToKeep(allPosts, entitlement.episodes_to_keep).map(mapCatalogPost);
    const { canStream, canRss, canDownload } = accessFlags(user);

    res.set('Cache-Control', 'no-store, private');
    res.json({
      ...entitlement,
      is_paying: !!user.is_paying,
      canStream,
      canRss,
      canDownload,
      streamPreviewSeconds: streamPreviewSeconds(user),
      rss_token: user.rss_token || null,
      posts
    });
  } catch (error) {
    console.error('App catalog error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /heartbeat — refresh app auth timestamp without reloading the full catalog.
router.post('/heartbeat', async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!memberHasAppAccess(user)) {
      return res.status(403).json({ error: 'App access required', app_access: false });
    }

    const nowIso = new Date().toISOString();
    await updateUserFields(user.id, { app_last_authenticated_at: nowIso });
    user.app_last_authenticated_at = nowIso;

    res.set('Cache-Control', 'no-store, private');
    res.json(buildOfflineEntitlement(user));
  } catch (error) {
    console.error('App heartbeat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
