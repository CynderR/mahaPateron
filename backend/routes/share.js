const express = require('express');
const {
  getPostByShareToken,
  getPublishedPostsForUser,
  getPostById,
  getLibraryForUserPaginated,
  userCanAccessPost
} = require('../database');
const {
  accessFlags,
  streamPreviewSeconds,
  userHasShareMemberFullAccess,
  userIsNotSubscribed
} = require('../utils/accessPermissions');

const router = express.Router();

const ANONYMOUS_SHARE_ACCESS = {
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

const mapAnchorLibraryEntry = (anchor) => ({
  id: anchor.id,
  title: anchor.title,
  description: anchor.description,
  duration_secs: anchor.duration_secs,
  published_at: anchor.published_at,
  image_filename: anchor.image_filename || null,
  artist: anchor.artist || null,
  album: anchor.album || null,
  year: anchor.year || null,
  genre: anchor.genre || null,
  accessible: true
});

const validateShareAnchor = async (shareToken) => {
  const post = await getPostByShareToken(shareToken);
  if (!post || !post.is_published) return null;
  return post;
};

const shareViewer = (req) => req.authenticatedUser || null;

const memberFullAccess = (user) => userHasShareMemberFullAccess(user);

const memberShareMeta = (user) => {
  const flags = accessFlags(user);
  return {
    member_access: true,
    anchor_post_id: null,
    is_paying: !!user.is_paying,
    back_catalog_access: !!user.back_catalog_access,
    streamPreviewSeconds: streamPreviewSeconds(user),
    ...flags
  };
};

const anonymousShareMeta = (anchor) => ({
  member_access: false,
  anchor_post_id: anchor.id,
  is_paying: false,
  back_catalog_access: false,
  streamPreviewSeconds: null,
  ...ANONYMOUS_SHARE_ACCESS
});

// GET /:shareToken/feed — feed for share viewers (one episode unless signed-in member).
router.get('/:shareToken/feed', async (req, res) => {
  try {
    const anchor = await validateShareAnchor(req.params.shareToken);
    if (!anchor) {
      return res.status(404).json({ error: 'Episode not found' });
    }

    const user = shareViewer(req);
    if (memberFullAccess(user)) {
      const posts = await getPublishedPostsForUser(user);
      return res.json({
        share_token: anchor.share_token,
        ...memberShareMeta(user),
        post: mapPublicPost(anchor),
        posts: posts.map(mapPublicPost)
      });
    }

    const mapped = mapPublicPost(anchor);
    res.json({
      share_token: anchor.share_token,
      ...anonymousShareMeta(anchor),
      post: mapped,
      posts: [mapped]
    });
  } catch (error) {
    console.error('Public share feed error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:shareToken/library — catalog for share viewers.
router.get('/:shareToken/library', async (req, res) => {
  try {
    const anchor = await validateShareAnchor(req.params.shareToken);
    if (!anchor) {
      return res.status(404).json({ error: 'Episode not found' });
    }

    const user = shareViewer(req);
    if (memberFullAccess(user)) {
      const { page, limit, q, sort, dir } = req.query;
      const result = await getLibraryForUserPaginated(user, {
        page,
        limit,
        search: q,
        sortField: sort,
        sortDir: dir
      });
      return res.json({
        share_token: anchor.share_token,
        ...memberShareMeta(user),
        total: result.total,
        catalogTotal: result.catalogTotal,
        accessible: result.accessible,
        page: result.page,
        limit: result.limit,
        entries: result.entries
      });
    }

    const entry = mapAnchorLibraryEntry(anchor);
    res.json({
      share_token: anchor.share_token,
      ...anonymousShareMeta(anchor),
      total: 1,
      catalogTotal: 1,
      accessible: 1,
      page: 1,
      limit: 1,
      entries: [entry]
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

    const user = shareViewer(req);
    if (memberFullAccess(user)) {
      const post = await getPostById(req.params.id);
      if (!post || !post.is_published) {
        return res.status(404).json({ error: 'Episode not found' });
      }
      const flags = accessFlags(user);
      const accessible = userIsNotSubscribed(user) || userCanAccessPost(user, post);
      return res.json({
        share_token: anchor.share_token,
        ...memberShareMeta(user),
        accessible,
        post: mapPublicPost(post)
      });
    }

    if (req.params.id !== anchor.id) {
      return res.status(403).json({ error: 'This share link only includes the shared episode' });
    }

    res.json({
      share_token: anchor.share_token,
      ...anonymousShareMeta(anchor),
      accessible: true,
      post: mapPublicPost(anchor)
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

    const user = shareViewer(req);
    if (memberFullAccess(user)) {
      const posts = await getPublishedPostsForUser(user);
      return res.json({
        share_token: anchor.share_token,
        ...memberShareMeta(user),
        post: mapPublicPost(anchor),
        posts: posts.map(mapPublicPost)
      });
    }

    const mapped = mapPublicPost(anchor);
    res.json({
      share_token: anchor.share_token,
      ...anonymousShareMeta(anchor),
      post: mapped,
      posts: [mapped]
    });
  } catch (error) {
    console.error('Public share error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
