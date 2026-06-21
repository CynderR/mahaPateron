import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { buildDownloadUrl } from '../config';
import { FeedPost } from './PostCard';

const LAST_LATEST_KEY = 'lastKnownLatestPostId';

interface LatestEpisodeResponse {
  post: FeedPost | null;
  download_url?: string;
  canStream: boolean;
  is_paying: boolean;
}

interface DownloadLatestButtonProps {
  className?: string;
  compact?: boolean;
}

const DownloadLatestButton: React.FC<DownloadLatestButtonProps> = ({ className = '', compact = false }) => {
  const { user } = useAuth();
  const [data, setData] = useState<LatestEpisodeResponse | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const checkLatest = async () => {
    if (!user) return;
    setError('');
    try {
      const res = await axios.get<LatestEpisodeResponse>('/account/player/latest-episode');
      setData(res.data);
      if (res.data.post) {
        const lastSeen = localStorage.getItem(LAST_LATEST_KEY);
        setIsNew(lastSeen !== res.data.post.id);
      } else {
        setIsNew(false);
      }
    } catch {
      setError('Could not check for new episodes.');
    }
  };

  useEffect(() => {
    checkLatest();
  }, [user]);

  const downloadLatest = async () => {
    if (!user?.rss_token) return;
    setLoading(true);
    setError('');
    try {
      const res = await axios.get<LatestEpisodeResponse>('/account/player/latest-episode');
      const post = res.data.post;
      if (!post) {
        setError('No episodes available yet.');
        return;
      }
      if (!res.data.is_paying || !res.data.canStream) {
        setError('Streaming access is required to download.');
        return;
      }

      const url = buildDownloadUrl(post.id, user.rss_token);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${post.title.replace(/[^\w\s.-]+/g, '').trim() || 'episode'}.mp3`;
      document.body.appendChild(link);
      link.click();
      link.remove();

      localStorage.setItem(LAST_LATEST_KEY, post.id);
      setIsNew(false);
      setData(res.data);
    } catch {
      setError('Download failed.');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className={`download-latest ${className}`.trim()}>
      <button
        type="button"
        className={`pod-btn pod-btn-sm${isNew ? ' download-latest-new' : ''}${compact ? ' pod-btn-secondary' : ''}`}
        onClick={downloadLatest}
        disabled={loading}
        title={data?.post ? `Latest: ${data.post.title}` : 'Check for latest episode'}
      >
        {loading ? 'Checking…' : isNew ? 'Download new episode' : compact ? 'Latest' : 'Download latest'}
      </button>
      {error && <span className="download-latest-error">{error}</span>}
    </div>
  );
};

export default DownloadLatestButton;
