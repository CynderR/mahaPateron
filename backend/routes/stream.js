const express = require('express');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');

const { AUDIO_DIR } = require('../config');
const { JWT_SECRET } = require('../middleware/authenticateToken');
const { getUserByRssToken, getUserById, getPostById, getPostByShareToken, logStreamEvent, userCanAccessPost } = require('../database');

const router = express.Router();

// Resolve the requesting user from either the RSS token query param (podcast
// apps) or the JWT Bearer token / token query param (browser player).
const resolveUser = async (req) => {
  const rssToken = req.query.token;
  if (rssToken) {
    const byRss = await getUserByRssToken(rssToken);
    if (byRss) return byRss;
  }

  const authHeader = req.headers['authorization'];
  const jwtToken = (authHeader && authHeader.split(' ')[1]) || req.query.jwt;
  if (jwtToken) {
    try {
      const decoded = jwt.verify(jwtToken, JWT_SECRET);
      const user = await getUserById(decoded.id);
      if (user && !user.deleted_at) return user;
    } catch (e) {
      // fall through to unauthorized
    }
  }
  return null;
};

// GET /:postId — stream audio with HTTP range support.
router.get('/:postId', async (req, res) => {
  try {
    const shareToken = req.query.share;
    let user = null;
    let post = null;
    let streamUserId = null;

    if (shareToken) {
      const anchor = await getPostByShareToken(String(shareToken));
      if (!anchor || !anchor.is_published) {
        return res.status(404).json({ error: 'Episode not found' });
      }
      post = await getPostById(req.params.postId);
      if (!post || !post.is_published) {
        return res.status(404).json({ error: 'Episode not found' });
      }
    } else {
      user = await resolveUser(req);
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      if (!user.is_paying) {
        return res.status(403).json({ error: 'Subscription inactive' });
      }
      const streamingAllowed = user.access_type === 'streaming' || user.access_type === 'both';
      if (!streamingAllowed) {
        return res.status(403).json({ error: 'Your plan does not include streaming access' });
      }

      post = await getPostById(req.params.postId);
      if (!post || !post.is_published) {
        return res.status(404).json({ error: 'Episode not found' });
      }
      if (!userCanAccessPost(user, post)) {
        return res.status(403).json({ error: 'This episode is not included in your subscription' });
      }
      streamUserId = user.id;
    }

    const safeFilename = path.basename(String(post.audio_filename || ''));
    if (!safeFilename || safeFilename !== post.audio_filename) {
      return res.status(404).json({ error: 'Audio file missing' });
    }

    const filePath = path.join(AUDIO_DIR, safeFilename);
    let stat;
    try {
      stat = fs.statSync(filePath);
    } catch (e) {
      return res.status(404).json({ error: 'Audio file missing' });
    }

    const fileSize = stat.size;
    const range = req.headers.range;

    res.set('Accept-Ranges', 'bytes');
    res.set('Content-Type', 'audio/mpeg');

    if (req.query.download === '1') {
      const safeTitle = String(post.title || 'episode')
        .replace(/[^\w\s.-]+/g, '')
        .trim()
        .slice(0, 120) || 'episode';
      res.set('Content-Disposition', `attachment; filename="${safeTitle}.mp3"`);
    }

    if (range) {
      const match = /bytes=(\d*)-(\d*)/.exec(range);
      const start = match && match[1] ? parseInt(match[1], 10) : 0;
      const end = match && match[2] ? parseInt(match[2], 10) : fileSize - 1;

      if (Number.isNaN(start) || start >= fileSize || end >= fileSize || start > end) {
        res.status(416).set('Content-Range', `bytes */${fileSize}`);
        return res.end();
      }

      const chunkSize = end - start + 1;
      res.status(206);
      res.set('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.set('Content-Length', chunkSize);

      logStreamEvent({ post_id: post.id, user_id: streamUserId, bytes_sent: chunkSize }).catch(() => {});

      const stream = fs.createReadStream(filePath, { start, end });
      stream.on('error', () => res.destroy());
      return stream.pipe(res);
    }

    res.status(200);
    res.set('Content-Length', fileSize);
    logStreamEvent({ post_id: post.id, user_id: streamUserId, bytes_sent: fileSize }).catch(() => {});

    const stream = fs.createReadStream(filePath);
    stream.on('error', () => res.destroy());
    return stream.pipe(res);
  } catch (error) {
    console.error('Stream error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

module.exports = router;
