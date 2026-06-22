import React from 'react';
import { usePlayer } from '../contexts/PlayerContext';
import {
  AUTOPLAY_TIMEOUT_OPTIONS,
  AutoplayTimeoutHours,
  formatAutoplayTimeRemaining
} from '../utils/autoplayTimeout';

interface AutoplayTimeoutSelectProps {
  className?: string;
  compact?: boolean;
}

const AutoplayTimeoutSelect: React.FC<AutoplayTimeoutSelectProps> = ({ className = '', compact = false }) => {
  const { autoplayTimeoutHours, autoplayTimeRemainingMs, setAutoplayTimeoutHours } = usePlayer();

  return (
    <label className={`player-autoplay-timeout ${className}`.trim()}>
      {!compact && <span className="player-autoplay-timeout-label">Autoplay limit</span>}
      <select
        className="player-autoplay-timeout-select pod-select"
        value={autoplayTimeoutHours}
        onChange={(e) => setAutoplayTimeoutHours(parseInt(e.target.value, 10) as AutoplayTimeoutHours)}
        aria-label="Autoplay time limit"
      >
        {AUTOPLAY_TIMEOUT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {autoplayTimeoutHours > 0 && autoplayTimeRemainingMs != null && (
        <span className="player-autoplay-timeout-remaining" aria-live="polite">
          {formatAutoplayTimeRemaining(autoplayTimeRemainingMs)} left
        </span>
      )}
    </label>
  );
};

export default AutoplayTimeoutSelect;
