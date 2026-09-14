import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { PlaylistSummary } from '../contexts/PlayerContext';
import { canStartDownload } from '../native/appCatalog';
import {
  downloadEpisodeToDevice,
  loadOfflineIndex
} from '../native/offlineStorage';
import { isNativeApp } from '../native/platform';

interface PlaylistDownloadAllButtonProps {
  items: PlaylistSummary['items'];
}

const PlaylistDownloadAllButton: React.FC<PlaylistDownloadAllButtonProps> = ({ items }) => {
  const { user } = useAuth();
  const [savedCount, setSavedCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isNativeApp()) return;
    let cancelled = false;
    loadOfflineIndex().then((index) => {
      if (cancelled) return;
      setSavedCount(items.filter((item) => index[item.post_id]).length);
    });
    return () => {
      cancelled = true;
    };
  }, [items]);

  if (!isNativeApp() || !user?.rss_token) return null;

  const total = items.length;
  const allSaved = total > 0 && savedCount >= total;
  const allowDownload = canStartDownload(
    user.offline_use,
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  const handleDownloadAll = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!user.rss_token || total === 0 || allSaved) return;

    setError('');
    setBusy(true);
    setDone(0);
    let failed = 0;
    let firstError = '';
    try {
      const index = await loadOfflineIndex();
      let processed = 0;
      for (const item of items) {
        if (!index[item.post_id]) {
          try {
            const meta = await downloadEpisodeToDevice({
              postId: item.post_id,
              title: item.title,
              published_at: item.published_at,
              duration_secs: item.duration_secs,
              image_filename: item.image_filename,
              rssToken: user.rss_token
            });
            index[item.post_id] = meta;
          } catch (err: any) {
            failed += 1;
            if (!firstError) {
              firstError = err?.message || 'Download failed';
              console.error('Playlist download failed', item.post_id, err);
            }
            const sharedFailure =
              /download access|Authentication required|Subscription inactive|Failed to fetch|Cannot reach|only available in the app/i.test(
                firstError
              );
            if (sharedFailure) {
              failed += items.length - processed - 1;
              break;
            }
          }
        }
        processed += 1;
        setSavedCount(items.filter((row) => index[row.post_id]).length);
        setDone(processed);
      }
      if (failed > 0) {
        setError(
          firstError
            ? `Saved ${total - failed} of ${total}. ${failed} failed. ${firstError}`
            : `Saved ${total - failed} of ${total}. ${failed} failed.`
        );
      }
    } catch (err: any) {
      setError(err?.message || 'Download failed');
    } finally {
      setBusy(false);
    }
  };

  const label = allSaved
    ? 'Saved offline'
    : busy
      ? `Downloading ${Math.min(done + 1, total)}/${total}`
      : savedCount > 0
        ? `Download rest (${total - savedCount})`
        : 'Download all';

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: '0.25rem' }}>
      <button
        type="button"
        className="pod-btn pod-btn-secondary pod-btn-sm"
        disabled={busy || total === 0 || allSaved || !allowDownload}
        onClick={(event) => void handleDownloadAll(event)}
        title="Save this playlist for offline playback"
      >
        {label}
      </button>
      {error && (
        <span style={{ fontSize: '0.75rem', color: 'var(--danger, #c53030)' }}>{error}</span>
      )}
    </span>
  );
};

export default PlaylistDownloadAllButton;
