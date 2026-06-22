import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { usePlayer } from '../contexts/PlayerContext';
import { buildImageUrl } from '../config';
import StreamPlayer from '../components/StreamPlayer';
import { FeedPost } from '../components/PostCard';
import { resolveStreamBackTarget, StreamLocationState } from '../utils/streamNavigation';

const PODCAST_AUTHOR = 'Shyam Akaash';

interface EpisodeResponse {
  is_paying: boolean;
  canStream: boolean;
  accessible: boolean;
  post: FeedPost;
}

const Stream: React.FC = () => {
  const { postId } = useParams<{ postId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setQueue, queue } = usePlayer();
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const [data, setData] = useState<EpisodeResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const navState = location.state as StreamLocationState | null;
  const navPost = navState?.post;
  const returnPath = resolveStreamBackTarget(location.state);
  const goBack = () => navigate(returnPath);

  const playerPost =
    data?.post ?? (navPost && navPost.id === postId ? navPost : null);

  useEffect(() => {
    if (!postId) return;
    const load = async () => {
      setError('');
      try {
        const res = await axios.get<EpisodeResponse>(`/account/episodes/${postId}`);
        setData(res.data);
      } catch (e) {
        setError('Could not load this episode.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [postId]);

  useEffect(() => {
    if (!postId || !user) return;
    const activeQueue = queueRef.current;
    if (activeQueue.some((p) => p.id === postId)) {
      setQueue(activeQueue, postId);
      return;
    }
    axios
      .get<{ posts: FeedPost[] }>('/account/feed')
      .then((res) => setQueue(res.data.posts, postId))
      .catch(() => {});
  }, [postId, user, setQueue]);

  const coverUrl = playerPost?.image_filename ? buildImageUrl(playerPost.image_filename) : null;
  const bgStyle = coverUrl
    ? ({ '--stream-cover-url': `url("${coverUrl}")` } as React.CSSProperties)
    : undefined;

  const coverNode = coverUrl ? (
    <img className="stream-cover" src={coverUrl} alt="" />
  ) : (
    <div className="stream-cover stream-cover-placeholder" aria-hidden>
      ♪
    </div>
  );

  return (
    <div className="stream-page" style={bgStyle}>
      <div className="stream-bg stream-desktop-only" aria-hidden />

      <button
        type="button"
        className="stream-back-btn stream-desktop-only"
        onClick={goBack}
        aria-label="Go back"
      >
        <svg viewBox="0 0 24 24" aria-hidden>
          <path fill="currentColor" d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
        </svg>
      </button>

      <header className="pod-stream-topbar pod-mobile-only">
        <button type="button" className="pod-stream-topbar-btn" onClick={goBack} aria-label="Back">
          <svg viewBox="0 0 24 24" aria-hidden>
            <path fill="currentColor" d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
          </svg>
        </button>
        <span className="pod-stream-topbar-title">Now playing</span>
        <Link to={returnPath} className="pod-stream-topbar-btn" aria-label="Back to list">
          <svg viewBox="0 0 24 24" aria-hidden>
            <path fill="currentColor" d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
          </svg>
        </Link>
      </header>

      <header className="stream-mobile-topbar stream-ht-mobile-only">
        <span className="stream-mobile-brand">{PODCAST_AUTHOR}</span>
        <div className="stream-mobile-topbar-actions">
          <Link to="/account/settings" className="stream-mobile-icon-btn" aria-label="Account">
            <svg viewBox="0 0 24 24" aria-hidden>
              <path
                fill="currentColor"
                d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
              />
            </svg>
          </Link>
          <Link to="/library" className="stream-mobile-icon-btn" aria-label="Library">
            <svg viewBox="0 0 24 24" aria-hidden>
              <path
                fill="currentColor"
                d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"
              />
            </svg>
          </Link>
          <button type="button" className="stream-mobile-icon-btn" onClick={goBack} aria-label="Back">
            <svg viewBox="0 0 24 24" aria-hidden>
              <path fill="currentColor" d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
            </svg>
          </button>
        </div>
      </header>

      <main className="stream-main">
        {loading && !playerPost && <div className="stream-loading">Loading…</div>}
        {!loading && error && (
          <div className="stream-card">
            <div className="pod-banner pod-banner-error">{error}</div>
            <Link to={returnPath} className="pod-btn">
              Go back
            </Link>
          </div>
        )}

        {user?.rss_token && playerPost && (
          <article className="stream-card">
            <div className="stream-mobile-hero stream-ht-mobile-only">
              {coverNode}
              <div className="stream-mobile-artist">
                <span>{PODCAST_AUTHOR}</span>
                <span className="stream-mobile-plus" aria-hidden>+</span>
              </div>
              <h1 className="stream-mobile-title">{playerPost.title}</h1>
            </div>

            <div className="stream-desktop-only">{coverNode}</div>

            <div className="stream-card-body">
              <StreamPlayer
                post={playerPost}
                rssToken={user.rss_token}
                coverUrl={coverUrl}
                accessible={data ? data.accessible && data.is_paying : true}
                canStream={data ? data.canStream : true}
                returnPath={returnPath}
              />
            </div>
          </article>
        )}

        {!loading && data && !data.is_paying && (
          <div className="stream-card stream-card-banner">
            <p className="stream-unavailable" style={{ margin: 0 }}>
              Your subscription is inactive. <Link to="/account/billing">Reactivate it</Link> to listen.
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Stream;
