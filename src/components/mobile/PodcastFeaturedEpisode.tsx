import React from 'react';
import { useNavigate } from 'react-router-dom';
import { buildImageUrl, buildStreamUrl } from '../../config';
import { useAuth } from '../../contexts/AuthContext';
import { usePlayer } from '../../contexts/PlayerContext';
import { FeedPost } from '../PostCard';
import { formatDuration, PODCAST_AUTHOR, PODCAST_PROFILE_BIO } from '../../podcastMeta';

interface PodcastFeaturedEpisodeProps {
  post: FeedPost;
  canStream: boolean;
  memberSince?: string;
}

const PodcastFeaturedEpisode: React.FC<PodcastFeaturedEpisodeProps> = ({ post, canStream, memberSince }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { playEpisode } = usePlayer();
  const coverUrl = post.image_filename ? buildImageUrl(post.image_filename) : null;

  const handlePlay = async () => {
    if (!user?.rss_token || !canStream) return;
    await playEpisode(post.id, buildStreamUrl(post.id, user.rss_token), post.duration_secs);
    navigate(`/stream/${post.id}`);
  };

  return (
    <section className="pod-featured pod-mobile-only">
      <div className="pod-featured-show">
        <h2>{PODCAST_AUTHOR}</h2>
        <p>{PODCAST_PROFILE_BIO}</p>
        <p className="pod-featured-since">Member since:{memberSince ? ` ${memberSince}` : ''}</p>
      </div>
      <article className="pod-featured-latest">
        <p className="pod-featured-label">Latest episode</p>
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
        {canStream ? (
          <button type="button" className="pod-btn pod-featured-play" onClick={handlePlay}>
            Play latest episode
          </button>
        ) : (
          <span className="pod-featured-locked">Subscribe to listen</span>
        )}
      </article>
    </section>
  );
};

export default PodcastFeaturedEpisode;
