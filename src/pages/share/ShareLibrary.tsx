import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import ShareNav from '../../components/ShareNav';
import PostCard, { FeedPost } from '../../components/PostCard';
import ShareMobileNav, { ShareMobileHeader } from '../../components/mobile/ShareMobileNav';
import PodcastEpisodeCard from '../../components/mobile/PodcastEpisodeCard';
import MemberEpisodeToolbar from '../../components/MemberEpisodeToolbar';
import ShareAccessNotice from '../../components/share/ShareAccessNotice';
import LibraryInfiniteFooter from '../../components/LibraryInfiniteFooter';
import { useShare } from '../../contexts/ShareContext';
import { useAuth } from '../../contexts/AuthContext';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import {
  AdminSortDir,
  AdminSortField,
  nextSortState
} from '../../utils/adminTableHelpers';

interface LibraryEntry extends FeedPost {
  accessible: boolean;
}

interface ShareLibraryResponse {
  canStream: boolean;
  total: number;
  catalogTotal: number;
  accessible: number;
  page: number;
  limit: number;
  entries: LibraryEntry[];
}

const ShareLibrary: React.FC = () => {
  const { shareToken, basePath, memberAccess } = useShare();
  const { user } = useAuth();
  const [meta, setMeta] = useState<Omit<ShareLibraryResponse, 'entries' | 'page' | 'limit'> | null>(null);
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<AdminSortField>('date');
  const [sortDir, setSortDir] = useState<AdminSortDir>('desc');
  const [page, setPage] = useState(1);
  const limit = 20;
  const hasMore = entries.length < total;

  useEffect(() => {
    setPage(1);
    setEntries([]);
    setLoading(true);
  }, [searchQuery, sortField, sortDir]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setError('');
      if (page === 1) setLoading(true);
      else setLoadingMore(true);

      try {
        const params: Record<string, string | number> = { page, limit };
        if (searchQuery) params.q = searchQuery;
        params.sort = sortField;
        params.dir = sortDir;

        const res = await axios.get<ShareLibraryResponse>(
          `/share/${encodeURIComponent(shareToken)}/library`,
          { params }
        );
        if (cancelled) return;

        const { entries: pageEntries, page: responsePage, ...responseMeta } = res.data;
        setTotal(res.data.total);
        setMeta(responseMeta);
        setEntries((prev) => (page === 1 ? pageEntries : [...prev, ...pageEntries]));

        if (pageEntries.length === 0 && responsePage > 1 && res.data.total > 0) {
          setPage(responsePage - 1);
        }
      } catch {
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
  }, [page, searchQuery, sortField, sortDir, shareToken, memberAccess, user?.id]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) return;
    setPage((current) => current + 1);
  }, [loading, loadingMore, hasMore]);

  const sentinelRef = useInfiniteScroll(loadMore, hasMore && !loading && !loadingMore);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleSort = (field: AdminSortField) => {
    const next = nextSortState(field, sortField, sortDir);
    setSortField(next.field);
    setSortDir(next.dir);
  };

  const toolbar = !loading && (meta?.catalogTotal ?? 0) > 0 && (
    <MemberEpisodeToolbar
      onSearch={handleSearch}
      placeholder="Search by title, description, artist, album, year, or genre…"
      resultCount={total}
      totalCount={meta?.catalogTotal ?? 0}
      showSort
      sortField={sortField}
      sortDir={sortDir}
      onSort={handleSort}
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

  const canStream = !!meta?.canStream;

  return (
    <div className="podcast-page library-page">
      <div className="library-sticky-stack feed-ht-desktop-only">
        <ShareNav />
        <div className="library-sticky-head-inner">
          <div className="ht-tabs-bar library-sticky-tabs">
            <div className="ht-tabs">
              <Link to={basePath} className="ht-tab">
                Recent uploads
              </Link>
              <span className="ht-tab ht-tab-active">Library</span>
            </div>
          </div>
          <h2 className="podcast-section-title library-sticky-title">Episode Library</h2>
        </div>
      </div>

      <div className="pod-feed-mobile-only">
        <div className="library-sticky-head">
          <ShareMobileHeader
            title="Library"
            subtitle={meta ? `${meta.accessible} of ${meta.catalogTotal} episodes available` : undefined}
          />
        </div>

        {error && <div className="pod-banner pod-banner-error">{error}</div>}

        <ShareAccessNotice
          memberAccess={memberAccess}
          memberMessage="Signed in with member access — your full library is available."
          style={{ margin: '0.75rem 1rem 0' }}
        />

        {loading ? (
          <div className="pod-empty">Loading library…</div>
        ) : entries.length > 0 ? (
          <>
            {toolbar}
            <div className="pod-feed-list">
              {entries.map((entry) => (
                <PodcastEpisodeCard key={entry.id} post={entry} canStream={canStream && entry.accessible} />
              ))}
            </div>
            {infiniteFooter}
          </>
        ) : (
          <>
            {toolbar}
            <div className="pod-empty">{emptyMessage}</div>
          </>
        )}

        <ShareMobileNav />
      </div>

      <main className="podcast-main feed-ht-desktop-only library-main">
        {error && <div className="pod-banner pod-banner-error">{error}</div>}

        <ShareAccessNotice
          memberAccess={memberAccess}
          memberMessage="Signed in with member access — your full library is available."
        />

        {loading ? (
          <div className="pod-empty">Loading library…</div>
        ) : entries.length > 0 ? (
          <>
            {toolbar}
            <div className="pod-feed-grid">
              {entries.map((entry) => (
                <PostCard
                  key={entry.id}
                  post={entry}
                  canStream={canStream && entry.accessible}
                  locked={!entry.accessible}
                />
              ))}
            </div>
            {infiniteFooter}
          </>
        ) : (
          <>
            {toolbar}
            <div className="pod-empty">{emptyMessage}</div>
          </>
        )}
      </main>
    </div>
  );
};

export default ShareLibrary;
