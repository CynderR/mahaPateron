import React from 'react';
import { buildImageUrl } from '../../config';
import { FeedPost } from '../PostCard';
import { formatDuration, PODCAST_AUTHOR, PODCAST_PROFILE_BIO } from '../../podcastMeta';
import AdminFeedShareAction from '../admin/AdminFeedShareAction';
import DownloadEpisodeButton from '../DownloadEpisodeButton';
import { useEpisodePlayback } from '../../hooks/useEpisodePlayback';

interface PodcastFeaturedEpisodeProps {
  post: FeedPost;
  canStream: boolean;
  canDownload?: boolean;
  selected?: boolean;
  onSelectChange?: (postId: string, selected: boolean) => void;
}

const PodcastFeaturedEpisode: React.FC<PodcastFeaturedEpisodeProps> = ({
  post,
  canStream,
  canDownload = false,
  selected = false,
  onSelectChange
}) => {
  const { startPlayback } = useEpisodePlayback(post, canStream);
  const coverUrl = post.image_filename ? buildImageUrl(post.image_filename) : null;

  return (
    <section className="pod-featured pod-mobile-only">
      <div className="pod-featured-show">
        <h2>{PODCAST_AUTHOR}</h2>
        <p>{PODCAST_PROFILE_BIO}</p>
      </div>
      <article className="pod-featured-latest">
        <div className="pod-featured-latest-head">
          <p className="pod-featured-label">Latest episode</p>
          {onSelectChange && (
            <label
              className="member-episode-checkbox-wrap pod-featured-select"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <input
                type="checkbox"
                className="member-episode-checkbox"
                checked={selected}
                onChange={(e) => onSelectChange(post.id, e.target.checked)}
                onClick={(e) => e.stopPropagation()}
                aria-label={`Select ${post.title}`}
              />
            </label>
          )}
        </div>
        {coverUrl ? (
          <img className="pod-featured-art" src={coverUrl} alt="" />
        ) : (
          <div className="pod-featured-art pod-episode-cover-placeholder" aria-hidden>
            ♪
          </div>
        )}
        <h3 className="pod-featured-title">{post.title}</h3>
        <p className="pod-featured-meta">
          {post.duration_secs != null && formatDuration(post.duration_secs)}
        </p>
        <div className="pod-featured-actions">
          {canStream ? (
            <button type="button" className="pod-btn pod-featured-play" onClick={startPlayback}>
              Play latest episode
            </button>
          ) : canDownload ? (
            <DownloadEpisodeButton postId={post.id} postTitle={post.title} />
          ) : (
            <span className="pod-featured-locked">Subscribe to listen</span>
          )}
          {canStream && canDownload && (
            <DownloadEpisodeButton postId={post.id} postTitle={post.title} compact />
          )}
          <AdminFeedShareAction postId={post.id} postTitle={post.title} className="pod-featured-share" />
        </div>
      </article>
    </section>
  );
};

export default PodcastFeaturedEpisode;
