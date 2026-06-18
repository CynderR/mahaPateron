import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import PodcastNav from '../components/PodcastNav';
import PostCard, { FeedPost } from '../components/PostCard';

interface LibraryEntry extends FeedPost {
  accessible: boolean;
}

interface LibraryResponse {
  is_paying: boolean;
  back_catalog_access: boolean;
  canStream: boolean;
  total: number;
  accessible: number;
  entries: LibraryEntry[];
}

const Library: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<LibraryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get<LibraryResponse>('/account/library');
        setData(res.data);
      } catch (e) {
        setError('Could not load the episode library.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const lockedCount = data ? data.total - data.accessible : 0;

  return (
    <div className="podcast-page">
      <PodcastNav />
      <main className="podcast-main">
        <h2 className="podcast-section-title">Episode Library</h2>

        {error && <div className="pod-banner pod-banner-error">{error}</div>}

        {!loading && data && !data.is_paying && (
          <div className="pod-banner pod-banner-info">
            Your subscription is inactive. <Link to="/account/billing">Reactivate it</Link> to listen to episodes.
          </div>
        )}

        {!loading && data && data.is_paying && lockedCount > 0 && !data.back_catalog_access && (
          <div className="pod-banner pod-banner-info">
            {lockedCount} older {lockedCount === 1 ? 'episode is' : 'episodes are'} not included in your plan.
            Contact the administrator for full archive access.
          </div>
        )}

        {loading ? (
          <div className="pod-empty">Loading library…</div>
        ) : data && data.entries.length > 0 ? (
          <div className="pod-feed-grid">
            {data.entries.map((entry) => (
              <PostCard
                key={entry.id}
                post={entry}
                rssToken={user?.rss_token}
                canStream={!!data.is_paying && data.canStream && entry.accessible}
                locked={!entry.accessible}
              />
            ))}
          </div>
        ) : (
          <div className="pod-empty">No episodes in the library yet.</div>
        )}
      </main>
    </div>
  );
};

export default Library;
