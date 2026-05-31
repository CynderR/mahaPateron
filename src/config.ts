// Production is served under the /shyam_akaash subpath at 4thstate.ca, so API
// and media requests are prefixed accordingly. In development the React dev
// server talks to the Express backend on port 5000 directly.
const isProd = process.env.NODE_ENV === 'production';

// Base path the React app is mounted at (BrowserRouter basename).
export const ROUTER_BASENAME = isProd ? '/shyam_akaash' : '';

// Axios base URL for the JSON API.
export const API_BASE_URL = isProd ? '/shyam_akaash/api' : 'http://localhost:5000/api';

// Origin used to build absolute media URLs (audio streaming).
export const MEDIA_BASE_URL = isProd ? '/shyam_akaash' : 'http://localhost:5000';

// Build the streaming URL for a post, authenticated with the user's RSS token.
export const buildStreamUrl = (postId: string, rssToken: string): string =>
  `${MEDIA_BASE_URL}/stream/${postId}?token=${encodeURIComponent(rssToken)}`;
