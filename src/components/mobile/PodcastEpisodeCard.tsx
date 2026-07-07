import React from 'react';
import { Link } from 'react-router-dom';
import { buildImageUrl } from '../../config';
import { FeedPost } from '../PostCard';
import { formatDuration, PODCAST_AUTHOR } from '../../podcastMeta';
import { feedDescriptionPreview } from '../../utils/feedDescriptionHelpers';
import FavoriteButton from '../FavoriteButton';
import AdminFeedShareAction from '../admin/AdminFeedShareAction';
import DownloadEpisodeButton from '../DownloadEpisodeButton';
import PlaybackProgressBar from '../PlaybackProgressBar';
import { useEpisodePlayback } from '../../hooks/useEpisodePlayback';

interface PodcastEpisodeCardProps {
  post: FeedPost;
  canStream: boolean;
  canDownload?: boolean;
  selected?: boolean;
  onSelectChange?: (postId: string, selected: boolean) => void;
}

const PodcastEpisodeCard: React.FC<PodcastEpisodeCardProps> = ({
  post,
  canStream,
  canDownload = false,
  selected = false,
  onSelectChange
}) => {
  const { streamPath, streamState, startPlayback } = useEpisodePlayback(post, canStream);
  const coverUrl = post.image_filename ? buildImageUrl(post.image_filename) : null;
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
    if (target.closest('.member-episode-checkbox-wrap')) {
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

  const coverWithSelect = (
    <div className="pod-episode-cover-stack">
      {onSelectChange && (
        <label
          className="member-episode-checkbox-wrap pod-episode-select"
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
      )}
      {cover}
    </div>
  );

  return (
    <article className="pod-episode-card">
      {canStream ? (
        <Link to={streamPath} state={streamState} className="pod-episode-card-main" onClick={handleCardActivate}>
          {coverWithSelect}
          <div className="pod-episode-body">
            <p className="pod-episode-show">{PODCAST_AUTHOR}</p>
            <h3 className="pod-episode-title">{post.title}</h3>
            <div className="pod-episode-meta">
              {published && <span>{published}</span>}
              {post.duration_secs != null && <span>{formatDuration(post.duration_secs)}</span>}
            </div>
            {displayDescription && <p className="pod-episode-desc">{displayDescription}</p>}
          </div>
        </Link>
      ) : (
        <>
          {coverWithSelect}
          <div className="pod-episode-body">
            <p className="pod-episode-show">{PODCAST_AUTHOR}</p>
            <h3 className="pod-episode-title">{post.title}</h3>
            <div className="pod-episode-meta">
              {published && <span>{published}</span>}
              {post.duration_secs != null && <span>{formatDuration(post.duration_secs)}</span>}
            </div>
            {displayDescription && <p className="pod-episode-desc">{displayDescription}</p>}
          </div>
        </>
      )}
      {canStream && (
        <button type="button" className="pod-episode-play" onClick={handlePlay} aria-label={`Play ${post.title}`}>
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M8 5v14l11-7z" fill="currentColor" />
          </svg>
        </button>
      )}
      {canStream && <FavoriteButton postId={post.id} className="pod-episode-fav" />}
      {canDownload && (
        <DownloadEpisodeButton postId={post.id} postTitle={post.title} compact className="pod-episode-download" />
      )}
      <AdminFeedShareAction postId={post.id} postTitle={post.title} className="pod-episode-share" />
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
