import { FeedPost } from '../components/PostCard';

export type ReplayMode = 'one' | 'all' | 'off';

export const REPLAY_LABELS: Record<ReplayMode, string> = {
  one: 'Replay one',
  all: 'Replay all',
  off: 'Replay off'
};

export const cycleReplayMode = (mode: ReplayMode): ReplayMode => {
  if (mode === 'one') return 'all';
  if (mode === 'all') return 'off';
  return 'one';
};

export const buildShuffleOrder = (length: number, currentIndex: number): number[] => {
  const indices = Array.from({ length }, (_, i) => i).filter((i) => i !== currentIndex);
  for (let i = indices.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return [currentIndex, ...indices];
};

export const resolveNextIndex = (
  currentIndex: number,
  length: number,
  replayMode: ReplayMode,
  shuffle: boolean,
  shuffleOrder: number[]
): number | null => {
  if (length <= 1) {
    if (replayMode === 'off') return null;
    return currentIndex;
  }

  if (shuffle && shuffleOrder.length === length) {
    const pos = shuffleOrder.indexOf(currentIndex);
    if (pos >= 0 && pos < shuffleOrder.length - 1) return shuffleOrder[pos + 1];
    if (replayMode === 'all') return shuffleOrder[0];
    return null;
  }

  if (currentIndex < length - 1) return currentIndex + 1;
  if (replayMode === 'all') return 0;
  return null;
};

export const resolvePrevIndex = (
  currentIndex: number,
  length: number,
  replayMode: ReplayMode,
  shuffle: boolean,
  shuffleOrder: number[]
): number | null => {
  if (length <= 1) {
    if (replayMode === 'off') return null;
    return currentIndex;
  }

  if (shuffle && shuffleOrder.length === length) {
    const pos = shuffleOrder.indexOf(currentIndex);
    if (pos > 0) return shuffleOrder[pos - 1];
    if (replayMode === 'all') return shuffleOrder[shuffleOrder.length - 1];
    return null;
  }

  if (currentIndex > 0) return currentIndex - 1;
  if (replayMode === 'all') return length - 1;
  return null;
};

export type QueuePost = FeedPost;
