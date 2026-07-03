import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import PodcastNav from '../../components/PodcastNav';
import RssCopyWidget from '../../components/RssCopyWidget';
import { buildRssUrl, rssTokenFromUrl } from '../../config';

interface RssResponse {
  rssUrl: string;
  canRss: boolean;
  is_paying: boolean;
}

const RssFeed: React.FC = () => {
  const [data, setData] = useState<RssResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  return (
    <div className="podcast-page">
      <PodcastNav />
      <main className="podcast-main">
        <h2 className="podcast-section-title">Your Private RSS Feed</h2>

        {error && <div className="pod-banner pod-banner-error">{error}</div>}

        {loading ? (
          <div className="pod-empty">Loading…</div>
        ) : available ? (
          <div className="pod-card">
            <p style={{ marginTop: 0 }}>
              This URL is unique to your account. Keep it private — anyone with it can access your episodes.
            </p>
            <RssCopyWidget url={rssUrl} />

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
                <strong>Apple Podcasts (desktop):</strong> File → Add a Show by URL, then paste.
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
    </div>
  );
};

export default RssFeed;
