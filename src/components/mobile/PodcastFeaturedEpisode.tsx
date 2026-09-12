import React from 'react';
import { resolveEpisodeImageUrl } from '../../native/coverCache';
import { FeedPost } from '../PostCard';
import { formatDuration, PODCAST_AUTHOR, PODCAST_PROFILE_BIO } from '../../podcastMeta';
import AdminFeedShareAction from '../admin/AdminFeedShareAction';
import DownloadEpisodeButton from '../DownloadEpisodeButton';
import { isNativeApp } from '../../native/platform';
import { useEpisodePlayback } from '../../hooks/useEpisodePlayback';

interface PodcastFeaturedEpisodeProps {
  post: FeedPost;
  canStream: boolean;
  canDownload?: boolean;
  selected?: boolean;
  onSelectChange?: (postId: string, selected: boolean) => void;
  unavailable?: boolean;
}

const PodcastFeaturedEpisode: React.FC<PodcastFeaturedEpisodeProps> = ({
  post,
  canStream,
  canDownload = false,
  selected = false,
  onSelectChange,
  unavailable = false
}) => {
  const playable = canStream && !unavailable;
  const { startPlayback } = useEpisodePlayback(post, playable);
  const coverUrl = resolveEpisodeImageUrl(post.id, post.image_filename);

  return (
    <section className="pod-featured pod-mobile-only">
      <div className="pod-featured-show">
        <h2>{PODCAST_AUTHOR}</h2>
        <p>{PODCAST_PROFILE_BIO}</p>
      </div>
      <article className={`pod-featured-latest${unavailable ? ' is-offline-unavailable' : ''}`}>
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
          ) : canDownload || isNativeApp() ? (
            <DownloadEpisodeButton
              postId={post.id}
              postTitle={post.title}
              publishedAt={post.published_at}
              durationSecs={post.duration_secs}
              imageFilename={post.image_filename}
            />
          ) : (
            <span className="pod-featured-locked">Subscribe to listen</span>
          )}
          {canStream && (canDownload || isNativeApp()) && (
            <DownloadEpisodeButton
              postId={post.id}
              postTitle={post.title}
              publishedAt={post.published_at}
              durationSecs={post.duration_secs}
              imageFilename={post.image_filename}
              compact
            />
          )}
          <AdminFeedShareAction postId={post.id} postTitle={post.title} className="pod-featured-share" />
        </div>
      </article>
    </section>
  );
};

export default PodcastFeaturedEpisode;
