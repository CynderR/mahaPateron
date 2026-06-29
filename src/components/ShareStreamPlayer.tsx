import React, { useCallback, useEffect, useLayoutEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { buildPublicShareStreamUrl } from '../config';
import { usePlayer } from '../contexts/PlayerContext';
import { FeedPost } from './PostCard';
import PlayerControls from './PlayerControls';
import PodcastStreamMobile from './mobile/PodcastStreamMobile';
import PlaybackProgressBar from './PlaybackProgressBar';
import { StreamLocationState } from '../utils/streamNavigation';
import { PODCAST_AUTHOR } from '../podcastMeta';

interface ShareStreamPlayerProps {
  post: FeedPost;
  shareToken: string;
  coverUrl: string | null;
  accessible: boolean;
  canStream: boolean;
  returnPath: string;
  streamPath: (postId: string) => string;
  streamState: (post?: FeedPost) => StreamLocationState;
}

const formatTime = (secs: number): string => {
  if (!Number.isFinite(secs) || secs < 0) return '0:00';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
};

const formatRelativeTime = (iso?: string): string => {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return 'Today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return '1 month ago';
  if (months < 12) return `${months} months ago`;
  const years = Math.floor(months / 12);
  return years === 1 ? '1 year ago' : `${years} years ago`;
};

const seedHeights = (seedStr: string, count: number): number[] => {
  let seed = seedStr.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return Array.from({ length: count }, () => {
    seed = (seed * 9301 + 49297) % 233280;
    return 18 + (seed % 72);
  });
};

const ShareStreamPlayer: React.FC<ShareStreamPlayerProps> = ({
  post,
  shareToken,
  coverUrl,
  accessible,
  canStream,
  returnPath,
  streamPath,
  streamState
}) => {
  const navigate = useNavigate();
  const {
    playing,
    currentTime,
    duration,
    playbackError,
    mediaLoading,
    mediaReady,
    getNextPostId,
    getPrevPostId,
    prepareEpisode,
    playNextInQueue,
    togglePlayback,
    seekTo,
    skipBy,
    registerTrackEndedHandler
  } = usePlayer();

  const streamUrl = buildPublicShareStreamUrl(post.id, shareToken);
  const barHeights = useMemo(() => seedHeights(post.id, 80), [post.id]);
  const mobileBarHeights = useMemo(() => seedHeights(`${post.id}-m`, 60), [post.id]);
  const effectiveDuration = duration || post.duration_secs || 0;
  const progress = effectiveDuration > 0 ? Math.min(100, (currentTime / effectiveDuration) * 100) : 0;
  const playable = accessible && canStream;
  const canPlay = playable && mediaReady && !mediaLoading;

  const nextId = getNextPostId();
  const prevId = getPrevPostId();

  const navToStream = useCallback(
    (targetPost: FeedPost) => {
      navigate(streamPath(targetPost.id), { state: streamState(targetPost) });
    },
    [navigate, streamPath, streamState]
  );

  const goNext = useCallback(() => {
    if (nextId) navigate(streamPath(nextId), { state: streamState() });
  }, [navigate, nextId, streamPath, streamState]);

  const goPrev = useCallback(() => {
    if (prevId) navigate(streamPath(prevId), { state: streamState() });
  }, [navigate, prevId, streamPath, streamState]);

  const handleEnded = useCallback(() => {
    const nextPost = playNextInQueue();
    if (nextPost) {
      navToStream(nextPost);
    }
  }, [navToStream, playNextInQueue]);

  useEffect(() => {
    registerTrackEndedHandler(handleEnded);
    return () => registerTrackEndedHandler(null);
  }, [handleEnded, registerTrackEndedHandler]);

  useLayoutEffect(() => {
    if (playable) {
      prepareEpisode(post.id, streamUrl, post.duration_secs);
    }
  }, [playable, post.id, post.duration_secs, streamUrl, prepareEpisode]);

  const seekFromWaveform = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!playable || !effectiveDuration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seekTo(ratio * effectiveDuration);
  };

  const PlayIcon = ({ large = false }: { large?: boolean }) => (
    <svg
      className={large ? 'stream-play-icon stream-play-icon-lg' : 'stream-play-icon'}
      viewBox="0 0 24 24"
      aria-hidden
    >
      {playing ? (
        <>
          <rect x="6" y="5" width="4" height="14" fill="currentColor" />
          <rect x="14" y="5" width="4" height="14" fill="currentColor" />
        </>
      ) : (
        <path d="M8 5v14l11-7z" fill="currentColor" />
      )}
    </svg>
  );

  const waveform = (heights: number[], className: string) => (
    <div
      className={`stream-waveform ${className}${playable ? '' : ' stream-waveform-disabled'}`}
      onClick={seekFromWaveform}
      role={playable ? 'slider' : undefined}
      aria-valuenow={playable ? Math.round(currentTime) : undefined}
      aria-valuemax={playable ? Math.round(effectiveDuration) : undefined}
      tabIndex={playable ? 0 : -1}
      onKeyDown={(e) => {
        if (!playable) return;
        if (e.key === 'ArrowRight') skipBy(5);
        if (e.key === 'ArrowLeft') skipBy(-5);
      }}
    >
      <div className="stream-waveform-bars">
        {heights.map((h, i) => (
          <span key={i} className="stream-waveform-bar" style={{ height: `${h}%` }} />
        ))}
      </div>
      <div className="stream-waveform-progress" style={{ width: `${progress}%` }} />
    </div>
  );

  return (
    <>
      <div className="stream-header stream-desktop-only">
        <button
          type="button"
          className="stream-play-btn stream-play-btn-header"
          onClick={() => togglePlayback()}
          disabled={!canPlay}
          aria-label={mediaLoading ? 'Loading audio' : playing ? 'Pause' : 'Play'}
        >
          <PlayIcon large />
        </button>
        <h1 className="stream-title">{post.title}</h1>
      </div>

      <div className="stream-author stream-desktop-only">
        <div className="stream-author-avatar" aria-hidden>
          {PODCAST_AUTHOR.charAt(0)}
        </div>
        <span className="stream-author-name">{PODCAST_AUTHOR}</span>
      </div>

      <div className="stream-waveform-wrap">
        <span className="stream-duration-label stream-desktop-only">
          {formatTime(effectiveDuration)}
        </span>
        {waveform(barHeights, 'stream-waveform-desktop stream-desktop-only')}
        {waveform(mobileBarHeights, 'stream-waveform-mobile stream-ht-mobile-only')}
      </div>

      <PlaybackProgressBar
        postId={post.id}
        durationSecs={post.duration_secs}
        className="stream-desktop-scrubber stream-desktop-only"
      />

      {post.description && <p className="stream-description stream-desktop-only">{post.description}</p>}

      <div className="stream-card-footer stream-desktop-only">
        <div className="stream-footer-meta">
          <span>{formatRelativeTime(post.published_at)}</span>
          <span className="stream-footer-private">Shared listening link</span>
        </div>
      </div>

      {!playable && (
        <p className="stream-unavailable">Streaming is not available through this share link.</p>
      )}

      <footer className="stream-global-bar stream-desktop-only">
        <PlayerControls
          className="stream-global-bar-controls"
          onPrevious={goPrev}
          onNext={goNext}
          canPrevious={!!prevId}
          canNext={!!nextId}
          onSkip={skipBy}
          canSkip={playable}
        />
        <Link to="/signin" className="pod-btn pod-btn-secondary pod-btn-sm">
          Sign in for RSS
        </Link>
      </footer>

      <PodcastStreamMobile
        post={post}
        coverUrl={coverUrl}
        playing={playing}
        currentTime={currentTime}
        duration={effectiveDuration}
        playable={playable}
        canPlay={canPlay}
        playbackError={playbackError}
        mediaLoading={mediaLoading}
        onTogglePlay={() => togglePlayback()}
        onSeek={seekTo}
        onSkip={skipBy}
        onPrevious={goPrev}
        onNext={goNext}
        canPrevious={!!prevId}
        canNext={!!nextId}
        returnPath={returnPath}
        showMemberTools={false}
      />
    </>
  );
};

export default ShareStreamPlayer;
