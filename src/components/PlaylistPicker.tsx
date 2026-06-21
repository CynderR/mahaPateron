import React, { useState } from 'react';
import { usePlayer } from '../contexts/PlayerContext';

interface PlaylistPickerProps {
  postId: string;
  className?: string;
}

const PlaylistPicker: React.FC<PlaylistPickerProps> = ({ postId, className = '' }) => {
  const { playlists, createPlaylist, addToPlaylist } = usePlayer();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    setMessage('');
    try {
      const playlist = await createPlaylist(name);
      if (playlist) {
        await addToPlaylist(playlist.id, postId);
        setMessage(`Added to "${name}"`);
        setNewName('');
      }
    } catch {
      setMessage('Could not create playlist.');
    } finally {
      setBusy(false);
    }
  };

  const handleAdd = async (playlistId: string, playlistName: string) => {
    setBusy(true);
    setMessage('');
    try {
      await addToPlaylist(playlistId, postId);
      setMessage(`Added to "${playlistName}"`);
    } catch {
      setMessage('Could not add to playlist.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`playlist-picker ${className}`.trim()}>
      <button
        type="button"
        className="player-control-btn"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Add to playlist"
      >
        <svg viewBox="0 0 24 24" aria-hidden>
          <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
        </svg>
        <span className="player-control-label">Playlist</span>
      </button>
      {open && (
        <div className="playlist-picker-menu">
          <p className="playlist-picker-title">Add to playlist</p>
          {playlists.length > 0 && (
            <ul className="playlist-picker-list">
              {playlists.map((pl) => (
                <li key={pl.id}>
                  <button type="button" disabled={busy} onClick={() => handleAdd(pl.id, pl.name)}>
                    {pl.name} ({pl.item_count})
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form className="playlist-picker-new" onSubmit={handleCreate}>
            <input
              type="text"
              className="pod-input"
              placeholder="New playlist name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              disabled={busy}
            />
            <button type="submit" className="pod-btn pod-btn-sm" disabled={busy || !newName.trim()}>
              Create & add
            </button>
          </form>
          {message && <p className="playlist-picker-msg">{message}</p>}
        </div>
      )}
    </div>
  );
};

export default PlaylistPicker;
