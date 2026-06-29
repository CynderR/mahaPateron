import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Link, useLocation } from 'react-router-dom';

import axios from 'axios';

import { useAuth } from '../contexts/AuthContext';

import PodcastNav from '../components/PodcastNav';

import ProfileFeaturedTrack from '../components/ProfileFeaturedTrack';

import ProfileTrackRow from '../components/ProfileTrackRow';

import PodcastMobileNav, { PodcastMobileHeader } from '../components/mobile/PodcastMobileNav';

import PodcastFeaturedEpisode from '../components/mobile/PodcastFeaturedEpisode';

import PodcastEpisodeCard from '../components/mobile/PodcastEpisodeCard';

import MemberEpisodeToolbar from '../components/MemberEpisodeToolbar';

import BulkPlaylistPicker from '../components/BulkPlaylistPicker';

import LibraryInfiniteFooter from '../components/LibraryInfiniteFooter';

import { FeedPost } from '../components/PostCard';

import { buildImageUrl } from '../config';

import { PODCAST_AUTHOR, PODCAST_BANNER_URL, PODCAST_PROFILE_BIO } from '../podcastMeta';

import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { useMemberAccess } from '../hooks/useMemberAccess';
import { useEpisodeSelection } from '../utils/episodeListHelpers';
import { buildStreamState, currentPathWithSearch } from '../utils/streamNavigation';



interface FeedAccessMeta {

  is_paying: boolean;

  canStream: boolean;

  canDownload: boolean;

  canRss: boolean;

  streamPreviewSeconds?: number | null;

}



interface FeedResponse extends FeedAccessMeta {

  total: number;

  page: number;

  limit: number;

  posts: FeedPost[];

}



const Feed: React.FC = () => {

  const location = useLocation();

  const streamReturnFrom = currentPathWithSearch(location.pathname, location.search);

  const { user } = useAuth();

  const [meta, setMeta] = useState<FeedAccessMeta | null>(null);

  const [posts, setPosts] = useState<FeedPost[]>([]);

  const [total, setTotal] = useState(0);
  const [catalogTotal, setCatalogTotal] = useState(0);

  const [loading, setLoading] = useState(true);

  const [loadingMore, setLoadingMore] = useState(false);

  const [error, setError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');

  const [page, setPage] = useState(1);

  const { selectedIds, toggleSelect, selectAll } = useEpisodeSelection();

  const selectedPostIds = useMemo(() => Array.from(selectedIds), [selectedIds]);

  const limit = 20;

  const hasMore = posts.length < total;



  useEffect(() => {

    setPage(1);

    setPosts([]);

    setLoading(true);

  }, [searchQuery]);



  useEffect(() => {

    let cancelled = false;



    const load = async () => {

      setError('');

      if (page === 1) setLoading(true);

      else setLoadingMore(true);



      try {

        const params: Record<string, string | number> = { page, limit };

        if (searchQuery) params.q = searchQuery;



        const res = await axios.get<FeedResponse>('/account/feed', { params });

        if (cancelled) return;



        const { posts: pagePosts, page: responsePage, total: responseTotal, ...responseMeta } = res.data;

        setTotal(responseTotal);

        if (page === 1 && !searchQuery) {
          setCatalogTotal(responseTotal);
        }

        setMeta(responseMeta);

        setPosts((prev) => (page === 1 ? pagePosts : [...prev, ...pagePosts]));



        if (pagePosts.length === 0 && responsePage > 1 && responseTotal > 0) {

          setPage(responsePage - 1);

        }

      } catch (e) {

        if (!cancelled) setError('Could not load the feed.');

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

  }, [page, searchQuery]);



  const loadMore = useCallback(() => {

    if (loading || loadingMore || !hasMore) return;

    setPage((current) => current + 1);

  }, [loading, loadingMore, hasMore]);



  const sentinelRef = useInfiniteScroll(loadMore, hasMore && !loading && !loadingMore);

  const { isNotSubscribed, isInactive, canStream, canDownload } = useMemberAccess(meta);

  const featured = !searchQuery && posts.length > 0 ? posts[0] : null;

  const listPosts = !searchQuery && posts.length > 0 ? posts.slice(1) : posts;



  const selectionProps = {

    onSelectChange: toggleSelect

  };



  const toolbar = !loading && (catalogTotal || total) > 0 && (

    <MemberEpisodeToolbar

      onSearch={setSearchQuery}

      resultCount={total}

      totalCount={catalogTotal || total}

      selectedCount={selectedIds.size}

      selectableCount={posts.length}

      onSelectAll={(checked) => selectAll(posts.map((p) => p.id), checked)}

      selectionActions={<BulkPlaylistPicker postIds={selectedPostIds} />}

    />

  );



  const emptyMessage =

    total > 0 && posts.length === 0 && !loading

      ? 'No episodes match your search.'

      : 'No episodes have been published yet.';



  const infiniteFooter = (

    <LibraryInfiniteFooter

      sentinelRef={sentinelRef}

      loadingMore={loadingMore}

      hasMore={hasMore}

    />

  );



  const episodeList = listPosts.length > 0 && (

    <>

      {!searchQuery && <p className="pod-feed-section-label pod-mobile-only">All episodes</p>}

      <div className="pod-feed-list pod-mobile-only">

        {listPosts.map((post) => (

          <PodcastEpisodeCard

            key={post.id}

            post={post}

            canStream={canStream}

            canDownload={canDownload}

            selected={selectedIds.has(post.id)}

            onSelectChange={selectionProps.onSelectChange}

          />

        ))}

      </div>

      <div className="ht-track-list feed-ht-desktop-only">

        {listPosts.map((post, index) => (

          <ProfileTrackRow

            key={post.id}

            post={post}

            rank={index + (featured ? 2 : 1)}

            canStream={canStream}

            canDownload={canDownload}

            selected={selectedIds.has(post.id)}

            onSelectChange={selectionProps.onSelectChange}

          />

        ))}

      </div>

      {infiniteFooter}

    </>

  );



  return (

    <div className="podcast-page feed-page">

      <div className="library-sticky-stack feed-ht-desktop-only">

        <PodcastNav />

      </div>



      <div className="pod-feed-mobile-only">

        <div className="library-sticky-head">

          <PodcastMobileHeader

            title={PODCAST_AUTHOR}

            titleTo="/feed"

            subtitle={`${catalogTotal || total} ${(catalogTotal || total) === 1 ? 'episode' : 'episodes'}`}

          />

          {toolbar}

        </div>



        {error && <div className="pod-banner pod-banner-error">{error}</div>}



        {!loading && isNotSubscribed && (

          <div className="pod-banner pod-banner-info">

            Preview: 1 minute per episode. <Link to="/account/billing">Subscribe</Link> for full access.

          </div>

        )}



        {!loading && isInactive && (

          <div className="pod-banner pod-banner-info">

            Your subscription is inactive. <Link to="/account/billing">Reactivate it</Link> to listen to

            episodes.

          </div>

        )}



        {loading ? (

          <div className="pod-empty">Loading episodes…</div>

        ) : posts.length > 0 || featured ? (

          <>

            {featured && (

              <PodcastFeaturedEpisode

                post={featured}

                canStream={canStream}

                canDownload={canDownload}

                selected={selectedIds.has(featured.id)}

                onSelectChange={selectionProps.onSelectChange}

              />

            )}

            {episodeList}

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

          <div className="feed-sticky-subhead">

            <div className="ht-tabs-bar library-sticky-tabs">

              <div className="ht-tabs">

                <span className="ht-tab ht-tab-active">

                  {catalogTotal || total} {(catalogTotal || total) === 1 ? 'Recent upload' : 'Recent uploads'}

                </span>

                <Link to="/library" className="ht-tab">

                  Library

                </Link>

                <Link to="/account/rss" className="ht-tab">

                  RSS

                </Link>

              </div>

            </div>

            {toolbar}

          </div>



          {error && <div className="ht-banner ht-banner-error">{error}</div>}



          {!loading && isNotSubscribed && (

            <div className="ht-banner ht-banner-info">

              Preview: 1 minute per episode. <Link to="/account/billing">Subscribe</Link> for full access.

            </div>

          )}



          {!loading && isInactive && (

            <div className="ht-banner ht-banner-info">

              Your subscription is inactive. <Link to="/account/billing">Reactivate it</Link> to listen to

              episodes.

            </div>

          )}



          {loading ? (

            <div className="ht-empty">Loading sounds…</div>

          ) : posts.length > 0 || featured ? (

            <>

              {featured && (

                <ProfileFeaturedTrack

                  post={featured}

                  canStream={canStream}

                  canDownload={canDownload}

                  selected={selectedIds.has(featured.id)}

                  onSelectChange={selectionProps.onSelectChange}

                />

              )}

              {episodeList}

            </>

          ) : (

            <div className="ht-empty">{emptyMessage}</div>

          )}

        </main>



        <aside className="ht-sidebar">

          <h4 className="ht-sidebar-title">

            {catalogTotal || total} {(catalogTotal || total) === 1 ? 'Sound' : 'Sounds'}

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

