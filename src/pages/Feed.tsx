import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import HearThisNav from '../components/HearThisNav';
import ProfileFeaturedTrack from '../components/ProfileFeaturedTrack';
import ProfileTrackRow from '../components/ProfileTrackRow';
import PodcastMobileNav, { PodcastMobileHeader } from '../components/mobile/PodcastMobileNav';
import PodcastFeaturedEpisode from '../components/mobile/PodcastFeaturedEpisode';
import PodcastEpisodeCard from '../components/mobile/PodcastEpisodeCard';
import MemberEpisodeToolbar from '../components/MemberEpisodeToolbar';
import BulkPlaylistPicker from '../components/BulkPlaylistPicker';
import { FeedPost } from '../components/PostCard';
import { buildImageUrl } from '../config';
import { PODCAST_AUTHOR, PODCAST_BANNER_URL, PODCAST_PROFILE_BIO } from '../podcastMeta';
import { filterAdminItems } from '../utils/adminTableHelpers';
import { useEpisodeSelection } from '../utils/episodeListHelpers';
import { buildStreamState, currentPathWithSearch } from '../utils/streamNavigation';

interface FeedResponse {
  is_paying: boolean;
  canStream: boolean;
  canRss: boolean;
  posts: FeedPost[];
}

const Feed: React.FC = () => {
  const location = useLocation();
  const streamReturnFrom = currentPathWithSearch(location.pathname, location.search);
  const { user } = useAuth();
  const [data, setData] = useState<FeedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const { selectedIds, toggleSelect, selectAll } = useEpisodeSelection();
  const selectedPostIds = useMemo(() => Array.from(selectedIds), [selectedIds]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get<FeedResponse>('/account/feed');
        setData(res.data);
      } catch (e) {
        setError('Could not load the feed.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const posts = data?.posts ?? [];
  const canStream = !!data?.is_paying && !!data?.canStream;

  const visiblePosts = useMemo(() => filterAdminItems(posts, searchQuery), [posts, searchQuery]);
  const featured = visiblePosts[0] ?? null;
  const listPosts = visiblePosts.slice(1);

  const soundCount = posts.length;

  const selectionProps = {
    onSelectChange: toggleSelect
  };

  const toolbar = !loading && posts.length > 0 && (
    <MemberEpisodeToolbar
      onSearch={setSearchQuery}
      resultCount={visiblePosts.length}
      totalCount={posts.length}
      selectedCount={selectedIds.size}
      selectableCount={visiblePosts.length}
      onSelectAll={(checked) => selectAll(visiblePosts.map((p) => p.id), checked)}
      selectionActions={<BulkPlaylistPicker postIds={selectedPostIds} />}
    />
  );

  const emptyMessage =
    posts.length > 0 && visiblePosts.length === 0
      ? 'No episodes match your search.'
      : 'No episodes have been published yet.';

  return (
    <div className="ht-page">
      <HearThisNav />

      <div className="pod-feed-mobile-only">
        <PodcastMobileHeader
          title={PODCAST_AUTHOR}
          subtitle={`${soundCount} ${soundCount === 1 ? 'episode' : 'episodes'}`}
        />

        {error && <div className="pod-banner pod-banner-error">{error}</div>}

        {!loading && data && !data.is_paying && (
          <div className="pod-banner pod-banner-info">
            Your subscription is inactive. <Link to="/account/billing">Reactivate it</Link> to listen to
            episodes.
          </div>
        )}

        {toolbar}

        {loading ? (
          <div className="pod-empty">Loading episodes…</div>
        ) : visiblePosts.length > 0 ? (
          <>
            {featured && (
              <PodcastFeaturedEpisode
                post={featured}
                canStream={canStream}
                selected={selectedIds.has(featured.id)}
                onSelectChange={selectionProps.onSelectChange}
              />
            )}
            {listPosts.length > 0 && (
              <>
                <p className="pod-feed-section-label">All episodes</p>
                <div className="pod-feed-list">
                  {listPosts.map((post) => (
                    <PodcastEpisodeCard
                      key={post.id}
                      post={post}
                      canStream={canStream}
                      selected={selectedIds.has(post.id)}
                      onSelectChange={selectionProps.onSelectChange}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="pod-empty">{emptyMessage}</div>
        )}

        <PodcastMobileNav />
      </div>

      <section
        className="ht-profile-banner feed-ht-desktop-only"
        style={{ backgroundImage: `url("${PODCAST_BANNER_URL}")` }}
      >
        <div className="ht-profile-banner-overlay" />
        <div className="ht-profile-banner-inner">
          <img className="ht-profile-avatar" src={PODCAST_BANNER_URL} alt="" />
          <div className="ht-profile-copy">
            <h1 className="ht-profile-heading">{PODCAST_AUTHOR}</h1>
            <p className="ht-profile-bio">{PODCAST_PROFILE_BIO}</p>
          </div>
        </div>
      </section>

      <div className="ht-layout feed-ht-desktop-only">
        <main className="ht-main">
          <div className="ht-tabs-bar">
            <div className="ht-tabs">
              <span className="ht-tab ht-tab-active">
                {soundCount} {soundCount === 1 ? 'Recent upload' : 'Recent uploads'}
              </span>
              <Link to="/library" className="ht-tab">
                Library
              </Link>
              <Link to="/account/rss" className="ht-tab">
                RSS
              </Link>
            </div>
          </div>

          {error && <div className="ht-banner ht-banner-error">{error}</div>}

          {!loading && data && !data.is_paying && (
            <div className="ht-banner ht-banner-info">
              Your subscription is inactive. <Link to="/account/billing">Reactivate it</Link> to listen to
              episodes.
            </div>
          )}

          {toolbar}

          {loading ? (
            <div className="ht-empty">Loading sounds…</div>
          ) : visiblePosts.length > 0 ? (
            <>
              {featured && (
                <ProfileFeaturedTrack
                  post={featured}
                  canStream={canStream}
                  selected={selectedIds.has(featured.id)}
                  onSelectChange={selectionProps.onSelectChange}
                />
              )}
              <div className="ht-track-list">
                {listPosts.map((post, index) => (
                  <ProfileTrackRow
                    key={post.id}
                    post={post}
                    rank={index + 2}
                    canStream={canStream}
                    selected={selectedIds.has(post.id)}
                    onSelectChange={selectionProps.onSelectChange}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="ht-empty">{emptyMessage}</div>
          )}
        </main>

        <aside className="ht-sidebar">
          <h4 className="ht-sidebar-title">
            {soundCount} {soundCount === 1 ? 'Sound' : 'Sounds'}
          </h4>
          {posts.length > 0 && (
            <div className="ht-sidebar-covers">
              {posts.slice(0, 8).map((post) => {
                const coverUrl = post.image_filename ? buildImageUrl(post.image_filename) : null;
                const thumb = coverUrl ? (
                  <img src={coverUrl} alt="" />
                ) : (
                  <span aria-hidden>♪</span>
                );
                return canStream ? (
                  <Link key={post.id} to={`/stream/${post.id}`} state={buildStreamState(streamReturnFrom, post)} className="ht-sidebar-thumb">
                    {thumb}
                  </Link>
                ) : (
                  <span key={post.id} className="ht-sidebar-thumb">
                    {thumb}
                  </span>
                );
              })}
            </div>
          )}
          {user && (
            <p className="ht-sidebar-note">
              Signed in as <strong>{user.username}</strong>
            </p>
          )}
        </aside>
      </div>
    </div>
  );
};

export default Feed;
