import React, { useMemo } from 'react';
import { usePlayer } from '../contexts/PlayerContext';
import { usePlaybackProgress } from '../hooks/usePlaybackProgress';
import { seedHeights } from '../podcastMeta';

interface ProfileWaveformProps {
  seed: string;
  barCount?: number;
  className?: string;
  postId?: string;
  durationSecs?: number | null;
  seekable?: boolean;
}

const ProfileWaveform: React.FC<ProfileWaveformProps> = ({
  seed,
  barCount = 72,
  className = '',
  postId,
  durationSecs,
  seekable = true
}) => {
  const { seekTo } = usePlayer();
  const { isActive, effectiveDuration, progress } = usePlaybackProgress(postId ?? '', durationSecs);
  const heights = useMemo(() => seedHeights(seed, barCount), [seed, barCount]);
  const showProgress = !!postId && isActive;

  const handleSeek = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!seekable || !showProgress || !effectiveDuration) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    seekTo(ratio * effectiveDuration);
  };

  return (
    <div
      className={`ht-waveform ${showProgress ? 'ht-waveform-active' : ''} ${className}`.trim()}
      aria-hidden={!showProgress}
      onClick={showProgress && seekable ? handleSeek : undefined}
      role={showProgress && seekable ? 'slider' : undefined}
    >
      <div className="ht-waveform-bars">
        {heights.map((h, i) => (
          <span key={i} className="ht-waveform-bar" style={{ height: `${h}%` }} />
        ))}
      </div>
      {showProgress && (
        <div className="ht-waveform-progress" style={{ width: `${progress}%` }} aria-hidden />
      )}
    </div>
  );
};

export default ProfileWaveform;
