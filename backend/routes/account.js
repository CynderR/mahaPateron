const express = require('express');

const { BASE_URL } = require('../config');
const {
  getUserById,
  getUserByEmail,
  getUserByUsername,
  getPublishedPosts,
  updateUserFields,
  softDeleteUser
} = require('../database');

const router = express.Router();

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const stripe = STRIPE_SECRET_KEY ? require('stripe')(STRIPE_SECRET_KEY) : null;

const accessFlags = (user) => ({
  canRss: user.access_type === 'rss' || user.access_type === 'both',
  canStream: user.access_type === 'streaming' || user.access_type === 'both'
});

// GET /feed — published episodes plus the viewer's access flags.
router.get('/feed', async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const posts = await getPublishedPosts();
    const { canStream, canRss } = accessFlags(user);

    res.json({
      is_paying: !!user.is_paying,
      canStream,
      canRss,
      posts: posts.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        duration_secs: p.duration_secs,
        published_at: p.published_at,
        image_filename: p.image_filename || null
      }))
    });
  } catch (error) {
    console.error('Account feed error:', error);
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
    const { username, email, whatsapp_id, signal_id } = req.body;
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
    if (whatsapp_id !== undefined) data.whatsapp_id = whatsapp_id;
    if (signal_id !== undefined) data.signal_id = signal_id;

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

    if (stripe && user.stripe_sub_id) {
      try {
        await stripe.subscriptions.cancel(user.stripe_sub_id);
      } catch (e) {
        console.warn('Stripe cancel during account deletion failed:', e.message);
      }
    }

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
