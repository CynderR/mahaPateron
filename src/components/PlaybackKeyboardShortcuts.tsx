import React from 'react';
import { useLocation } from 'react-router-dom';
import { usePlayer } from '../contexts/PlayerContext';
import { isStreamPlayPath, usePlaybackKeyboardShortcuts } from '../hooks/usePlaybackKeyboardShortcuts';

/** Global Space → play/pause while on a stream (play mode) page. */
const PlaybackKeyboardShortcuts: React.FC = () => {
  const { pathname } = useLocation();
  const { activePostId, togglePlayback } = usePlayer();
  const inPlayMode = isStreamPlayPath(pathname) && activePostId != null;

  usePlaybackKeyboardShortcuts(inPlayMode, togglePlayback);
  return null;
};

export default PlaybackKeyboardShortcuts;
