import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import PodcastNav from '../../components/PodcastNav';
import LibraryAddForm from '../../components/LibraryAddForm';
import AdminFeedPostShareButton from '../../components/admin/AdminFeedPostShareButton';
import AdminPostEditButton from '../../components/admin/AdminPostEditButton';
import AdminTableToolbar from '../../components/AdminTableToolbar';
import LibraryInfiniteFooter from '../../components/LibraryInfiniteFooter';
import LibrarySearchResultsDialog from '../../components/LibrarySearchResultsDialog';
import SortableTableHeader from '../../components/SortableTableHeader';
import { buildImageUrl } from '../../config';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import { stripFeedMetadataFromDescription } from '../../utils/feedDescriptionHelpers';
import {
  AdminSortDir,
  AdminSortField,
  nextSortState
} from '../../utils/adminTableHelpers';
import {
  EPISODE_PAGE_MAX,
  fetchAllEpisodeIds,
  useEpisodeSelection
} from '../../utils/episodeListHelpers';

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
  const [meta, setMeta] = useState<Omit<LibraryResponse, 'entries' | 'page' | 'limit'> | null>(null);
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<AdminSortField | null>('date');
  const [sortDir, setSortDir] = useState<AdminSortDir>('desc');
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectingAll, setSelectingAll] = useState(false);
  const { selectedIds, toggleSelect, selectAll, clearSelection } = useEpisodeSelection();
  const limit = searchQuery ? EPISODE_PAGE_MAX : 20;
  const hasMore = entries.length < total;

  useEffect(() => {
    setPage(1);
    setEntries([]);
    setLoading(true);
    clearSelection();
  }, [searchQuery, sortField, sortDir, clearSelection]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setError('');
      if (page === 1) setLoading(true);
      else setLoadingMore(true);

      try {
        const params: Record<string, string | number> = { page, limit };
        if (searchQuery) params.q = searchQuery;
        if (sortField) params.sort = sortField;
        params.dir = sortDir;

        const res = await axios.get<LibraryResponse>('/admin/library', { params });
        if (cancelled) return;

        const { entries: pageEntries, page: responsePage, ...responseMeta } = res.data;
        setTotal(res.data.total);
        setMeta(responseMeta);
        setEntries((prev) => (page === 1 ? pageEntries : [...prev, ...pageEntries]));

        if (pageEntries.length === 0 && responsePage > 1 && res.data.total > 0) {
          setPage(responsePage - 1);
        }
      } catch (e) {
        if (!cancelled) setError('Could not load the library.');
      } finally {
        if (!cancelled) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [page, searchQuery, sortField, sortDir, refreshKey]);

  const reload = () => {
    setEntries([]);
    setPage(1);
    setRefreshKey((key) => key + 1);
  };

  const listParams = useMemo(() => {
    const params: Record<string, string | number> = { dir: sortDir };
    if (searchQuery) params.q = searchQuery;
    if (sortField) params.sort = sortField;
    return params;
  }, [searchQuery, sortField, sortDir]);

  const handleSelectAll = useCallback(
    async (checked: boolean) => {
      if (!checked) {
        selectAll([], false);
        return;
      }
      if (entries.length >= total) {
        selectAll(
          entries.map((e) => e.id),
          true
        );
        return;
      }
      setSelectingAll(true);
      try {
        const allIds = await fetchAllEpisodeIds('/admin/library', listParams, total);
        selectAll(allIds, true);
      } catch {
        selectAll(
          entries.map((e) => e.id),
          true
        );
      } finally {
        setSelectingAll(false);
      }
    },
    [entries, total, listParams, selectAll]
  );

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) return;
    setPage((current) => current + 1);
  }, [loading, loadingMore, hasMore]);

  const sentinelRef = useInfiniteScroll(loadMore, hasMore && !loading && !loadingMore);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const closeSearchDialog = useCallback(() => {
    setSearchQuery('');
    clearSelection();
  }, [clearSelection]);

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
      reload();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Update failed.');
    }
  };

  const deleteEntry = async (entry: LibraryEntry) => {
    if (!window.confirm(`Delete "${entry.title}"? This cannot be undone.`)) return;
    try {
      await axios.delete(`/admin/library/${entry.id}`);
      setMessage('Library entry removed.');
      reload();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Delete failed.');
    }
  };

  return (
    <div className="podcast-page">
      <LibrarySearchResultsDialog
        open={Boolean(searchQuery)}
        query={searchQuery}
        entries={entries}
        total={total}
        catalogTotal={meta?.catalogTotal ?? 0}
        loading={loading}
        loadingMore={loadingMore}
        hasMore={hasMore}
        onLoadMore={loadMore}
        onClose={closeSearchDialog}
        selectedIds={selectedIds}
        onSelectChange={toggleSelect}
        onSelectAll={handleSelectAll}
        selectAllBusy={selectingAll}
        showPlaylists
      />
      <PodcastNav />
      <main className="podcast-main">
        <h2 className="podcast-section-title">
          Library {meta ? `(${meta.catalogTotal})` : ''}
        </h2>

        {error && <div className="pod-banner pod-banner-error">{error}</div>}
        {message && <div className="pod-banner pod-banner-success">{message}</div>}

        <LibraryAddForm
          onAdded={() => {
            setMessage('Episode added to the library.');
            reload();
          }}
        />

        <AdminTableToolbar
          onSearch={handleSearch}
          searchQuery={searchQuery}
          placeholder="Search by title, description, artist, album, year, or genre…"
          totalCount={meta?.catalogTotal ?? 0}
          resultCount={total}
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
                      <AdminPostEditButton postId={entry.id} postTitle={entry.title} onSaved={reload} />
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
              {loading && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>
                    Loading library…
                  </td>
                </tr>
              )}
              {!loading && meta && meta.catalogTotal === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>
                    No library entries yet.
                  </td>
                </tr>
              )}
              {!loading && meta && meta.catalogTotal > 0 && entries.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>
                    No library entries match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {!loading && (
          <LibraryInfiniteFooter
            sentinelRef={sentinelRef}
            loadingMore={loadingMore}
            hasMore={hasMore}
          />
        )}
      </main>
    </div>
  );
};

export default AdminLibrary;
