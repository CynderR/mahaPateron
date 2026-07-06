import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import PodcastNav from '../components/PodcastNav';
import FavoriteButton from '../components/FavoriteButton';
import PodcastMobileNav, { PodcastMobileHeader } from '../components/mobile/PodcastMobileNav';
import { PlaylistSummary, usePlayer } from '../contexts/PlayerContext';
import { FeedPost } from '../components/PostCard';
import { buildStreamState, currentPathWithSearch } from '../utils/streamNavigation';

const Playlists: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const streamReturnFrom = currentPathWithSearch(location.pathname, location.search);
  const { playlists, createPlaylist, deletePlaylist, playQueueFromPlaylist, refreshPlaylists } = usePlayer();
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    setError('');
    try {
      await createPlaylist(name);
      setNewName('');
      await refreshPlaylists();
    } catch {
      setError('Could not create playlist.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete playlist "${name}"?`)) return;
    try {
      await deletePlaylist(id);
    } catch {
      setError('Could not delete playlist.');
    }
  };

  const playPlaylist = (items: { post_id: string; title: string; description?: string; duration_secs?: number; published_at?: string; image_filename?: string | null }[]) => {
    if (items.length === 0) return;
    const posts: FeedPost[] = items.map((item) => ({
      id: item.post_id,
      title: item.title,
      description: item.description,
      duration_secs: item.duration_secs,
      published_at: item.published_at,
      image_filename: item.image_filename
    }));
    playQueueFromPlaylist(posts, posts[0].id);
    navigate(`/stream/${posts[0].id}`, { state: buildStreamState(streamReturnFrom, posts[0]) });
  };

  const renderPlaylistCard = (pl: PlaylistSummary) => {
    const trackListId = `playlist-tracks-${pl.id}`;

    return (
      <section key={pl.id} className="pod-card playlist-card">
        <details className="playlist-card-details">
          <summary className="playlist-card-summary" aria-controls={trackListId}>
            <span className="playlist-card-title-wrap">
              <span className="playlist-card-title">{pl.name}</span>
              <span className="playlist-card-count">{pl.item_count} tracks</span>
            </span>
            <span className="playlist-card-chevron" aria-hidden>
              v
            </span>
            <div className="pod-inline-actions playlist-card-actions">
              <button
                type="button"
                className="pod-btn pod-btn-secondary pod-btn-sm"
                disabled={pl.items.length === 0}
                onClick={() => playPlaylist(pl.items)}
              >
                Play all
              </button>
              <button
                type="button"
                className="pod-btn pod-btn-danger pod-btn-sm"
                onClick={() => handleDelete(pl.id, pl.name)}
              >
                Delete
              </button>
            </div>
          </summary>
          <div id={trackListId} className="playlist-card-body">
            {pl.items.length > 0 ? (
              <ul className="playlist-track-list">
                {pl.items.map((item) => (
                  <li key={item.post_id}>
                    <Link
                      to={`/stream/${item.post_id}`}
                      state={buildStreamState(streamReturnFrom, {
                        id: item.post_id,
                        title: item.title,
                        duration_secs: item.duration_secs,
                        published_at: item.published_at,
                        image_filename: item.image_filename
                      })}
                    >
                      {item.title}
                    </Link>
                    <FavoriteButton postId={item.post_id} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="playlist-empty">No tracks in this playlist yet.</p>
            )}
          </div>
        </details>
      </section>
    );
  };

  return (
    <div className="podcast-page playlists-page-shell">
      <div className="feed-ht-desktop-only">
        <PodcastNav />
      </div>

      <div className="pod-feed-mobile-only">
        <PodcastMobileHeader title="Playlists" subtitle={`${playlists.length} saved lists`} />
        {error && <div className="pod-banner pod-banner-error">{error}</div>}

        <form className="pod-card playlists-create" onSubmit={handleCreate} style={{ margin: '0.75rem 1rem' }}>
          <h3 style={{ marginTop: 0 }}>New playlist</h3>
          <div className="pod-copy-row">
            <input
              className="pod-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Playlist name"
              disabled={busy}
            />
            <button type="submit" className="pod-btn" disabled={busy || !newName.trim()}>
              Create
            </button>
          </div>
        </form>

        {playlists.length === 0 ? (
          <div className="pod-empty">No playlists yet.</div>
        ) : (
          <div className="playlists-grid" style={{ padding: '0 1rem' }}>
            {playlists.map(renderPlaylistCard)}
          </div>
        )}

        <PodcastMobileNav />
      </div>

      <main className="podcast-main playlists-page feed-ht-desktop-only">
        <h2 className="podcast-section-title">Playlists</h2>
        {error && <div className="pod-banner pod-banner-error">{error}</div>}

        <form className="pod-card playlists-create" onSubmit={handleCreate}>
          <h3 style={{ marginTop: 0 }}>New playlist</h3>
          <div className="pod-copy-row">
            <input
              className="pod-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Playlist name"
              disabled={busy}
            />
            <button type="submit" className="pod-btn" disabled={busy || !newName.trim()}>
              Create
            </button>
          </div>
        </form>

        {playlists.length === 0 ? (
          <div className="pod-empty">No playlists yet. Create one above or add tracks from the player.</div>
        ) : (
          <div className="playlists-grid">
            {playlists.map(renderPlaylistCard)}
          </div>
        )}
      </main>
    </div>
  );
};

export default Playlists;
