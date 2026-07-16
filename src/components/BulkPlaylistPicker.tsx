import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePlayer } from '../contexts/PlayerContext';

interface BulkPlaylistPickerProps {
  postIds: string[];
  onComplete?: () => void;
  className?: string;
  /** dropdown = toolbar button + menu; panel = always-visible; popup = auto-open modal on selection */
  variant?: 'dropdown' | 'panel' | 'popup';
}

const BulkPlaylistPicker: React.FC<BulkPlaylistPickerProps> = ({
  postIds,
  onComplete,
  className = '',
  variant = 'dropdown'
}) => {
  const { playlists, createPlaylist, addManyToPlaylist, refreshPlaylists } = usePlayer();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const isPanel = variant === 'panel';
  const isPopup = variant === 'popup';
  const showMenu = isPanel || open;

  useEffect(() => {
    if (postIds.length > 0 && (isPopup || variant === 'dropdown')) {
      setOpen(true);
    }
  }, [postIds.length, isPopup, variant]);

  useEffect(() => {
    if (!showMenu) return;
    refreshPlaylists().catch(() => {});
  }, [showMenu, refreshPlaylists]);

  useEffect(() => {
    if (!open || isPanel || isPopup) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, isPanel, isPopup]);

  useEffect(() => {
    if (postIds.length === 0) {
      setOpen(false);
      setMessage('');
      setNewName('');
    }
  }, [postIds.length]);

  useEffect(() => {
    if (!isPopup || !open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [isPopup, open]);

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

  const menuBody = (
    <>
      <p className="playlist-picker-title">Add {countLabel} to playlist</p>
      {playlists.length > 0 ? (
        <ul className="playlist-picker-list">
          {playlists.map((pl) => (
            <li key={pl.id}>
              <button type="button" disabled={busy} onClick={() => handleAdd(pl.id, pl.name)}>
                {pl.name} ({pl.item_count})
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="playlist-picker-empty">No playlists yet — create one below.</p>
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
    </>
  );

  if (isPopup) {
    return (
      <>
        <div className={`playlist-picker playlist-picker-toolbar ${className}`.trim()}>
          <button
            type="button"
            className="pod-btn pod-btn-sm pod-btn-secondary"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            aria-haspopup="dialog"
          >
            Add to playlist
          </button>
        </div>
        {open &&
          createPortal(
            <div
              className="playlist-picker-overlay"
              role="presentation"
              onClick={(event) => {
                if (event.target === event.currentTarget) setOpen(false);
              }}
            >
              <div
                className="playlist-picker-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="playlist-picker-dialog-title"
              >
                <header className="playlist-picker-dialog-header">
                  <h2 id="playlist-picker-dialog-title" className="playlist-picker-dialog-title">
                    Add to playlist
                  </h2>
                  <button
                    type="button"
                    className="playlist-picker-dialog-close"
                    aria-label="Close playlist picker"
                    onClick={() => setOpen(false)}
                  >
                    ×
                  </button>
                </header>
                <div className="playlist-picker-dialog-body">{menuBody}</div>
              </div>
            </div>,
            document.body
          )}
      </>
    );
  }

  const menu = showMenu && (
    <div className={isPanel ? 'playlist-picker-panel' : 'playlist-picker-menu'} role="menu">
      {menuBody}
    </div>
  );

  return (
    <div
      ref={rootRef}
      className={`playlist-picker playlist-picker-toolbar${isPanel ? ' playlist-picker-panel-root' : ''} ${className}`.trim()}
    >
      {!isPanel && (
        <button
          type="button"
          className="pod-btn pod-btn-sm pod-btn-secondary"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="menu"
        >
          Add to playlist
        </button>
      )}
      {menu}
    </div>
  );
};

export default BulkPlaylistPicker;
