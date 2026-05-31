import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import PodcastNav from '../components/PodcastNav';
import PostCard, { FeedPost } from '../components/PostCard';

interface FeedResponse {
  is_paying: boolean;
  canStream: boolean;
  canRss: boolean;
  posts: FeedPost[];
}

const Feed: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<FeedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get<FeedResponse>('/account/feed');
        setData(res.data);
      } catch (e) {
        setError('Could not load the feed.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="podcast-page">
      <PodcastNav />
      <main className="podcast-main">
        <h2 className="podcast-section-title">Latest Episodes</h2>

        {error && <div className="pod-banner pod-banner-error">{error}</div>}

        {!loading && data && !data.is_paying && (
          <div className="pod-banner pod-banner-info">
            Your subscription is inactive. <Link to="/account/billing">Reactivate it</Link> to listen to episodes.
          </div>
        )}

        {loading ? (
          <div className="pod-empty">Loading episodes…</div>
        ) : data && data.posts.length > 0 ? (
          <div className="pod-feed-grid">
            {data.posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                rssToken={user?.rss_token}
                canStream={!!data.is_paying && data.canStream}
              />
            ))}
          </div>
        ) : (
          <div className="pod-empty">No episodes have been published yet.</div>
        )}
      </main>
    </div>
  );
};

export default Feed;
