// Public URL / API paths. In production builds these come from REACT_APP_BASE_PATH
// (and PUBLIC_URL for static assets). Local `npm start` talks to the Express
// backend on localhost unless REACT_APP_API_ORIGIN is set.
import { slugifyPostTitle } from './utils/shareLinkHelpers';

const isProd = process.env.NODE_ENV === 'production';

const normalizeBasePath = (value: string | undefined): string => {
  const trimmed = String(value || '').trim().replace(/\/$/, '');
  if (!trimmed || trimmed === '/') return '';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
};

// CRA injects PUBLIC_URL from homepage / PUBLIC_URL env at build time.
const fromEnv = normalizeBasePath(
  process.env.REACT_APP_BASE_PATH || process.env.PUBLIC_URL
);

// Production default keeps current live path when env is unset.
export const ROUTER_BASENAME = isProd ? fromEnv || '/shyam_akaash' : fromEnv;

const apiOrigin = String(process.env.REACT_APP_API_ORIGIN || '')
  .trim()
  .replace(/\/$/, '');

// Axios base URL for the JSON API.
// When REACT_APP_API_ORIGIN is set (native Capacitor builds), always use it —
// including production — so the WebView can reach the hosted backend.
// Website production builds leave REACT_APP_API_ORIGIN unset and keep relative paths.
export const API_BASE_URL = apiOrigin
  ? `${apiOrigin}/api`
  : isProd
    ? `${ROUTER_BASENAME}/api`
    : 'http://localhost:5000/api';

// Origin used to build absolute media URLs (audio streaming).
export const MEDIA_BASE_URL = apiOrigin
  ? apiOrigin
  : isProd
    ? ROUTER_BASENAME
    : 'http://localhost:5000';

// Public origin for RSS feed URLs (must match backend BASE_URL in production).
export const buildRssBaseUrl = (): string => {
  if (apiOrigin) return apiOrigin;
  if (isProd) {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return `${window.location.origin}${ROUTER_BASENAME}`;
    }
    return `https://4thstate.ca${ROUTER_BASENAME || '/shyam_akaash'}`;
  }
  return 'http://localhost:5000';
};

export const buildRssUrl = (token: string): string =>
  `${buildRssBaseUrl()}/rss/${encodeURIComponent(token)}`;

export const rssTokenFromUrl = (url: string): string | null =>
  url.match(/\/rss\/([^/?#]+)/)?.[1] ?? null;

// Build the streaming URL for a post, authenticated with the user's RSS token.
// JWT is sent via Authorization header in fetch-based playback; it is not
// appended to the URL to avoid leaking session tokens in logs and history.
export const buildStreamUrl = (postId: string, rssToken: string): string => {
  const params = new URLSearchParams({ token: rssToken });
  const path = `${MEDIA_BASE_URL}/stream/${postId}?${params.toString()}`;
  if (path.startsWith('http')) return path;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${path}`;
  }
  return path;
};

export const buildDownloadUrl = (postId: string, rssToken: string): string =>
  `${buildStreamUrl(postId, rssToken)}&download=1`;

/** Native app offline download URL (requires app_access; bypasses website download_access). */
export const buildAppDownloadUrl = (postId: string, rssToken: string): string =>
  `${buildStreamUrl(postId, rssToken)}&download=1&app=1`;

// Cover art is served publicly from the backend uploads directory.
export const buildImageUrl = (filename: string): string =>
  `${MEDIA_BASE_URL}/uploads/images/${encodeURIComponent(filename)}`;

// Member-facing URL for an episode (opens the stream page from the feed).
export const buildMemberFeedPostUrl = (postId: string): string => {
  const path = `${ROUTER_BASENAME}/stream/${encodeURIComponent(postId)}`;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${path}`;
  }
  return path;
};

// Public share URL — works without login when the episode is published.
export const buildPublicSharePostUrl = (shareToken: string, title?: string): string => {
  const slug = title ? slugifyPostTitle(title) : null;
  const path = slug
    ? `${ROUTER_BASENAME}/share/${encodeURIComponent(slug)}/${encodeURIComponent(shareToken)}`
    : `${ROUTER_BASENAME}/share/${encodeURIComponent(shareToken)}`;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${path}`;
  }
  return path;
};

export const buildPublicShareStreamUrl = (postId: string, shareToken: string): string => {
  const params = new URLSearchParams({ share: shareToken });
  const path = `${MEDIA_BASE_URL}/stream/${encodeURIComponent(postId)}?${params.toString()}`;
  if (path.startsWith('http')) return path;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${path}`;
  }
  return path;
};

export const buildSignInUrl = (): string => {
  const path = `${ROUTER_BASENAME}/signin`;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${path}`;
  }
  return `https://4thstate.ca${path || '/signin'}`;
};
