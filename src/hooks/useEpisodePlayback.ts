import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildPublicShareStreamUrl, buildStreamUrl } from '../config';
import { useAuth } from '../contexts/AuthContext';
import { useOptionalShare } from '../contexts/ShareContext';
import { usePlayer } from '../contexts/PlayerContext';
import { FeedPost } from '../components/PostCard';
import { useEpisodeStreamLink } from './useEpisodeStreamLink';
import { useStreamLinkState } from './useStreamLinkState';

export const useEpisodePlayback = (post: FeedPost, canStream: boolean) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const share = useOptionalShare();
  const { prepareEpisode } = usePlayer();
  const memberStreamState = useStreamLinkState(post);
  const { streamPath, streamState } = useEpisodeStreamLink(post);

  const startPlayback = useCallback(() => {
    if (!canStream) return;

    if (share) {
      const streamUrl =
        share.memberAccess && user?.rss_token
          ? buildStreamUrl(post.id, user.rss_token)
          : buildPublicShareStreamUrl(post.id, share.shareToken);
      prepareEpisode(post.id, streamUrl, post.duration_secs);
      navigate(streamPath, { state: share.streamState(post) });
      return;
    }

    if (!user?.rss_token) return;
    prepareEpisode(post.id, buildStreamUrl(post.id, user.rss_token), post.duration_secs);
    navigate(streamPath, { state: memberStreamState });
  }, [
    canStream,
    memberStreamState,
    navigate,
    post,
    prepareEpisode,
    share,
    streamPath,
    user?.rss_token
  ]);

  return {
    streamPath,
    streamState: share ? share.streamState(post) : memberStreamState,
    startPlayback
  };
};
