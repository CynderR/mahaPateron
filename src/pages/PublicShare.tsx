import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { buildImageUrl, buildPublicShareStreamUrl } from '../config';
import { stripFeedMetadataFromDescription } from '../utils/feedDescriptionHelpers';

interface SharedPost {
  id: string;
  title: string;
  description?: string;
  duration_secs?: number;
  published_at?: string;
  image_filename?: string | null;
}

interface ShareResponse {
  share_token: string;
  post: SharedPost;
}

const formatDuration = (secs?: number): string => {
  if (!secs && secs !== 0) return '';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

const PublicShare: React.FC = () => {
  const { shareToken } = useParams<{ shareToken?: string; titleSlug?: string }>();
  const token = shareToken || '';
  const [data, setData] = useState<ShareResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      setError('');
      try {
        const res = await axios.get<ShareResponse>(`/share/${encodeURIComponent(token)}`);
        setData(res.data);
      } catch {
        setError('This episode is unavailable or the link has expired.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  const streamUrl = useMemo(() => {
    if (!data) return '';
    return buildPublicShareStreamUrl(data.post.id, data.share_token);
  }, [data]);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio || !streamUrl) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    if (audio.src !== streamUrl) {
      audio.src = streamUrl;
      audio.load();
    }
    try {
      await audio.play();
      setPlaying(true);
    } catch {
      setError('Could not start playback in this browser.');
    }
  };

  const post = data?.post;
  const coverUrl = post?.image_filename ? buildImageUrl(post.image_filename) : null;
  const description = stripFeedMetadataFromDescription(post?.description);

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
        {loading && <div className="pod-empty">Loading episode…</div>}

        {!loading && error && (
          <div className="pod-card">
            <div className="pod-banner pod-banner-error">{error}</div>
            <Link to="/" className="pod-btn">
              Go to homepage
            </Link>
          </div>
        )}

        {!loading && post && streamUrl && (
          <article className="pod-card public-share-card">
            {coverUrl ? (
              <img className="public-share-cover" src={coverUrl} alt="" />
            ) : (
              <div className="public-share-cover public-share-cover-placeholder" aria-hidden>
                ♪
              </div>
            )}

            <div className="public-share-body">
              <p className="public-share-kicker">Shared episode</p>
              <h1 className="public-share-title">{post.title}</h1>
              {post.duration_secs != null && (
                <p className="public-share-meta">{formatDuration(post.duration_secs)}</p>
              )}
              {description && <p className="public-share-description">{description}</p>}

              <audio
                ref={audioRef}
                preload="none"
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={() => setPlaying(false)}
              />

              <button type="button" className="pod-btn public-share-play" onClick={togglePlayback}>
                {playing ? 'Pause' : 'Play episode'}
              </button>

              <p className="public-share-note">
                Anyone with this link can listen. Members can also find episodes in the full feed after signing in.
              </p>
            </div>
          </article>
        )}
      </main>
    </div>
  );
};

export default PublicShare;
