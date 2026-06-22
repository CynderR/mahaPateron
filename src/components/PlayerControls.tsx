import React from 'react';
import { usePlayer } from '../contexts/PlayerContext';
import { REPLAY_LABELS } from '../utils/playerQueue';
import AutoplayTimeoutSelect from './AutoplayTimeoutSelect';

interface PlayerControlsProps {
  onPrevious?: () => void;
  onNext?: () => void;
  canPrevious?: boolean;
  canNext?: boolean;
  className?: string;
}

const PlayerControls: React.FC<PlayerControlsProps> = ({
  onPrevious,
  onNext,
  canPrevious = false,
  canNext = false,
  className = ''
}) => {
  const { replayMode, shuffle, cycleReplay, toggleShuffle } = usePlayer();

  return (
    <div className={`player-controls ${className}`.trim()}>
      <button
        type="button"
        className={`player-control-btn player-replay-btn${replayMode !== 'off' ? ' player-control-btn-active' : ''}`}
        onClick={cycleReplay}
        title={REPLAY_LABELS[replayMode]}
        aria-label={REPLAY_LABELS[replayMode]}
      >
        <svg viewBox="0 0 24 24" aria-hidden>
          <path
            fill="currentColor"
            d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"
            opacity={replayMode === 'off' ? 0.45 : 1}
          />
        </svg>
        <span className="player-control-label">{REPLAY_LABELS[replayMode]}</span>
      </button>

      <button
        type="button"
        className={`player-control-btn${shuffle ? ' player-control-btn-active' : ''}`}
        onClick={toggleShuffle}
        aria-label={shuffle ? 'Random play on' : 'Random play off'}
        title={shuffle ? 'Random play on' : 'Random play off'}
      >
        <svg viewBox="0 0 24 24" aria-hidden>
          <path
            fill="currentColor"
            d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"
          />
        </svg>
        <span className="player-control-label">Random</span>
      </button>

      <button
        type="button"
        className="player-control-btn"
        onClick={onPrevious}
        disabled={!canPrevious}
        aria-label="Previous track"
      >
        <svg viewBox="0 0 24 24" aria-hidden>
          <path fill="currentColor" d="M6 6h2v12H6V6zm3.5 6l8.5 6V6l-8.5 6z" />
        </svg>
      </button>

      <button
        type="button"
        className="player-control-btn"
        onClick={onNext}
        disabled={!canNext}
        aria-label="Next track"
      >
        <svg viewBox="0 0 24 24" aria-hidden>
          <path fill="currentColor" d="M6 18l8.5-6L6 6v12zm2.5-6l0 0zm8.5 6V6h2v12h-2z" />
        </svg>
      </button>

      <AutoplayTimeoutSelect compact />
    </div>
  );
};

export default PlayerControls;
