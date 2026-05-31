const express = require('express');

const {
  getUserStats,
  countPosts,
  getStreamStats,
  getPlatformSettings,
  updatePlatformSettings
} = require('../database');

const router = express.Router();

// GET /stats — dashboard summary cards.
router.get('/stats', async (req, res) => {
  try {
    const [userStats, postCount, streamStats, settings] = await Promise.all([
      getUserStats(),
      countPosts(),
      getStreamStats(),
      getPlatformSettings()
    ]);

    const defaultPrice = (settings && settings.default_price) || 0;
    // MRR = sum of override prices for paying users + default price for paying
    // users without an override.
    const mrr = (userStats.paying_override_sum || 0) +
      (userStats.paying_default_count || 0) * defaultPrice;

    res.json({
      totalUsers: userStats.total || 0,
      payingUsers: userStats.paying || 0,
      freeUsers: userStats.free || 0,
      mrr: Number(mrr.toFixed(2)),
      totalPosts: postCount || 0,
      totalStreams: streamStats.total_streams || 0,
      totalStreamHours: Number(((streamStats.total_duration_secs || 0) / 3600).toFixed(1))
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /settings — platform configuration (secret is masked).
router.get('/settings', async (req, res) => {
  try {
    const settings = await getPlatformSettings();
    res.json({
      default_price: settings ? settings.default_price : null,
      stripe_price_id: settings ? settings.stripe_price_id : null,
      has_webhook_secret: !!(settings && settings.stripe_webhook_secret)
    });
  } catch (error) {
    console.error('Admin get settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /settings — update platform configuration.
router.put('/settings', async (req, res) => {
  try {
    const { default_price, stripe_price_id, stripe_webhook_secret } = req.body;
    const data = {};
    if (default_price !== undefined && default_price !== '') data.default_price = parseFloat(default_price);
    if (stripe_price_id !== undefined) data.stripe_price_id = stripe_price_id;
    if (stripe_webhook_secret !== undefined && stripe_webhook_secret !== '') {
      data.stripe_webhook_secret = stripe_webhook_secret;
    }
    await updatePlatformSettings(data);
    res.json({ message: 'Settings updated' });
  } catch (error) {
    console.error('Admin update settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
