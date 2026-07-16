import { stripFeedMetadataFromDescription } from '../utils/feedDescriptionHelpers';
import { Link } from 'react-router-dom';
import { buildImageUrl, buildStreamUrl } from '../config';
import { useAuth } from '../contexts/AuthContext';
import DownloadEpisodeButton from './DownloadEpisodeButton';
import { useStreamLinkState } from '../hooks/useStreamLinkState';
import { prefetchEpisodeStream } from '../utils/streamLoader';

export interface FeedPost {
  id: string;
  title: string;
  description?: string | null;
  duration_secs?: number | null;
  published_at?: string;
  image_filename?: string | null;
  artist?: string | null;
  album?: string | null;
  year?: string | null;
  genre?: string | null;
}

interface PostCardProps {
  post: FeedPost;
  rssToken?: string;
  canStream: boolean;
  canDownload?: boolean;
  locked?: boolean;
  selected?: boolean;
  onSelectChange?: (postId: string, selected: boolean) => void;
}

const formatDuration = (secs?: number | null): string => {
  if (secs === null || secs === undefined) return '';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
};

const PostCard: React.FC<PostCardProps> = ({
  post,
  rssToken: rssTokenProp,
  canStream,
  canDownload = false,
  locked = false,
  selected = false,
  onSelectChange
}) => {
  const { user } = useAuth();
  const published = post.published_at ? new Date(post.published_at).toLocaleDateString() : '';
  const coverUrl = post.image_filename ? buildImageUrl(post.image_filename) : null;
  const displayDescription = stripFeedMetadataFromDescription(post.description);
  const streamState = useStreamLinkState(post);
  const rssToken = rssTokenProp ?? user?.rss_token;
  const warmStream = () => {
    if (canStream && !locked && rssToken) {
      prefetchEpisodeStream(post.id, buildStreamUrl(post.id, rssToken));
    }
  };

  return (
    <article className="pod-post-card">
      {onSelectChange && (
        <label className="member-episode-checkbox-wrap pod-post-select">
          <input
            type="checkbox"
            className="member-episode-checkbox"
            checked={selected}
            onChange={(e) => onSelectChange(post.id, e.target.checked)}
            aria-label={`Select ${post.title}`}
          />
        </label>
      )}
      {canStream && !locked ? (
        <Link
          to={`/stream/${post.id}`}
          state={streamState}
          className="pod-post-cover-link"
          onMouseEnter={warmStream}
          onFocus={warmStream}
          onTouchStart={warmStream}
        >
          {coverUrl ? (
            <img className="pod-post-cover" src={coverUrl} alt={post.title} />
          ) : (
            <div className="pod-post-cover-placeholder" aria-hidden>
              ♪
            </div>
          )}
        </Link>
      ) : coverUrl ? (
        <img className="pod-post-cover" src={coverUrl} alt={post.title} />
      ) : (
        <div className="pod-post-cover-placeholder" aria-hidden>
          ♪
        </div>
      )}
      <div className="pod-post-body">
        {canStream && !locked ? (
          <Link
            to={`/stream/${post.id}`}
            state={streamState}
            className="pod-post-title-link"
            onMouseEnter={warmStream}
            onFocus={warmStream}
            onTouchStart={warmStream}
          >
            <h3 className="pod-post-title">{post.title}</h3>
          </Link>
        ) : (
          <h3 className="pod-post-title">{post.title}</h3>
        )}
        <div className="pod-post-meta">
          {published}
          {post.duration_secs ? ` · ${formatDuration(post.duration_secs)}` : ''}
        </div>
        {displayDescription && <p className="pod-post-desc">{displayDescription}</p>}
        {locked ? (
          <p className="pod-post-meta">This episode is outside your subscription period.</p>
        ) : canStream ? (
          <div className="pod-inline-actions">
            <Link
              to={`/stream/${post.id}`}
              state={streamState}
              className="pod-btn pod-stream-listen-btn"
              onMouseEnter={warmStream}
              onFocus={warmStream}
              onTouchStart={warmStream}
            >
              Listen
            </Link>
            {canDownload && <DownloadEpisodeButton postId={post.id} postTitle={post.title} compact />}
          </div>
        ) : canDownload ? (
          <DownloadEpisodeButton postId={post.id} postTitle={post.title} />
        ) : (
          <p className="pod-post-meta">Streaming is not included in your plan.</p>
        )}
      </div>
    </article>
  );
};

export default PostCard;
