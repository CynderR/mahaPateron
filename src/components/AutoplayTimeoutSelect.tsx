import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selectedLabel = useMemo(
    () => AUTOPLAY_TIMEOUT_OPTIONS.find((option) => option.value === autoplayTimeoutHours)?.label ?? 'Replay Timer',
    [autoplayTimeoutHours]
  );

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`player-autoplay-timeout ${className}`.trim()}>
      {!compact && <span className="player-autoplay-timeout-label">Autoplay limit</span>}
      <div className="player-autoplay-timeout-menu-wrap">
        <button
          type="button"
          className="player-autoplay-timeout-select pod-select"
          onClick={() => setOpen((value) => !value)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Replay timer"
        >
          {selectedLabel}
        </button>
        {open && (
          <ul className="player-autoplay-timeout-menu" role="listbox" aria-label="Replay timer options">
            {AUTOPLAY_TIMEOUT_OPTIONS.map((option) => (
              <li key={option.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={autoplayTimeoutHours === option.value}
                  className={`player-autoplay-timeout-menu-item${
                    autoplayTimeoutHours === option.value ? ' player-autoplay-timeout-menu-item-active' : ''
                  }`}
                  onClick={() => {
                    setAutoplayTimeoutHours(option.value as AutoplayTimeoutHours);
                    setOpen(false);
                  }}
                >
                  {option.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {autoplayTimeoutHours > 0 && autoplayTimeRemainingMs != null && (
        <span className="player-autoplay-timeout-remaining" aria-live="polite">
          {formatAutoplayTimeRemaining(autoplayTimeRemainingMs)} left
        </span>
      )}
    </div>
  );
};

export default AutoplayTimeoutSelect;
