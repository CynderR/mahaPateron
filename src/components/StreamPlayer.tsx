import React, { useCallback, useEffect, useLayoutEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { buildStreamUrl } from '../config';
import { usePlayer } from '../contexts/PlayerContext';
import { FeedPost } from './PostCard';
import FavoriteButton from './FavoriteButton';
import PlayerControls from './PlayerControls';
import PlaylistPicker from './PlaylistPicker';
import PodcastStreamMobile from './mobile/PodcastStreamMobile';

const PODCAST_AUTHOR = 'Shyam Akaash';

interface StreamPlayerProps {
  post: FeedPost;
  rssToken: string;
  coverUrl: string | null;
  accessible: boolean;
  canStream: boolean;
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

const truncate = (text: string, max: number): string =>
  text.length <= max ? text : `${text.slice(0, max).trim()}…`;

const StreamPlayer: React.FC<StreamPlayerProps> = ({
  post,
  rssToken,
  coverUrl,
  accessible,
  canStream
}) => {
  const navigate = useNavigate();
  const {
    playing,
    currentTime,
    duration,
    playbackError,
    getNextPostId,
    getPrevPostId,
    prepareEpisode,
    togglePlayback,
    seekTo,
    skipBy,
    registerTrackEndedHandler
  } = usePlayer();

  const streamUrl = buildStreamUrl(post.id, rssToken);
  const barHeights = useMemo(() => seedHeights(post.id, 80), [post.id]);
  const mobileBarHeights = useMemo(() => seedHeights(`${post.id}-m`, 60), [post.id]);
  const effectiveDuration = duration || post.duration_secs || 0;
  const progress = effectiveDuration > 0 ? Math.min(100, (currentTime / effectiveDuration) * 100) : 0;
  const playable = accessible && canStream;

  const nextId = getNextPostId();
  const prevId = getPrevPostId();

  const goNext = useCallback(() => {
    if (nextId) navigate(`/stream/${nextId}`);
  }, [navigate, nextId]);

  const goPrev = useCallback(() => {
    if (prevId) navigate(`/stream/${prevId}`);
  }, [navigate, prevId]);

  const handleEnded = useCallback(() => {
    if (nextId) navigate(`/stream/${nextId}`);
  }, [nextId, navigate]);

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

  const PlayIcon = ({ large = false, filled = false }: { large?: boolean; filled?: boolean }) => (
    <svg
      className={large ? 'stream-play-icon stream-play-icon-lg' : 'stream-play-icon'}
      viewBox="0 0 24 24"
      aria-hidden
    >
      {playing && filled ? (
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
          disabled={!playable}
          aria-label={playing ? 'Pause' : 'Play'}
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

      <div className="stream-player-tools stream-desktop-only">
        <PlayerControls
          onPrevious={goPrev}
          onNext={goNext}
          canPrevious={!!prevId}
          canNext={!!nextId}
        />
        <FavoriteButton postId={post.id} />
        <PlaylistPicker postId={post.id} />
      </div>

      <div className="stream-mobile-actions stream-ht-mobile-only">
        <button
          type="button"
          className="stream-play-btn stream-play-btn-mobile"
          onClick={() => togglePlayback()}
          disabled={!playable}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          <PlayIcon filled />
        </button>
        <span className="stream-mobile-duration">{formatTime(effectiveDuration)}</span>
        <span className="stream-mobile-actions-spacer" aria-hidden />
        <FavoriteButton postId={post.id} className="stream-mobile-favorite" />
        <Link to="/account/rss" className="stream-mobile-icon-btn stream-mobile-share" aria-label="RSS feed">
          <svg viewBox="0 0 24 24" aria-hidden>
            <path
              fill="currentColor"
              d="M18 11c0-3.31-2.69-6-6-6s-6 2.69-6 6 2.69 6 6 6 6-2.69 6-6zm-6 4c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zM6 6v2c6.08 0 11 4.92 11 11h2C19 11.94 12.06 6 6 6zm0 4v2c3.87 0 7 3.13 7 7h2c0-4.97-4.03-9-9-9z"
            />
          </svg>
        </Link>
      </div>

      <div className="stream-waveform-wrap">
        <span className="stream-duration-label stream-desktop-only">
          {formatTime(effectiveDuration)}
        </span>
        {waveform(barHeights, 'stream-waveform-desktop stream-desktop-only')}
        {waveform(mobileBarHeights, 'stream-waveform-mobile stream-ht-mobile-only')}
      </div>

      <div className="stream-player-tools stream-ht-mobile-only stream-player-tools-mobile">
        <PlayerControls
          onPrevious={goPrev}
          onNext={goNext}
          canPrevious={!!prevId}
          canNext={!!nextId}
        />
        <PlaylistPicker postId={post.id} />
      </div>

      <div className="stream-description-block stream-ht-mobile-only">
        <p className="stream-description-label">Profile description of {PODCAST_AUTHOR}:</p>
        <p className="stream-description">{post.description || 'Members-only audio from Shyam Akaash.'}</p>
      </div>

      {post.description && <p className="stream-description stream-desktop-only">{post.description}</p>}

      <div className="stream-card-footer stream-desktop-only">
        <div className="stream-footer-meta">
          <span>{formatRelativeTime(post.published_at)}</span>
          <span className="stream-footer-private">
            <svg className="stream-lock-icon" viewBox="0 0 24 24" aria-hidden>
              <path
                fill="currentColor"
                d="M18 8h-1V6a5 5 0 00-10 0v2H6a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V10a2 2 0 00-2-2zm-6 9a2 2 0 110-4 2 2 0 010 4zm3-9H9V6a3 3 0 016 0v2z"
              />
            </svg>
            Members only
          </span>
        </div>
      </div>

      {!playable && (
        <p className="stream-unavailable">
          {!accessible
            ? 'This episode is outside your subscription period.'
            : !canStream
              ? 'Streaming is not included in your plan.'
              : 'Subscribe to listen to this episode.'}
        </p>
      )}

      <footer className="stream-global-bar stream-desktop-only">
        <button
          type="button"
          className="stream-play-btn stream-play-btn-bar"
          onClick={() => togglePlayback()}
          disabled={!playable}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          <PlayIcon />
        </button>
        <PlayerControls
          className="stream-global-bar-controls"
          onPrevious={goPrev}
          onNext={goNext}
          canPrevious={!!prevId}
          canNext={!!nextId}
        />
        <FavoriteButton postId={post.id} />
      </footer>

      <PodcastStreamMobile
        post={post}
        coverUrl={coverUrl}
        playing={playing}
        currentTime={currentTime}
        duration={effectiveDuration}
        playable={playable}
        playbackError={playbackError}
        onTogglePlay={() => togglePlayback()}
        onSeek={seekTo}
        onSkip={skipBy}
        onPrevious={goPrev}
        onNext={goNext}
        canPrevious={!!prevId}
        canNext={!!nextId}
      />

      <footer className="stream-mobile-bar stream-ht-mobile-only">
        <div className="stream-mobile-bar-progress">
          <div className="stream-mobile-bar-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="stream-mobile-bar-inner">
          {coverUrl ? (
            <img className="stream-mobile-bar-thumb" src={coverUrl} alt="" />
          ) : (
            <div className="stream-mobile-bar-thumb stream-mobile-bar-thumb-placeholder" aria-hidden>
              ♪
            </div>
          )}
          <div className="stream-mobile-bar-info">
            <p className="stream-mobile-bar-title">{truncate(post.title, 32)}</p>
            <p className="stream-mobile-bar-artist">{PODCAST_AUTHOR}</p>
          </div>
          <div className="stream-mobile-bar-controls">
            <FavoriteButton postId={post.id} className="stream-mobile-bar-icon-wrap" />
            <button
              type="button"
              className="stream-play-btn stream-play-btn-mobile stream-play-btn-bar-mobile"
              onClick={() => togglePlayback()}
              disabled={!playable}
              aria-label={playing ? 'Pause' : 'Play'}
            >
              <PlayIcon filled />
            </button>
            <button
              type="button"
              className="stream-mobile-bar-icon"
              aria-label="Next"
              onClick={goNext}
              disabled={!nextId}
            >
              <svg viewBox="0 0 24 24" aria-hidden>
                <path fill="currentColor" d="M6 18l8.5-6L6 6v12zm2.5-6l0 0zm8.5 6V6h2v12h-2z" />
              </svg>
            </button>
            <Link to="/playlists" className="stream-mobile-bar-icon" aria-label="Playlists">
              <svg viewBox="0 0 24 24" aria-hidden>
                <path fill="currentColor" d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
              </svg>
            </Link>
          </div>
        </div>
      </footer>
    </>
  );
};

export default StreamPlayer;
