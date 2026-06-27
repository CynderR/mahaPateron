import { usePlayer } from '../contexts/PlayerContext';

export const usePlaybackProgress = (postId: string, fallbackDuration?: number | null) => {
  const { activePostId, currentTime, duration, playing } = usePlayer();
  const isActive = activePostId === postId;
  const effectiveDuration = isActive ? duration || fallbackDuration || 0 : 0;
  const progress =
    isActive && effectiveDuration > 0 ? Math.min(100, (currentTime / effectiveDuration) * 100) : 0;

  return {
    isActive,
    playing: isActive && playing,
    currentTime: isActive ? currentTime : 0,
    effectiveDuration,
    progress
  };
};
