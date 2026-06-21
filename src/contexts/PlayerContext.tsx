import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
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
  const [replayMode, setReplayMode] = useState<ReplayMode>(readReplayMode);
  const [shuffle, setShuffle] = useState(readShuffle);
  const [queue, setQueueState] = useState<QueuePost[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [shuffleOrder, setShuffleOrder] = useState<number[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);

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
      deletePlaylist: deletePlaylistById
    }),
    [
      replayMode,
      shuffle,
      queue,
      currentIndex,
      favorites,
      playlists,
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
      deletePlaylistById
    ]
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
};

export const usePlayer = () => {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
};
