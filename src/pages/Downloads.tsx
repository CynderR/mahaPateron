import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PodcastNav from '../components/PodcastNav';
import PodcastMobileNav, { PodcastMobileHeader } from '../components/mobile/PodcastMobileNav';
import { PODCAST_AUTHOR } from '../podcastMeta';
import { useAuth } from '../contexts/AuthContext';
import { parseOfflineUse } from '../utils/appAccess';
import {
  clearAllOfflineEpisodes,
  deleteOfflineOlderThanDays,
  formatBytes,
  loadOfflineIndex,
  loadOfflineSettings,
  OfflineDownloadSettings,
  OfflineEpisodeMeta,
  removeOfflineEpisode,
  saveOfflineSettings,
  totalOfflineBytes
} from '../native/offlineStorage';
import {
  AppCatalogResponse,
  fetchAppCatalog,
  runAutoDownloadIfEnabled
} from '../native/appCatalog';
import { isDeviceOffline } from '../native/network';
import { resolveEpisodeImageUrl } from '../native/coverCache';

const Downloads: React.FC = () => {
  const { user } = useAuth();
  const [episodes, setEpisodes] = useState<OfflineEpisodeMeta[]>([]);
  const [bytes, setBytes] = useState(0);
  const [settings, setSettings] = useState<OfflineDownloadSettings>({
    autoDownload: false,
    deleteOlderThanDays: null
  });
  const [ageDays, setAgeDays] = useState('30');
  const [catalog, setCatalog] = useState<AppCatalogResponse | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const index = await loadOfflineIndex();
    const list = Object.values(index).sort((a, b) =>
      String(b.published_at || b.downloaded_at).localeCompare(String(a.published_at || a.downloaded_at))
    );
    setEpisodes(list);
    setBytes(await totalOfflineBytes());
    setSettings(await loadOfflineSettings());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchAppCatalog();
        if (cancelled) return;
        setCatalog(data);
        await runAutoDownloadIfEnabled(data);
        if (!cancelled) await refresh();
      } catch (err: any) {
        if (!cancelled && !isDeviceOffline()) {
          setError(err?.response?.data?.error || err?.message || 'Could not refresh catalog');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const offlineInfo = useMemo(() => parseOfflineUse(user?.offline_use ?? catalog?.offline_use), [
    user?.offline_use,
    catalog?.offline_use
  ]);

  const updateSettings = async (patch: Partial<OfflineDownloadSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    await saveOfflineSettings(next);
  };

  const handleRemove = async (postId: string) => {
    setBusy(true);
    setError('');
    try {
      await removeOfflineEpisode(postId);
      await refresh();
      setMessage('Episode removed from this device.');
    } catch (err: any) {
      setError(err?.message || 'Could not remove episode');
    } finally {
      setBusy(false);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Delete all downloaded episodes from this device?')) return;
    setBusy(true);
    setError('');
    try {
      await clearAllOfflineEpisodes();
      await refresh();
      setMessage('All downloads cleared.');
    } catch (err: any) {
      setError(err?.message || 'Could not clear downloads');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteOlder = async () => {
    const days = Math.max(1, parseInt(ageDays, 10) || 30);
    setBusy(true);
    setError('');
    try {
      const removed = await deleteOfflineOlderThanDays(days);
      await refresh();
      setMessage(removed ? `Removed ${removed} older episode(s).` : 'No older episodes to remove.');
    } catch (err: any) {
      setError(err?.message || 'Could not delete older episodes');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="podcast-page">
      <PodcastNav />
      <PodcastMobileHeader title={PODCAST_AUTHOR} subtitle="Downloads" titleTo="/feed" />
      <main className="pod-main" style={{ paddingBottom: '5rem' }}>
        <h2 className="pod-desktop-only">Downloads</h2>

        {isDeviceOffline() && (
          <div className="pod-banner pod-banner-info" style={{ marginBottom: '1rem' }}>
            You&apos;re offline. Anything saved on this device will still play.
          </div>
        )}

        {catalog?.offline_use && offlineInfo.mode === 'days' && (
          <div className="pod-card" style={{ marginBottom: '1rem' }}>
            {catalog.offline_expired ? (
              <p style={{ margin: 0, color: 'var(--danger, #c53030)' }}>
                Offline window expired. Connect and sign in again to keep listening.
              </p>
            ) : (
              <p style={{ margin: 0 }}>
                Offline mode: about <strong>{catalog.offline_days_remaining ?? offlineInfo.days}</strong> day(s)
                remaining until you need to authenticate again.
              </p>
            )}
          </div>
        )}

        {message && (
          <div className="pod-card" style={{ marginBottom: '1rem' }}>
            {message}
          </div>
        )}
        {error && (
          <div className="pod-card" style={{ marginBottom: '1rem', color: 'var(--danger, #c53030)' }}>
            {error}
          </div>
        )}

        <div className="pod-card" style={{ marginBottom: '1rem' }}>
          <p style={{ marginTop: 0 }}>
            Storage used: <strong>{formatBytes(bytes)}</strong> · {episodes.length} episode
            {episodes.length === 1 ? '' : 's'}
          </p>
          <label className="pod-user-field-inline" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={settings.autoDownload}
              onChange={(e) => void updateSettings({ autoDownload: e.target.checked })}
            />
            <span>Auto-download new episodes when online</span>
          </label>
          {catalog?.episodes_to_keep != null && (
            <p style={{ marginBottom: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Your app catalog is limited to the {catalog.episodes_to_keep} most recent episodes.
            </p>
          )}
        </div>

        <div className="pod-card" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'end' }}>
            <label className="pod-form-group" style={{ marginBottom: 0 }}>
              <span>Delete downloads older than (days)</span>
              <input
                className="pod-input"
                type="number"
                min={1}
                value={ageDays}
                onChange={(e) => setAgeDays(e.target.value)}
                style={{ width: '6rem' }}
              />
            </label>
            <button type="button" className="pod-btn pod-btn-secondary" disabled={busy} onClick={() => void handleDeleteOlder()}>
              Delete older
            </button>
            <button type="button" className="pod-btn pod-btn-danger" disabled={busy || episodes.length === 0} onClick={() => void handleClearAll()}>
              Clear all
            </button>
          </div>
        </div>

        {episodes.length === 0 ? (
          <div className="pod-empty">No downloaded episodes yet. Download from the feed or library.</div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {episodes.map((ep) => {
              const coverUrl = resolveEpisodeImageUrl(ep.postId, ep.image_filename);
              return (
              <li key={ep.postId} className="pod-card" style={{ marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', minWidth: 0 }}>
                    {coverUrl ? (
                      <img
                        src={coverUrl}
                        alt=""
                        style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }}
                      />
                    ) : null}
                    <div>
                    <Link to={`/stream/${encodeURIComponent(ep.postId)}`} style={{ fontWeight: 600 }}>
                      {ep.title}
                    </Link>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      {formatBytes(ep.bytes)}
                      {ep.published_at ? ` · ${String(ep.published_at).slice(0, 10)}` : ''}
                      {` · saved ${String(ep.downloaded_at).slice(0, 10)}`}
                    </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="pod-btn pod-btn-secondary pod-btn-sm"
                    disabled={busy}
                    onClick={() => void handleRemove(ep.postId)}
                  >
                    Remove
                  </button>
                </div>
              </li>
              );
            })}
          </ul>
        )}
      </main>
      <PodcastMobileNav />
    </div>
  );
};

export default Downloads;
