import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { PODCAST_AUTHOR } from '../podcastMeta';
import { buildSignInUrl } from '../config';
import { isNativeApp } from '../native/platform';

/**
 * Shown when a member signs into the native app but does not have app_access.
 * Website accounts without the entitlement stay on the web.
 */
const AppAccessDenied: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/signin', { replace: true });
  };

  const websiteUrl = isNativeApp()
    ? 'https://4thstate.ca/shyam_akaash'
    : buildSignInUrl().replace(/\/signin$/, '');

  return (
    <div className="podcast-page" style={{ padding: '2rem 1.25rem', maxWidth: 480, margin: '0 auto' }}>
      <h1 className="podcast-brand" style={{ marginBottom: '1rem' }}>
        {PODCAST_AUTHOR}
      </h1>
      <div className="pod-card">
        <h2 style={{ marginTop: 0 }}>Website-only account</h2>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {user?.email ? (
            <>
              <strong>{user.email}</strong> can use the website, but this account has not been granted access to the
              app.
            </>
          ) : (
            <>This account has not been granted access to the app.</>
          )}
        </p>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Continue on the website, or ask an admin to enable <em>App access</em> for your account.
        </p>
        <p style={{ fontSize: '0.9rem', wordBreak: 'break-all' }}>
          Website: <a href={websiteUrl}>{websiteUrl}</a>
        </p>
        <button type="button" className="pod-btn" onClick={handleLogout}>
          Sign out
        </button>
      </div>
    </div>
  );
};

export default AppAccessDenied;
