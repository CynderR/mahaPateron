import React, { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import axios from 'axios';
import { ShareAccess, ShareProvider } from '../../contexts/ShareContext';
import ShareFeed from './ShareFeed';
import ShareLibrary from './ShareLibrary';
import ShareStream from './ShareStream';

interface ShareBootstrap {
  share_token: string;
  canStream: boolean;
  canRss: boolean;
  canDownload: boolean;
}

const ShareLayout: React.FC = () => {
  const { shareToken, titleSlug } = useParams<{ shareToken?: string; titleSlug?: string }>();
  const token = shareToken || '';
  const basePath = titleSlug ? `/share/${titleSlug}/${token}` : `/share/${token}`;
  const [bootstrap, setBootstrap] = useState<ShareBootstrap | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    const load = async () => {
      setError('');
      try {
        const res = await axios.get<ShareBootstrap>(`/share/${encodeURIComponent(token)}/feed`);
        if (!cancelled) setBootstrap(res.data);
      } catch {
        if (!cancelled) setError('This share link is unavailable or has expired.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!token) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return (
      <div className="ht-page">
        <div className="pod-empty">Loading shared episodes…</div>
      </div>
    );
  }

  if (error || !bootstrap) {
    return (
      <div className="ht-page">
        <main className="podcast-main">
          <div className="pod-card">
            <div className="pod-banner pod-banner-error">{error || 'This share link is unavailable.'}</div>
          </div>
        </main>
      </div>
    );
  }

  const access: ShareAccess = {
    canStream: !!bootstrap.canStream,
    canRss: !!bootstrap.canRss,
    canDownload: !!bootstrap.canDownload
  };

  return (
    <ShareProvider shareToken={bootstrap.share_token || token} basePath={basePath} access={access}>
      <Routes>
        <Route index element={<ShareFeed />} />
        <Route path="library" element={<ShareLibrary />} />
        <Route path="stream/:postId" element={<ShareStream />} />
        <Route path="*" element={<Navigate to={basePath} replace />} />
      </Routes>
    </ShareProvider>
  );
};

export default ShareLayout;
