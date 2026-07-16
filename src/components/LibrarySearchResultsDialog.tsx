import React, { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import BulkPlaylistPicker from './BulkPlaylistPicker';
import AdminSelectedPostEdit from './admin/AdminSelectedPostEdit';
import { buildImageUrl } from '../config';
import { normalizePostId } from '../utils/episodeListHelpers';

export interface LibrarySearchResultItem {
  id: string | number;
  title: string;
  duration_secs?: number | null;
  image_filename?: string | null;
  artist?: string | null;
  album?: string | null;
}

interface LibrarySearchResultsDialogProps {
  open: boolean;
  query: string;
  entries: LibrarySearchResultItem[];
  total: number;
  catalogTotal: number;
  loading: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onClose: () => void;
  selectedIds: Set<string>;
  onSelectChange: (id: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  selectAllBusy?: boolean;
  showPlaylists?: boolean;
  showAdminEdit?: boolean;
  onEpisodeEdited?: () => void;
}

const formatDuration = (secs?: number | null): string => {
  if (secs == null || Number.isNaN(secs)) return '';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

const LibrarySearchResultsDialog: React.FC<LibrarySearchResultsDialogProps> = ({
  open,
  query,
  entries,
  total,
  catalogTotal,
  loading,
  loadingMore = false,
  hasMore = false,
  onLoadMore,
  onClose,
  selectedIds,
  onSelectChange,
  onSelectAll,
  selectAllBusy = false,
  showPlaylists = true,
  showAdminEdit = false,
  onEpisodeEdited
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const selectedPostIds = useMemo(() => Array.from(selectedIds), [selectedIds]);
  const titlesById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const entry of entries) {
      map[normalizePostId(entry.id)] = entry.title;
    }
    return map;
  }, [entries]);
  const allSelected = total > 0 && selectedIds.size === total;
  const someSelected = selectedIds.size > 0 && selectedIds.size < total;

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected;
    }
  }, [someSelected, selectedIds.size, total]);

  useEffect(() => {
    const root = listRef.current;
    if (!open || !root || !onLoadMore) return;

    const onScroll = () => {
      if (!hasMore || loading || loadingMore) return;
      const remaining = root.scrollHeight - root.scrollTop - root.clientHeight;
      if (remaining < 120) onLoadMore();
    };

    root.addEventListener('scroll', onScroll);
    return () => root.removeEventListener('scroll', onScroll);
  }, [open, hasMore, loading, loadingMore, onLoadMore]);

  if (!open) return null;

  return createPortal(
    <div
      className="library-search-overlay"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="library-search-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="library-search-dialog-title"
      >
        <header className="library-search-dialog-header">
          <div>
            <h2 id="library-search-dialog-title" className="library-search-dialog-title">
              Search results
            </h2>
            <p className="library-search-dialog-subtitle">
              {loading && entries.length === 0
                ? `Searching for “${query}”…`
                : `${total} ${total === 1 ? 'match' : 'matches'} for “${query}”${
                    catalogTotal > 0 ? ` · ${catalogTotal} in library` : ''
                  }`}
            </p>
          </div>
          <button
            type="button"
            className="library-search-dialog-close"
            aria-label="Close search results"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="library-search-dialog-toolbar">
          {total > 0 && (
            <label className="member-select-all">
              <input
                ref={selectAllRef}
                type="checkbox"
                className="member-episode-checkbox"
                checked={allSelected}
                disabled={selectAllBusy || loading}
                onChange={(e) => onSelectAll(e.target.checked)}
              />
              <span>{selectAllBusy ? 'Selecting all…' : 'Select all'}</span>
              {selectedIds.size > 0 && (
                <span className="member-selected-count">({selectedIds.size} selected)</span>
              )}
            </label>
          )}
        </div>

        <div ref={listRef} className="library-search-dialog-list">
          {loading && entries.length === 0 ? (
            <div className="pod-empty">Loading results…</div>
          ) : entries.length === 0 ? (
            <div className="pod-empty">No episodes match your search.</div>
          ) : (
            <ul className="library-search-result-list">
              {entries.map((entry) => {
                const id = normalizePostId(entry.id);
                const coverUrl = entry.image_filename ? buildImageUrl(entry.image_filename) : null;
                const metaBits = [entry.artist, entry.album, formatDuration(entry.duration_secs)].filter(
                  Boolean
                );

                return (
                  <li key={id} className="library-search-result-row">
                    <label className="library-search-result-select">
                      <input
                        type="checkbox"
                        className="member-episode-checkbox"
                        checked={selectedIds.has(id)}
                        onChange={(e) => onSelectChange(id, e.target.checked)}
                      />
                      <span className="visually-hidden">Select {entry.title}</span>
                    </label>
                    {coverUrl ? (
                      <img className="library-search-result-cover" src={coverUrl} alt="" />
                    ) : (
                      <div className="library-search-result-cover library-search-result-cover-placeholder" aria-hidden>
                        ♪
                      </div>
                    )}
                    <div className="library-search-result-copy">
                      <div className="library-search-result-title">{entry.title}</div>
                      {metaBits.length > 0 && (
                        <div className="library-search-result-meta">{metaBits.join(' · ')}</div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {loadingMore && <div className="pod-infinite-loading">Loading more…</div>}
        </div>

        {(showPlaylists || showAdminEdit) && (
          <footer className="library-search-dialog-footer">
            {selectedIds.size === 0 ? (
              <p className="library-search-dialog-hint">
                {showPlaylists
                  ? 'Select episodes above to add them to a playlist or create a new one.'
                  : 'Select an episode above to edit its metadata.'}
              </p>
            ) : (
              <div className="library-search-dialog-footer-actions">
                {showAdminEdit && (
                  <AdminSelectedPostEdit
                    postIds={selectedPostIds}
                    titlesById={titlesById}
                    onSaved={onEpisodeEdited}
                  />
                )}
                {showPlaylists && (
                  <BulkPlaylistPicker
                    postIds={selectedPostIds}
                    variant="panel"
                    onComplete={() => onSelectAll(false)}
                  />
                )}
              </div>
            )}
          </footer>
        )}
      </div>
    </div>,
    document.body
  );
};

export default LibrarySearchResultsDialog;
