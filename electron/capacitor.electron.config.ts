import { defineConfig } from '@capawesome/capacitor-electron/config';

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

export default defineConfig({
  window: {
    width: 1280,
    height: 840,
    minWidth: 880,
    minHeight: 600,
    backgroundColor: '#ffffff'
  },
  // Electron origin is capacitor-electron://localhost — must stay on the API CORS allowlist.
  csp: {
    policy: productionCsp
  },
  splashScreen: {
    path: 'assets/splash.html',
    width: 400,
    height: 240,
    backgroundColor: '#ffffff'
  }
});
