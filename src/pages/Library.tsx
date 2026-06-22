import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import PodcastNav from '../components/PodcastNav';
import PostCard, { FeedPost } from '../components/PostCard';
import PodcastMobileNav, { PodcastMobileHeader } from '../components/mobile/PodcastMobileNav';
import PodcastEpisodeCard from '../components/mobile/PodcastEpisodeCard';
import MemberEpisodeToolbar from '../components/MemberEpisodeToolbar';
import BulkPlaylistPicker from '../components/BulkPlaylistPicker';
import LibraryMetadataFilters, {
  emptyLibraryMetadataFilters,
  LibraryMetadataFiltersState
} from '../components/LibraryMetadataFilters';
import {
  AdminSortDir,
  AdminSortField,
  nextSortState
} from '../utils/adminTableHelpers';
import { useEpisodeSelection } from '../utils/episodeListHelpers';

interface LibraryEntry extends FeedPost {
  accessible: boolean;
}

interface LibraryResponse {
  is_paying: boolean;
  back_catalog_access: boolean;
  canStream: boolean;
  total: number;
  catalogTotal: number;
  accessible: number;
  page: number;
  limit: number;
  entries: LibraryEntry[];
}

const Library: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<LibraryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<AdminSortField>('date');
  const [sortDir, setSortDir] = useState<AdminSortDir>('desc');
  const [page, setPage] = useState(1);
  const [metadataFilters, setMetadataFilters] = useState<LibraryMetadataFiltersState>(
    emptyLibraryMetadataFilters
  );
  const { selectedIds, toggleSelect, selectAll } = useEpisodeSelection();
  const limit = 20;
  const selectedPostIds = useMemo(() => Array.from(selectedIds), [selectedIds]);

  const load = useCallback(async () => {
    setError('');
    try {
      const params: Record<string, string | number> = { page, limit };
      if (searchQuery) params.q = searchQuery;
      if (metadataFilters.artist) params.artist = metadataFilters.artist;
      if (metadataFilters.album) params.album = metadataFilters.album;
      if (metadataFilters.year) params.year = metadataFilters.year;
      if (metadataFilters.genre) params.genre = metadataFilters.genre;
      params.sort = sortField;
      params.dir = sortDir;
      const res = await axios.get<LibraryResponse>('/account/library', { params });
      if (res.data.entries.length === 0 && res.data.page > 1 && res.data.total > 0) {
        setPage(res.data.page - 1);
        return;
      }
      setData(res.data);
    } catch (e) {
      setError('Could not load the episode library.');
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery, sortField, sortDir, metadataFilters]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const lockedCount = data ? data.catalogTotal - data.accessible : 0;
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

  const selectionProps = {
    selectedIds,
    onSelectChange: toggleSelect
  };

  const handleMetadataFilter = (field: keyof LibraryMetadataFiltersState, value: string) => {
    setPage(1);
    setMetadataFilters((prev) => ({ ...prev, [field]: value }));
  };

  const clearMetadataFilters = () => {
    setPage(1);
    setMetadataFilters(emptyLibraryMetadataFilters());
  };

  const metadataFilterBar = !loading && (data?.catalogTotal ?? 0) > 0 && (
    <LibraryMetadataFilters
      filtersUrl="/account/library/filters"
      values={metadataFilters}
      onChange={handleMetadataFilter}
      onClear={clearMetadataFilters}
      refreshKey={data?.catalogTotal ?? 0}
    />
  );

  const toolbar = !loading && (data?.catalogTotal ?? 0) > 0 && (
    <MemberEpisodeToolbar
      onSearch={handleSearch}
      resultCount={data?.total ?? 0}
      totalCount={data?.catalogTotal ?? 0}
      showSort
      sortField={sortField}
      sortDir={sortDir}
      onSort={handleSort}
      selectedCount={selectedIds.size}
      selectableCount={entries.length}
      onSelectAll={(checked) => selectAll(entries.map((e) => e.id), checked)}
      selectionActions={<BulkPlaylistPicker postIds={selectedPostIds} />}
    />
  );

  const emptyMessage =
    (data?.catalogTotal ?? 0) > 0 && entries.length === 0 && !loading
      ? 'No episodes match your search or filters.'
      : 'No episodes in the library yet.';

  const pagination = data && data.total > 0 && (
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
  );

  return (
    <div className="podcast-page">
      <div className="feed-ht-desktop-only">
        <PodcastNav />
      </div>

      <div className="pod-feed-mobile-only">
        <PodcastMobileHeader
          title="Library"
          subtitle={data ? `${data.accessible} of ${data.catalogTotal} episodes available` : undefined}
        />

        {error && <div className="pod-banner pod-banner-error">{error}</div>}

        {!loading && data && !data.is_paying && (
          <div className="pod-banner pod-banner-info">
            Your subscription is inactive. <Link to="/account/billing">Reactivate it</Link> to listen to episodes.
          </div>
        )}

        {!loading && data && data.is_paying && lockedCount > 0 && !data.back_catalog_access && (
          <div className="pod-banner pod-banner-info">
            {lockedCount} older {lockedCount === 1 ? 'episode is' : 'episodes are'} not included in your plan.
          </div>
        )}

        {toolbar}
        {metadataFilterBar}

        {loading ? (
          <div className="pod-empty">Loading library…</div>
        ) : entries.length > 0 ? (
          <div className="pod-feed-list">
            {entries.map((entry) => (
              <PodcastEpisodeCard
                key={entry.id}
                post={entry}
                canStream={!!data?.is_paying && !!data.canStream && entry.accessible}
                selected={selectedIds.has(entry.id)}
                onSelectChange={selectionProps.onSelectChange}
              />
            ))}
          </div>
        ) : (
          <div className="pod-empty">{emptyMessage}</div>
        )}

        {pagination}

        <PodcastMobileNav />
      </div>

      <main className="podcast-main feed-ht-desktop-only">
        <h2 className="podcast-section-title">Episode Library</h2>

        {error && <div className="pod-banner pod-banner-error">{error}</div>}

        {!loading && data && !data.is_paying && (
          <div className="pod-banner pod-banner-info">
            Your subscription is inactive. <Link to="/account/billing">Reactivate it</Link> to listen to episodes.
          </div>
        )}

        {!loading && data && data.is_paying && lockedCount > 0 && !data.back_catalog_access && (
          <div className="pod-banner pod-banner-info">
            {lockedCount} older {lockedCount === 1 ? 'episode is' : 'episodes are'} not included in your plan.
            Contact the administrator for full archive access.
          </div>
        )}

        {toolbar}
        {metadataFilterBar}

        {loading ? (
          <div className="pod-empty">Loading library…</div>
        ) : entries.length > 0 ? (
          <div className="pod-feed-grid">
            {entries.map((entry) => (
              <PostCard
                key={entry.id}
                post={entry}
                rssToken={user?.rss_token}
                canStream={!!data?.is_paying && data.canStream && entry.accessible}
                locked={!entry.accessible}
                selected={selectedIds.has(entry.id)}
                onSelectChange={selectionProps.onSelectChange}
              />
            ))}
          </div>
        ) : (
          <div className="pod-empty">{emptyMessage}</div>
        )}

        {pagination}
      </main>
    </div>
  );
};

export default Library;
