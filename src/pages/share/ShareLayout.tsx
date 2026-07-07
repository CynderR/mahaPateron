import React, { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { memberIsNotSubscribed } from '../../utils/accessPermissions';
import { ShareAccess, ShareProvider } from '../../contexts/ShareContext';
import ShareFeed from './ShareFeed';
import ShareLibrary from './ShareLibrary';
import ShareStream from './ShareStream';

interface ShareBootstrap {
  share_token: string;
  canStream: boolean;
  canRss: boolean;
  canDownload: boolean;
  member_access: boolean;
  anchor_post_id: string | null;
}

const ShareLayout: React.FC = () => {
  const { shareToken, titleSlug } = useParams<{ shareToken?: string; titleSlug?: string }>();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const token = shareToken || '';
  const basePath = titleSlug ? `/share/${titleSlug}/${token}` : `/share/${token}`;
  const [bootstrap, setBootstrap] = useState<ShareBootstrap | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token || authLoading) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
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
  }, [token, authLoading, user?.id, user?.payment_category, user?.is_paying]);

  if (!token) {
    return <Navigate to="/" replace />;
  }

  if (loading || authLoading) {
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

  const isSignedInMember =
    !!user && !memberIsNotSubscribed(user.payment_category, user.is_paying);

  if (isSignedInMember) {
    const remainder = location.pathname.replace(basePath, '').replace(/^\//, '');
    if (remainder.startsWith('stream/')) {
      const postId = decodeURIComponent(remainder.replace(/^stream\//, '').split('/')[0]);
      return <Navigate to={`/stream/${postId}`} replace />;
    }
    if (remainder.startsWith('library')) {
      return <Navigate to="/library" replace />;
    }
    return <Navigate to="/feed" replace />;
  }

  const access: ShareAccess = {
    canStream: !!bootstrap.canStream,
    canRss: !!bootstrap.canRss,
    canDownload: !!bootstrap.canDownload
  };

  return (
    <ShareProvider
      shareToken={bootstrap.share_token || token}
      basePath={basePath}
      access={access}
      memberAccess={!!bootstrap.member_access}
      anchorPostId={bootstrap.anchor_post_id ?? null}
    >
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
