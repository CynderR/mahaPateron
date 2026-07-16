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
import BulkDeleteEpisodes from '../components/admin/BulkDeleteEpisodes';
import AdminSelectedPostEdit from '../components/admin/AdminSelectedPostEdit';
import LibraryInfiniteFooter from '../components/LibraryInfiniteFooter';
import LibrarySearchResultsDialog from '../components/LibrarySearchResultsDialog';
import SubscribeAccessBanner from '../components/SubscribeAccessBanner';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { useMemberAccess } from '../hooks/useMemberAccess';
import {
  AdminSortDir,
  AdminSortField,
  nextSortState
} from '../utils/adminTableHelpers';
import { useEpisodeSelection, EPISODE_PAGE_MAX, fetchAllEpisodeIds, normalizePostId } from '../utils/episodeListHelpers';

interface LibraryEntry extends FeedPost {
  accessible: boolean;
}

interface LibraryResponse {
  is_paying: boolean;
  back_catalog_access: boolean;
  canStream: boolean;
  canDownload: boolean;
  streamPreviewSeconds?: number | null;
  total: number;
  catalogTotal: number;
  accessible: number;
  page: number;
  limit: number;
  entries: LibraryEntry[];
}

const Library: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [meta, setMeta] = useState<Omit<LibraryResponse, 'entries' | 'page' | 'limit'> | null>(null);
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<AdminSortField>('date');
  const [sortDir, setSortDir] = useState<AdminSortDir>('desc');
  const [page, setPage] = useState(1);
  const [listEpoch, setListEpoch] = useState(0);
  const [selectingAll, setSelectingAll] = useState(false);
  const { selectedIds, toggleSelect, selectAll, clearSelection } = useEpisodeSelection();
  const pageLimit = searchQuery ? EPISODE_PAGE_MAX : 20;
  const selectedPostIds = useMemo(() => Array.from(selectedIds), [selectedIds]);
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
        const params: Record<string, string | number> = { page, limit: pageLimit };
        if (searchQuery) params.q = searchQuery;
        params.sort = sortField;
        params.dir = sortDir;

        const res = await axios.get<LibraryResponse>('/account/library', { params });
        if (cancelled) return;

        const { entries: pageEntries, page: responsePage, ...responseMeta } = res.data;
        setTotal(res.data.total);
        setMeta(responseMeta);
        setEntries((prev) => (page === 1 ? pageEntries : [...prev, ...pageEntries]));

        if (pageEntries.length === 0 && responsePage > 1 && res.data.total > 0) {
          setPage(responsePage - 1);
        }
      } catch (e) {
        if (!cancelled) setError('Could not load the episode library.');
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
  }, [page, searchQuery, sortField, sortDir, pageLimit, listEpoch]);

  const listParams = useMemo(() => {
    const params: Record<string, string | number> = { sort: sortField, dir: sortDir };
    if (searchQuery) params.q = searchQuery;
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
        const allIds = await fetchAllEpisodeIds('/account/library', listParams, total);
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

  const lockedCount = meta ? meta.catalogTotal - meta.accessible : 0;
  const { isPayingMember, isNotSubscribed, isInactive, canStream, canDownload } = useMemberAccess(meta);

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

  const selectionProps = {
    selectedIds,
    onSelectChange: toggleSelect
  };

  const handleEpisodesDeleted = useCallback(() => {
    clearSelection();
    setPage(1);
    setEntries([]);
    setListEpoch((epoch) => epoch + 1);
  }, [clearSelection]);

  const handleEpisodeEdited = useCallback(() => {
    setPage(1);
    setEntries([]);
    setListEpoch((epoch) => epoch + 1);
  }, []);

  const titlesById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const entry of entries) {
      map[normalizePostId(entry.id)] = entry.title;
    }
    return map;
  }, [entries]);

  const selectionActions = (
    <div className="member-episode-selection-actions">
      <BulkPlaylistPicker postIds={selectedPostIds} onComplete={clearSelection} variant="popup" />
      {isAdmin && (
        <BulkDeleteEpisodes postIds={selectedPostIds} onComplete={handleEpisodesDeleted} />
      )}
    </div>
  );

  const mainBarActions = isAdmin ? (
    <AdminSelectedPostEdit
      postIds={selectedPostIds}
      titlesById={titlesById}
      onSaved={handleEpisodeEdited}
    />
  ) : null;

  const renderToolbar = (showMobileSelectionBar = false) =>
    !loading &&
    (meta?.catalogTotal ?? 0) > 0 && (
      <MemberEpisodeToolbar
        onSearch={handleSearch}
        searchQuery={searchQuery}
        placeholder="Search by title, description, artist, album, year, or genre…"
        resultCount={total}
        totalCount={meta?.catalogTotal ?? 0}
        showSort
        sortField={sortField}
        sortDir={sortDir}
        onSort={handleSort}
        selectedCount={selectedIds.size}
        selectableCount={total}
        selectAllBusy={selectingAll}
        onSelectAll={handleSelectAll}
        mainBarActions={mainBarActions}
        selectionActions={selectionActions}
        showMobileSelectionBar={showMobileSelectionBar}
      />
    );

  const emptyMessage =
    (meta?.catalogTotal ?? 0) > 0 && entries.length === 0 && !loading
      ? 'No episodes match your search.'
      : 'No episodes in the library yet.';

  const infiniteFooter = (
    <LibraryInfiniteFooter
      sentinelRef={sentinelRef}
      loadingMore={loadingMore}
      hasMore={hasMore}
    />
  );

  const searchResultsDialog = (
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
      showAdminEdit={isAdmin}
      onEpisodeEdited={handleEpisodeEdited}
    />
  );

  return (
    <div className="podcast-page library-page">
      {searchResultsDialog}

      <div className="library-sticky-stack feed-ht-desktop-only">
        <PodcastNav />
        <div className="library-sticky-head-inner">
          <h2 className="podcast-section-title library-sticky-title">Episode Library</h2>
        </div>
      </div>

      <div className="pod-feed-mobile-only">
        <div className="library-sticky-head">
          <PodcastMobileHeader
            title="Library"
            subtitle={meta ? `${meta.accessible} of ${meta.catalogTotal} episodes available` : undefined}
          />
        </div>

        {error && <div className="pod-banner pod-banner-error">{error}</div>}

        {!loading && isNotSubscribed && <SubscribeAccessBanner />}

        {!loading && isInactive && (
          <div className="pod-banner pod-banner-info">
            Your subscription is inactive. <Link to="/account/billing">Reactivate it</Link> to listen to episodes.
          </div>
        )}

        {!loading && isPayingMember && lockedCount > 0 && !meta?.back_catalog_access && (
          <div className="pod-banner pod-banner-info">
            {lockedCount} older {lockedCount === 1 ? 'episode is' : 'episodes are'} not included in your plan.
          </div>
        )}

        {loading ? (
          <div className="pod-empty">Loading library…</div>
        ) : entries.length > 0 ? (
          <>
            {renderToolbar(true)}
            <div className="pod-feed-list">
              {entries.map((entry) => (
                <PodcastEpisodeCard
                  key={entry.id}
                  post={entry}
                  canStream={canStream && (entry.accessible || isNotSubscribed)}
                  canDownload={canDownload && entry.accessible}
                  selected={selectedIds.has(normalizePostId(entry.id))}
                  onSelectChange={selectionProps.onSelectChange}
                />
              ))}
            </div>
            {infiniteFooter}
          </>
        ) : (
          <>
            {renderToolbar(true)}
            <div className="pod-empty">{emptyMessage}</div>
          </>
        )}

        <PodcastMobileNav />
      </div>

      <main className="podcast-main feed-ht-desktop-only library-main">
        {error && <div className="pod-banner pod-banner-error">{error}</div>}

        {!loading && isNotSubscribed && <SubscribeAccessBanner />}

        {!loading && isInactive && (
          <div className="pod-banner pod-banner-info">
            Your subscription is inactive. <Link to="/account/billing">Reactivate it</Link> to listen to episodes.
          </div>
        )}

        {!loading && isPayingMember && lockedCount > 0 && !meta?.back_catalog_access && (
          <div className="pod-banner pod-banner-info">
            {lockedCount} older {lockedCount === 1 ? 'episode is' : 'episodes are'} not included in your plan.
            Contact the administrator for full archive access.
          </div>
        )}

        {loading ? (
          <div className="pod-empty">Loading library…</div>
        ) : entries.length > 0 ? (
          <>
            {renderToolbar()}
            <div className="pod-feed-grid">
              {entries.map((entry) => (
                <PostCard
                  key={entry.id}
                  post={entry}
                  rssToken={user?.rss_token}
                  canStream={canStream && (entry.accessible || isNotSubscribed)}
                  canDownload={canDownload && entry.accessible}
                  locked={!entry.accessible && !isNotSubscribed}
                  selected={selectedIds.has(normalizePostId(entry.id))}
                  onSelectChange={selectionProps.onSelectChange}
                />
              ))}
            </div>
            {infiniteFooter}
          </>
        ) : (
          <>
            {renderToolbar()}
            <div className="pod-empty">{emptyMessage}</div>
          </>
        )}
      </main>
    </div>
  );
};

export default Library;
