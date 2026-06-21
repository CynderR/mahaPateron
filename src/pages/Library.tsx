import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import PodcastNav from '../components/PodcastNav';
import PostCard, { FeedPost } from '../components/PostCard';
import PodcastMobileNav, { PodcastMobileHeader } from '../components/mobile/PodcastMobileNav';
import PodcastEpisodeCard from '../components/mobile/PodcastEpisodeCard';
import MemberEpisodeToolbar from '../components/MemberEpisodeToolbar';
import {
  AdminSortDir,
  AdminSortField,
  filterAdminItems,
  nextSortState,
  sortAdminItems
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
  accessible: number;
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
  const { selectedIds, toggleSelect, selectAll } = useEpisodeSelection();

  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get<LibraryResponse>('/account/library');
        setData(res.data);
      } catch (e) {
        setError('Could not load the episode library.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const lockedCount = data ? data.total - data.accessible : 0;
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

  const selectionProps = {
    selectedIds,
    onSelectChange: toggleSelect
  };

  const toolbar = !loading && entries.length > 0 && (
    <MemberEpisodeToolbar
      onSearch={setSearchQuery}
      resultCount={visibleEntries.length}
      totalCount={entries.length}
      showSort
      sortField={sortField}
      sortDir={sortDir}
      onSort={handleSort}
      selectedCount={selectedIds.size}
      selectableCount={visibleEntries.length}
      onSelectAll={(checked) => selectAll(visibleEntries.map((e) => e.id), checked)}
    />
  );

  const emptyMessage =
    entries.length > 0 && visibleEntries.length === 0
      ? 'No episodes match your search.'
      : 'No episodes in the library yet.';

  return (
    <div className="podcast-page">
      <div className="feed-ht-desktop-only">
        <PodcastNav />
      </div>

      <div className="pod-feed-mobile-only">
        <PodcastMobileHeader
          title="Library"
          subtitle={data ? `${data.accessible} of ${data.total} episodes available` : undefined}
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

        {loading ? (
          <div className="pod-empty">Loading library…</div>
        ) : visibleEntries.length > 0 ? (
          <div className="pod-feed-list">
            {visibleEntries.map((entry) => (
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

        {loading ? (
          <div className="pod-empty">Loading library…</div>
        ) : visibleEntries.length > 0 ? (
          <div className="pod-feed-grid">
            {visibleEntries.map((entry) => (
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
      </main>
    </div>
  );
};

export default Library;
