import React from 'react';

interface EpisodeTransportBarProps {
  onSkip: (delta: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  canPrevious: boolean;
  canNext: boolean;
  canSkip: boolean;
  className?: string;
}

const EpisodeTransportBar: React.FC<EpisodeTransportBarProps> = ({
  onSkip,
  onPrevious,
  onNext,
  canPrevious,
  canNext,
  canSkip,
  className = ''
}) => (
  <div className={`stream-episode-transport ${className}`.trim()} aria-label="Episode transport">
    <button
      type="button"
      className="stream-episode-transport-skip"
      onClick={() => onSkip(-15)}
      disabled={!canSkip}
      aria-label="Rewind 15 seconds"
    >
      -15
    </button>
    <button
      type="button"
      className="stream-episode-transport-btn"
      onClick={onPrevious}
      disabled={!canPrevious}
      aria-label="Previous episode"
    >
      <svg viewBox="0 0 24 24" aria-hidden>
        <path fill="currentColor" d="M6 6h2v12H6V6zm3.5 6l8.5 6V6l-8.5 6z" />
      </svg>
    </button>
    <button
      type="button"
      className="stream-episode-transport-btn"
      onClick={onNext}
      disabled={!canNext}
      aria-label="Next episode"
    >
      <svg viewBox="0 0 24 24" aria-hidden>
        <path fill="currentColor" d="M6 18l8.5-6L6 6v12zm2.5-6l0 0zm8.5 6V6h2v12h-2z" />
      </svg>
    </button>
    <button
      type="button"
      className="stream-episode-transport-skip"
      onClick={() => onSkip(15)}
      disabled={!canSkip}
      aria-label="Forward 15 seconds"
    >
      +15
    </button>
  </div>
);

export default EpisodeTransportBar;
