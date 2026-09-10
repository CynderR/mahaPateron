import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isNativeApp } from '../native/platform';
import { fetchAppCatalog, AppCatalogResponse } from '../native/appCatalog';
import { parseOfflineUse } from '../utils/appAccess';

/**
 * Native-only banner showing offline-days remaining / expired state.
 */
const OfflineModeBanner: React.FC = () => {
  const { user, token } = useAuth();
  const [catalog, setCatalog] = useState<AppCatalogResponse | null>(null);

  useEffect(() => {
    if (!isNativeApp() || !token || !user) return;
    let cancelled = false;
    fetchAppCatalog()
      .then((data) => {
        if (!cancelled) setCatalog(data);
      })
      .catch(() => {
        // Offline — fall back to local user fields
      });
    return () => {
      cancelled = true;
    };
  }, [token, user]);

  if (!isNativeApp() || !user) return null;

  const offline = parseOfflineUse(user.offline_use ?? catalog?.offline_use);
  if (offline.mode !== 'days') return null;

  const expired = catalog?.offline_expired === true;
  const daysRemaining = catalog?.offline_days_remaining ?? offline.days;

  return (
    <div
      role="status"
      style={{
        background: expired ? 'rgba(197, 48, 48, 0.12)' : 'rgba(49, 130, 206, 0.12)',
        color: 'var(--text-primary)',
        padding: '0.65rem 1rem',
        fontSize: '0.9rem',
        textAlign: 'center',
        borderBottom: '1px solid var(--border-color, rgba(0,0,0,0.08))'
      }}
    >
      {expired ? (
        <>
          You are in offline mode and your authentication window has expired. Connect to the internet and{' '}
          <Link to="/signin">sign in again</Link> to keep listening.
        </>
      ) : (
        <>
          Offline mode: about <strong>{daysRemaining}</strong> day{daysRemaining === 1 ? '' : 's'} left until you need
          to authenticate again. Manage downloads in <Link to="/downloads">Downloads</Link>.
        </>
      )}
    </div>
  );
};

export default OfflineModeBanner;
