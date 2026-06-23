import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import PublicShareEpisodeRow, { PublicSharePost } from '../components/PublicShareEpisodeRow';

interface ShareResponse {
  share_token: string;
  post: PublicSharePost;
  posts: PublicSharePost[];
}

const PublicShare: React.FC = () => {
  const { shareToken } = useParams<{ shareToken?: string; titleSlug?: string }>();
  const token = shareToken || '';
  const [data, setData] = useState<ShareResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      setError('');
      try {
        const res = await axios.get<ShareResponse>(`/share/${encodeURIComponent(token)}`);
        setData(res.data);
      } catch {
        setError('This share link is unavailable or has expired.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  const handleTogglePlay = async (postId: string, streamUrl: string) => {
    const audio = audioRef.current;
    if (!audio) return;

    if (playingId === postId && !audio.paused) {
      audio.pause();
      setPlayingId(null);
      return;
    }

    if (audio.src !== streamUrl) {
      audio.src = streamUrl;
      audio.load();
    }

    try {
      await audio.play();
      setPlayingId(postId);
    } catch {
      setError('Could not start playback in this browser.');
    }
  };

  const featured = data?.post ?? null;
  const shareTokenValue = data?.share_token ?? '';
  const otherPosts =
    data?.posts.filter((post) => post.id !== featured?.id) ?? [];

  return (
    <div className="public-share-page">
      <header className="public-share-header">
        <Link to="/" className="public-share-brand">
          Shyam Akaash
        </Link>
        <Link to="/signin" className="pod-btn pod-btn-secondary pod-btn-sm">
          Member sign in
        </Link>
      </header>

      <main className="public-share-main">
        {loading && <div className="pod-empty">Loading episodes…</div>}

        {!loading && error && !data && (
          <div className="pod-card">
            <div className="pod-banner pod-banner-error">{error}</div>
            <Link to="/" className="pod-btn">
              Go to homepage
            </Link>
          </div>
        )}

        {!loading && data && shareTokenValue && (
          <>
            {error && <div className="pod-banner pod-banner-error">{error}</div>}

            <p className="public-share-note public-share-catalog-note">
              Anyone with this link can browse and listen to all published episodes.
            </p>

            <audio ref={audioRef} preload="none" onEnded={() => setPlayingId(null)} />

            {featured && (
              <div className="pod-card public-share-card">
                <PublicShareEpisodeRow
                  post={featured}
                  shareToken={shareTokenValue}
                  featured
                  playing={playingId === featured.id}
                  onTogglePlay={handleTogglePlay}
                />
              </div>
            )}

            {otherPosts.length > 0 && (
              <section className="public-share-catalog">
                <h2 className="public-share-catalog-title">All episodes</h2>
                <div className="public-share-catalog-list">
                  {otherPosts.map((post) => (
                    <PublicShareEpisodeRow
                      key={post.id}
                      post={post}
                      shareToken={shareTokenValue}
                      playing={playingId === post.id}
                      onTogglePlay={handleTogglePlay}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default PublicShare;
