import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import PodcastNav from '../../components/PodcastNav';
import LibraryAddForm from '../../components/LibraryAddForm';
import AdminFeedPostShareButton from '../../components/admin/AdminFeedPostShareButton';
import AdminTableToolbar from '../../components/AdminTableToolbar';
import LibraryMetadataFilters, {
  emptyLibraryMetadataFilters,
  LibraryMetadataFiltersState
} from '../../components/LibraryMetadataFilters';
import SortableTableHeader from '../../components/SortableTableHeader';
import { buildImageUrl } from '../../config';
import { stripFeedMetadataFromDescription } from '../../utils/feedDescriptionHelpers';
import {
  AdminSortDir,
  AdminSortField,
  nextSortState
} from '../../utils/adminTableHelpers';

interface LibraryEntry {
  id: string;
  title: string;
  description?: string;
  duration_secs?: number;
  is_published: boolean;
  published_at?: string;
  image_filename?: string | null;
  artist?: string | null;
  album?: string | null;
  year?: string | null;
  genre?: string | null;
  share_token?: string | null;
}

interface LibraryResponse {
  total: number;
  catalogTotal: number;
  published: number;
  page: number;
  limit: number;
  entries: LibraryEntry[];
}

const formatDuration = (secs?: number): string => {
  if (!secs && secs !== 0) return '—';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

const AdminLibrary: React.FC = () => {
  const [data, setData] = useState<LibraryResponse | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<AdminSortField | null>('date');
  const [sortDir, setSortDir] = useState<AdminSortDir>('desc');
  const [page, setPage] = useState(1);
  const [metadataFilters, setMetadataFilters] = useState<LibraryMetadataFiltersState>(
    emptyLibraryMetadataFilters
  );
  const limit = 20;

  const load = useCallback(async () => {
    setError('');
    try {
      const params: Record<string, string | number> = { page, limit };
      if (searchQuery) params.q = searchQuery;
      if (metadataFilters.artist) params.artist = metadataFilters.artist;
      if (metadataFilters.album) params.album = metadataFilters.album;
      if (metadataFilters.year) params.year = metadataFilters.year;
      if (metadataFilters.genre) params.genre = metadataFilters.genre;
      if (sortField) params.sort = sortField;
      params.dir = sortDir;
      const res = await axios.get<LibraryResponse>('/admin/library', { params });
      if (res.data.entries.length === 0 && res.data.page > 1 && res.data.total > 0) {
        setPage(res.data.page - 1);
        return;
      }
      setData(res.data);
    } catch (e) {
      setError('Could not load the library.');
    }
  }, [page, searchQuery, sortField, sortDir, metadataFilters]);

  useEffect(() => {
    load();
  }, [load]);

  const entries = data?.entries ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / limit));

  const handleSearch = (query: string) => {
    setPage(1);
    setSearchQuery(query);
  };

  const handleSort = (field: AdminSortField) => {
    const next = nextSortState(field, sortField, sortDir);
    setPage(1);
    setSortField(next.field);
    setSortDir(next.dir);
  };

  const handleMetadataFilter = (field: keyof LibraryMetadataFiltersState, value: string) => {
    setPage(1);
    setMetadataFilters((prev) => ({ ...prev, [field]: value }));
  };

  const clearMetadataFilters = () => {
    setPage(1);
    setMetadataFilters(emptyLibraryMetadataFilters());
  };

  const togglePublished = async (entry: LibraryEntry) => {
    try {
      const form = new FormData();
      form.append('is_published', String(!entry.is_published));
      await axios.put(`/admin/library/${entry.id}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      load();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Update failed.');
    }
  };

  const deleteEntry = async (entry: LibraryEntry) => {
    if (!window.confirm(`Delete "${entry.title}"? This cannot be undone.`)) return;
    try {
      await axios.delete(`/admin/library/${entry.id}`);
      setMessage('Library entry removed.');
      load();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Delete failed.');
    }
  };

  return (
    <div className="podcast-page">
      <PodcastNav />
      <main className="podcast-main">
        <h2 className="podcast-section-title">
          Library {data ? `(${data.catalogTotal})` : ''}
        </h2>

        {error && <div className="pod-banner pod-banner-error">{error}</div>}
        {message && <div className="pod-banner pod-banner-success">{message}</div>}

        <LibraryAddForm
          onAdded={() => {
            setMessage('Episode added to the library.');
            setPage(1);
            load();
          }}
        />

        <AdminTableToolbar
          onSearch={handleSearch}
          totalCount={data?.catalogTotal ?? 0}
          resultCount={data?.total ?? 0}
        />

        <LibraryMetadataFilters
          filtersUrl="/admin/library/filters"
          values={metadataFilters}
          onChange={handleMetadataFilter}
          onClear={clearMetadataFilters}
          refreshKey={data?.catalogTotal ?? 0}
        />

        <div className="pod-table-wrap" style={{ marginTop: '0.75rem' }}>
          <table className="pod-table">
            <thead>
              <tr>
                <th>Title</th>
                <SortableTableHeader
                  label="Duration"
                  field="duration"
                  activeField={sortField}
                  activeDir={sortDir}
                  onSort={handleSort}
                />
                <th>Published</th>
                <SortableTableHeader
                  label="Date"
                  field="date"
                  activeField={sortField}
                  activeDir={sortDir}
                  onSort={handleSort}
                />
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const displayDescription = stripFeedMetadataFromDescription(entry.description);
                const coverUrl = entry.image_filename ? buildImageUrl(entry.image_filename) : null;
                return (
                <tr key={entry.id}>
                  <td>
                    <div className="pod-library-entry-title">
                      {coverUrl ? (
                        <img className="pod-library-cover" src={coverUrl} alt="" />
                      ) : (
                        <div className="pod-library-cover pod-library-cover-placeholder" aria-hidden>
                          ♪
                        </div>
                      )}
                      <div className="pod-library-entry-copy">
                        <div style={{ fontWeight: 600 }}>{entry.title}</div>
                        {displayDescription && (
                          <div style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem' }}>
                            {displayDescription}
                          </div>
                        )}
                        {(entry.artist || entry.genre) && (
                          <div style={{ color: 'var(--text-tertiary)', fontSize: '0.72rem', marginTop: '0.15rem' }}>
                            {[entry.artist, entry.genre].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>{formatDuration(entry.duration_secs)}</td>
                  <td>
                    <span className={`pod-badge ${entry.is_published ? 'pod-badge-on' : 'pod-badge-off'}`}>
                      {entry.is_published ? 'Published' : 'Hidden'}
                    </span>
                  </td>
                  <td>{entry.published_at ? new Date(entry.published_at).toLocaleDateString() : ''}</td>
                  <td>
                    <div className="pod-inline-actions">
                      <AdminFeedPostShareButton
                        postId={entry.id}
                        postTitle={entry.title}
                        shareToken={entry.share_token}
                        isPublished={entry.is_published}
                      />
                      <button
                        type="button"
                        className="pod-btn pod-btn-secondary pod-btn-sm"
                        onClick={() => togglePublished(entry)}
                      >
                        {entry.is_published ? 'Unpublish' : 'Publish'}
                      </button>
                      <button
                        type="button"
                        className="pod-btn pod-btn-danger pod-btn-sm"
                        onClick={() => deleteEntry(entry)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
              {data && data.catalogTotal === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>
                    No library entries yet.
                  </td>
                </tr>
              )}
              {data && data.catalogTotal > 0 && entries.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>
                    No library entries match your search or filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {data && data.total > 0 && (
          <div className="pod-inline-actions" style={{ marginTop: '1.5rem', justifyContent: 'center' }}>
            <button
              type="button"
              className="pod-btn pod-btn-secondary pod-btn-sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </button>
            <span style={{ alignSelf: 'center', color: 'var(--text-secondary)' }}>
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              className="pod-btn pod-btn-secondary pod-btn-sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminLibrary;
