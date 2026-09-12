import React from 'react';
import { Link } from 'react-router-dom';
import { resolveEpisodeImageUrl } from '../native/coverCache';
import { useAuth } from '../contexts/AuthContext';
import { FeedPost } from './PostCard';
import { formatDuration, PODCAST_AUTHOR } from '../podcastMeta';
import ProfileWaveform from './ProfileWaveform';
import AdminFeedShareAction from './admin/AdminFeedShareAction';
import DownloadEpisodeButton from './DownloadEpisodeButton';
import { isNativeApp } from '../native/platform';
import { useEpisodePlayback } from '../hooks/useEpisodePlayback';
import { memberHasStreamAccess } from '../utils/accessPermissions';

interface ProfileFeaturedTrackProps {
  post: FeedPost;
  canStream: boolean;
  canDownload?: boolean;
  selected?: boolean;
  onSelectChange?: (postId: string, selected: boolean) => void;
  unavailable?: boolean;
}

const ProfileFeaturedTrack: React.FC<ProfileFeaturedTrackProps> = ({
  post,
  canStream,
  canDownload = false,
  selected = false,
  onSelectChange,
  unavailable = false
}) => {
  const { user } = useAuth();
  const showPlayControls =
    !unavailable &&
    (canStream || memberHasStreamAccess(user?.is_paying, user?.access_type, user?.payment_category));
  const { streamPath, streamState, startPlayback, prefetchStream } = useEpisodePlayback(post, showPlayControls);
  const coverUrl = resolveEpisodeImageUrl(post.id, post.image_filename);

  const primePlay = (e: React.MouseEvent) => {
    e.preventDefault();
    startPlayback();
  };

  const warmHandlers = {
    onMouseEnter: prefetchStream,
    onFocus: prefetchStream,
    onTouchStart: prefetchStream
  };

  const cover = coverUrl ? (
    <img className="ht-featured-cover" src={coverUrl} alt="" />
  ) : (
    <div className="ht-featured-cover ht-featured-cover-placeholder" aria-hidden>
      ♪
    </div>
  );

  const body = (
    <>
      <div className="ht-featured-top">
        {showPlayControls ? (
          <Link
            to={streamPath}
            state={streamState}
            className="ht-play-btn"
            aria-label={`Play ${post.title}`}
            onClick={primePlay}
            {...warmHandlers}
          >
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M8 5v14l11-7z" fill="currentColor" />
            </svg>
          </Link>
        ) : (
          <span className="ht-play-btn ht-play-btn-disabled" aria-hidden>
            <svg viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" fill="currentColor" />
            </svg>
          </span>
        )}
        <div className="ht-featured-info">
          {showPlayControls ? (
            <Link
              to={streamPath}
              state={streamState}
              className="ht-featured-title-link"
              onClick={primePlay}
              {...warmHandlers}
            >
              <h2 className="ht-featured-title">{post.title}</h2>
            </Link>
          ) : (
            <h2 className="ht-featured-title">{post.title}</h2>
          )}
          <p className="ht-featured-artist">
            <span className="ht-artist-dot" aria-hidden />
            {PODCAST_AUTHOR}
          </p>
        </div>
      </div>
      <ProfileWaveform
        seed={`featured-${post.id}`}
        barCount={80}
        className="ht-featured-waveform"
        postId={post.id}
        durationSecs={post.duration_secs}
      />
      <div className="ht-featured-actions">
        <span className="ht-featured-duration">{formatDuration(post.duration_secs)}</span>
        <span className="ht-featured-badge">Members only</span>
        <AdminFeedShareAction postId={post.id} postTitle={post.title} className="ht-featured-share" />
        {(canDownload || isNativeApp()) && (
          <DownloadEpisodeButton
            postId={post.id}
            postTitle={post.title}
            publishedAt={post.published_at}
            durationSecs={post.duration_secs}
            imageFilename={post.image_filename}
            compact
            className="ht-featured-download"
          />
        )}
      </div>
    </>
  );

  return (
    <article className={`ht-featured${unavailable ? ' is-offline-unavailable' : ''}`}>
      {onSelectChange && (
        <label className="member-episode-checkbox-wrap ht-featured-select">
          <input
            type="checkbox"
            className="member-episode-checkbox"
            checked={selected}
            onChange={(e) => onSelectChange(post.id, e.target.checked)}
            aria-label={`Select ${post.title}`}
          />
        </label>
      )}
      {showPlayControls ? (
        <Link
          to={streamPath}
          state={streamState}
          className="ht-featured-cover-link"
          onClick={primePlay}
          {...warmHandlers}
        >
          {cover}
        </Link>
      ) : (
        cover
      )}
      <div className="ht-featured-body">{body}</div>
    </article>
  );
};

export default ProfileFeaturedTrack;
