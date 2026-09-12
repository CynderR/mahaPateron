import React from 'react';
import { Link } from 'react-router-dom';
import { resolveEpisodeImageUrl } from '../../native/coverCache';
import { FeedPost } from '../PostCard';
import { formatDuration, PODCAST_AUTHOR } from '../../podcastMeta';
import { feedDescriptionPreview } from '../../utils/feedDescriptionHelpers';
import FavoriteButton from '../FavoriteButton';
import AdminFeedShareAction from '../admin/AdminFeedShareAction';
import DownloadEpisodeButton from '../DownloadEpisodeButton';
import PlaybackProgressBar from '../PlaybackProgressBar';
import { useEpisodePlayback } from '../../hooks/useEpisodePlayback';
import { isNativeApp } from '../../native/platform';

interface PodcastEpisodeCardProps {
  post: FeedPost;
  canStream: boolean;
  canDownload?: boolean;
  selected?: boolean;
  onSelectChange?: (postId: string, selected: boolean) => void;
  unavailable?: boolean;
}

const PodcastEpisodeCard: React.FC<PodcastEpisodeCardProps> = ({
  post,
  canStream,
  canDownload = false,
  selected = false,
  onSelectChange,
  unavailable = false
}) => {
  const playable = canStream && !unavailable;
  const { streamPath, streamState, startPlayback, prefetchStream } = useEpisodePlayback(post, playable);
  const coverUrl = resolveEpisodeImageUrl(post.id, post.image_filename);
  const published = post.published_at
    ? new Date(post.published_at).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    : '';

  const handlePlay = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startPlayback();
  };

  const handleCardActivate = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('.member-episode-checkbox-wrap') ||
      target.closest('.pod-episode-play') ||
      target.closest('.pod-episode-controls') ||
      target.closest('.pod-episode-actions')
    ) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    e.preventDefault();
    startPlayback();
  };

  const displayDescription = feedDescriptionPreview(post.description);

  const cover = coverUrl ? (
    <img className="pod-episode-cover" src={coverUrl} alt="" />
  ) : (
    <div className="pod-episode-cover pod-episode-cover-placeholder" aria-hidden>
      ♪
    </div>
  );

  const selectCheckbox = onSelectChange ? (
    <label
      className="member-episode-checkbox-wrap pod-episode-select-inline"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <input
        type="checkbox"
        className="member-episode-checkbox"
        checked={selected}
        onChange={(e) => {
          e.stopPropagation();
          onSelectChange(post.id, e.target.checked);
        }}
        onClick={(e) => e.stopPropagation()}
        aria-label={`Select ${post.title}`}
      />
    </label>
  ) : null;

  const body = (
    <div className="pod-episode-body">
      <div className="pod-episode-head">
        {playable && (
          <div className="pod-episode-controls">
            <button type="button" className="pod-episode-play" onClick={handlePlay} aria-label={`Play ${post.title}`}>
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d="M8 5v14l11-7z" fill="currentColor" />
              </svg>
            </button>
            <FavoriteButton postId={post.id} className="pod-episode-fav" />
          </div>
        )}
        <div className="pod-episode-copy">
          <p className="pod-episode-show">{PODCAST_AUTHOR}</p>
          <h3 className="pod-episode-title">{post.title}</h3>
          <div className="pod-episode-meta">
            {published && <span>{published}</span>}
            {post.duration_secs != null && <span>{formatDuration(post.duration_secs)}</span>}
          </div>
        </div>
        {playable && (
          <div className="pod-episode-actions">
            {(canDownload || isNativeApp()) && (
              <DownloadEpisodeButton
                postId={post.id}
                postTitle={post.title}
                publishedAt={post.published_at}
                durationSecs={post.duration_secs}
                imageFilename={post.image_filename}
                compact
                className="pod-episode-download"
              />
            )}
            <AdminFeedShareAction postId={post.id} postTitle={post.title} className="pod-episode-share" />
          </div>
        )}
      </div>
      {unavailable && <p className="pod-episode-desc">Not downloaded on this device.</p>}
      {displayDescription && <p className="pod-episode-desc">{displayDescription}</p>}
    </div>
  );

  return (
    <article className={`pod-episode-card${unavailable ? ' is-offline-unavailable' : ''}`}>
      <div className="pod-episode-card-row">
        {selectCheckbox}
        {playable ? (
          <Link
            to={streamPath}
            state={streamState}
            className="pod-episode-card-main"
            onClick={handleCardActivate}
            onMouseEnter={prefetchStream}
            onFocus={prefetchStream}
            onTouchStart={prefetchStream}
          >
            {cover}
            {body}
          </Link>
        ) : (
          <div className="pod-episode-card-main">
            {cover}
            {body}
          </div>
        )}
      </div>
      <PlaybackProgressBar
        postId={post.id}
        durationSecs={post.duration_secs}
        seekable={false}
        variant="thin"
        className="pod-episode-progress"
      />
    </article>
  );
};

export default PodcastEpisodeCard;
