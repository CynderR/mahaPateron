import React, { useEffect, useRef, useState } from 'react';
import { AdminSortDir, AdminSortField } from '../utils/adminTableHelpers';

interface MemberEpisodeToolbarProps {
  onSearch: (query: string) => void;
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
}

const MemberEpisodeToolbar: React.FC<MemberEpisodeToolbarProps> = ({
  onSearch,
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
  selectionActions
}) => {
  const [query, setQuery] = useState('');
  const selectAllRef = useRef<HTMLInputElement>(null);

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

        {selectedCount > 0 && selectionActions}

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
    </div>
  );
};

export default MemberEpisodeToolbar;
