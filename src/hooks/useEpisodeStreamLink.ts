import { FeedPost } from '../components/PostCard';
import { useOptionalShare } from '../contexts/ShareContext';
import { useStreamLinkState } from './useStreamLinkState';

export const useEpisodeStreamLink = (post: FeedPost) => {
  const share = useOptionalShare();
  const streamState = useStreamLinkState(post);
  const streamPath = share
    ? share.streamPath(post.id)
    : `/stream/${encodeURIComponent(post.id)}`;

  return { streamPath, streamState };
};
