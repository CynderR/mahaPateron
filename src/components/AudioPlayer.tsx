import React from 'react';
import { buildStreamUrl } from '../config';

interface AudioPlayerProps {
  postId: string;
  rssToken?: string;
}

// HTML5 audio element pointing at the authenticated streaming route. The
// browser cannot send an Authorization header for media elements, so the
// user's RSS token is passed as a query param; the stream route validates it
// and enforces the paying + streaming-access checks on every request.
const AudioPlayer: React.FC<AudioPlayerProps> = ({ postId, rssToken }) => {
  if (!rssToken) {
    return null;
  }

  return (
    <audio className="pod-audio" controls preload="none">
      <source src={buildStreamUrl(postId, rssToken)} type="audio/mpeg" />
      Your browser does not support the audio element.
    </audio>
  );
};

export default AudioPlayer;
