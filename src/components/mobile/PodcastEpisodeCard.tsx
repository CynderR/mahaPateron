import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { buildImageUrl, buildStreamUrl } from '../../config';
import { useAuth } from '../../contexts/AuthContext';
import { usePlayer } from '../../contexts/PlayerContext';
import { FeedPost } from '../PostCard';
import { formatDuration, PODCAST_AUTHOR } from '../../podcastMeta';
import FavoriteButton from '../FavoriteButton';

interface PodcastEpisodeCardProps {
  post: FeedPost;
  canStream: boolean;
}

const PodcastEpisodeCard: React.FC<PodcastEpisodeCardProps> = ({ post, canStream }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { playEpisode } = usePlayer();
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
    if (!user?.rss_token || !canStream) return;
    playEpisode(post.id, buildStreamUrl(post.id, user.rss_token), post.duration_secs);
    navigate(`/stream/${post.id}`);
  };

  const cover = coverUrl ? (
    <img className="pod-episode-cover" src={coverUrl} alt="" />
  ) : (
    <div className="pod-episode-cover pod-episode-cover-placeholder" aria-hidden>
      ♪
    </div>
  );

  return (
    <article className="pod-episode-card">
      {canStream ? (
        <Link to={`/stream/${post.id}`} className="pod-episode-card-main">
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
        </Link>
      ) : (
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
    </article>
  );
};

export default PodcastEpisodeCard;
