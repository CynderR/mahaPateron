import React from 'react';
import { Link } from 'react-router-dom';
import { buildImageUrl } from '../../config';
import { FeedPost } from '../PostCard';
import { formatDuration, PODCAST_AUTHOR, PODCAST_PROFILE_BIO } from '../../podcastMeta';

interface PodcastFeaturedEpisodeProps {
  post: FeedPost;
  canStream: boolean;
  memberSince?: string;
}

const PodcastFeaturedEpisode: React.FC<PodcastFeaturedEpisodeProps> = ({ post, canStream, memberSince }) => {
  const coverUrl = post.image_filename ? buildImageUrl(post.image_filename) : null;

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
          <Link to={`/stream/${post.id}`} className="pod-btn pod-featured-play">
            Play latest episode
          </Link>
        ) : (
          <span className="pod-featured-locked">Subscribe to listen</span>
        )}
      </article>
    </section>
  );
};

export default PodcastFeaturedEpisode;
