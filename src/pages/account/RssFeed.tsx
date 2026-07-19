import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import PodcastNav from '../../components/PodcastNav';
import PodcastMobileNav, { PodcastMobileHeader } from '../../components/mobile/PodcastMobileNav';
import RssCopyWidget from '../../components/RssCopyWidget';
import { useAuth } from '../../contexts/AuthContext';
import { buildRssUrl, rssTokenFromUrl } from '../../config';

interface RssResponse {
  rssUrl: string;
  canRss: boolean;
  is_paying: boolean;
  rss_token?: string;
  message?: string;
}

const RssFeed: React.FC = () => {
  const { refreshUser } = useAuth();
  const [data, setData] = useState<RssResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [rotating, setRotating] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get<RssResponse>('/account/rss');
        setData(res.data);
      } catch (e) {
        setError('Could not load your RSS feed.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const available = data && data.canRss && data.is_paying;
  const rssUrl = useMemo(() => {
    if (!data?.rssUrl) return '';
    const token = rssTokenFromUrl(data.rssUrl);
    return token ? buildRssUrl(token) : data.rssUrl;
  }, [data?.rssUrl]);

  const handleRotate = async () => {
    if (
      !window.confirm(
        'Rotate your private RSS URL? Your podcast app will stop updating until you paste the new URL.'
      )
    ) {
      return;
    }
    setRotating(true);
    setError('');
    setMessage('');
    try {
      const res = await axios.post<RssResponse>('/account/rss/rotate');
      setData(res.data);
      setMessage(res.data.message || 'RSS feed URL rotated.');
      await refreshUser();
    } catch (e) {
      setError('Could not rotate your RSS feed URL.');
    } finally {
      setRotating(false);
    }
  };

  return (
    <div className="podcast-page rss-page">
      <div className="feed-ht-desktop-only">
        <PodcastNav />
      </div>

      <div className="pod-feed-mobile-only">
        <PodcastMobileHeader title="RSS feed" subtitle="Private podcast URL" />
      </div>

      <main className="podcast-main">
        <h2 className="podcast-section-title feed-ht-desktop-only">Your Private RSS Feed</h2>

        <p className="pod-feed-mobile-only settings-rss-back">
          <Link to="/account/settings" className="pod-btn pod-btn-secondary pod-btn-sm">
            ← Back to Settings
          </Link>
        </p>

        {error && <div className="pod-banner pod-banner-error">{error}</div>}
        {message && <div className="pod-banner pod-banner-info">{message}</div>}

        {loading ? (
          <div className="pod-empty">Loading…</div>
        ) : available ? (
          <div className="pod-card">
            <p style={{ marginTop: 0 }}>
              This URL is unique to your account. Keep it private — anyone with it can access your episodes.
            </p>
            <RssCopyWidget url={rssUrl} />

            <p style={{ marginTop: '1rem' }}>
              <button
                type="button"
                className="pod-btn pod-btn-secondary"
                disabled={rotating}
                onClick={handleRotate}
              >
                {rotating ? 'Rotating…' : 'Rotate feed URL'}
              </button>
            </p>
            <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', opacity: 0.85 }}>
              Use rotate if this URL may have been shared or leaked. You must update your podcast app afterward.
            </p>

            <h3 style={{ marginBottom: '0.5rem' }}>Add it to your podcast app</h3>
            <ol className="pod-instructions">
              <li>Copy the URL above.</li>
              <li>
                <strong>Pocket Casts:</strong> Profile → Add Podcast → Add by URL, then paste.
              </li>
              <li>
                <strong>Overcast:</strong> + → Add URL, then paste.
              </li>
              <li>
                <strong>MediaMonkey:</strong> Podcasts → Subscribe → paste the URL.
              </li>
              <li>
                <strong>Apple Podcasts:</strong> Library → Edit → Add a Show by URL, then paste.
              </li>
            </ol>
          </div>
        ) : (
          <div className="pod-card">
            <div className="pod-banner pod-banner-info" style={{ marginBottom: 0 }}>
              {data && !data.is_paying
                ? 'Your subscription is inactive.'
                : 'Your plan does not include RSS access.'}{' '}
              <Link to="/account/billing">Manage your subscription</Link> to enable your private feed.
            </div>
          </div>
        )}
      </main>

      <PodcastMobileNav />
    </div>
  );
};

export default RssFeed;
