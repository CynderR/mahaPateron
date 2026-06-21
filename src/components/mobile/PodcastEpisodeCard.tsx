import React from 'react';
import { Link } from 'react-router-dom';
import { buildImageUrl } from '../../config';
import { FeedPost } from '../PostCard';
import { formatDuration, PODCAST_AUTHOR } from '../../podcastMeta';
import FavoriteButton from '../FavoriteButton';

interface PodcastEpisodeCardProps {
  post: FeedPost;
  canStream: boolean;
}

const PodcastEpisodeCard: React.FC<PodcastEpisodeCardProps> = ({ post, canStream }) => {
  const coverUrl = post.image_filename ? buildImageUrl(post.image_filename) : null;
  const published = post.published_at
    ? new Date(post.published_at).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    : '';

  const cover = coverUrl ? (
    <img className="pod-episode-cover" src={coverUrl} alt="" />
  ) : (
    <div className="pod-episode-cover pod-episode-cover-placeholder" aria-hidden>
      ♪
    </div>
  );

  const body = (
    <>
      {cover}
      <div className="pod-episode-body">
        <p className="pod-episode-show">{PODCAST_AUTHOR}</p>
        <h3 className="pod-episode-title">{post.title}</h3>
        <div className="pod-episode-meta">
          {published && <span>{published}</span>}
          {post.duration_secs != null && <span>{formatDuration(post.duration_secs)}</span>}
        </div>
        {post.description && <p className="pod-episode-desc">{post.description.split('\n')[0]}</p>}
      </div>
      {canStream && <FavoriteButton postId={post.id} className="pod-episode-fav" />}
    </>
  );

  if (canStream) {
    return (
      <Link to={`/stream/${post.id}`} className="pod-episode-card pod-episode-card-link">
        {body}
      </Link>
    );
  }

  return <article className="pod-episode-card">{body}</article>;
};

export default PodcastEpisodeCard;
