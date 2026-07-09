import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildPublicShareStreamUrl, buildStreamUrl } from '../config';
import { useAuth } from '../contexts/AuthContext';
import { useOptionalShare } from '../contexts/ShareContext';
import { usePlayer } from '../contexts/PlayerContext';
import { FeedPost } from '../components/PostCard';
import { prefetchEpisodeStream } from '../utils/streamLoader';
import { useEpisodeStreamLink } from './useEpisodeStreamLink';
import { useStreamLinkState } from './useStreamLinkState';

export const useEpisodePlayback = (post: FeedPost, canStream: boolean) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const share = useOptionalShare();
  const { playEpisode, advanceToPost } = usePlayer();
  const memberStreamState = useStreamLinkState(post);
  const { streamPath, streamState } = useEpisodeStreamLink(post);

  const primePlayback = useCallback(
    (streamUrl: string) => {
      advanceToPost(post.id);
      // Start playback in the user-gesture handler so every platform can begin
      // buffering immediately (SoundCloud-style) instead of waiting for the stream page.
      playEpisode(post.id, streamUrl, post.duration_secs);
    },
    [advanceToPost, playEpisode, post]
  );

  const startPlayback = useCallback(() => {
    if (!canStream) return;

    if (share) {
      const streamUrl = user?.rss_token
        ? buildStreamUrl(post.id, user.rss_token)
        : buildPublicShareStreamUrl(post.id, share.shareToken);
      primePlayback(streamUrl);
      navigate(streamPath, { state: share.streamState(post) });
      return;
    }

    if (!user?.rss_token) return;
    primePlayback(buildStreamUrl(post.id, user.rss_token));
    navigate(streamPath, { state: memberStreamState });
  }, [
    canStream,
    memberStreamState,
    navigate,
    post,
    primePlayback,
    share,
    streamPath,
    user?.rss_token
  ]);

  const prefetchStream = useCallback(() => {
    if (!canStream) return;
    if (share) {
      const streamUrl = user?.rss_token
        ? buildStreamUrl(post.id, user.rss_token)
        : buildPublicShareStreamUrl(post.id, share.shareToken);
      prefetchEpisodeStream(post.id, streamUrl);
      return;
    }
    if (user?.rss_token) {
      prefetchEpisodeStream(post.id, buildStreamUrl(post.id, user.rss_token));
    }
  }, [canStream, post.id, share, user?.rss_token]);

  return {
    streamPath,
    streamState: share ? share.streamState(post) : memberStreamState,
    startPlayback,
    prefetchStream
  };
};
