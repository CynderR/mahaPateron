const express = require('express');
const path = require('path');
const fs = require('fs');

const { BASE_URL, AUDIO_DIR } = require('../config');
const { getUserByRssToken, getPublishedPostsForUser, getPostByShareToken } = require('../database');
const {
  ensurePodcastChannelArt,
  getPodcastChannelImageUrl,
  buildEpisodeImageUrl
} = require('../utils/podcastBranding');

const router = express.Router();

const PODCAST_TITLE = process.env.PODCAST_TITLE || 'Shyam Akaash';
const PODCAST_AUTHOR = process.env.PODCAST_AUTHOR || 'Shyam Akaash';
const PODCAST_DESCRIPTION =
  process.env.PODCAST_DESCRIPTION || 'Members-only audio from Shyam Akaash.';
const PODCAST_EMAIL = process.env.PODCAST_EMAIL || 'podcast@4thstate.ca';

ensurePodcastChannelArt();

const escapeXml = (value) => {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

const formatDuration = (secs) => {
  if (!secs && secs !== 0) return '';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

const audioByteLength = (filename) => {
  try {
    const safeName = path.basename(String(filename || ''));
    if (!safeName || safeName !== filename) return 0;
    return fs.statSync(path.join(AUDIO_DIR, safeName)).size;
  } catch (e) {
    return 0;
  }
};

const buildChannelImageXml = (channelImageUrl) => {
  if (!channelImageUrl) return '';

  return `    <image>
      <url>${escapeXml(channelImageUrl)}</url>
      <title>${escapeXml(PODCAST_TITLE)}</title>
      <link>${escapeXml(BASE_URL)}</link>
    </image>
    <itunes:image href="${escapeXml(channelImageUrl)}" />
    <media:thumbnail url="${escapeXml(channelImageUrl)}" />`;
};

const buildItem = (post, token, channelImageUrl) => {
  const streamUrl = `${BASE_URL}/stream/${post.id}?token=${token}`;
  const pubDate = new Date(post.published_at || Date.now()).toUTCString();
  const length = audioByteLength(post.audio_filename);
  const imageUrl = buildEpisodeImageUrl(post.image_filename, channelImageUrl);
  const summary = post.description || '';
  const encodedDescription = imageUrl
    ? `<![CDATA[<p><img src="${imageUrl.replace(/]]>/g, ']]]]><![CDATA[>')}" alt="${escapeXml(post.title)}" /></p>${summary.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`
    : escapeXml(summary);

  return `    <item>
      <title>${escapeXml(post.title)}</title>
      <description>${encodedDescription}</description>
      <content:encoded>${encodedDescription}</content:encoded>
      <itunes:summary>${escapeXml(summary)}</itunes:summary>
      <itunes:title>${escapeXml(post.title)}</itunes:title>
      <itunes:episodeType>full</itunes:episodeType>
      <guid isPermaLink="false">${escapeXml(post.id)}</guid>
      <pubDate>${pubDate}</pubDate>
      <enclosure url="${escapeXml(streamUrl)}" length="${length}" type="audio/mpeg" />
      ${post.duration_secs != null ? `<itunes:duration>${formatDuration(post.duration_secs)}</itunes:duration>` : ''}
      ${imageUrl ? `<itunes:image href="${escapeXml(imageUrl)}" />` : ''}
    </item>`;
};

const buildFeed = ({ description, items, feedUrl }) => {
  const channelImageUrl = getPodcastChannelImageUrl();
  const channelImageXml = buildChannelImageXml(channelImageUrl);
  const selfLink = feedUrl
    ? `    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />\n`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:media="http://search.yahoo.com/mrss/"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(PODCAST_TITLE)}</title>
    <link>${escapeXml(BASE_URL)}</link>
${selfLink}${channelImageXml}
    <language>en-us</language>
    <description>${escapeXml(description)}</description>
    <itunes:author>${escapeXml(PODCAST_AUTHOR)}</itunes:author>
    <itunes:summary>${escapeXml(description)}</itunes:summary>
    <itunes:type>episodic</itunes:type>
    <itunes:explicit>no</itunes:explicit>
    <itunes:owner>
      <itunes:name>${escapeXml(PODCAST_AUTHOR)}</itunes:name>
      <itunes:email>${escapeXml(PODCAST_EMAIL)}</itunes:email>
    </itunes:owner>
${items}
  </channel>
</rss>`;
};

// GET /:token — personal RSS feed. Always returns a valid feed at a stable URL.
router.get('/:token', async (req, res) => {
  try {
    // Post share tokens must not work as RSS feed URLs.
    const sharedPost = await getPostByShareToken(req.params.token);
    if (sharedPost) {
      return res.status(404).json({ error: 'Feed not found' });
    }

    const user = await getUserByRssToken(req.params.token);

    // Unknown token is the only 404 — podcast apps need a consistent URL once
    // the feed exists, so inactive subscribers still get a valid (empty) feed.
    if (!user) {
      return res.status(404).json({ error: 'Feed not found' });
    }

    res.set('Content-Type', 'application/rss+xml; charset=utf-8');
    res.set('Cache-Control', 'no-cache');

    const channelImageUrl = getPodcastChannelImageUrl();
    const feedUrl = `${BASE_URL}/rss/${req.params.token}`;
    const rssAllowed = user.access_type === 'rss' || user.access_type === 'both';

    if (!user.is_paying || !rssAllowed) {
      const reason = !user.is_paying
        ? 'Your subscription is inactive. Reactivate it to receive new episodes.'
        : 'Your plan does not include RSS access.';
      return res.send(buildFeed({
        description: `${PODCAST_DESCRIPTION} ${reason}`,
        items: '',
        feedUrl
      }));
    }

    const posts = await getPublishedPostsForUser(user);
    const items = posts
      .map((post) => buildItem(post, req.params.token, channelImageUrl))
      .join('\n');
    res.send(buildFeed({ description: PODCAST_DESCRIPTION, items, feedUrl }));
  } catch (error) {
    console.error('RSS feed error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
