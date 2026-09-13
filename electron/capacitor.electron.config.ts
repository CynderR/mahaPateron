import { defineConfig } from '@capawesome/capacitor-electron/config';
import { session } from 'electron';

const productionCsp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "media-src 'self' blob: https:",
  "connect-src 'self' https: wss:",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'self'",
  "form-action 'self'"
].join('; ');

const DESKTOP_ORIGIN = 'capacitor-electron://localhost';

const writeHeader = (
  headers: Record<string, string[]>,
  name: string,
  value: string
): void => {
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === name.toLowerCase()) {
      delete headers[key];
    }
  }
  headers[name] = [value];
};

/**
 * Production still echoes Access-Control-Allow-Origin: https://4thstate.ca.
 * The desktop window origin is capacitor-electron://localhost, so Chromium
 * blocks login unless we rewrite the API CORS headers here.
 */
const installDesktopApiCors = (): void => {
  const originsByRequestId = new Map<number, string>();
  const filter = { urls: ['https://4thstate.ca/*'] };

  session.defaultSession.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
    const origin = details.requestHeaders.Origin || details.requestHeaders.origin || DESKTOP_ORIGIN;
    originsByRequestId.set(details.id, origin);
    callback({ requestHeaders: details.requestHeaders });
  });

  session.defaultSession.webRequest.onHeadersReceived(filter, (details, callback) => {
    try {
      const rawOrigin =
        details.initiatorOrigin || originsByRequestId.get(details.id) || DESKTOP_ORIGIN;
      const origin = !rawOrigin || rawOrigin === 'null' ? DESKTOP_ORIGIN : rawOrigin;
      originsByRequestId.delete(details.id);
      const responseHeaders = { ...(details.responseHeaders || {}) };
      writeHeader(responseHeaders, 'Access-Control-Allow-Origin', origin);
      writeHeader(responseHeaders, 'Access-Control-Allow-Credentials', 'true');
      writeHeader(
        responseHeaders,
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, Cache-Control, Pragma'
      );
      writeHeader(
        responseHeaders,
        'Access-Control-Allow-Methods',
        'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS'
      );
      callback({ responseHeaders });
    } catch {
      originsByRequestId.delete(details.id);
      callback({ responseHeaders: details.responseHeaders });
    }
  });
};

export default defineConfig({
  window: {
    width: 1280,
    height: 840,
    minWidth: 880,
    minHeight: 600,
    backgroundColor: '#ffffff'
  },
  csp: {
    policy: productionCsp
  },
  splashScreen: {
    path: 'assets/splash.html',
    width: 400,
    height: 240,
    backgroundColor: '#ffffff'
  },
  hooks: {
    onWindowCreated() {
      installDesktopApiCors();
    }
  }
});
