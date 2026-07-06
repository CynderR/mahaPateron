import React, { useEffect, useRef, useState } from 'react';
import { usePlayer } from '../contexts/PlayerContext';

interface BulkPlaylistPickerProps {
  postIds: string[];
  onComplete?: () => void;
  className?: string;
}

const BulkPlaylistPicker: React.FC<BulkPlaylistPickerProps> = ({
  postIds,
  onComplete,
  className = ''
}) => {
  const { playlists, createPlaylist, addManyToPlaylist, refreshPlaylists } = usePlayer();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    refreshPlaylists().catch(() => {});
  }, [open, refreshPlaylists]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (postIds.length === 0) {
      setOpen(false);
      setMessage('');
    }
  }, [postIds.length]);

  if (postIds.length === 0) return null;

  const countLabel = postIds.length === 1 ? '1 episode' : `${postIds.length} episodes`;

  const formatResult = (playlistName: string, added: number, failed: number) => {
    if (failed === 0) {
      return `Added ${added} ${added === 1 ? 'episode' : 'episodes'} to "${playlistName}"`;
    }
    return `Added ${added} of ${added + failed} to "${playlistName}" (${failed} unavailable)`;
  };

  const handleAdd = async (playlistId: string, playlistName: string) => {
    setBusy(true);
    setMessage('');
    try {
      const { added, failed } = await addManyToPlaylist(playlistId, postIds);
      setMessage(formatResult(playlistName, added, failed));
      if (added > 0) {
        onComplete?.();
      }
    } catch {
      setMessage('Could not add to playlist.');
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    setMessage('');
    try {
      const playlist = await createPlaylist(name, postIds);
      if (playlist) {
        const added = playlist.item_count;
        const failed = postIds.length - added;
        setMessage(formatResult(name, added, failed));
        setNewName('');
        if (added > 0) {
          onComplete?.();
        }
      }
    } catch {
      setMessage('Could not create playlist.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={rootRef} className={`playlist-picker playlist-picker-toolbar ${className}`.trim()}>
      <button
        type="button"
        className="pod-btn pod-btn-sm pod-btn-secondary"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        Add to playlist
      </button>
      {open && (
        <div className="playlist-picker-menu" role="menu">
          <p className="playlist-picker-title">Add {countLabel} to playlist</p>
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

export default BulkPlaylistPicker;
