import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import PodcastNav from '../../components/PodcastNav';
import LibraryAddForm from '../../components/LibraryAddForm';
import AdminTableToolbar from '../../components/AdminTableToolbar';
import SortableTableHeader from '../../components/SortableTableHeader';
import { buildImageUrl } from '../../config';
import { stripFeedMetadataFromDescription } from '../../utils/feedDescriptionHelpers';
import {
  AdminSortDir,
  AdminSortField,
  filterAdminItems,
  nextSortState,
  sortAdminItems
} from '../../utils/adminTableHelpers';

interface LibraryEntry {
  id: string;
  title: string;
  description?: string;
  duration_secs?: number;
  is_published: boolean;
  published_at?: string;
  image_filename?: string | null;
}

interface LibraryResponse {
  total: number;
  published: number;
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

  const load = async () => {
    setError('');
    try {
      const res = await axios.get<LibraryResponse>('/admin/library');
      setData(res.data);
    } catch (e) {
      setError('Could not load the library.');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const entries = data?.entries ?? [];
  const visibleEntries = useMemo(
    () => sortAdminItems(filterAdminItems(entries, searchQuery), sortField, sortDir),
    [entries, searchQuery, sortField, sortDir]
  );

  const handleSort = (field: AdminSortField) => {
    const next = nextSortState(field, sortField, sortDir);
    setSortField(next.field);
    setSortDir(next.dir);
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
          Library {data ? `(${data.total})` : ''}
        </h2>

        {error && <div className="pod-banner pod-banner-error">{error}</div>}
        {message && <div className="pod-banner pod-banner-success">{message}</div>}

        <LibraryAddForm
          onAdded={() => {
            setMessage('Episode added to the library.');
            load();
          }}
        />

        <AdminTableToolbar
          onSearch={setSearchQuery}
          totalCount={entries.length}
          resultCount={visibleEntries.length}
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
              {visibleEntries.map((entry) => {
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
              {data && entries.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>
                    No library entries yet.
                  </td>
                </tr>
              )}
              {data && entries.length > 0 && visibleEntries.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>
                    No library entries match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
};

export default AdminLibrary;
