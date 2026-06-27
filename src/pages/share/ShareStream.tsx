import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { usePlayer } from '../../contexts/PlayerContext';
import { buildImageUrl } from '../../config';
import ShareStreamPlayer from '../../components/ShareStreamPlayer';
import ThemeToggle from '../../components/ThemeToggle';
import { FeedPost } from '../../components/PostCard';
import { useShare } from '../../contexts/ShareContext';
import { resolveStreamBackTarget, StreamLocationState } from '../../utils/streamNavigation';
import { PODCAST_AUTHOR } from '../../podcastMeta';

interface ShareEpisodeResponse {
  canStream: boolean;
  accessible: boolean;
  post: FeedPost;
}

const ShareStream: React.FC = () => {
  const { postId } = useParams<{ postId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { shareToken, access, streamPath, streamState } = useShare();
  const { setQueue, queue } = usePlayer();
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const [data, setData] = useState<ShareEpisodeResponse | null>(null);
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
        const res = await axios.get<ShareEpisodeResponse>(
          `/share/${encodeURIComponent(shareToken)}/episodes/${encodeURIComponent(postId)}`
        );
        setData(res.data);
      } catch {
        setError('Could not load this episode.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [postId, shareToken]);

  useEffect(() => {
    if (!postId || !access.canStream) return;
    const activeQueue = queueRef.current;
    if (activeQueue.some((p) => p.id === postId)) {
      setQueue(activeQueue, postId);
      return;
    }
    axios
      .get<{ posts: FeedPost[] }>(`/share/${encodeURIComponent(shareToken)}/feed`)
      .then((res) => setQueue(res.data.posts, postId))
      .catch(() => {});
  }, [postId, shareToken, access.canStream, setQueue]);

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

      <div className="stream-theme-btn stream-desktop-only">
        <ThemeToggle />
      </div>

      <header className="pod-stream-topbar pod-mobile-only">
        <button type="button" className="pod-stream-topbar-btn" onClick={goBack} aria-label="Back">
          <svg viewBox="0 0 24 24" aria-hidden>
            <path fill="currentColor" d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
          </svg>
        </button>
        <span className="pod-stream-topbar-title">Now playing</span>
        <div className="theme-toggle-row">
          <ThemeToggle />
          <Link to={returnPath} className="pod-stream-topbar-btn" aria-label="Back to list">
            <svg viewBox="0 0 24 24" aria-hidden>
              <path fill="currentColor" d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
            </svg>
          </Link>
        </div>
      </header>

      <header className="stream-mobile-topbar stream-ht-mobile-only">
        <span className="stream-mobile-brand">{PODCAST_AUTHOR}</span>
        <div className="stream-mobile-topbar-actions">
          <ThemeToggle />
          <Link to="/signin" className="stream-mobile-icon-btn" aria-label="Sign in">
            <svg viewBox="0 0 24 24" aria-hidden>
              <path
                fill="currentColor"
                d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
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

        {playerPost && access.canStream && (
          <article className="stream-card">
            <div className="stream-mobile-hero stream-ht-mobile-only">
              {coverNode}
              <div className="stream-mobile-artist">
                <span>{PODCAST_AUTHOR}</span>
                <span className="stream-mobile-plus" aria-hidden>
                  +
                </span>
              </div>
              <h1 className="stream-mobile-title">{playerPost.title}</h1>
            </div>

            <div className="stream-desktop-only">{coverNode}</div>

            <div className="stream-card-body">
              <ShareStreamPlayer
                post={playerPost}
                shareToken={shareToken}
                coverUrl={coverUrl}
                accessible={data ? data.accessible : true}
                canStream={data ? data.canStream : access.canStream}
                returnPath={returnPath}
                streamPath={streamPath}
                streamState={streamState}
              />
            </div>
          </article>
        )}

        {!loading && data && !access.canStream && (
          <div className="stream-card stream-card-banner">
            <p className="stream-unavailable" style={{ margin: 0 }}>
              Streaming is not available through this share link.
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default ShareStream;
