import React from 'react';
import { usePlayer } from '../contexts/PlayerContext';
import { usePlaybackProgress } from '../hooks/usePlaybackProgress';
import { formatPlaybackTime } from '../utils/playerTime';

interface PlaybackProgressBarProps {
  postId: string;
  durationSecs?: number | null;
  seekable?: boolean;
  showTimes?: boolean;
  variant?: 'scrubber' | 'thin';
  className?: string;
}

const PlaybackProgressBar: React.FC<PlaybackProgressBarProps> = ({
  postId,
  durationSecs,
  seekable = true,
  showTimes = true,
  variant = 'scrubber',
  className = ''
}) => {
  const { seekTo } = usePlayer();
  const { isActive, currentTime, effectiveDuration, progress } = usePlaybackProgress(postId, durationSecs);

  if (!isActive) return null;

  if (variant === 'thin') {
    return (
      <div
        className={`playback-progress-thin ${className}`.trim()}
        role="progressbar"
        aria-valuenow={Math.round(currentTime)}
        aria-valuemin={0}
        aria-valuemax={Math.round(effectiveDuration)}
        aria-label="Playback progress"
      >
        <div className="playback-progress-thin-fill" style={{ width: `${progress}%` }} />
      </div>
    );
  }

  const remaining = Math.max(0, effectiveDuration - currentTime);

  return (
    <div className={`playback-progress-scrubber ${className}`.trim()}>
      <input
        type="range"
        className="playback-progress-range"
        min={0}
        max={effectiveDuration || 1}
        step={1}
        value={Math.min(currentTime, effectiveDuration || 0)}
        disabled={!seekable || !effectiveDuration}
        onChange={(e) => seekTo(parseFloat(e.target.value))}
        aria-label="Seek"
        style={{ '--playback-progress': `${progress}%` } as React.CSSProperties}
      />
      {showTimes && (
        <div className="playback-progress-times">
          <span>{formatPlaybackTime(currentTime)}</span>
          <span>-{formatPlaybackTime(remaining)}</span>
        </div>
      )}
    </div>
  );
};

export default PlaybackProgressBar;
