import React from 'react';
import { Link } from 'react-router-dom';
import { FeedPost } from '../PostCard';
import { PODCAST_AUTHOR } from '../../podcastMeta';
import FavoriteButton from '../FavoriteButton';
import PlayerControls from '../PlayerControls';
import PlaylistPicker from '../PlaylistPicker';

interface PodcastStreamMobileProps {
  post: FeedPost;
  coverUrl: string | null;
  playing: boolean;
  currentTime: number;
  duration: number;
  playable: boolean;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onSkip: (delta: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  canPrevious: boolean;
  canNext: boolean;
}

const formatTime = (secs: number): string => {
  if (!Number.isFinite(secs) || secs < 0) return '0:00';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
};

const PodcastStreamMobile: React.FC<PodcastStreamMobileProps> = ({
  post,
  coverUrl,
  playing,
  currentTime,
  duration,
  playable,
  onTogglePlay,
  onSeek,
  onSkip,
  onPrevious,
  onNext,
  canPrevious,
  canNext
}) => {
  const published = post.published_at
    ? new Date(post.published_at).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : '';
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const remaining = Math.max(0, duration - currentTime);

  return (
    <div className="pod-stream pod-mobile-only">
      <div className="pod-stream-art-wrap">
        {coverUrl ? (
          <img className="pod-stream-art" src={coverUrl} alt="" />
        ) : (
          <div className="pod-stream-art pod-episode-cover-placeholder" aria-hidden>
            ♪
          </div>
        )}
      </div>

      <div className="pod-stream-copy">
        <p className="pod-stream-show">{PODCAST_AUTHOR}</p>
        <h1 className="pod-stream-title">{post.title}</h1>
        {published && <p className="pod-stream-date">{published}</p>}
      </div>

      <div className="pod-stream-scrubber">
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={1}
          value={Math.min(currentTime, duration || 0)}
          disabled={!playable || !duration}
          onChange={(e) => onSeek(parseFloat(e.target.value))}
          aria-label="Seek"
          className="pod-stream-range"
          style={{ '--pod-progress': `${progress}%` } as React.CSSProperties}
        />
        <div className="pod-stream-times">
          <span>{formatTime(currentTime)}</span>
          <span>-{formatTime(remaining)}</span>
        </div>
      </div>

      <div className="pod-stream-transport">
        <button type="button" className="pod-stream-skip" onClick={() => onSkip(-15)} disabled={!playable} aria-label="Back 15 seconds">
          -15
        </button>
        <button type="button" className="pod-stream-transport-btn" onClick={onPrevious} disabled={!canPrevious} aria-label="Previous episode">
          <svg viewBox="0 0 24 24" aria-hidden>
            <path fill="currentColor" d="M6 6h2v12H6V6zm3.5 6l8.5 6V6l-8.5 6z" />
          </svg>
        </button>
        <button
          type="button"
          className="pod-stream-play"
          onClick={onTogglePlay}
          disabled={!playable}
          aria-label={playing ? 'Pause' : 'Play'}
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
        <button type="button" className="pod-stream-transport-btn" onClick={onNext} disabled={!canNext} aria-label="Next episode">
          <svg viewBox="0 0 24 24" aria-hidden>
            <path fill="currentColor" d="M6 18l8.5-6L6 6v12zm2.5-6l0 0zm8.5 6V6h2v12h-2z" />
          </svg>
        </button>
        <button type="button" className="pod-stream-skip" onClick={() => onSkip(15)} disabled={!playable} aria-label="Forward 15 seconds">
          +15
        </button>
      </div>

      <div className="pod-stream-tools">
        <PlayerControls
          onPrevious={onPrevious}
          onNext={onNext}
          canPrevious={canPrevious}
          canNext={canNext}
        />
        <FavoriteButton postId={post.id} />
        <PlaylistPicker postId={post.id} />
        <Link to="/feed" className="pod-stream-back-link">
          All episodes
        </Link>
      </div>

      {post.description && (
        <section className="pod-stream-notes">
          <h2>Show notes</h2>
          <p>{post.description}</p>
        </section>
      )}
    </div>
  );
};

export default PodcastStreamMobile;
