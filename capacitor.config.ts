import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ca.fourthstate.shyamakaash',
  appName: 'Shyam Akaash',
  webDir: 'build',
  server: {
    androidScheme: 'https'
  },
  android: {
    allowMixedContent: false
  },
  plugins: {
    // Native HTTP bypasses WebView CORS. Required while production still echoes
    // only the website origin (https://4thstate.ca) instead of https://localhost.
    CapacitorHttp: {
      enabled: true
    },
    SystemBars: {
      insetsHandling: 'css',
      style: 'LIGHT',
      hidden: false
    }
  }
};

export default config;
