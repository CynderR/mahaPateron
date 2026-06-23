import React from 'react';
import { useNavigate } from 'react-router-dom';
import { buildImageUrl, buildStreamUrl } from '../../config';
import { useAuth } from '../../contexts/AuthContext';
import { usePlayer } from '../../contexts/PlayerContext';
import { FeedPost } from '../PostCard';
import { formatDuration, PODCAST_AUTHOR, PODCAST_PROFILE_BIO } from '../../podcastMeta';
import AdminFeedShareAction from '../admin/AdminFeedShareAction';
import { useStreamLinkState } from '../../hooks/useStreamLinkState';

interface PodcastFeaturedEpisodeProps {
  post: FeedPost;
  canStream: boolean;
  selected?: boolean;
  onSelectChange?: (postId: string, selected: boolean) => void;
}

const PodcastFeaturedEpisode: React.FC<PodcastFeaturedEpisodeProps> = ({
  post,
  canStream,
  selected = false,
  onSelectChange
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { prepareEpisode } = usePlayer();
  const streamState = useStreamLinkState(post);
  const coverUrl = post.image_filename ? buildImageUrl(post.image_filename) : null;

  const handlePlay = () => {
    if (!user?.rss_token || !canStream) return;
    prepareEpisode(post.id, buildStreamUrl(post.id, user.rss_token), post.duration_secs);
    navigate(`/stream/${post.id}`, { state: streamState });
  };

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
            <button type="button" className="pod-btn pod-featured-play" onClick={handlePlay}>
              Play latest episode
            </button>
          ) : (
            <span className="pod-featured-locked">Subscribe to listen</span>
          )}
          <AdminFeedShareAction postId={post.id} postTitle={post.title} className="pod-featured-share" />
        </div>
      </article>
    </section>
  );
};

export default PodcastFeaturedEpisode;
