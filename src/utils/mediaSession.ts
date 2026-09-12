import { resolveEpisodeImageUrl } from '../native/coverCache';
import { PODCAST_AUTHOR, PODCAST_AVATAR_URL } from '../podcastMeta';
import { QueuePost } from './playerQueue';

export type MediaSessionHandlers = {
  play: () => void;
  pause: () => void;
  seekBy: (deltaSeconds: number) => void;
  seekTo: (timeSeconds: number) => void;
  nextTrack: () => void;
  previousTrack: () => void;
};

const hasMediaSession = (): boolean =>
  typeof navigator !== 'undefined' && typeof navigator.mediaSession !== 'undefined';

const artworkForPost = (post: QueuePost | null | undefined): MediaImage[] => {
  const images: MediaImage[] = [];
  if (post) {
    const src = resolveEpisodeImageUrl(post.id, post.image_filename);
    if (src) {
      images.push({ src, sizes: '512x512', type: 'image/jpeg' });
      images.push({ src, sizes: '256x256', type: 'image/jpeg' });
    }
  }
  if (PODCAST_AVATAR_URL) {
    images.push({ src: PODCAST_AVATAR_URL, sizes: '512x512', type: 'image/png' });
  }
  return images;
};

export const updateMediaSessionMetadata = (post: QueuePost | null | undefined): void => {
  if (!hasMediaSession() || typeof MediaMetadata === 'undefined') return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: post?.title || 'Episode',
    artist: post?.artist || PODCAST_AUTHOR,
    album: post?.album || PODCAST_AUTHOR,
    artwork: artworkForPost(post)
  });
};

export const updateMediaSessionPlaybackState = (playing: boolean): void => {
  if (!hasMediaSession()) return;
  navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
};

export const updateMediaSessionPosition = (
  currentTime: number,
  duration: number,
  playbackRate = 1
): void => {
  if (!hasMediaSession() || typeof navigator.mediaSession.setPositionState !== 'function') return;
  if (!Number.isFinite(duration) || duration <= 0) return;
  try {
    navigator.mediaSession.setPositionState({
      duration,
      playbackRate,
      position: Math.max(0, Math.min(currentTime, duration))
    });
  } catch {
    // ignore out-of-range during seeks
  }
};

export const bindMediaSessionHandlers = (handlers: MediaSessionHandlers): (() => void) => {
  if (!hasMediaSession()) return () => {};

  const bindings: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
    ['play', () => handlers.play()],
    ['pause', () => handlers.pause()],
    ['seekbackward', (details) => handlers.seekBy(-(details.seekOffset || 10))],
    ['seekforward', (details) => handlers.seekBy(details.seekOffset || 10)],
    [
      'seekto',
      (details) => {
        if (typeof details.seekTime === 'number') handlers.seekTo(details.seekTime);
      }
    ],
    ['previoustrack', () => handlers.previousTrack()],
    ['nexttrack', () => handlers.nextTrack()]
  ];

  for (const [action, handler] of bindings) {
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    } catch {
      // unsupported
    }
  }

  return () => {
    for (const [action] of bindings) {
      try {
        navigator.mediaSession.setActionHandler(action, null);
      } catch {
        // ignore
      }
    }
  };
};
