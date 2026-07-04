const express = require('express');
const { getPostByShareToken } = require('../database');
const { buildShareOgHtml } = require('../utils/shareOgHtml');

const router = express.Router();

// HTML with Open Graph tags for social crawlers (WhatsApp, iMessage, etc.).
// nginx proxies /shyam_akaash/share/... requests from crawlers here.
router.get('/share/:shareToken', async (req, res) => {
  try {
    const post = await getPostByShareToken(req.params.shareToken);
    if (!post || !post.is_published) {
      return res.status(404).send('Episode not found');
    }

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=300');
    res.send(buildShareOgHtml(post));
  } catch (error) {
    console.error('Share OG preview error:', error);
    res.status(500).send('Internal server error');
  }
});

module.exports = router;
