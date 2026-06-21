import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import HearThisNav from '../components/HearThisNav';
import FavoriteButton from '../components/FavoriteButton';
import PodcastMobileNav, { PodcastMobileHeader } from '../components/mobile/PodcastMobileNav';
import { usePlayer } from '../contexts/PlayerContext';
import { FeedPost } from '../components/PostCard';

const Playlists: React.FC = () => {
  const navigate = useNavigate();
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
    navigate(`/stream/${posts[0].id}`);
  };

  return (
    <div className="ht-page">
      <HearThisNav />

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
            {playlists.map((pl) => (
              <section key={pl.id} className="pod-card playlist-card">
                <div className="playlist-card-head">
                  <h3>{pl.name}</h3>
                  <div className="pod-inline-actions">
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
                </div>
                <p className="playlist-card-count">{pl.item_count} tracks</p>
                {pl.items.length > 0 && (
                  <ul className="playlist-track-list">
                    {pl.items.map((item) => (
                      <li key={item.post_id}>
                        <Link to={`/stream/${item.post_id}`}>{item.title}</Link>
                        <FavoriteButton postId={item.post_id} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
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
            {playlists.map((pl) => (
              <section key={pl.id} className="pod-card playlist-card">
                <div className="playlist-card-head">
                  <h3>{pl.name}</h3>
                  <div className="pod-inline-actions">
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
                </div>
                <p className="playlist-card-count">{pl.item_count} tracks</p>
                {pl.items.length > 0 && (
                  <ul className="playlist-track-list">
                    {pl.items.map((item) => (
                      <li key={item.post_id}>
                        <Link to={`/stream/${item.post_id}`}>{item.title}</Link>
                        <FavoriteButton postId={item.post_id} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Playlists;
