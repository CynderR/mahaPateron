import React from 'react';
import AudioPlayer from './AudioPlayer';
import { buildImageUrl } from '../config';

export interface FeedPost {
  id: string;
  title: string;
  description?: string | null;
  duration_secs?: number | null;
  published_at?: string;
  image_filename?: string | null;
}

interface PostCardProps {
  post: FeedPost;
  rssToken?: string;
  canStream: boolean;
  locked?: boolean;
}

const formatDuration = (secs?: number | null): string => {
  if (secs === null || secs === undefined) return '';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
};

const PostCard: React.FC<PostCardProps> = ({ post, rssToken, canStream, locked = false }) => {
  const published = post.published_at ? new Date(post.published_at).toLocaleDateString() : '';
  const coverUrl = post.image_filename ? buildImageUrl(post.image_filename) : null;

  return (
    <article className="pod-post-card">
      {coverUrl ? (
        <img className="pod-post-cover" src={coverUrl} alt={post.title} />
      ) : (
        <div className="pod-post-cover-placeholder" aria-hidden>
          ♪
        </div>
      )}
      <div className="pod-post-body">
        <h3 className="pod-post-title">{post.title}</h3>
        <div className="pod-post-meta">
          {published}
          {post.duration_secs ? ` · ${formatDuration(post.duration_secs)}` : ''}
        </div>
        {post.description && <p className="pod-post-desc">{post.description}</p>}
        {locked ? (
          <p className="pod-post-meta">This episode is outside your subscription period.</p>
        ) : canStream ? (
          <AudioPlayer postId={post.id} rssToken={rssToken} />
        ) : (
          <p className="pod-post-meta">Streaming is not included in your plan.</p>
        )}
      </div>
    </article>
  );
};

export default PostCard;
