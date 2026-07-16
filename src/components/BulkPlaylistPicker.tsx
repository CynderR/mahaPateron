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
  const [messageIsError, setMessageIsError] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const completeTimerRef = useRef<number | null>(null);
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
      setMessageIsError(false);
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

  useEffect(
    () => () => {
      if (completeTimerRef.current != null) {
        window.clearTimeout(completeTimerRef.current);
      }
    },
    []
  );

  if (postIds.length === 0) return null;

  const countLabel = postIds.length === 1 ? '1 episode' : `${postIds.length} episodes`;

  const formatResult = (playlistName: string, added: number, failed: number) => {
    if (failed === 0) {
      return `Added ${added} ${added === 1 ? 'episode' : 'episodes'} to "${playlistName}"`;
    }
    if (added === 0) {
      return `Could not add episodes to "${playlistName}". They may be unavailable.`;
    }
    return `Added ${added} of ${added + failed} to "${playlistName}" (${failed} unavailable)`;
  };

  const finishWithMessage = (text: string, isError: boolean, shouldComplete: boolean) => {
    setMessage(text);
    setMessageIsError(isError);
    if (!shouldComplete) return;
    if (completeTimerRef.current != null) {
      window.clearTimeout(completeTimerRef.current);
    }
    // Keep the success message visible briefly before the parent clears selection.
    completeTimerRef.current = window.setTimeout(() => {
      onComplete?.();
    }, 1200);
  };

  const handleAdd = async (playlistId: string, playlistName: string) => {
    if (busy) return;
    setBusy(true);
    setMessage('');
    setMessageIsError(false);
    try {
      const { added, failed } = await addManyToPlaylist(playlistId, postIds);
      finishWithMessage(formatResult(playlistName, added, failed), added === 0, added > 0);
    } catch {
      finishWithMessage('Could not add to playlist.', true, false);
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const name = newName.trim();
    if (!name) {
      finishWithMessage('Enter a playlist name to create one.', true, false);
      return;
    }
    if (busy) return;
    setBusy(true);
    setMessage('');
    setMessageIsError(false);
    try {
      const playlist = await createPlaylist(name, postIds);
      if (!playlist) {
        finishWithMessage('Could not create playlist.', true, false);
        return;
      }
      const added = Number(playlist.item_count) || 0;
      const failed = Math.max(0, postIds.length - added);
      setNewName('');
      finishWithMessage(formatResult(name, added, failed), added === 0, added > 0);
    } catch {
      finishWithMessage('Could not create playlist.', true, false);
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
              <button
                type="button"
                className="playlist-picker-list-btn"
                disabled={busy}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void handleAdd(pl.id, pl.name);
                }}
              >
                <span className="playlist-picker-list-btn-name">{pl.name}</span>
                <span className="playlist-picker-list-btn-count">{pl.item_count}</span>
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
          aria-label="New playlist name"
        />
        <button type="submit" className="pod-btn pod-btn-sm" disabled={busy}>
          {busy ? 'Working…' : 'Create & add'}
        </button>
      </form>
      {message && (
        <p className={`playlist-picker-msg${messageIsError ? ' playlist-picker-msg-error' : ''}`}>
          {message}
        </p>
      )}
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
