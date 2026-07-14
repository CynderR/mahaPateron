import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AdminSortDir, AdminSortField } from '../utils/adminTableHelpers';

interface MemberEpisodeToolbarProps {
  onSearch: (query: string) => void;
  /** Applied search query from parent — keeps the input in sync when search is cleared elsewhere */
  searchQuery?: string;
  placeholder?: string;
  resultCount?: number;
  totalCount?: number;
  showSort?: boolean;
  sortField?: AdminSortField | null;
  sortDir?: AdminSortDir;
  onSort?: (field: AdminSortField) => void;
  selectedCount?: number;
  selectableCount?: number;
  selectAllBusy?: boolean;
  onSelectAll?: (selected: boolean) => void;
  selectionActions?: React.ReactNode;
  showMobileSelectionBar?: boolean;
}
const MemberEpisodeToolbar: React.FC<MemberEpisodeToolbarProps> = ({
  onSearch,
  searchQuery,
  placeholder = 'Search by title or description…',
  resultCount,
  totalCount,
  showSort = false,
  sortField = null,
  sortDir = 'desc',
  onSort,
  selectedCount = 0,
  selectableCount = 0,
  selectAllBusy = false,
  onSelectAll,
  selectionActions,
  showMobileSelectionBar = false
}) => {
  const [query, setQuery] = useState(searchQuery ?? '');
  const selectAllRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchQuery !== undefined) {
      setQuery(searchQuery);
    }
  }, [searchQuery]);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    onSearch(query.trim());
  };

  const clear = () => {
    setQuery('');
    onSearch('');
  };

  const allSelected = selectableCount > 0 && selectedCount === selectableCount;
  const someSelected = selectedCount > 0 && selectedCount < selectableCount;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected;
    }
  }, [someSelected, selectedCount, selectableCount]);

  const sortIndicator = (field: AdminSortField) =>
    sortField === field ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  useEffect(() => {
    if (!showMobileSelectionBar) return;
    document.body.classList.toggle('member-episode-selection-active', selectedCount > 0);
    return () => document.body.classList.remove('member-episode-selection-active');
  }, [selectedCount, showMobileSelectionBar]);

  const mobileSelectionBar =
    showMobileSelectionBar && selectedCount > 0 && selectionActions
      ? createPortal(
          <div className="member-episode-mobile-selection-bar" role="toolbar" aria-label="Selection actions">
            <span className="member-episode-mobile-selection-count">{selectedCount} selected</span>
            <div className="member-episode-mobile-selection-actions">{selectionActions}</div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className="member-episode-toolbar">
      <form className="member-episode-search" onSubmit={submit}>
        <input
          type="search"
          className="pod-input member-episode-search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          aria-label="Search episodes"
        />
        <button type="submit" className="pod-btn pod-btn-sm">
          Search
        </button>
        {query && (
          <button type="button" className="pod-btn pod-btn-secondary pod-btn-sm" onClick={clear}>
            Clear
          </button>
        )}
      </form>

      <div className="member-episode-toolbar-row">
        {onSelectAll && selectableCount > 0 && (
          <label className="member-select-all">
            <input
              ref={selectAllRef}
              type="checkbox"
              className="member-episode-checkbox"
              checked={allSelected}
              disabled={selectAllBusy}
              onChange={(e) => onSelectAll(e.target.checked)}
            />
            <span>{selectAllBusy ? 'Selecting all…' : 'Select all'}</span>
            {selectedCount > 0 && (
              <span className="member-selected-count">({selectedCount} selected)</span>
            )}
          </label>
        )}

        {selectedCount > 0 && selectionActions && (
          <div className="member-episode-toolbar-actions-inline feed-ht-desktop-only">{selectionActions}</div>
        )}

        {showSort && onSort && (
          <div className="member-sort-group" role="group" aria-label="Sort episodes">
            <span className="member-sort-label">Sort</span>
            <button
              type="button"
              className={`member-sort-btn${sortField === 'date' ? ' member-sort-btn-active' : ''}`}
              onClick={() => onSort('date')}
            >
              Date{sortIndicator('date')}
            </button>
            <button
              type="button"
              className={`member-sort-btn${sortField === 'duration' ? ' member-sort-btn-active' : ''}`}
              onClick={() => onSort('duration')}
            >
              Duration{sortIndicator('duration')}
            </button>
          </div>
        )}

        {totalCount != null && resultCount != null && (
          <span className="member-episode-count">
            {resultCount === totalCount ? `${totalCount} episodes` : `${resultCount} of ${totalCount} episodes`}
          </span>
        )}
      </div>

      {mobileSelectionBar}
    </div>
  );
};

export default MemberEpisodeToolbar;
