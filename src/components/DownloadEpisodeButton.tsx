import React, { useState } from 'react';
import { buildDownloadUrl } from '../config';
import { useAuth } from '../contexts/AuthContext';
import { memberHasDownloadAccess } from '../utils/accessPermissions';
import { isNativeApp } from '../native/platform';
import AppDownloadButton from './AppDownloadButton';

interface DownloadEpisodeButtonProps {
  postId: string;
  postTitle: string;
  publishedAt?: string | null;
  durationSecs?: number | null;
  imageFilename?: string | null;
  className?: string;
  compact?: boolean;
}

const DownloadEpisodeButton: React.FC<DownloadEpisodeButtonProps> = ({
  postId,
  postTitle,
  publishedAt,
  durationSecs,
  imageFilename,
  className = '',
  compact = false
}) => {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);

  if (isNativeApp()) {
    return (
      <AppDownloadButton
        postId={postId}
        postTitle={postTitle}
        publishedAt={publishedAt}
        durationSecs={durationSecs}
        imageFilename={imageFilename}
        className={className}
        compact={compact}
      />
    );
  }

  if (!user?.rss_token || !memberHasDownloadAccess(user.is_paying, user.download_access, user.payment_category)) {
    return null;
  }

  const rssToken = user.rss_token;

  const handleDownload = () => {
    setBusy(true);
    try {
      const url = buildDownloadUrl(postId, rssToken);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${postTitle.replace(/[^\w\s.-]+/g, '').trim() || 'episode'}.mp3`;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      className={`pod-btn pod-btn-secondary pod-btn-sm episode-download-btn ${className}`.trim()}
      onClick={handleDownload}
      disabled={busy}
      title={`Download ${postTitle}`}
    >
      {busy ? 'Downloading…' : compact ? 'Download' : 'Download episode'}
    </button>
  );
};

export default DownloadEpisodeButton;
