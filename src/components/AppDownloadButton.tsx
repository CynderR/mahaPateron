import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { isNativeApp } from '../native/platform';
import {
  downloadEpisodeToDevice,
  getOfflineEpisode,
  isDownloadInProgress,
  removeOfflineEpisode,
  subscribeDownloadProgress
} from '../native/offlineStorage';
import { canStartDownload } from '../native/appCatalog';
import { parseOfflineUse } from '../utils/appAccess';

interface AppDownloadButtonProps {
  postId: string;
  postTitle: string;
  publishedAt?: string | null;
  durationSecs?: number | null;
  imageFilename?: string | null;
  className?: string;
  compact?: boolean;
}

/**
 * Native-only download / remove control. Website keeps DownloadEpisodeButton.
 */
const AppDownloadButton: React.FC<AppDownloadButtonProps> = ({
  postId,
  postTitle,
  publishedAt,
  durationSecs,
  imageFilename,
  className = '',
  compact = false
}) => {
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isNativeApp()) return;
    let cancelled = false;
    getOfflineEpisode(postId).then((meta) => {
      if (!cancelled) setSaved(!!meta);
    });
    const unsub = subscribeDownloadProgress((id, value) => {
      if (id !== postId) return;
      setProgress(value);
      if (value === 1) setSaved(true);
      if (value === null && isDownloadInProgress(postId)) setBusy(true);
      if (value === null && !isDownloadInProgress(postId)) setBusy(false);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [postId]);

  if (!isNativeApp() || !user?.rss_token) return null;

  const offline = parseOfflineUse(user.offline_use);
  const allowDownload = canStartDownload(user.offline_use, typeof navigator !== 'undefined' ? navigator.onLine : true);

  const handleDownload = async () => {
    setError('');
    setBusy(true);
    try {
      if (!allowDownload && offline.mode === 'false') {
        throw new Error('Connect to the internet and stay signed in to download.');
      }
      await downloadEpisodeToDevice({
        postId,
        title: postTitle,
        published_at: publishedAt,
        duration_secs: durationSecs,
        image_filename: imageFilename,
        rssToken: user.rss_token!
      });
      setSaved(true);
    } catch (err: any) {
      setError(err?.message || 'Download failed');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const handleRemove = async () => {
    setBusy(true);
    setError('');
    try {
      await removeOfflineEpisode(postId);
      setSaved(false);
    } catch (err: any) {
      setError(err?.message || 'Could not remove');
    } finally {
      setBusy(false);
    }
  };

  const label = saved
    ? compact
      ? 'Remove'
      : 'Remove download'
    : busy && progress != null
      ? `${Math.round(progress * 100)}%`
      : busy
        ? 'Downloading…'
        : compact
          ? 'Save'
          : 'Save offline';

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: '0.25rem' }}>
      <button
        type="button"
        className={`pod-btn pod-btn-secondary pod-btn-sm episode-download-btn ${className}`.trim()}
        onClick={() => void (saved ? handleRemove() : handleDownload())}
        disabled={busy || (!saved && !allowDownload)}
        title={saved ? `Remove ${postTitle}` : `Download ${postTitle}`}
      >
        {label}
      </button>
      {error && (
        <span style={{ fontSize: '0.75rem', color: 'var(--danger, #c53030)' }}>{error}</span>
      )}
    </span>
  );
};

export default AppDownloadButton;
