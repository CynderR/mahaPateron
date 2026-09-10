import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import axios from 'axios';
import { buildPublicShareStreamUrl, buildStreamUrl } from '../config';
import { useAuth } from './AuthContext';
import {
  buildShuffleOrder,
  cycleReplayMode,
  QueuePost,
  ReplayMode,
  resolveNextIndex,
  resolvePrevIndex
} from '../utils/playerQueue';
import {
  memberHasShareFullAccess,
  memberStreamPreviewSeconds,
  SHARE_PREVIEW_STREAM_SECONDS
} from '../utils/accessPermissions';
import {
  clearStreamBlob,
  getCachedStreamBlob,
  getInflightStreamBlob,
  loadStreamBlob,
  prefetchStreamMedia,
  shouldTryBlobFallback
} from '../utils/streamLoader';
import { getCachedOfflinePlaybackUrl, loadOfflineIndex } from '../native/offlineStorage';
import { isNativeApp } from '../native/platform';
import { canPlayOffline } from '../native/appCatalog';
import { parseOfflineUse } from '../utils/appAccess';
import {
  bindMediaSessionHandlers,
  updateMediaSessionMetadata,
  updateMediaSessionPlaybackState,
  updateMediaSessionPosition
} from '../utils/mediaSession';
import { postIdsMatch } from '../utils/episodeListHelpers';
import {
  AutoplayTimeoutHours,
  autoplayTimeoutMs,
  readAutoplayTimeoutHours,
  writeAutoplayTimeoutHours
} from '../utils/autoplayTimeout';

/** Derive the next episode URL from the current stream (member token or share). */
const resolveStreamUrlForPost = (
  postId: string,
  currentUrl: string | null | undefined,
  rssToken: string | null | undefined
): string | null => {
  if (currentUrl) {
    try {
      const parsed = new URL(currentUrl, typeof window !== 'undefined' ? window.location.origin : undefined);
      const share = parsed.searchParams.get('share');
      if (share) return buildPublicShareStreamUrl(postId, share);
      const token = parsed.searchParams.get('token');
      if (token) return buildStreamUrl(postId, token);
    } catch {
      // Fall through to rss token.
    }
  }
  if (rssToken) return buildStreamUrl(postId, rssToken);
  return null;
};

export interface PlaylistSummary {
  id: string;
  name: string;
  item_count: number;
  items: {
    post_id: string;
    title: string;
    duration_secs?: number;
    published_at?: string;
    image_filename?: string | null;
  }[];
}

interface PlayerContextType {
  replayMode: ReplayMode;
  shuffle: boolean;
  queue: QueuePost[];
  currentIndex: number;
  favorites: Set<string>;
  playlists: PlaylistSummary[];
  activePostId: string | null;
  playing: boolean;
  currentTime: number;
  duration: number;
  playbackError: string | null;
  mediaLoading: boolean;
  mediaReady: boolean;
  autoplayTimeoutHours: AutoplayTimeoutHours;
  autoplayTimeRemainingMs: number | null;
  streamPreviewSeconds: number | null;
  setAutoplayTimeoutHours: (hours: AutoplayTimeoutHours) => void;
  cycleReplay: () => void;
  toggleShuffle: () => void;
  setQueue: (
    posts: QueuePost[],
    currentPostId: string,
    options?: { fromPlaylist?: boolean; preserveShuffleOrder?: boolean }
  ) => void;
  playQueueFromPlaylist: (posts: QueuePost[], startPostId: string) => void;
  getNextPostId: () => string | null;
  getPrevPostId: () => string | null;
  isFavorite: (postId: string) => boolean;
  toggleFavorite: (postId: string) => Promise<void>;
  refreshPlaylists: () => Promise<void>;
  createPlaylist: (name: string, postIds?: string[]) => Promise<PlaylistSummary | null>;
  addToPlaylist: (playlistId: string, postId: string) => Promise<void>;
  addManyToPlaylist: (playlistId: string, postIds: string[]) => Promise<{ added: number; failed: number }>;
  removeFromPlaylist: (playlistId: string, postId: string) => Promise<void>;
  deletePlaylist: (playlistId: string) => Promise<void>;
  prepareEpisode: (postId: string, streamUrl: string, durationSecs?: number | null) => void;
  playEpisode: (postId: string, streamUrl: string, durationSecs?: number | null) => void;
  loadEpisodeForStream: (postId: string, streamUrl: string, durationSecs?: number | null) => void;
  advanceToPost: (postId: string) => void;
  togglePlayback: () => void;
  seekTo: (time: number) => void;
  skipBy: (delta: number) => void;
  playNextInQueue: () => QueuePost | null;
  /** Called after autoplay has already started the next episode; UI should navigate. */
  registerTrackEndedHandler: (handler: ((nextPost: QueuePost) => void) | null) => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

const REPLAY_STORAGE_KEY = 'playerReplayMode';
const SHUFFLE_STORAGE_KEY = 'playerShuffle';

const readReplayMode = (): ReplayMode => {
  const stored = localStorage.getItem(REPLAY_STORAGE_KEY);
  if (stored === 'all' || stored === 'off' || stored === 'one') return stored;
  return 'off';
};

const readShuffle = (): boolean => localStorage.getItem(SHUFFLE_STORAGE_KEY) === 'true';

const SEEK_PLAYBACK_GRACE_MS = 15000;

const audioHasEpisode = (audio: HTMLAudioElement, postId: string, blobUrl: string | null): boolean => {
  const src = audio.currentSrc || audio.src || '';
  if (blobUrl && src === blobUrl) return true;
  return src.includes(postId);
};

const playbackSourceUrl = (postId: string, streamUrl: string, blobUrl: string | null): string | null => {
  const offline = getCachedOfflinePlaybackUrl(postId);
  if (offline) return offline;
  const resolved = blobUrl ?? getCachedStreamBlob(postId);
  if (resolved) return resolved;
  return streamUrl;
};

const describeMediaError = (audio: HTMLAudioElement): string => {
  const code = audio.error?.code;
  if (code === MediaError.MEDIA_ERR_NETWORK) return 'Network error while loading audio.';
  if (code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) return 'This episode could not be loaded.';
  if (code === MediaError.MEDIA_ERR_ABORTED) return 'Playback was interrupted.';
  return 'Could not load this episode.';
};

export const PlayerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const audioSlotsRef = useRef<[HTMLAudioElement | null, HTMLAudioElement | null]>([null, null]);
  const activeSlotRef = useRef(0);
  const standbyPostIdRef = useRef<string | null>(null);
  const standbyUrlRef = useRef<string | null>(null);
  const userPausedRef = useRef(false);
  const activePostIdRef = useRef<string | null>(null);
  const assignedSourceRef = useRef<{ postId: string; url: string } | null>(null);
  const loadedPostIdRef = useRef<string | null>(null);
  const pendingPlayCleanupRef = useRef<(() => void) | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const autoplayAdvancePostIdRef = useRef<string | null>(null);
  const queueFromPlaylistRef = useRef(false);
  const prefetchedNextPostIdRef = useRef<string | null>(null);
  const autoplayDeadlineRef = useRef<number | null>(null);
  const autoplayTimedOutRef = useRef(false);
  const playbackErrorRef = useRef<string | null>(null);
  const onTrackEndedRef = useRef<((nextPost: QueuePost) => void) | null>(null);
  const autoplayAdvanceNextRef = useRef<() => void>(() => {});
  const pendingAutoplayNavigateRef = useRef<QueuePost | null>(null);
  const pendingLockScreenResumeRef = useRef(false);
  const requestPlayRef = useRef<() => void>(() => {});
  const playRequestedRef = useRef(false);
  const autoplayHandoffRef = useRef(false);
  const playbackGraceUntilRef = useRef(0);
  const suppressAudioErrorsRef = useRef(false);
  const preloadGenerationRef = useRef(0);
  const preloadCleanupRef = useRef<(() => void) | null>(null);
  const streamPreviewLimitRef = useRef<number | null>(null);
  const replayModeRef = useRef<ReplayMode>(readReplayMode());
  const [replayMode, setReplayMode] = useState<ReplayMode>(readReplayMode);
  const [shuffle, setShuffle] = useState(readShuffle);
  const [queue, setQueueState] = useState<QueuePost[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [shuffleOrder, setShuffleOrder] = useState<number[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  const [autoplayTimeoutHours, setAutoplayTimeoutHoursState] = useState<AutoplayTimeoutHours>(readAutoplayTimeoutHours);
  const [autoplayTimeRemainingMs, setAutoplayTimeRemainingMs] = useState<number | null>(null);
  const [playingShareStream, setPlayingShareStream] = useState(false);

  const getActiveAudio = useCallback(() => audioSlotsRef.current[activeSlotRef.current], []);
  const getStandbyAudio = useCallback(() => audioSlotsRef.current[1 - activeSlotRef.current], []);

  const streamPreviewSeconds = useMemo(() => {
    // Payment = Subscribed (blue tick) → full playback everywhere.
    if (user && memberHasShareFullAccess(user.payment_category, user.is_paying)) {
      return null;
    }
    // Share links: 2-minute preview when Payment is Not Subscribed (or anonymous).
    if (playingShareStream) {
      return SHARE_PREVIEW_STREAM_SECONDS;
    }
    // Logged-in Not Subscribed users on the main app: standard preview.
    if (user) {
      return memberStreamPreviewSeconds(user.payment_category, user.is_paying);
    }
    return null;
  }, [user, playingShareStream]);

  useEffect(() => {
    streamPreviewLimitRef.current = streamPreviewSeconds;
  }, [streamPreviewSeconds]);

  useEffect(() => {
    if (!isNativeApp()) return;
    void loadOfflineIndex();
  }, []);

  const clampPlaybackTime = useCallback(
    (time: number, audioDuration?: number) => {
      const limit = streamPreviewLimitRef.current;
      const audioMax =
        audioDuration != null && Number.isFinite(audioDuration) && audioDuration > 0
          ? audioDuration
          : duration;
      const max = limit != null ? Math.min(limit, audioMax || limit) : audioMax || time;
      return Math.max(0, Math.min(time, max || time));
    },
    [duration]
  );

  useEffect(() => {
    replayModeRef.current = replayMode;
  }, [replayMode]);

  useEffect(() => {
    playbackErrorRef.current = playbackError;
  }, [playbackError]);

  const clearPendingPlay = useCallback(() => {
    pendingPlayCleanupRef.current?.();
    pendingPlayCleanupRef.current = null;
  }, []);

  const sourceIsPrimed = useCallback((postId: string): boolean => {
    const audio = getActiveAudio();
    if (!audio || !postIdsMatch(loadedPostIdRef.current, postId)) return false;
    return audioHasEpisode(audio, postId, blobUrlRef.current);
  }, [getActiveAudio]);

  const syncPlayingState = useCallback(() => {
    const audio = getActiveAudio();
    if (!audio) return;
    setPlaying(!audio.paused && !audio.ended);
  }, [getActiveAudio]);

  const stopForAutoplayTimeout = useCallback(() => {
    const audio = getActiveAudio();
    autoplayDeadlineRef.current = null;
    autoplayTimedOutRef.current = true;
    setAutoplayTimeRemainingMs(null);
    autoplayAdvancePostIdRef.current = null;
    if (audio) {
      clearPendingPlay();
      audio.pause();
    }
    setPlaying(false);
    setPlaybackError('Playback stopped — autoplay time limit reached.');
  }, [clearPendingPlay, getActiveAudio]);

  const isAutoplayTimeoutExpired = useCallback(() => {
    const deadline = autoplayDeadlineRef.current;
    return deadline != null && Date.now() >= deadline;
  }, []);

  const armAutoplayDeadline = useCallback((hours: AutoplayTimeoutHours) => {
    if (hours <= 0) {
      autoplayDeadlineRef.current = null;
      setAutoplayTimeRemainingMs(null);
      return;
    }
    const deadline = Date.now() + autoplayTimeoutMs(hours);
    autoplayDeadlineRef.current = deadline;
    setAutoplayTimeRemainingMs(deadline - Date.now());
  }, []);

  const setAutoplayTimeoutHours = useCallback(
    (hours: AutoplayTimeoutHours) => {
      writeAutoplayTimeoutHours(hours);
      setAutoplayTimeoutHoursState(hours);
      autoplayTimedOutRef.current = false;
      armAutoplayDeadline(hours);
      if (hours > 0) {
        setPlaybackError(null);
      }
    },
    [armAutoplayDeadline]
  );

  useEffect(() => {
    if (autoplayTimeoutHours <= 0) {
      autoplayDeadlineRef.current = null;
      setAutoplayTimeRemainingMs(null);
      return undefined;
    }

    if (!autoplayDeadlineRef.current) {
      armAutoplayDeadline(autoplayTimeoutHours);
    }

    const tick = () => {
      const deadline = autoplayDeadlineRef.current;
      if (deadline == null) return;
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        stopForAutoplayTimeout();
        return;
      }
      setAutoplayTimeRemainingMs(remaining);
    };

    tick();
    const intervalId = window.setInterval(tick, 1000);
    return () => window.clearInterval(intervalId);
  }, [autoplayTimeoutHours, armAutoplayDeadline, stopForAutoplayTimeout]);

  const assignEpisode = useCallback((
    postId: string,
    streamUrl: string,
    durationSecs?: number | null,
    options?: { softHandoff?: boolean }
  ) => {
    const softHandoff = options?.softHandoff === true;
    const changed =
      !assignedSourceRef.current ||
      !postIdsMatch(assignedSourceRef.current.postId, postId) ||
      assignedSourceRef.current.url !== streamUrl;

    assignedSourceRef.current = { postId, url: streamUrl };
    activePostIdRef.current = postId;
    setActivePostId(postId);
    setPlayingShareStream(/[?&]share=/.test(streamUrl));
    setPlaybackError(null);

    if (changed) {
      setCurrentTime(0);
      setDuration(durationSecs ?? 0);
      setPlaying(false);
      playRequestedRef.current = false;
      playbackGraceUntilRef.current = 0;
      clearPendingPlay();
      preloadCleanupRef.current?.();
      preloadCleanupRef.current = null;
      preloadGenerationRef.current += 1;

      const previousPostId = loadedPostIdRef.current;
      if (previousPostId && !postIdsMatch(previousPostId, postId)) {
        clearStreamBlob(previousPostId);
      }

      blobUrlRef.current = null;
      setMediaLoading(true);
      setMediaReady(false);

      const audio = getActiveAudio();
      // Soft handoff (autoplay next): skip empty-src clear so play() stays in the
      // ended-handler stack and browsers keep continuous-playback privilege.
      if (audio && previousPostId && !postIdsMatch(previousPostId, postId) && !softHandoff) {
        suppressAudioErrorsRef.current = true;
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
        loadedPostIdRef.current = null;
      } else if (softHandoff) {
        loadedPostIdRef.current = null;
      }
    } else if (durationSecs != null) {
      setDuration((prev) => prev || durationSecs);
    }

    return true;
  }, [clearPendingPlay, getActiveAudio]);

  const primeAudioSource = useCallback((force = false) => {
    const audio = getActiveAudio();
    const assigned = assignedSourceRef.current;
    if (!audio || !assigned) return false;

    const src = playbackSourceUrl(assigned.postId, assigned.url, blobUrlRef.current);
    if (!src) return false;

    if (
      !force &&
      postIdsMatch(loadedPostIdRef.current, assigned.postId) &&
      audioHasEpisode(audio, assigned.postId, blobUrlRef.current)
    ) {
      suppressAudioErrorsRef.current = false;
      return true;
    }

    clearPendingPlay();
    audio.pause();
    audio.src = src;
    audio.preload = 'auto';
    audio.volume = 1;
    audio.muted = false;
    audio.load();
    loadedPostIdRef.current = assigned.postId;
    suppressAudioErrorsRef.current = false;
    setPlaybackError(null);
    return true;
  }, [clearPendingPlay, getActiveAudio]);

  const beginPlayback = useCallback(
    (audio: HTMLAudioElement) => {
      playbackGraceUntilRef.current = Date.now() + 15000;
      playRequestedRef.current = true;
      userPausedRef.current = false;

      const tryPlay = () => {
        if (!playRequestedRef.current) return;
        const attempt = audio.play();
        if (!attempt) {
          syncPlayingState();
          return;
        }

        attempt
          .then(() => {
            setPlaybackError(null);
            pendingLockScreenResumeRef.current = false;
          })
          .catch((err: DOMException) => {
            if (err.name === 'AbortError') {
              // Src swap / load() aborted play — retry once media can play.
              if (playRequestedRef.current && audio.paused) {
                const retry = () => {
                  if (!playRequestedRef.current || !audio.paused) return;
                  tryPlay();
                };
                audio.addEventListener('canplay', retry, { once: true });
                pendingPlayCleanupRef.current = () => {
                  audio.removeEventListener('canplay', retry);
                };
              }
              return;
            }
            // Brave/Android often rejects play() while the lock screen is up; resume on unlock.
            if (typeof document !== 'undefined' && document.hidden) {
              pendingLockScreenResumeRef.current = true;
              playRequestedRef.current = true;
              return;
            }
            playRequestedRef.current = false;
            playbackGraceUntilRef.current = 0;
            setPlaying(false);
            if (err.name === 'NotAllowedError') {
              // Keep primed src so one tap can resume without a full re-prime.
              setPlaybackError('Playback blocked by the browser. Tap play again.');
            } else {
              loadedPostIdRef.current = null;
              setPlaybackError('Could not start playback. Tap play again.');
            }
          });
      };

      // Call play() immediately so autoplay-from-ended stays in the user-activation
      // / media-engagement stack (critical on iOS Safari and mobile Chromium).
      tryPlay();

      if (audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
        const onReady = () => {
          if (!playRequestedRef.current || !audio.paused) return;
          tryPlay();
        };
        audio.addEventListener('canplay', onReady);
        pendingPlayCleanupRef.current = () => {
          audio.removeEventListener('canplay', onReady);
        };
      }
    },
    [syncPlayingState]
  );

  const requestPlay = useCallback(() => {
    const audio = getActiveAudio();
    const assigned = assignedSourceRef.current;
    if (!audio || !assigned) return;

    userPausedRef.current = false;

    if (autoplayTimedOutRef.current) {
      setPlaybackError('Autoplay limit reached. Choose a new limit to continue.');
      return;
    }

    if (isAutoplayTimeoutExpired()) {
      stopForAutoplayTimeout();
      return;
    }

    if (autoplayTimeoutHours > 0 && autoplayDeadlineRef.current == null) {
      armAutoplayDeadline(autoplayTimeoutHours);
    }

    clearPendingPlay();
    setPlaybackError(null);
    playRequestedRef.current = true;

    const pendingBlob = getInflightStreamBlob(assigned.postId);
    if (pendingBlob && !blobUrlRef.current) {
      setMediaLoading(true);
      pendingBlob
        .then((blobUrl) => {
          if (!postIdsMatch(assignedSourceRef.current?.postId, assigned.postId)) return;
          blobUrlRef.current = blobUrl;
          setMediaReady(true);
          setMediaLoading(false);
          setPlaybackError(null);
          requestPlayRef.current();
        })
        .catch((err: Error) => {
          if (!postIdsMatch(assignedSourceRef.current?.postId, assigned.postId)) return;
          setMediaLoading(false);
          setMediaReady(false);
          setPlaybackError(err.message || 'Could not load this episode.');
        });
      return;
    }

    if (!primeAudioSource(false)) {
      setPlaybackError('Could not load this episode.');
      return;
    }

    beginPlayback(audio);
  }, [
    armAutoplayDeadline,
    autoplayTimeoutHours,
    beginPlayback,
    clearPendingPlay,
    getActiveAudio,
    isAutoplayTimeoutExpired,
    primeAudioSource,
    stopForAutoplayTimeout
  ]);

  useEffect(() => {
    requestPlayRef.current = requestPlay;
  }, [requestPlay]);

  const resumeAfterSeek = useCallback(
    (audio: HTMLAudioElement, shouldResume: boolean) => {
      if (!shouldResume || !assignedSourceRef.current) return;

      playbackGraceUntilRef.current = Date.now() + SEEK_PLAYBACK_GRACE_MS;

      const resume = () => {
        if (!assignedSourceRef.current) return;
        if (!audio.paused) {
          setPlaying(true);
          return;
        }
        const attempt = audio.play();
        if (attempt) {
          attempt.catch(() => requestPlay());
        } else {
          requestPlay();
        }
      };

      if (audio.seeking) {
        audio.addEventListener('seeked', resume, { once: true });
      } else {
        resume();
      }
    },
    [requestPlay]
  );

  const preloadEpisodeMedia = useCallback(
    (postId: string, streamUrl: string) => {
      const audio = getActiveAudio();
      // Same episode already live (e.g. stream remount while global player continues) —
      // do not pause/reload or flip mediaReady false waiting for a canplay that may never re-fire.
      if (
        audio &&
        sourceIsPrimed(postId) &&
        postIdsMatch(assignedSourceRef.current?.postId, postId) &&
        audioHasEpisode(audio, postId, blobUrlRef.current) &&
        (!audio.paused || playRequestedRef.current || audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA)
      ) {
        setMediaReady(true);
        setMediaLoading(false);
        setPlaybackError(null);
        return;
      }

      preloadCleanupRef.current?.();
      preloadCleanupRef.current = null;
      const generation = ++preloadGenerationRef.current;

      prefetchStreamMedia(postId, streamUrl).catch(() => {});

      const cached = getCachedStreamBlob(postId);
      if (cached) {
        blobUrlRef.current = cached;
      }

      const forcePrime = !sourceIsPrimed(postId);
      primeAudioSource(forcePrime);

      const media = getActiveAudio();
      if (!media) return;

      const cleanupListeners = () => {
        media.removeEventListener('canplay', onCanPlay);
        media.removeEventListener('error', onError);
        if (preloadCleanupRef.current === cleanupListeners) {
          preloadCleanupRef.current = null;
        }
      };

      const markReady = () => {
        if (generation !== preloadGenerationRef.current) return;
        if (!postIdsMatch(assignedSourceRef.current?.postId, postId)) return;
        if (!audioHasEpisode(media, postId, blobUrlRef.current)) return;
        cleanupListeners();
        setMediaReady(true);
        setMediaLoading(false);
        setPlaybackError(null);
      };

      if (
        !forcePrime &&
        (media.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA || !media.paused) &&
        postIdsMatch(loadedPostIdRef.current, postId) &&
        audioHasEpisode(media, postId, blobUrlRef.current)
      ) {
        markReady();
        return;
      }

      setMediaLoading(true);
      setMediaReady(false);

      const onCanPlay = () => {
        markReady();
      };

      const onError = () => {
        cleanupListeners();
        if (generation !== preloadGenerationRef.current) return;
        if (!postIdsMatch(assignedSourceRef.current?.postId, postId)) return;
        if (!shouldTryBlobFallback() || blobUrlRef.current) {
          setMediaLoading(false);
          setMediaReady(false);
          setPlaybackError('Could not load this episode.');
          return;
        }

        loadStreamBlob(postId, streamUrl)
          .then((blobUrl) => {
            if (generation !== preloadGenerationRef.current) return;
            if (!postIdsMatch(assignedSourceRef.current?.postId, postId)) return;
            blobUrlRef.current = blobUrl;
            primeAudioSource(true);
            markReady();
            if (playRequestedRef.current) {
              requestPlayRef.current();
            }
          })
          .catch((err: Error) => {
            if (generation !== preloadGenerationRef.current) return;
            if (!postIdsMatch(assignedSourceRef.current?.postId, postId)) return;
            setMediaLoading(false);
            setMediaReady(false);
            setPlaybackError(err.message || 'Could not load this episode.');
          });
      };

      media.addEventListener('canplay', onCanPlay);
      media.addEventListener('error', onError);
      preloadCleanupRef.current = cleanupListeners;
    },
    [getActiveAudio, primeAudioSource, sourceIsPrimed]
  );

  const prepareEpisode = useCallback(
    (postId: string, streamUrl: string, durationSecs?: number | null) => {
      autoplayHandoffRef.current = false;
      assignEpisode(postId, streamUrl, durationSecs);
      preloadEpisodeMedia(postId, streamUrl);
    },
    [assignEpisode, preloadEpisodeMedia]
  );

  const playEpisode = useCallback(
    (
      postId: string,
      streamUrl: string,
      durationSecs?: number | null,
      options?: { softHandoff?: boolean }
    ) => {
      if (isNativeApp()) {
        const offline = parseOfflineUse(user?.offline_use);
        const localOnly = !!getCachedOfflinePlaybackUrl(postId);
        const online = typeof navigator === 'undefined' ? true : navigator.onLine;
        // Days window expired: block all playback until re-auth (online catalog/heartbeat).
        if (offline.mode === 'days' && user?.app_last_authenticated_at) {
          const days = offline.days;
          const last = new Date(user.app_last_authenticated_at).getTime();
          const expired = Number.isFinite(last) && Date.now() > last + days * 24 * 60 * 60 * 1000;
          if (expired && !canPlayOffline(user.offline_use, true)) {
            setPlaybackError('Offline window expired. Connect and sign in again to keep listening.');
            return;
          }
        }
        if (!online && !localOnly) {
          setPlaybackError('This episode is not downloaded. Connect to stream it.');
          return;
        }
      }

      autoplayHandoffRef.current = options?.softHandoff === true;
      assignEpisode(postId, streamUrl, durationSecs, options);
      preloadEpisodeMedia(postId, streamUrl);
      requestPlay();
    },
    [assignEpisode, preloadEpisodeMedia, requestPlay, user?.app_last_authenticated_at, user?.offline_use]
  );

  const loadEpisodeForStream = useCallback(
    (postId: string, streamUrl: string, durationSecs?: number | null) => {
      const audio = getActiveAudio();
      const alreadyLive =
        !!audio &&
        postIdsMatch(activePostIdRef.current, postId) &&
        postIdsMatch(assignedSourceRef.current?.postId, postId) &&
        sourceIsPrimed(postId) &&
        audioHasEpisode(audio, postId, blobUrlRef.current);

      // Autoplay already started this episode in the ended handler — sync UI only.
      if (postIdsMatch(autoplayAdvancePostIdRef.current, postId)) {
        if (
          alreadyLive ||
          playRequestedRef.current ||
          (audio && !audio.paused && postIdsMatch(assignedSourceRef.current?.postId, postId))
        ) {
          if (durationSecs != null) {
            setDuration((prev) => prev || durationSecs);
          }
          if (alreadyLive || (audio && audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA)) {
            setMediaReady(true);
            setMediaLoading(false);
          }
          setPlaybackError(null);
          syncPlayingState();
          return;
        }
        playEpisode(postId, streamUrl, durationSecs, { softHandoff: true });
        return;
      }

      if (alreadyLive) {
        // Stream page remounted while global audio is still on this episode — sync UI only.
        if (durationSecs != null) {
          setDuration((prev) => prev || durationSecs);
        }
        setMediaReady(true);
        setMediaLoading(false);
        setPlaybackError(null);
        syncPlayingState();
        return;
      }

      prepareEpisode(postId, streamUrl, durationSecs);
    },
    [getActiveAudio, playEpisode, prepareEpisode, sourceIsPrimed, syncPlayingState]
  );

  const advanceToPost = useCallback((postId: string) => {
    const index = queue.findIndex((p) => postIdsMatch(p.id, postId));
    if (index >= 0) {
      setCurrentIndex(index);
    }
    autoplayAdvancePostIdRef.current = postId;
  }, [queue]);

  const playNextInQueue = useCallback((): QueuePost | null => {
    if (queue.length === 0) return null;
    if (autoplayTimedOutRef.current || isAutoplayTimeoutExpired()) {
      stopForAutoplayTimeout();
      return null;
    }

    const nextIndex = resolveNextIndex(currentIndex, queue.length, replayMode, shuffle, shuffleOrder);
    if (nextIndex == null) return null;

    const nextPost = queue[nextIndex];
    if (!nextPost) return null;

    advanceToPost(nextPost.id);
    return nextPost;
  }, [
    queue,
    currentIndex,
    replayMode,
    shuffle,
    shuffleOrder,
    advanceToPost,
    isAutoplayTimeoutExpired,
    stopForAutoplayTimeout
  ]);

  const armStandbyForNext = useCallback(
    (nextPostId: string, streamUrl: string) => {
      const standby = getStandbyAudio();
      if (!standby) return;

      const standbySrc = standby.currentSrc || standby.src || '';
      if (
        standbyPostIdRef.current &&
        postIdsMatch(standbyPostIdRef.current, nextPostId) &&
        standbyUrlRef.current === streamUrl &&
        (standbySrc === streamUrl || standbySrc.includes(nextPostId))
      ) {
        return;
      }

      standby.src = streamUrl;
      standby.preload = 'auto';
      standby.load();
      standbyPostIdRef.current = nextPostId;
      standbyUrlRef.current = streamUrl;
    },
    [getStandbyAudio]
  );

  // Start next episode inside the ended stack (before navigate) for reliable autoplay.
  const autoplayAdvanceNext = useCallback(() => {
    if (queue.length === 0) return;
    if (autoplayTimedOutRef.current || isAutoplayTimeoutExpired()) {
      stopForAutoplayTimeout();
      return;
    }

    const nextIndex = resolveNextIndex(currentIndex, queue.length, replayMode, shuffle, shuffleOrder);
    if (nextIndex == null) return;

    const nextPost = queue[nextIndex];
    if (!nextPost) return;

    const streamUrl = resolveStreamUrlForPost(
      nextPost.id,
      assignedSourceRef.current?.url,
      user?.rss_token
    );
    if (!streamUrl) return;

    const standby = getStandbyAudio();
    const standbyArmed =
      !!standby &&
      !!standbyPostIdRef.current &&
      postIdsMatch(standbyPostIdRef.current, nextPost.id) &&
      !standby.error &&
      !!(standby.currentSrc || standby.src);

    // Prefer standby even if still buffering — a fresh element + ended-stack play()
    // is what Android needs; same-element src swap is the failure mode.
    if (standbyArmed && standby) {
      userPausedRef.current = false;
      clearPendingPlay();
      preloadCleanupRef.current?.();
      preloadCleanupRef.current = null;
      preloadGenerationRef.current += 1;

      const previousPostId = loadedPostIdRef.current;
      if (previousPostId && !postIdsMatch(previousPostId, nextPost.id)) {
        clearStreamBlob(previousPostId);
      }

      advanceToPost(nextPost.id);
      assignedSourceRef.current = { postId: nextPost.id, url: streamUrl };
      activePostIdRef.current = nextPost.id;
      setActivePostId(nextPost.id);
      setPlayingShareStream(/[?&]share=/.test(streamUrl));
      setCurrentTime(0);
      setDuration(nextPost.duration_secs ?? 0);
      setPlaybackError(null);
      loadedPostIdRef.current = nextPost.id;
      blobUrlRef.current = null;
      setMediaReady(standby.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA);
      setMediaLoading(standby.readyState < HTMLMediaElement.HAVE_CURRENT_DATA);

      // Sync play on standby FIRST (ended stack) before swapping slots.
      playRequestedRef.current = true;
      standby.volume = 1;
      standby.muted = false;
      const playAttempt = standby.play();

      const old = getActiveAudio();
      activeSlotRef.current = 1 - activeSlotRef.current;
      // Clearing the finished element can fire a spurious error — ignore it.
      suppressAudioErrorsRef.current = true;
      if (old) {
        old.pause();
        try {
          old.removeAttribute('src');
          old.load();
        } catch {
          // ignore cleanup errors
        }
      }
      window.setTimeout(() => {
        suppressAudioErrorsRef.current = false;
      }, 0);

      standbyPostIdRef.current = null;
      standbyUrlRef.current = null;
      prefetchedNextPostIdRef.current = null;
      autoplayAdvancePostIdRef.current = nextPost.id;
      autoplayHandoffRef.current = false;

      // Defer route change until the next track is playing — navigating while the
      // lock screen is up remounts the stream page and breaks Brave handoff.
      pendingAutoplayNavigateRef.current = nextPost;
      if (typeof document !== 'undefined' && document.hidden) {
        pendingLockScreenResumeRef.current = true;
      }

      playAttempt?.catch(() => {
        if (typeof document !== 'undefined' && document.hidden) {
          pendingLockScreenResumeRef.current = true;
          playRequestedRef.current = true;
          return;
        }
        requestPlayRef.current();
      });
      return;
    }

    // Fallback: soft handoff on the same element (cold miss / standby not ready).
    advanceToPost(nextPost.id);
    pendingAutoplayNavigateRef.current = nextPost;
    if (typeof document !== 'undefined' && document.hidden) {
      pendingLockScreenResumeRef.current = true;
    }
    playEpisode(nextPost.id, streamUrl, nextPost.duration_secs, { softHandoff: true });
  }, [
    queue,
    currentIndex,
    replayMode,
    shuffle,
    shuffleOrder,
    user?.rss_token,
    advanceToPost,
    playEpisode,
    clearPendingPlay,
    getActiveAudio,
    getStandbyAudio,
    isAutoplayTimeoutExpired,
    stopForAutoplayTimeout
  ]);

  useEffect(() => {
    autoplayAdvanceNextRef.current = autoplayAdvanceNext;
  }, [autoplayAdvanceNext]);

  // Fallback only: if soft handoff primed media but play() did not stick (rare).
  useEffect(() => {
    const postId = autoplayAdvancePostIdRef.current;
    if (!postId || !postIdsMatch(postId, activePostId)) return;
    if (!autoplayHandoffRef.current) return;
    if (mediaLoading || !mediaReady) return;
    if (playing || playRequestedRef.current) return;
    requestPlay();
  }, [activePostId, mediaLoading, mediaReady, playing, requestPlay]);

  const togglePlayback = useCallback(() => {
    const audio = getActiveAudio();
    if (!audio || !assignedSourceRef.current) return;

    if (audio.paused) {
      userPausedRef.current = false;
      if (playbackErrorRef.current) {
        loadedPostIdRef.current = null;
        primeAudioSource(true);
      }
      requestPlay();
    } else {
      userPausedRef.current = true;
      playRequestedRef.current = false;
      playbackGraceUntilRef.current = 0;
      clearPendingPlay();
      audio.pause();
      setPlaying(false);
    }
  }, [clearPendingPlay, getActiveAudio, primeAudioSource, requestPlay]);

  const seekTo = useCallback(
    (time: number) => {
      const audio = getActiveAudio();
      if (!audio || !assignedSourceRef.current) return;
      const shouldResume = !audio.paused && !audio.ended;
      audio.currentTime = clampPlaybackTime(time, audio.duration);
      resumeAfterSeek(audio, shouldResume);
    },
    [clampPlaybackTime, getActiveAudio, resumeAfterSeek]
  );

  const skipBy = useCallback(
    (delta: number) => {
      const audio = getActiveAudio();
      if (!audio || !assignedSourceRef.current) return;
      const shouldResume = !audio.paused && !audio.ended;

      audio.currentTime = clampPlaybackTime(audio.currentTime + delta, audio.duration);
      resumeAfterSeek(audio, shouldResume);
    },
    [clampPlaybackTime, getActiveAudio, resumeAfterSeek]
  );

  const registerTrackEndedHandler = useCallback((handler: ((nextPost: QueuePost) => void) | null) => {
    onTrackEndedRef.current = handler;
  }, []);

  useEffect(() => {
    for (const audio of audioSlotsRef.current) {
      if (!audio) continue;
      audio.setAttribute('playsinline', '');
      audio.setAttribute('webkit-playsinline', 'true');
      audio.volume = 1;
      audio.muted = false;
    }
  }, []);

  useEffect(() => {
    const slots = audioSlotsRef.current.filter((el): el is HTMLAudioElement => !!el);
    if (slots.length === 0) return;

    const onTimeUpdate = (e: Event) => {
      if (e.target !== getActiveAudio()) return;
      const audio = e.target as HTMLAudioElement;
      const limit = streamPreviewLimitRef.current;
      if (limit != null && audio.currentTime >= limit - 0.05) {
        audio.currentTime = limit;
        audio.pause();
        setPlaying(false);
        setCurrentTime(limit);
        setPlaybackError('Preview limit reached. Subscribe for full access.');
        return;
      }
      setCurrentTime(audio.currentTime);
    };
    const onDurationChange = (e: Event) => {
      if (e.target !== getActiveAudio()) return;
      const audio = e.target as HTMLAudioElement;
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        const limit = streamPreviewLimitRef.current;
        setDuration(limit != null ? Math.min(limit, audio.duration) : audio.duration);
      }
    };
    const onPlaying = (e: Event) => {
      if (e.target !== getActiveAudio()) return;
      userPausedRef.current = false;
      playRequestedRef.current = false;
      autoplayHandoffRef.current = false;
      pendingLockScreenResumeRef.current = false;
      setPlaybackError(null);
      if (postIdsMatch(autoplayAdvancePostIdRef.current, activePostIdRef.current)) {
        autoplayAdvancePostIdRef.current = null;
      }
      setPlaying(true);
      updateMediaSessionPlaybackState(true);

      const pendingNav = pendingAutoplayNavigateRef.current;
      if (pendingNav && postIdsMatch(pendingNav.id, activePostIdRef.current)) {
        pendingAutoplayNavigateRef.current = null;
        onTrackEndedRef.current?.(pendingNav);
      }
    };
    const onPause = (e: Event) => {
      if (e.target !== getActiveAudio()) return;
      syncPlayingState();
      updateMediaSessionPlaybackState(false);
    };
    const onEnded = (e: Event) => {
      if (e.target !== getActiveAudio()) return;
      const audio = e.target as HTMLAudioElement;
      setPlaying(false);
      if (replayModeRef.current === 'one') {
        audio.currentTime = 0;
        const loop = audio.play();
        if (loop) {
          loop.catch(() => {
            requestPlayRef.current();
          });
        }
        return;
      }
      // Advance + play synchronously in this event so mobile browsers keep autoplay.
      autoplayAdvanceNextRef.current();
    };
    const onError = (e: Event) => {
      if (e.target !== getActiveAudio()) return;
      if (suppressAudioErrorsRef.current) return;
      const audio = e.target as HTMLAudioElement;
      const assigned = assignedSourceRef.current;
      const src = audio.currentSrc || audio.src || '';
      if (!assigned || !src) return;
      if (!audioHasEpisode(audio, assigned.postId, blobUrlRef.current)) return;

      // While locked, Brave often reports a transient media error on handoff.
      // Keep the next episode primed and resume when the screen unlocks.
      if (typeof document !== 'undefined' && document.hidden) {
        pendingLockScreenResumeRef.current = true;
        playRequestedRef.current = true;
        return;
      }

      clearPendingPlay();
      setPlaying(false);
      loadedPostIdRef.current = null;
      setPlaybackError(describeMediaError(audio));
    };

    for (const audio of slots) {
      audio.addEventListener('timeupdate', onTimeUpdate);
      audio.addEventListener('durationchange', onDurationChange);
      audio.addEventListener('loadedmetadata', onDurationChange);
      audio.addEventListener('playing', onPlaying);
      audio.addEventListener('pause', onPause);
      audio.addEventListener('ended', onEnded);
      audio.addEventListener('error', onError);
    }

    return () => {
      for (const audio of slots) {
        audio.removeEventListener('timeupdate', onTimeUpdate);
        audio.removeEventListener('durationchange', onDurationChange);
        audio.removeEventListener('loadedmetadata', onDurationChange);
        audio.removeEventListener('playing', onPlaying);
        audio.removeEventListener('pause', onPause);
        audio.removeEventListener('ended', onEnded);
        audio.removeEventListener('error', onError);
      }
    };
  }, [clearPendingPlay, getActiveAudio, syncPlayingState]);

  useEffect(() => {
    if (!playing) return undefined;

    let lastAudio: HTMLAudioElement | null = null;
    let lastTime = 0;
    let stalledChecks = 0;

    const intervalId = window.setInterval(() => {
      const audio = getActiveAudio();
      if (!audio || audio.paused) return;

      if (document.hidden) {
        stalledChecks = 0;
        lastTime = audio.currentTime;
        lastAudio = audio;
        return;
      }

      if (audio !== lastAudio) {
        lastAudio = audio;
        lastTime = audio.currentTime;
        stalledChecks = 0;
        return;
      }

      if (
        audio.seeking ||
        audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA ||
        audio.networkState === HTMLMediaElement.NETWORK_LOADING
      ) {
        stalledChecks = 0;
        lastTime = audio.currentTime;
        return;
      }

      if (Date.now() < playbackGraceUntilRef.current) {
        if (audio.currentTime > lastTime + 0.05) {
          playbackGraceUntilRef.current = 0;
        }
        lastTime = audio.currentTime;
        stalledChecks = 0;
        return;
      }

      if (audio.currentTime > lastTime + 0.05) {
        lastTime = audio.currentTime;
        stalledChecks = 0;
        return;
      }

      stalledChecks += 1;
      if (stalledChecks >= 3) {
        playRequestedRef.current = false;
        playbackGraceUntilRef.current = 0;
        setPlaying(false);
        audio.pause();
        loadedPostIdRef.current = null;
        setPlaybackError('Playback stalled. Tap play to try again.');
      }
    }, 2000);

    return () => window.clearInterval(intervalId);
  }, [getActiveAudio, playing]);

  const loadFavorites = useCallback(async () => {
    if (!user) {
      setFavorites(new Set());
      return;
    }
    try {
      const res = await axios.get<{ favorites: string[] }>('/account/player/favorites');
      setFavorites(new Set(res.data.favorites));
    } catch {
      setFavorites(new Set());
    }
  }, [user]);

  const refreshPlaylists = useCallback(async () => {
    if (!user) {
      setPlaylists([]);
      return;
    }
    try {
      const res = await axios.get<{ playlists: PlaylistSummary[] }>('/account/player/playlists');
      setPlaylists(res.data.playlists);
    } catch {
      setPlaylists([]);
    }
  }, [user]);

  useEffect(() => {
    loadFavorites();
    refreshPlaylists();
  }, [loadFavorites, refreshPlaylists]);

  const setQueue = useCallback(
    (
      posts: QueuePost[],
      currentPostId: string,
      options?: { fromPlaylist?: boolean; preserveShuffleOrder?: boolean }
    ) => {
      if (options?.fromPlaylist === true) {
        queueFromPlaylistRef.current = true;
      } else if (options?.fromPlaylist === false) {
        queueFromPlaylistRef.current = false;
        prefetchedNextPostIdRef.current = null;
      }

      const index = posts.findIndex((p) => postIdsMatch(p.id, currentPostId));
      const safeIndex = index >= 0 ? index : 0;
      setQueueState(posts);
      setCurrentIndex(safeIndex);
      if (!options?.preserveShuffleOrder) {
        setShuffleOrder(shuffle ? buildShuffleOrder(posts.length, safeIndex) : []);
      }
    },
    [shuffle]
  );

  const playQueueFromPlaylist = useCallback(
    (posts: QueuePost[], startPostId: string) => {
      setQueue(posts, startPostId, { fromPlaylist: true });
    },
    [setQueue]
  );

  const cycleReplay = useCallback(() => {
    setReplayMode((prev) => {
      const next = cycleReplayMode(prev);
      localStorage.setItem(REPLAY_STORAGE_KEY, next);
      return next;
    });
  }, []);

  const toggleShuffle = useCallback(() => {
    setShuffle((prev) => {
      const next = !prev;
      localStorage.setItem(SHUFFLE_STORAGE_KEY, String(next));
      setShuffleOrder((order) => {
        if (!next) return [];
        return buildShuffleOrder(queue.length, currentIndex);
      });
      return next;
    });
  }, [queue.length, currentIndex]);

  const getNextPostId = useCallback(() => {
    const nextIndex = resolveNextIndex(currentIndex, queue.length, replayMode, shuffle, shuffleOrder);
    if (nextIndex == null) return null;
    return queue[nextIndex]?.id ?? null;
  }, [currentIndex, queue, replayMode, shuffle, shuffleOrder]);

  const getPrevPostId = useCallback(() => {
    const prevIndex = resolvePrevIndex(currentIndex, queue.length, replayMode, shuffle, shuffleOrder);
    if (prevIndex == null) return null;
    return queue[prevIndex]?.id ?? null;
  }, [currentIndex, queue, replayMode, shuffle, shuffleOrder]);

  const prefetchNextInQueue = useCallback(() => {
    if (!activePostId) return;

    const nextIndex = resolveNextIndex(currentIndex, queue.length, replayMode, shuffle, shuffleOrder);
    if (nextIndex == null) return;

    const nextPost = queue[nextIndex];
    if (!nextPost || postIdsMatch(nextPost.id, activePostId)) return;

    const streamUrl = resolveStreamUrlForPost(
      nextPost.id,
      assignedSourceRef.current?.url,
      user?.rss_token
    );
    if (!streamUrl) return;

    armStandbyForNext(nextPost.id, streamUrl);

    if (prefetchedNextPostIdRef.current === nextPost.id) return;
    prefetchedNextPostIdRef.current = nextPost.id;
    prefetchStreamMedia(nextPost.id, streamUrl).catch(() => {});
  }, [
    activePostId,
    armStandbyForNext,
    currentIndex,
    queue,
    replayMode,
    shuffle,
    shuffleOrder,
    user?.rss_token
  ]);

  useEffect(() => {
    if (!playing || !mediaReady || !activePostId) return;
    prefetchNextInQueue();
  }, [
    activePostId,
    currentIndex,
    mediaReady,
    playing,
    prefetchNextInQueue,
    queue,
    replayMode,
    shuffle
  ]);

  useEffect(() => {
    const post = activePostId
      ? queue.find((p) => postIdsMatch(p.id, activePostId)) ?? null
      : null;
    updateMediaSessionMetadata(post);
  }, [activePostId, queue]);

  useEffect(() => {
    updateMediaSessionPlaybackState(playing);
  }, [playing]);

  useEffect(() => {
    if (!playing) return;
    updateMediaSessionPosition(currentTime, duration);
  }, [playing, currentTime, duration]);

  useEffect(() => {
    return bindMediaSessionHandlers({
      play: () => {
        userPausedRef.current = false;
        requestPlay();
      },
      pause: () => {
        const audio = getActiveAudio();
        if (!audio) return;
        userPausedRef.current = true;
        playRequestedRef.current = false;
        playbackGraceUntilRef.current = 0;
        clearPendingPlay();
        audio.pause();
        setPlaying(false);
      },
      seekBy: (delta) => skipBy(delta),
      seekTo: (time) => seekTo(time),
      nextTrack: () => {
        const nextIndex = resolveNextIndex(currentIndex, queue.length, replayMode, shuffle, shuffleOrder);
        if (nextIndex == null) return;
        const nextPost = queue[nextIndex];
        if (!nextPost) return;
        const streamUrl = resolveStreamUrlForPost(
          nextPost.id,
          assignedSourceRef.current?.url,
          user?.rss_token
        );
        if (!streamUrl) return;
        advanceToPost(nextPost.id);
        playEpisode(nextPost.id, streamUrl, nextPost.duration_secs);
        onTrackEndedRef.current?.(nextPost);
      },
      previousTrack: () => {
        const prevIndex = resolvePrevIndex(currentIndex, queue.length, replayMode, shuffle, shuffleOrder);
        if (prevIndex == null) return;
        const prevPost = queue[prevIndex];
        if (!prevPost) return;
        const streamUrl = resolveStreamUrlForPost(
          prevPost.id,
          assignedSourceRef.current?.url,
          user?.rss_token
        );
        if (!streamUrl) return;
        advanceToPost(prevPost.id);
        playEpisode(prevPost.id, streamUrl, prevPost.duration_secs);
        onTrackEndedRef.current?.(prevPost);
      }
    });
  }, [
    advanceToPost,
    clearPendingPlay,
    currentIndex,
    getActiveAudio,
    playEpisode,
    queue,
    replayMode,
    requestPlay,
    seekTo,
    shuffle,
    shuffleOrder,
    skipBy,
    user?.rss_token
  ]);

  useEffect(() => {
    const flushPendingNavigate = () => {
      const pendingNav = pendingAutoplayNavigateRef.current;
      if (!pendingNav) return;
      if (!postIdsMatch(pendingNav.id, activePostIdRef.current)) return;
      pendingAutoplayNavigateRef.current = null;
      onTrackEndedRef.current?.(pendingNav);
    };

    const onVisibility = () => {
      if (document.hidden) return;
      if (userPausedRef.current) return;
      const audio = getActiveAudio();
      const assigned = assignedSourceRef.current;
      if (!audio || !assigned) return;

      const needsResume =
        pendingLockScreenResumeRef.current ||
        audio.paused ||
        !!audio.error ||
        !!playbackErrorRef.current;

      if (needsResume) {
        pendingLockScreenResumeRef.current = false;
        setPlaybackError(null);
        if (audio.error) {
          // Spurious lock-screen errors leave the element dead; re-prime then play.
          loadedPostIdRef.current = null;
          primeAudioSource(true);
        }
        playRequestedRef.current = true;
        requestPlay();
      }

      // If handoff already started playing under the lock screen, still navigate now.
      if (!audio.paused) {
        flushPendingNavigate();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onVisibility);
    };
  }, [getActiveAudio, primeAudioSource, requestPlay]);

  // Safety: if next track is playing but navigate was deferred, flush soon after.
  useEffect(() => {
    if (!playing || !activePostId) return undefined;
    const pendingNav = pendingAutoplayNavigateRef.current;
    if (!pendingNav || !postIdsMatch(pendingNav.id, activePostId)) return undefined;
    if (typeof document !== 'undefined' && document.hidden) return undefined;

    const timer = window.setTimeout(() => {
      const still = pendingAutoplayNavigateRef.current;
      if (still && postIdsMatch(still.id, activePostIdRef.current)) {
        pendingAutoplayNavigateRef.current = null;
        onTrackEndedRef.current?.(still);
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [activePostId, playing]);

  const isFavorite = useCallback((postId: string) => favorites.has(postId), [favorites]);

  const toggleFavorite = useCallback(
    async (postId: string) => {
      if (!user) return;
      const wasFavorite = favorites.has(postId);
      setFavorites((prev) => {
        const next = new Set(prev);
        if (wasFavorite) next.delete(postId);
        else next.add(postId);
        return next;
      });
      try {
        if (wasFavorite) {
          await axios.delete(`/account/player/favorites/${postId}`);
        } else {
          await axios.post(`/account/player/favorites/${postId}`);
        }
      } catch {
        await loadFavorites();
      }
    },
    [user, favorites, loadFavorites]
  );

  const createPlaylist = useCallback(
    async (name: string, postIds: string[] = []) => {
      const normalizedPostIds = Array.from(
        new Set(postIds.map((id) => String(id || '').trim()).filter(Boolean))
      );
      const res = await axios.post<{ playlist: PlaylistSummary }>('/account/player/playlists', {
        name,
        post_ids: normalizedPostIds
      });
      await refreshPlaylists();
      return res.data.playlist;
    },
    [refreshPlaylists]
  );

  const addToPlaylist = useCallback(
    async (playlistId: string, postId: string) => {
      await axios.post(`/account/player/playlists/${playlistId}/items`, { post_id: postId });
      await refreshPlaylists();
    },
    [refreshPlaylists]
  );

  const addManyToPlaylist = useCallback(
    async (playlistId: string, postIds: string[]) => {
      const uniquePostIds = Array.from(
        new Set(postIds.map((id) => String(id || '').trim()).filter(Boolean))
      );
      if (uniquePostIds.length === 0) return { added: 0, failed: 0 };
      let added = 0;
      for (const postId of uniquePostIds) {
        try {
          await axios.post(`/account/player/playlists/${playlistId}/items`, { post_id: postId });
          added += 1;
        } catch {
          // Keep adding the remaining selected tracks even if one is unavailable.
        }
      }
      await refreshPlaylists();
      return { added, failed: uniquePostIds.length - added };
    },
    [refreshPlaylists]
  );

  const removeFromPlaylist = useCallback(
    async (playlistId: string, postId: string) => {
      await axios.delete(`/account/player/playlists/${playlistId}/items/${postId}`);
      await refreshPlaylists();
    },
    [refreshPlaylists]
  );

  const deletePlaylistById = useCallback(
    async (playlistId: string) => {
      await axios.delete(`/account/player/playlists/${playlistId}`);
      await refreshPlaylists();
    },
    [refreshPlaylists]
  );

  const value = useMemo<PlayerContextType>(
    () => ({
      replayMode,
      shuffle,
      queue,
      currentIndex,
      favorites,
      playlists,
      activePostId,
      playing,
      currentTime,
      duration,
      playbackError,
      mediaLoading,
      mediaReady,
      autoplayTimeoutHours,
      autoplayTimeRemainingMs,
      streamPreviewSeconds,
      setAutoplayTimeoutHours,
      cycleReplay,
      toggleShuffle,
      setQueue,
      playQueueFromPlaylist,
      getNextPostId,
      getPrevPostId,
      isFavorite,
      toggleFavorite,
      refreshPlaylists,
      createPlaylist,
      addToPlaylist,
      addManyToPlaylist,
      removeFromPlaylist,
      deletePlaylist: deletePlaylistById,
      prepareEpisode,
      playEpisode,
      loadEpisodeForStream,
      advanceToPost,
      playNextInQueue,
      togglePlayback,
      seekTo,
      skipBy,
      registerTrackEndedHandler
    }),
    [
      replayMode,
      shuffle,
      queue,
      currentIndex,
      favorites,
      playlists,
      activePostId,
      playing,
      currentTime,
      duration,
      playbackError,
      mediaLoading,
      mediaReady,
      autoplayTimeoutHours,
      autoplayTimeRemainingMs,
      streamPreviewSeconds,
      setAutoplayTimeoutHours,
      cycleReplay,
      toggleShuffle,
      setQueue,
      playQueueFromPlaylist,
      getNextPostId,
      getPrevPostId,
      isFavorite,
      toggleFavorite,
      refreshPlaylists,
      createPlaylist,
      addToPlaylist,
      addManyToPlaylist,
      removeFromPlaylist,
      deletePlaylistById,
      prepareEpisode,
      playEpisode,
      loadEpisodeForStream,
      advanceToPost,
      playNextInQueue,
      togglePlayback,
      seekTo,
      skipBy,
      registerTrackEndedHandler
    ]
  );

  return (
    <PlayerContext.Provider value={value}>
      <audio
        ref={(el) => {
          audioSlotsRef.current[0] = el;
        }}
        className="podcast-audio-element"
        playsInline
        preload="auto"
      />
      <audio
        ref={(el) => {
          audioSlotsRef.current[1] = el;
        }}
        className="podcast-audio-element podcast-audio-standby"
        playsInline
        preload="auto"
      />
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
};
