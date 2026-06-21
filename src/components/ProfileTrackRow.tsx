import React from 'react';
import { Link } from 'react-router-dom';
import { buildImageUrl } from '../config';
import { FeedPost } from './PostCard';
import { formatDuration, PODCAST_GENRE, PODCAST_AUTHOR } from '../podcastMeta';
import ProfileWaveform from './ProfileWaveform';

interface ProfileTrackRowProps {
  post: FeedPost;
  rank: number;
  canStream: boolean;
  selected?: boolean;
  onSelectChange?: (postId: string, selected: boolean) => void;
}

const ProfileTrackRow: React.FC<ProfileTrackRowProps> = ({
  post,
  rank,
  canStream,
  selected = false,
  onSelectChange
}) => {
  const coverUrl = post.image_filename ? buildImageUrl(post.image_filename) : null;
  const published = post.published_at
    ? new Date(post.published_at).toLocaleDateString(undefined, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
    : '';

  const cover = coverUrl ? (
    <img className="ht-track-cover" src={coverUrl} alt="" />
  ) : (
    <div className="ht-track-cover ht-track-cover-placeholder" aria-hidden>
      ♪
    </div>
  );

  return (
    <article className="ht-track-row">
      {onSelectChange && (
        <label className="member-episode-checkbox-wrap">
          <input
            type="checkbox"
            className="member-episode-checkbox"
            checked={selected}
            onChange={(e) => onSelectChange(post.id, e.target.checked)}
            aria-label={`Select ${post.title}`}
          />
        </label>
      )}
      <div className="ht-track-rank">#{rank}</div>
      <div className="ht-track-cover-wrap">
        {canStream ? (
          <Link to={`/stream/${post.id}`} className="ht-track-cover-link">
            {cover}
          </Link>
        ) : (
          cover
        )}
      </div>
      <div className="ht-track-main">
        <div className="ht-track-head">
          {canStream ? (
            <Link to={`/stream/${post.id}`} className="ht-play-btn ht-play-btn-sm" aria-label={`Play ${post.title}`}>
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d="M8 5v14l11-7z" fill="currentColor" />
              </svg>
            </Link>
          ) : (
            <span className="ht-play-btn ht-play-btn-sm ht-play-btn-disabled" aria-hidden>
              <svg viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" fill="currentColor" />
              </svg>
            </span>
          )}
          <div className="ht-track-text">
            {canStream ? (
              <Link to={`/stream/${post.id}`} className="ht-track-title-link">
                <h3 className="ht-track-title">
                  <span className="ht-track-artist-inline">{PODCAST_AUTHOR}</span> {post.title}
                </h3>
              </Link>
            ) : (
              <h3 className="ht-track-title">
                <span className="ht-track-artist-inline">{PODCAST_AUTHOR}</span> {post.title}
              </h3>
            )}
          </div>
          <div className="ht-track-side">
            <span className="ht-track-genre">{PODCAST_GENRE}</span>
            <span className="ht-track-duration">{formatDuration(post.duration_secs)}</span>
          </div>
        </div>
        <ProfileWaveform seed={post.id} barCount={64} className="ht-track-waveform" />
        <div className="ht-track-meta">
          <span className="ht-track-meta-item">Members only</span>
          {published && <span className="ht-track-meta-item">on {published}</span>}
        </div>
      </div>
    </article>
  );
};

export default ProfileTrackRow;
