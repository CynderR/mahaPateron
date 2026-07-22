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

  const bars = (played: boolean) => (
    <div
      className={`ht-waveform-bars${played ? ' ht-waveform-bars-played' : ''}`}
      aria-hidden={played || undefined}
    >
      {heights.map((h, i) => (
        <span key={i} className="ht-waveform-bar" style={{ height: `${h}%` }} />
      ))}
    </div>
  );

  return (
    <div
      className={`ht-waveform ${showProgress ? 'ht-waveform-active' : ''} ${className}`.trim()}
      style={showProgress ? ({ '--wf-progress': `${progress}%` } as React.CSSProperties) : undefined}
      aria-hidden={!showProgress}
      onClick={showProgress && seekable ? handleSeek : undefined}
      role={showProgress && seekable ? 'slider' : undefined}
    >
      {bars(false)}
      {showProgress && bars(true)}
    </div>
  );
};

export default ProfileWaveform;
