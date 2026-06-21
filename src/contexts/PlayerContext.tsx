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
  playEpisode: (postId: string, streamUrl: string, durationSecs?: number | null) => Promise<void>;
  togglePlayback: () => Promise<void>;
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

export const PlayerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const audioRef = useRef<HTMLAudioElement>(null);
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

  const setAudioSource = useCallback((postId: string, streamUrl: string, durationSecs?: number | null) => {
    const audio = audioRef.current;
    if (!audio) return;

    if (activePostId !== postId) {
      audio.src = streamUrl;
      audio.load();
      setActivePostId(postId);
      setCurrentTime(0);
      setDuration(durationSecs ?? 0);
      setPlaying(false);
      setPlaybackError(null);
    }
  }, [activePostId]);

  const startPlayback = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;

    setPlaybackError(null);
    try {
      await audio.play();
    } catch {
      setPlaybackError('Playback was blocked. Tap play again.');
      setPlaying(false);
    }
  }, []);

  const prepareEpisode = useCallback(
    (postId: string, streamUrl: string, durationSecs?: number | null) => {
      setAudioSource(postId, streamUrl, durationSecs);
    },
    [setAudioSource]
  );

  const playEpisode = useCallback(
    async (postId: string, streamUrl: string, durationSecs?: number | null) => {
      setAudioSource(postId, streamUrl, durationSecs);
      await startPlayback();
    },
    [setAudioSource, startPlayback]
  );

  const togglePlayback = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;

    if (audio.paused) {
      await startPlayback();
    } else {
      audio.pause();
    }
  }, [startPlayback]);

  const seekTo = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;
    const max = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : duration;
    audio.currentTime = Math.max(0, Math.min(time, max || time));
  }, [duration]);

  const skipBy = useCallback((delta: number) => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;
    const max = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : duration;
    audio.currentTime = Math.max(0, Math.min(audio.currentTime + delta, max || audio.currentTime + delta));
  }, [duration]);

  const registerTrackEndedHandler = useCallback((handler: (() => void) | null) => {
    onTrackEndedRef.current = handler;
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
    const onPlay = () => {
      setPlaying(true);
      setPlaybackError(null);
    };
    const onPause = () => setPlaying(false);
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
      setPlaying(false);
      setPlaybackError('Could not load this episode.');
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
  }, []);

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
      <audio ref={audioRef} className="podcast-audio-element" playsInline preload="metadata" />
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
};
