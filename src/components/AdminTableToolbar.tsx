import React, { useEffect, useState } from 'react';

interface AdminTableToolbarProps {
  onSearch: (query: string) => void;
  /** Applied search query from parent — keeps the input in sync when search is cleared elsewhere */
  searchQuery?: string;
  placeholder?: string;
  resultCount?: number;
  totalCount?: number;
}

const AdminTableToolbar: React.FC<AdminTableToolbarProps> = ({
  onSearch,
  searchQuery,
  placeholder = 'Search by title or description…',
  resultCount,
  totalCount
}) => {
  const [query, setQuery] = useState(searchQuery ?? '');

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

  return (
    <form className="pod-admin-toolbar" onSubmit={submit}>
      <input
        type="search"
        className="pod-input pod-admin-search-input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        aria-label="Search"
      />
      <button type="submit" className="pod-btn pod-btn-sm">
        Search
      </button>
      {query && (
        <button type="button" className="pod-btn pod-btn-secondary pod-btn-sm" onClick={clear}>
          Clear
        </button>
      )}
      {totalCount != null && resultCount != null && (
        <span className="pod-admin-toolbar-count">
          {resultCount === totalCount ? `${totalCount} episodes` : `${resultCount} of ${totalCount} episodes`}
        </span>
      )}
    </form>
  );
};

export default AdminTableToolbar;
