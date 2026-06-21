import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';
import {
  buildShuffleOrder,
  cycleReplayMode,
  QueuePost,
  ReplayMode,
  resolveNextIndex,
  resolvePrevIndex
} from '../utils/playerQueue';

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
  cycleReplay: () => void;
  toggleShuffle: () => void;
  setQueue: (posts: QueuePost[], currentPostId: string) => void;
  playQueueFromPlaylist: (posts: QueuePost[], startPostId: string) => void;
  getNextPostId: () => string | null;
  getPrevPostId: () => string | null;
  isFavorite: (postId: string) => boolean;
  toggleFavorite: (postId: string) => Promise<void>;
  refreshPlaylists: () => Promise<void>;
  createPlaylist: (name: string) => Promise<PlaylistSummary | null>;
  addToPlaylist: (playlistId: string, postId: string) => Promise<void>;
  removeFromPlaylist: (playlistId: string, postId: string) => Promise<void>;
  deletePlaylist: (playlistId: string) => Promise<void>;
  prepareEpisode: (postId: string, streamUrl: string, durationSecs?: number | null) => void;
  playEpisode: (postId: string, streamUrl: string, durationSecs?: number | null) => void;
  togglePlayback: () => void;
  seekTo: (time: number) => void;
  skipBy: (delta: number) => void;
  registerTrackEndedHandler: (handler: (() => void) | null) => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

const REPLAY_STORAGE_KEY = 'playerReplayMode';
const SHUFFLE_STORAGE_KEY = 'playerShuffle';

const readReplayMode = (): ReplayMode => {
  const stored = localStorage.getItem(REPLAY_STORAGE_KEY);
  if (stored === 'all' || stored === 'off' || stored === 'one') return stored;
  return 'one';
};

const readShuffle = (): boolean => localStorage.getItem(SHUFFLE_STORAGE_KEY) === 'true';

// Minimal silent WAV — unlocks Chromium/Brave mobile audio in a user-gesture handler.
const SILENT_WAV =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

const audioHasEpisode = (audio: HTMLAudioElement, postId: string): boolean => {
  const src = audio.currentSrc || audio.src || '';
  return src.includes(postId);
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
  const audioUnlockedRef = useRef(false);
  const playbackErrorRef = useRef<string | null>(null);
  const onTrackEndedRef = useRef<(() => void) | null>(null);
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

  const syncPlayingState = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setPlaying(!audio.paused && !audio.ended);
  }, []);

  const assignEpisode = useCallback((postId: string, streamUrl: string, durationSecs?: number | null) => {
    const changed = assignedSourceRef.current?.postId !== postId || assignedSourceRef.current?.url !== streamUrl;

    assignedSourceRef.current = { postId, url: streamUrl };
    activePostIdRef.current = postId;
    setActivePostId(postId);
    setPlaybackError(null);

    if (changed) {
      setCurrentTime(0);
      setDuration(durationSecs ?? 0);
      setPlaying(false);
      clearPendingPlay();

      const audio = audioRef.current;
      if (audio && loadedPostIdRef.current && loadedPostIdRef.current !== postId) {
        audio.pause();
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

    if (!force && loadedPostIdRef.current === assigned.postId && audioHasEpisode(audio, assigned.postId)) {
      return true;
    }

    clearPendingPlay();
    audio.pause();
    audio.src = assigned.url;
    audio.preload = 'auto';
    audio.volume = 1;
    audio.muted = false;
    audio.load();
    loadedPostIdRef.current = assigned.postId;
    setCurrentTime(0);
    setPlaybackError(null);
    return true;
  }, [clearPendingPlay]);

  const playAssignedSource = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !assignedSourceRef.current) return;

    primeAudioSource(false);

    const attempt = audio.play();
    if (!attempt) {
      syncPlayingState();
      return;
    }

    attempt
      .then(() => {
        syncPlayingState();
        setPlaybackError(null);
      })
      .catch((err: DOMException) => {
        loadedPostIdRef.current = null;
        setPlaying(false);
        if (err.name === 'NotAllowedError') {
          audioUnlockedRef.current = false;
          setPlaybackError('Playback blocked by the browser. Tap play again.');
        } else {
          setPlaybackError('Could not start playback. Tap play again.');
        }
      });
  }, [primeAudioSource, syncPlayingState]);

  const requestPlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !assignedSourceRef.current) return;

    clearPendingPlay();
    setPlaybackError(null);

    // Brave/Chrome require play() in the user-gesture stack — never defer to canplay.
    if (audioUnlockedRef.current) {
      playAssignedSource();
      return;
    }

    audio.src = SILENT_WAV;
    audio.load();
    const unlockAttempt = audio.play();
    if (!unlockAttempt) {
      playAssignedSource();
      return;
    }

    unlockAttempt
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
        audioUnlockedRef.current = true;
        playAssignedSource();
      })
      .catch(() => {
        audioUnlockedRef.current = false;
        playAssignedSource();
      });
  }, [clearPendingPlay, playAssignedSource]);

  const prepareEpisode = useCallback(
    (postId: string, streamUrl: string, durationSecs?: number | null) => {
      assignEpisode(postId, streamUrl, durationSecs);
      primeAudioSource(true);
    },
    [assignEpisode, primeAudioSource]
  );

  const playEpisode = useCallback(
    (postId: string, streamUrl: string, durationSecs?: number | null) => {
      assignEpisode(postId, streamUrl, durationSecs);
      primeAudioSource(true);
      requestPlay();
    },
    [assignEpisode, primeAudioSource, requestPlay]
  );

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
      clearPendingPlay();
      audio.pause();
      setPlaying(false);
    }
  }, [clearPendingPlay, primeAudioSource, requestPlay]);

  const seekTo = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio || !assignedSourceRef.current) return;
    const max = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : duration;
    audio.currentTime = Math.max(0, Math.min(time, max || time));
  }, [duration]);

  const skipBy = useCallback((delta: number) => {
    const audio = audioRef.current;
    if (!audio || !assignedSourceRef.current) return;
    const max = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : duration;
    audio.currentTime = Math.max(0, Math.min(audio.currentTime + delta, max || audio.currentTime + delta));
  }, [duration]);

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

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onDurationChange = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };
    const onPlay = () => syncPlayingState();
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
      clearPendingPlay();
      setPlaying(false);
      loadedPostIdRef.current = null;
      setPlaybackError(describeMediaError(audio));
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('loadedmetadata', onDurationChange);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('loadedmetadata', onDurationChange);
      audio.removeEventListener('play', onPlay);
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

      if (audio.currentTime > lastTime + 0.05) {
        lastTime = audio.currentTime;
        stalledChecks = 0;
        return;
      }

      stalledChecks += 1;
      if (stalledChecks >= 2) {
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
    (posts: QueuePost[], currentPostId: string) => {
      const index = posts.findIndex((p) => p.id === currentPostId);
      const safeIndex = index >= 0 ? index : 0;
      setQueueState(posts);
      setCurrentIndex(safeIndex);
      setShuffleOrder(shuffle ? buildShuffleOrder(posts.length, safeIndex) : []);
    },
    [shuffle]
  );

  const playQueueFromPlaylist = useCallback(
    (posts: QueuePost[], startPostId: string) => {
      setQueue(posts, startPostId);
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

  useEffect(() => {
    if (shuffle && queue.length > 0) {
      setShuffleOrder(buildShuffleOrder(queue.length, currentIndex));
    }
  }, [queue.length, currentIndex, shuffle]);

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
    async (name: string) => {
      const res = await axios.post<{ playlist: PlaylistSummary }>('/account/player/playlists', { name });
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
      removeFromPlaylist,
      deletePlaylist: deletePlaylistById,
      prepareEpisode,
      playEpisode,
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
      removeFromPlaylist,
      deletePlaylistById,
      prepareEpisode,
      playEpisode,
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
