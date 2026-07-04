const { BASE_URL } = require('../config');
const { escapeHtml } = require('./escapeHtml');
const { getPodcastChannelImageUrl } = require('./podcastBranding');

const SITE_NAME = process.env.PODCAST_TITLE || 'Shyam Akaash';

const slugifyPostTitle = (title) => {
  const slug = String(title || '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return slug || 'episode';
};

const buildSharePageUrl = (post) => {
  const slug = slugifyPostTitle(post.title);
  return `${BASE_URL}/share/${encodeURIComponent(slug)}/${encodeURIComponent(post.share_token)}`;
};

const buildShareImageUrl = (post) => {
  if (post.image_filename) {
    return `${BASE_URL}/uploads/images/${encodeURIComponent(post.image_filename)}`;
  }
  return getPodcastChannelImageUrl() || `${BASE_URL}/podcast-cover.jpg`;
};

const truncateDescription = (text, maxLen = 200) => {
  const trimmed = String(text || '').trim();
  if (!trimmed) return '';
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen - 1).trim()}…`;
};

const buildShareOgHtml = (post) => {
  const episodeTitle = String(post.title || 'Episode').trim();
  const pageUrl = buildSharePageUrl(post);
  const imageUrl = buildShareImageUrl(post);
  // WhatsApp: title = episode name, subtitle = site name (not duplicate site title).
  const description = truncateDescription(post.description) || SITE_NAME;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(episodeTitle)} — ${escapeHtml(SITE_NAME)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${escapeHtml(SITE_NAME)}">
  <meta property="og:title" content="${escapeHtml(episodeTitle)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(pageUrl)}">
  <meta property="og:image" content="${escapeHtml(imageUrl)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(episodeTitle)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(imageUrl)}">
  <link rel="canonical" href="${escapeHtml(pageUrl)}">
</head>
<body>
  <p><a href="${escapeHtml(pageUrl)}">${escapeHtml(episodeTitle)}</a> — ${escapeHtml(SITE_NAME)}</p>
</body>
</html>`;
};

module.exports = {
  buildShareOgHtml,
  buildSharePageUrl,
  buildShareImageUrl,
  slugifyPostTitle,
};
