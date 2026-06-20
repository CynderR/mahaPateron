import React, { useMemo } from 'react';
import { seedHeights } from '../podcastMeta';

interface ProfileWaveformProps {
  seed: string;
  barCount?: number;
  className?: string;
}

const ProfileWaveform: React.FC<ProfileWaveformProps> = ({ seed, barCount = 72, className = '' }) => {
  const heights = useMemo(() => seedHeights(seed, barCount), [seed, barCount]);

  return (
    <div className={`ht-waveform ${className}`.trim()} aria-hidden>
      <div className="ht-waveform-bars">
        {heights.map((h, i) => (
          <span key={i} className="ht-waveform-bar" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
};

export default ProfileWaveform;
