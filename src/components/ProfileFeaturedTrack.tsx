import React from 'react';
import { Link } from 'react-router-dom';
import { buildImageUrl, buildStreamUrl } from '../config';
import { useAuth } from '../contexts/AuthContext';
import { usePlayer } from '../contexts/PlayerContext';
import { FeedPost } from './PostCard';
import { formatDuration, PODCAST_AUTHOR } from '../podcastMeta';
import ProfileWaveform from './ProfileWaveform';
import AdminFeedShareAction from './admin/AdminFeedShareAction';
import DownloadEpisodeButton from './DownloadEpisodeButton';
import { useStreamLinkState } from '../hooks/useStreamLinkState';
import { memberHasStreamAccess } from '../utils/accessPermissions';

interface ProfileFeaturedTrackProps {
  post: FeedPost;
  canStream: boolean;
  canDownload?: boolean;
  selected?: boolean;
  onSelectChange?: (postId: string, selected: boolean) => void;
}

const ProfileFeaturedTrack: React.FC<ProfileFeaturedTrackProps> = ({
  post,
  canStream,
  canDownload = false,
  selected = false,
  onSelectChange
}) => {
  const { user } = useAuth();
  const { prepareEpisode } = usePlayer();
  const streamState = useStreamLinkState(post);
  const showPlayControls =
    canStream || memberHasStreamAccess(user?.is_paying, user?.access_type);
  const coverUrl = post.image_filename ? buildImageUrl(post.image_filename) : null;

  const primePlay = () => {
    if (!user?.rss_token || !showPlayControls) return;
    prepareEpisode(post.id, buildStreamUrl(post.id, user.rss_token), post.duration_secs);
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
            to={`/stream/${post.id}`}
            state={streamState}
            className="ht-play-btn"
            aria-label={`Play ${post.title}`}
            onClick={primePlay}
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
            <Link to={`/stream/${post.id}`} state={streamState} className="ht-featured-title-link" onClick={primePlay}>
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
        {canDownload && <DownloadEpisodeButton postId={post.id} postTitle={post.title} compact className="ht-featured-download" />}
      </div>
    </>
  );

  return (
    <article className="ht-featured">
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
        <Link to={`/stream/${post.id}`} state={streamState} className="ht-featured-cover-link" onClick={primePlay}>
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
