import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import axios from 'axios';
import { buildStreamUrl } from '../config';
import { useAuth } from './AuthContext';
import {
  buildShuffleOrder,
  cycleReplayMode,
  QueuePost,
  ReplayMode,
  resolveNextIndex,
  resolvePrevIndex
} from '../utils/playerQueue';
import { memberStreamPreviewSeconds } from '../utils/accessPermissions';
import {
  clearStreamBlob,
  getCachedStreamBlob,
  getInflightStreamBlob,
  loadStreamBlob,
  prefetchStreamMedia,
  prefersBlobPlayback,
  shouldTryBlobFallback
} from '../utils/streamLoader';
import { normalizePostId, postIdsMatch } from '../utils/episodeListHelpers';
import {
  AutoplayTimeoutHours,
  autoplayTimeoutMs,
  readAutoplayTimeoutHours,
  writeAutoplayTimeoutHours
} from '../utils/autoplayTimeout';

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
  registerTrackEndedHandler: (handler: (() => void) | null) => void;
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
  if (prefersBlobPlayback()) {
    return blobUrl ?? getCachedStreamBlob(postId);
  }
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
  const audioRef = useRef<HTMLAudioElement>(null);
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
  const onTrackEndedRef = useRef<(() => void) | null>(null);
  const requestPlayRef = useRef<() => void>(() => {});
  const playRequestedRef = useRef(false);
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

  const streamPreviewSeconds = useMemo(
    () => (user ? memberStreamPreviewSeconds(user.payment_category, user.is_paying) : null),
    [user]
  );

  useEffect(() => {
    streamPreviewLimitRef.current = streamPreviewSeconds;
  }, [streamPreviewSeconds]);

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
    const audio = audioRef.current;
    if (!audio || !postIdsMatch(loadedPostIdRef.current, postId)) return false;
    return audioHasEpisode(audio, postId, blobUrlRef.current);
  }, []);

  const syncPlayingState = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setPlaying(!audio.paused && !audio.ended);
  }, []);

  const stopForAutoplayTimeout = useCallback(() => {
    const audio = audioRef.current;
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
  }, [clearPendingPlay]);

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

  const assignEpisode = useCallback((postId: string, streamUrl: string, durationSecs?: number | null) => {
    const changed =
      !assignedSourceRef.current ||
      !postIdsMatch(assignedSourceRef.current.postId, postId) ||
      assignedSourceRef.current.url !== streamUrl;

    assignedSourceRef.current = { postId, url: streamUrl };
    activePostIdRef.current = postId;
    setActivePostId(postId);
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

      const audio = audioRef.current;
      if (audio && previousPostId && !postIdsMatch(previousPostId, postId)) {
        suppressAudioErrorsRef.current = true;
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
        loadedPostIdRef.current = null;
      }
    } else if (durationSecs != null) {
      setDuration((prev) => prev || durationSecs);
    }

    return true;
  }, [clearPendingPlay]);

  const primeAudioSource = useCallback((force = false) => {
    const audio = audioRef.current;
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
  }, [clearPendingPlay]);

  const beginPlayback = useCallback(
    (audio: HTMLAudioElement) => {
      playbackGraceUntilRef.current = Date.now() + 15000;
      playRequestedRef.current = true;

      const tryPlay = () => {
        const attempt = audio.play();
        if (!attempt) {
          syncPlayingState();
          return;
        }

        attempt
          .then(() => {
            setPlaybackError(null);
          })
          .catch((err: DOMException) => {
            if (err.name === 'AbortError') return;
            playRequestedRef.current = false;
            playbackGraceUntilRef.current = 0;
            loadedPostIdRef.current = null;
            setPlaying(false);
            if (err.name === 'NotAllowedError') {
              setPlaybackError('Playback blocked by the browser. Tap play again.');
            } else {
              setPlaybackError('Could not start playback. Tap play again.');
            }
          });
      };

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
    []
  );

  const requestPlay = useCallback(() => {
    const audio = audioRef.current;
    const assigned = assignedSourceRef.current;
    if (!audio || !assigned) return;

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

      const audio = audioRef.current;
      if (!audio) return;

      const cleanupListeners = () => {
        audio.removeEventListener('canplay', onCanPlay);
        audio.removeEventListener('error', onError);
        if (preloadCleanupRef.current === cleanupListeners) {
          preloadCleanupRef.current = null;
        }
      };

      const markReady = () => {
        if (generation !== preloadGenerationRef.current) return;
        if (!postIdsMatch(assignedSourceRef.current?.postId, postId)) return;
        if (!audioHasEpisode(audio, postId, blobUrlRef.current)) return;
        cleanupListeners();
        setMediaReady(true);
        setMediaLoading(false);
        setPlaybackError(null);
      };

      if (
        !forcePrime &&
        audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA &&
        postIdsMatch(loadedPostIdRef.current, postId) &&
        audioHasEpisode(audio, postId, blobUrlRef.current)
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

      audio.addEventListener('canplay', onCanPlay);
      audio.addEventListener('error', onError);
      preloadCleanupRef.current = cleanupListeners;
    },
    [primeAudioSource, sourceIsPrimed]
  );

  const prepareEpisode = useCallback(
    (postId: string, streamUrl: string, durationSecs?: number | null) => {
      assignEpisode(postId, streamUrl, durationSecs);
      preloadEpisodeMedia(postId, streamUrl);
    },
    [assignEpisode, preloadEpisodeMedia]
  );

  const playEpisode = useCallback(
    (postId: string, streamUrl: string, durationSecs?: number | null) => {
      assignEpisode(postId, streamUrl, durationSecs);
      preloadEpisodeMedia(postId, streamUrl);
      requestPlay();
    },
    [assignEpisode, preloadEpisodeMedia, requestPlay]
  );

  const loadEpisodeForStream = useCallback(
    (postId: string, streamUrl: string, durationSecs?: number | null) => {
      if (postIdsMatch(autoplayAdvancePostIdRef.current, postId)) {
        playEpisode(postId, streamUrl, durationSecs);
        return;
      }
      prepareEpisode(postId, streamUrl, durationSecs);
    },
    [playEpisode, prepareEpisode]
  );

  const advanceToPost = useCallback((postId: string) => {
    const index = queue.findIndex((p) => postIdsMatch(p.id, postId));
    if (index >= 0) {
      setCurrentIndex(index);
    }
    autoplayAdvancePostIdRef.current = postId;
  }, [queue]);

  const playNextInQueue = useCallback((): QueuePost | null => {
    if (queue.length === 0 || !user?.rss_token) return null;
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
    user,
    advanceToPost,
    isAutoplayTimeoutExpired,
    stopForAutoplayTimeout
  ]);

  useEffect(() => {
    const postId = autoplayAdvancePostIdRef.current;
    if (!postId || !postIdsMatch(postId, activePostId)) return;
    if (mediaLoading || !mediaReady) return;
    if (playing) return;
    requestPlay();
  }, [activePostId, mediaLoading, mediaReady, playing, requestPlay]);

  const togglePlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !assignedSourceRef.current) return;

    if (audio.paused) {
      if (playbackErrorRef.current) {
        loadedPostIdRef.current = null;
        primeAudioSource(true);
      }
      requestPlay();
    } else {
      playRequestedRef.current = false;
      playbackGraceUntilRef.current = 0;
      clearPendingPlay();
      audio.pause();
      setPlaying(false);
    }
  }, [clearPendingPlay, primeAudioSource, requestPlay]);

  const seekTo = useCallback(
    (time: number) => {
      const audio = audioRef.current;
      if (!audio || !assignedSourceRef.current) return;
      const shouldResume = !audio.paused && !audio.ended;
      audio.currentTime = clampPlaybackTime(time, audio.duration);
      resumeAfterSeek(audio, shouldResume);
    },
    [clampPlaybackTime, resumeAfterSeek]
  );

  const skipBy = useCallback(
    (delta: number) => {
      const audio = audioRef.current;
      if (!audio || !assignedSourceRef.current) return;
      const shouldResume = !audio.paused && !audio.ended;

      audio.currentTime = clampPlaybackTime(audio.currentTime + delta, audio.duration);
      resumeAfterSeek(audio, shouldResume);
    },
    [clampPlaybackTime, resumeAfterSeek]
  );

  const registerTrackEndedHandler = useCallback((handler: (() => void) | null) => {
    onTrackEndedRef.current = handler;
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.setAttribute('playsinline', '');
    audio.setAttribute('webkit-playsinline', 'true');
    audio.volume = 1;
    audio.muted = false;
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
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
    const onDurationChange = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        const limit = streamPreviewLimitRef.current;
        setDuration(limit != null ? Math.min(limit, audio.duration) : audio.duration);
      }
    };
    const onPlaying = () => {
      playRequestedRef.current = false;
      if (postIdsMatch(autoplayAdvancePostIdRef.current, activePostIdRef.current)) {
        autoplayAdvancePostIdRef.current = null;
      }
      setPlaying(true);
    };
    const onPause = () => syncPlayingState();
    const onEnded = () => {
      setPlaying(false);
      if (replayModeRef.current === 'one') {
        audio.currentTime = 0;
        audio.play().catch(() => {});
        return;
      }
      onTrackEndedRef.current?.();
    };
    const onError = () => {
      if (suppressAudioErrorsRef.current) return;
      const assigned = assignedSourceRef.current;
      const src = audio.currentSrc || audio.src || '';
      if (!assigned || !src) return;
      if (!audioHasEpisode(audio, assigned.postId, blobUrlRef.current)) return;
      clearPendingPlay();
      setPlaying(false);
      loadedPostIdRef.current = null;
      setPlaybackError(describeMediaError(audio));
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('loadedmetadata', onDurationChange);
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('loadedmetadata', onDurationChange);
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, [clearPendingPlay, syncPlayingState]);

  useEffect(() => {
    if (!playing) return undefined;

    const audio = audioRef.current;
    if (!audio) return undefined;

    let lastTime = audio.currentTime;
    let stalledChecks = 0;

    const intervalId = window.setInterval(() => {
      if (!audio || audio.paused) return;

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
  }, [playing]);

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

  const prefetchNextInPlaylistQueue = useCallback(() => {
    if (!queueFromPlaylistRef.current || !user?.rss_token || !activePostId) return;

    const nextIndex = resolveNextIndex(currentIndex, queue.length, replayMode, shuffle, shuffleOrder);
    if (nextIndex == null) return;

    const nextPost = queue[nextIndex];
    if (!nextPost || postIdsMatch(nextPost.id, activePostId)) return;
    if (prefetchedNextPostIdRef.current === nextPost.id) return;

    prefetchedNextPostIdRef.current = nextPost.id;
    const streamUrl = buildStreamUrl(nextPost.id, user.rss_token);
    prefetchStreamMedia(nextPost.id, streamUrl).catch(() => {});
  }, [activePostId, currentIndex, queue, replayMode, shuffle, shuffleOrder, user?.rss_token]);

  useEffect(() => {
    if (!queueFromPlaylistRef.current || !playing || !mediaReady || !activePostId) return;
    prefetchNextInPlaylistQueue();
  }, [
    activePostId,
    currentIndex,
    mediaReady,
    playing,
    prefetchNextInPlaylistQueue,
    queue,
    replayMode,
    shuffle
  ]);

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
      <audio ref={audioRef} className="podcast-audio-element" playsInline preload="auto" />
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
};
