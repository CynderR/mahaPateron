const fs = require('fs');
const path = require('path');
const { BASE_URL } = require('../config');
const { escapeHtml } = require('./escapeHtml');
const { getPodcastChannelImageUrl } = require('./podcastBranding');
const { ensureShareOgImageFilename } = require('./shareOgImage');

const SITE_NAME = process.env.PODCAST_TITLE || 'Shyam Akaash';

const FRONTEND_INDEX =
  process.env.FRONTEND_INDEX ||
  path.join(__dirname, '..', '..', 'build', 'index.html');

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

const buildShareImageUrl = (imageFilename) => {
  if (imageFilename) {
    return `${BASE_URL}/uploads/images/${encodeURIComponent(imageFilename)}`;
  }
  return getPodcastChannelImageUrl() || `${BASE_URL}/podcast-cover.jpg`;
};

const truncateDescription = (text, maxLen = 200) => {
  const trimmed = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!trimmed) return '';
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen - 1).trim()}…`;
};

const buildOgMetaTags = (post, imageFilename) => {
  const episodeTitle = String(post.title || 'Episode').trim();
  const pageUrl = buildSharePageUrl(post);
  const imageUrl = buildShareImageUrl(imageFilename);
  // Signal/WhatsApp: title = episode name; description falls back to site name.
  const description = truncateDescription(post.description) || SITE_NAME;

  return {
    episodeTitle,
    pageUrl,
    imageUrl,
    description,
    // Keep OG tags contiguous and early — Signal stops parsing at <script>.
    tags: `<title>${escapeHtml(episodeTitle)} — ${escapeHtml(SITE_NAME)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${escapeHtml(SITE_NAME)}">
  <meta property="og:title" content="${escapeHtml(episodeTitle)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(pageUrl)}">
  <meta property="og:image" content="${escapeHtml(imageUrl)}">
  <meta property="og:image:secure_url" content="${escapeHtml(imageUrl)}">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:alt" content="${escapeHtml(episodeTitle)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(episodeTitle)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(imageUrl)}">
  <link rel="canonical" href="${escapeHtml(pageUrl)}">`,
  };
};

const buildStandaloneOgHtml = ({ episodeTitle, pageUrl, description, tags }) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  ${tags}
</head>
<body>
  <p><a href="${escapeHtml(pageUrl)}">${escapeHtml(episodeTitle)}</a> — ${escapeHtml(SITE_NAME)}</p>
  <p>${escapeHtml(description)}</p>
</body>
</html>`;

const injectOgIntoSpaHtml = (html, tags) => {
  let next = html;
  next = next.replace(/<title>[^<]*<\/title>/i, '');
  next = next.replace(/<meta\s+name=["']description["'][^>]*>/i, '');

  // Prefer: right after charset (still before any <script>).
  if (/<meta\s+charset=["'][^"']+["']\s*\/?>/i.test(next)) {
    return next.replace(
      /(<meta\s+charset=["'][^"']+["']\s*\/?>)/i,
      `$1\n  ${tags}`
    );
  }

  // Fallback: immediately after <head>.
  if (/<head[^>]*>/i.test(next)) {
    return next.replace(/<head[^>]*>/i, (open) => `${open}\n  ${tags}`);
  }

  return null;
};

// Prefer the built SPA shell so browsers still get the app while crawlers
// (Signal, WhatsApp, iMessage) see Open Graph tags without User-Agent sniffing.
const buildShareOgHtml = async (post) => {
  // Always prefer this post's cover. Compression may substitute og-*.jpg for
  // Signal's 1MB limit; never fall back to channel artwork when a cover exists.
  let ogImageFilename = post.image_filename || null;
  try {
    const ensured = await ensureShareOgImageFilename(post.image_filename);
    if (ensured) ogImageFilename = ensured;
  } catch (error) {
    console.warn('Share OG: cover resolve failed, using post image_filename:', error.message);
  }

  const og = buildOgMetaTags(post, ogImageFilename);

  try {
    if (fs.existsSync(FRONTEND_INDEX)) {
      const html = fs.readFileSync(FRONTEND_INDEX, 'utf8');
      const injected = injectOgIntoSpaHtml(html, og.tags);
      if (injected) return injected;
    }
  } catch (error) {
    console.warn('Share OG: could not inject into SPA index.html:', error.message);
  }

  return buildStandaloneOgHtml(og);
};

module.exports = {
  buildShareOgHtml,
  buildSharePageUrl,
  buildShareImageUrl,
  slugifyPostTitle,
};
