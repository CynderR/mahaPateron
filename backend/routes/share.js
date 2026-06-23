const express = require('express');
const { getPostByShareToken, getPublishedPosts } = require('../database');

const router = express.Router();

const mapPublicPost = (post) => ({
  id: post.id,
  title: post.title,
  description: post.description,
  duration_secs: post.duration_secs,
  published_at: post.published_at,
  image_filename: post.image_filename || null
});

// GET /:shareToken — public episode metadata for a share link (no login required).
router.get('/:shareToken', async (req, res) => {
  try {
    const post = await getPostByShareToken(req.params.shareToken);
    if (!post || !post.is_published) {
      return res.status(404).json({ error: 'Episode not found' });
    }

    res.json({
      share_token: post.share_token,
      access: {
        canStream: true,
        canRss: false,
        canDownload: false
      },
      post: mapPublicPost(post),
      posts: (await getPublishedPosts()).map(mapPublicPost)
    });
  } catch (error) {
    console.error('Public share error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
