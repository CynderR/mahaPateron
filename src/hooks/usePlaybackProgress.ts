import { usePlayer } from '../contexts/PlayerContext';

export const usePlaybackProgress = (postId: string, fallbackDuration?: number | null) => {
  const { activePostId, currentTime, duration, playing, streamPreviewSeconds } = usePlayer();
  const isActive = activePostId === postId;
  const rawDuration = isActive ? duration || fallbackDuration || 0 : 0;
  const effectiveDuration =
    isActive && streamPreviewSeconds != null
      ? Math.min(streamPreviewSeconds, rawDuration || streamPreviewSeconds)
      : rawDuration;
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
