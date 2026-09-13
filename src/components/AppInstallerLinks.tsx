import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ANDROID_APP_DOWNLOAD_URL, DESKTOP_APP_DOWNLOAD_URL } from '../config';
import { isNativeApp } from '../native/platform';
import { memberHasAppAccess } from '../utils/appAccess';

/** Website-only installer shortcuts. Hidden in the native shells and for website-only accounts. */
const AppInstallerLinks: React.FC = () => {
  const { user } = useAuth();

  if (isNativeApp() || !memberHasAppAccess(user?.app_access)) {
    return null;
  }

  return (
    <div className="app-installer-links" role="group" aria-label="Download the app">
      <a
        className="app-installer-link"
        href={ANDROID_APP_DOWNLOAD_URL}
        download="shyam-akaash.apk"
        title="Get the Android app"
        aria-label="Get the Android app"
      >
        <svg viewBox="0 0 24 24" aria-hidden>
          <path
            fill="currentColor"
            d="M17.6 9.48l1.63-2.82a.5.5 0 10-.87-.5l-1.66 2.87A7.3 7.3 0 0012 8c-1.4 0-2.7.4-3.8 1.03L6.54 6.16a.5.5 0 10-.87.5l1.63 2.82A6.96 6.96 0 005 14.5V21a1 1 0 001 1h3v-5h6v5h3a1 1 0 001-1v-6.5c0-1.9-.76-3.63-2-4.92zM9 13.25a1 1 0 110-2 1 1 0 010 2zm6 0a1 1 0 110-2 1 1 0 010 2z"
          />
        </svg>
      </a>
      <a
        className="app-installer-link"
        href={DESKTOP_APP_DOWNLOAD_URL}
        download="shyam-akaash-setup.exe"
        title="Download the desktop program"
        aria-label="Download the desktop program"
      >
        <svg viewBox="0 0 24 24" aria-hidden>
          <path
            fill="currentColor"
            d="M4 5h16a1 1 0 011 1v10a1 1 0 01-1 1h-5v1h2v2H8v-2h2v-1H4a1 1 0 01-1-1V6a1 1 0 011-1zm1 2v8h14V7H5z"
          />
        </svg>
      </a>
    </div>
  );
};

export default AppInstallerLinks;
