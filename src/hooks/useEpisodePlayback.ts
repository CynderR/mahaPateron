import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildPublicShareStreamUrl, buildStreamUrl } from '../config';
import { useAuth } from '../contexts/AuthContext';
import { useOptionalShare } from '../contexts/ShareContext';
import { usePlayer } from '../contexts/PlayerContext';
import { FeedPost } from '../components/PostCard';
import { isIOSDevice } from '../utils/streamLoader';
import { useEpisodeStreamLink } from './useEpisodeStreamLink';
import { useStreamLinkState } from './useStreamLinkState';

export const useEpisodePlayback = (post: FeedPost, canStream: boolean) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const share = useOptionalShare();
  const { prepareEpisode, playEpisode, advanceToPost } = usePlayer();
  const memberStreamState = useStreamLinkState(post);
  const { streamPath, streamState } = useEpisodeStreamLink(post);

  const primePlayback = useCallback(
    (streamUrl: string) => {
      advanceToPost(post.id);
      // iOS WebKit requires audio.play() inside the tap handler. Android loads via blob
      // and starts playback once the stream page has finished preparing the file.
      if (isIOSDevice()) {
        playEpisode(post.id, streamUrl, post.duration_secs);
      } else {
        prepareEpisode(post.id, streamUrl, post.duration_secs);
      }
    },
    [advanceToPost, playEpisode, post, prepareEpisode]
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

  return {
    streamPath,
    streamState: share ? share.streamState(post) : memberStreamState,
    startPlayback
  };
};
