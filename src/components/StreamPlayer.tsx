import React, { useCallback, useEffect, useLayoutEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { buildStreamUrl } from '../config';
import { usePlayer } from '../contexts/PlayerContext';
import { FeedPost } from './PostCard';
import FavoriteButton from './FavoriteButton';
import PlayerControls from './PlayerControls';
import EpisodeTransportBar from './EpisodeTransportBar';
import PlaylistPicker from './PlaylistPicker';
import DownloadEpisodeButton from './DownloadEpisodeButton';
import PodcastStreamMobile from './mobile/PodcastStreamMobile';
import PlaybackProgressBar from './PlaybackProgressBar';
import { buildStreamState } from '../utils/streamNavigation';
import {
  blurEpisodeTransportFocus,
  usePlaybackKeyboardShortcuts
} from '../hooks/usePlaybackKeyboardShortcuts';

const PODCAST_AUTHOR = 'Shyam Akaash';

interface StreamPlayerProps {
  post: FeedPost;
  rssToken: string;
  coverUrl: string | null;
  accessible: boolean;
  canStream: boolean;
  canDownload?: boolean;
  returnPath: string;
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
  canStream,
  canDownload = false,
  returnPath
}) => {
  const navigate = useNavigate();
  const {
    playing,
    currentTime,
    duration,
    streamPreviewSeconds,
    playbackError,
    mediaLoading,
    mediaReady,
    getNextPostId,
    getPrevPostId,
    loadEpisodeForStream,
    advanceToPost,
    playNextInQueue,
    togglePlayback,
    seekTo,
    skipBy,
    registerTrackEndedHandler
  } = usePlayer();

  const streamUrl = buildStreamUrl(post.id, rssToken);
  const barHeights = useMemo(() => seedHeights(post.id, 80), [post.id]);
  const mobileBarHeights = useMemo(() => seedHeights(`${post.id}-m`, 60), [post.id]);
  const effectiveDuration =
    streamPreviewSeconds != null
      ? streamPreviewSeconds
      : duration || post.duration_secs || 0;
  const progress = effectiveDuration > 0 ? Math.min(100, (currentTime / effectiveDuration) * 100) : 0;
  const playable = accessible && canStream;
  const canPlay = playable && mediaReady && !mediaLoading;

  const nextId = getNextPostId();
  const prevId = getPrevPostId();

  const navToStream = useCallback(
    (targetPost: FeedPost) => {
      navigate(`/stream/${targetPost.id}`, { state: buildStreamState(returnPath, targetPost) });
    },
    [navigate, returnPath]
  );

  const goNext = useCallback(() => {
    if (!nextId) return;
    advanceToPost(nextId);
    navigate(`/stream/${nextId}`, { state: buildStreamState(returnPath) });
  }, [advanceToPost, navigate, nextId, returnPath]);

  const goPrev = useCallback(() => {
    if (prevId) navigate(`/stream/${prevId}`, { state: buildStreamState(returnPath) });
  }, [navigate, prevId, returnPath]);

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
      loadEpisodeForStream(post.id, streamUrl, post.duration_secs);
    }
  }, [playable, post.id, post.duration_secs, streamUrl, loadEpisodeForStream]);

  useLayoutEffect(() => {
    blurEpisodeTransportFocus();
  }, [post.id]);

  usePlaybackKeyboardShortcuts(playable, canPlay, togglePlayback);

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
        <div className="stream-header-copy">
          <h1 className="stream-title">{post.title}</h1>
          <EpisodeTransportBar
            onSkip={skipBy}
            onPrevious={goPrev}
            onNext={goNext}
            canPrevious={!!prevId}
            canNext={!!nextId}
            canSkip={playable}
          />
        </div>
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
        <PlayerControls
          className="stream-global-bar-controls"
          showSkip={false}
          showTrackNav={false}
        />
        <FavoriteButton postId={post.id} />
        <PlaylistPicker postId={post.id} />
        {canDownload && accessible && (
          <DownloadEpisodeButton postId={post.id} postTitle={post.title} compact />
        )}
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
        canDownload={canDownload && accessible}
      />

      <footer className="stream-mobile-bar pod-mobile-only">
        <div className="stream-mobile-bar-progress">
          <div className="stream-mobile-bar-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="stream-mobile-bar-player-tools">
          <PlayerControls
            className="stream-mobile-bar-player-controls"
            showSkip={false}
            showTrackNav={false}
          />
          <FavoriteButton postId={post.id} className="stream-mobile-bar-icon-wrap" />
          <Link to="/playlists" className="stream-mobile-bar-icon" aria-label="Playlists">
            <svg viewBox="0 0 24 24" aria-hidden>
              <path fill="currentColor" d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
            </svg>
          </Link>
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
        </div>
      </footer>
    </>
  );
};

export default StreamPlayer;
