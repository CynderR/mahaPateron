import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { buildStreamUrl } from '../config';
import { FeedPost } from './PostCard';

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
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(post.duration_secs ?? 0);
  const [volume, setVolume] = useState(1);

  const streamUrl = buildStreamUrl(post.id, rssToken);
  const barHeights = useMemo(() => seedHeights(post.id, 80), [post.id]);
  const mobileBarHeights = useMemo(() => seedHeights(`${post.id}-m`, 60), [post.id]);
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const playable = accessible && canStream;

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !playable) return;
    if (audio.paused) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [playable]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onDurationChange = () => {
      if (Number.isFinite(audio.duration)) setDuration(audio.duration);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('loadedmetadata', onDurationChange);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('loadedmetadata', onDurationChange);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
    };
  }, [streamUrl]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const seekFromWaveform = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !playable || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * duration;
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
      aria-valuemax={playable ? Math.round(duration) : undefined}
      tabIndex={playable ? 0 : -1}
      onKeyDown={(e) => {
        if (!playable || !audioRef.current) return;
        if (e.key === 'ArrowRight') audioRef.current.currentTime += 5;
        if (e.key === 'ArrowLeft') audioRef.current.currentTime -= 5;
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
      {playable && (
        <audio ref={audioRef} preload="metadata" src={streamUrl}>
          <track kind="captions" />
        </audio>
      )}

      {/* Desktop header: play + title */}
      <div className="stream-header stream-desktop-only">
        <button
          type="button"
          className="stream-play-btn stream-play-btn-header"
          onClick={togglePlay}
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

      {/* Mobile action row */}
      <div className="stream-mobile-actions stream-mobile-only">
        <button
          type="button"
          className="stream-play-btn stream-play-btn-mobile"
          onClick={togglePlay}
          disabled={!playable}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          <PlayIcon filled />
        </button>
        <span className="stream-mobile-duration">{formatTime(duration || post.duration_secs || 0)}</span>
        <span className="stream-mobile-actions-spacer" aria-hidden />
        <button type="button" className="stream-mobile-icon-btn stream-mobile-more" aria-label="More options">
          <svg viewBox="0 0 24 24" aria-hidden>
            <path
              fill="currentColor"
              d="M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"
            />
          </svg>
        </button>
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
          {formatTime(duration || post.duration_secs || 0)}
        </span>
        {waveform(barHeights, 'stream-waveform-desktop stream-desktop-only')}
        {waveform(mobileBarHeights, 'stream-waveform-mobile stream-mobile-only')}
      </div>

      <div className="stream-description-block stream-mobile-only">
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

      {/* Desktop bottom bar */}
      <footer className="stream-global-bar stream-desktop-only">
        <button
          type="button"
          className="stream-play-btn stream-play-btn-bar"
          onClick={togglePlay}
          disabled={!playable}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          <PlayIcon />
        </button>
        <div className="stream-volume">
          <svg className="stream-volume-icon" viewBox="0 0 24 24" aria-hidden>
            <path
              fill="currentColor"
              d="M3 10v4h4l5 5V5L7 10H3zm13.5 2a4.5 4.5 0 00-2.47-4.01v8.02A4.5 4.5 0 0016.5 12z"
            />
          </svg>
          <input
            type="range"
            className="stream-volume-slider"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            aria-label="Volume"
          />
        </div>
      </footer>

      {/* Mobile sticky player */}
      <footer className="stream-mobile-bar stream-mobile-only">
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
            <button type="button" className="stream-mobile-bar-icon" aria-label="Favorite">
              <svg viewBox="0 0 24 24" aria-hidden>
                <path
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                />
              </svg>
            </button>
            <button
              type="button"
              className="stream-play-btn stream-play-btn-mobile stream-play-btn-bar-mobile"
              onClick={togglePlay}
              disabled={!playable}
              aria-label={playing ? 'Pause' : 'Play'}
            >
              <PlayIcon filled />
            </button>
            <button type="button" className="stream-mobile-bar-icon" aria-label="Next" disabled>
              <svg viewBox="0 0 24 24" aria-hidden>
                <path fill="currentColor" d="M6 18l8.5-6L6 6v12zm2.5-6l0 0zm8.5 6V6h2v12h-2z" />
              </svg>
            </button>
            <button type="button" className="stream-mobile-bar-icon" aria-label="Queue">
              <svg viewBox="0 0 24 24" aria-hidden>
                <path fill="currentColor" d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
              </svg>
            </button>
          </div>
        </div>
      </footer>
    </>
  );
};

export default StreamPlayer;
