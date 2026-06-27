import React, { useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { buildImageUrl } from '../config';
import { usePlayer } from '../contexts/PlayerContext';
import { PODCAST_AUTHOR } from '../podcastMeta';
import PlaybackProgressBar from './PlaybackProgressBar';

const truncate = (text: string, max: number): string =>
  text.length <= max ? text : `${text.slice(0, max).trim()}…`;

const GlobalNowPlayingBar: React.FC = () => {
  const location = useLocation();
  const {
    activePostId,
    playing,
    queue,
    currentIndex,
    togglePlayback,
    mediaLoading,
    mediaReady
  } = usePlayer();

  const onStreamPage =
    activePostId != null &&
    (location.pathname === `/stream/${activePostId}` ||
      location.pathname.endsWith(`/stream/${activePostId}`));

  const post = useMemo(() => {
    if (!activePostId) return null;
    if (queue[currentIndex]?.id === activePostId) return queue[currentIndex];
    return queue.find((entry) => entry.id === activePostId) ?? null;
  }, [activePostId, currentIndex, queue]);

  const visible = !!activePostId && !onStreamPage;
  const coverUrl = post?.image_filename ? buildImageUrl(post.image_filename) : null;
  const canPlay = mediaReady && !mediaLoading;

  useEffect(() => {
    document.body.classList.toggle('global-now-playing-active', visible);
    return () => document.body.classList.remove('global-now-playing-active');
  }, [visible]);

  if (!visible) return null;

  const streamPath = `/stream/${activePostId}`;

  return (
    <footer className="global-now-playing-bar" aria-label="Now playing">
      <PlaybackProgressBar
        postId={activePostId}
        durationSecs={post?.duration_secs}
        showTimes={false}
        className="global-now-playing-progress"
      />
      <div className="global-now-playing-inner">
        <Link to={streamPath} className="global-now-playing-main">
          {coverUrl ? (
            <img className="global-now-playing-thumb" src={coverUrl} alt="" />
          ) : (
            <div className="global-now-playing-thumb global-now-playing-thumb-placeholder" aria-hidden>
              ♪
            </div>
          )}
          <div className="global-now-playing-copy">
            <p className="global-now-playing-title">{truncate(post?.title ?? 'Now playing', 48)}</p>
            <p className="global-now-playing-artist">{PODCAST_AUTHOR}</p>
          </div>
        </Link>
        <button
          type="button"
          className="global-now-playing-play"
          onClick={() => togglePlayback()}
          disabled={!canPlay}
          aria-label={mediaLoading ? 'Loading audio' : playing ? 'Pause' : 'Play'}
        >
          {playing ? (
            <svg viewBox="0 0 24 24" aria-hidden>
              <rect x="6" y="5" width="4" height="14" fill="currentColor" />
              <rect x="14" y="5" width="4" height="14" fill="currentColor" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M8 5v14l11-7z" fill="currentColor" />
            </svg>
          )}
        </button>
      </div>
    </footer>
  );
};

export default GlobalNowPlayingBar;
