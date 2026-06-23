// Production is served under the /shyam_akaash subpath at 4thstate.ca, so API
// and media requests are prefixed accordingly. In development the React dev
// server talks to the Express backend on port 5000 directly.
import { slugifyPostTitle } from './utils/shareLinkHelpers';

const isProd = process.env.NODE_ENV === 'production';

// Base path the React app is mounted at (BrowserRouter basename).
export const ROUTER_BASENAME = isProd ? '/shyam_akaash' : '';

// Axios base URL for the JSON API.
export const API_BASE_URL = isProd ? '/shyam_akaash/api' : 'http://localhost:5000/api';

// Origin used to build absolute media URLs (audio streaming).
export const MEDIA_BASE_URL = isProd ? '/shyam_akaash' : 'http://localhost:5000';

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
