import React from 'react';
import { buildImageUrl, buildPublicShareStreamUrl } from '../config';
import { stripFeedMetadataFromDescription } from '../utils/feedDescriptionHelpers';

export interface PublicSharePost {
  id: string;
  title: string;
  description?: string;
  duration_secs?: number;
  published_at?: string;
  image_filename?: string | null;
}

interface PublicShareEpisodeRowProps {
  post: PublicSharePost;
  shareToken: string;
  featured?: boolean;
  playing: boolean;
  loading?: boolean;
  onTogglePlay: (postId: string, streamUrl: string) => void;
}

const formatDuration = (secs?: number): string => {
  if (!secs && secs !== 0) return '';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

const PublicShareEpisodeRow: React.FC<PublicShareEpisodeRowProps> = ({
  post,
  shareToken,
  featured = false,
  playing,
  loading = false,
  onTogglePlay
}) => {
  const coverUrl = post.image_filename ? buildImageUrl(post.image_filename) : null;
  const streamUrl = buildPublicShareStreamUrl(post.id, shareToken);
  const description = stripFeedMetadataFromDescription(post.description);
  const published = post.published_at
    ? new Date(post.published_at).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    : '';

  const cover = coverUrl ? (
    <img className="public-share-row-cover" src={coverUrl} alt="" />
  ) : (
    <div className="public-share-row-cover public-share-cover-placeholder" aria-hidden>
      ♪
    </div>
  );

  return (
    <article className={`public-share-row${featured ? ' public-share-row-featured' : ''}`}>
      {cover}
      <div className="public-share-row-body">
        {featured && <p className="public-share-kicker">Shared episode</p>}
        <h2 className={featured ? 'public-share-title' : 'public-share-row-title'}>{post.title}</h2>
        <div className="public-share-row-meta">
          {published && <span>{published}</span>}
          {post.duration_secs != null && <span>{formatDuration(post.duration_secs)}</span>}
        </div>
        {description && <p className="public-share-description">{description}</p>}
        <button
          type="button"
          className="pod-btn pod-btn-sm public-share-row-play"
          onClick={() => onTogglePlay(post.id, streamUrl)}
          disabled={loading}
        >
          {loading ? 'Loading…' : playing ? 'Pause' : 'Play'}
        </button>
      </div>
    </article>
  );
};

export default PublicShareEpisodeRow;
