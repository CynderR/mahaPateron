import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import ShareNav from '../../components/ShareNav';
import ProfileFeaturedTrack from '../../components/ProfileFeaturedTrack';
import ProfileTrackRow from '../../components/ProfileTrackRow';
import ShareMobileNav, { ShareMobileHeader } from '../../components/mobile/ShareMobileNav';
import PodcastFeaturedEpisode from '../../components/mobile/PodcastFeaturedEpisode';
import PodcastEpisodeCard from '../../components/mobile/PodcastEpisodeCard';
import MemberEpisodeToolbar from '../../components/MemberEpisodeToolbar';
import { FeedPost } from '../../components/PostCard';
import { buildImageUrl } from '../../config';
import { useShare } from '../../contexts/ShareContext';
import { PODCAST_AUTHOR, PODCAST_BANNER_URL, PODCAST_PROFILE_BIO } from '../../podcastMeta';
import { filterAdminItems } from '../../utils/adminTableHelpers';

interface ShareFeedResponse {
  canStream: boolean;
  member_access: boolean;
  post: FeedPost;
  posts: FeedPost[];
}

const ShareFeed: React.FC = () => {
  const { shareToken, basePath, streamPath, streamState, memberAccess } = useShare();
  const [data, setData] = useState<ShareFeedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get<ShareFeedResponse>(`/share/${encodeURIComponent(shareToken)}/feed`);
        setData(res.data);
      } catch {
        setError('Could not load the feed.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [shareToken]);

  const posts = data?.posts ?? [];
  const canStream = !!data?.canStream;
  const featured = data?.post ?? posts[0] ?? null;
  const visiblePosts = useMemo(() => filterAdminItems(posts, searchQuery), [posts, searchQuery]);
  const listPosts = visiblePosts.filter((post) => post.id !== featured?.id);
  const soundCount = posts.length;

  const toolbar = !loading && posts.length > 0 && (
    <MemberEpisodeToolbar
      onSearch={setSearchQuery}
      resultCount={visiblePosts.length}
      totalCount={posts.length}
    />
  );

  const emptyMessage =
    posts.length > 0 && visiblePosts.length === 0
      ? 'No episodes match your search.'
      : 'No episodes have been published yet.';

  return (
    <div className="ht-page feed-page">
      <div className="library-sticky-stack feed-ht-desktop-only">
        <ShareNav />
      </div>

      <div className="pod-feed-mobile-only">
        <div className="library-sticky-head">
          <ShareMobileHeader
            title={PODCAST_AUTHOR}
            subtitle={`${soundCount} ${soundCount === 1 ? 'episode' : 'episodes'}`}
          />
          {toolbar}
        </div>

        {error && <div className="pod-banner pod-banner-error">{error}</div>}

        <p className="pod-banner pod-banner-info" style={{ margin: '0.75rem 1rem 0' }}>
          {memberAccess
            ? 'Signed in with member access — browse and stream your full catalog.'
            : 'This link includes the shared episode only. Sign in with a subscribed, free, discounted, or non-card account for full access.'}{' '}
          {!memberAccess && <Link to="/signin">Sign in</Link>}
        </p>

        {loading ? (
          <div className="pod-empty">Loading episodes…</div>
        ) : visiblePosts.length > 0 || featured ? (
          <>
            {featured && <PodcastFeaturedEpisode post={featured} canStream={canStream} />}
            {listPosts.length > 0 && (
              <>
                <p className="pod-feed-section-label">All episodes</p>
                <div className="pod-feed-list">
                  {listPosts.map((post) => (
                    <PodcastEpisodeCard key={post.id} post={post} canStream={canStream} />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="pod-empty">{emptyMessage}</div>
        )}

        <ShareMobileNav />
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
                  {soundCount} {soundCount === 1 ? 'Recent upload' : 'Recent uploads'}
                </span>
                <Link to={`${basePath}/library`} className="ht-tab">
                  Library
                </Link>
              </div>
            </div>
            {toolbar}
          </div>

          <p className="pod-banner pod-banner-info">
            {memberAccess
              ? 'Signed in with member access — browse and stream your full catalog.'
              : 'This link includes the shared episode only. Sign in with a subscribed, free, discounted, or non-card account for full access.'}{' '}
            {!memberAccess && <Link to="/signin">Sign in</Link>}
          </p>

          {error && <div className="ht-banner ht-banner-error">{error}</div>}

          {loading ? (
            <div className="ht-empty">Loading sounds…</div>
          ) : visiblePosts.length > 0 || featured ? (
            <>
              {featured && <ProfileFeaturedTrack post={featured} canStream={canStream} />}
              <div className="ht-track-list">
                {listPosts.map((post, index) => (
                  <ProfileTrackRow
                    key={post.id}
                    post={post}
                    rank={index + (featured ? 2 : 1)}
                    canStream={canStream}
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
                  <Link key={post.id} to={streamPath(post.id)} state={streamState(post)} className="ht-sidebar-thumb">
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
          <p className="ht-sidebar-note">
            <Link to="/signin">Sign in</Link> for RSS feeds and downloads.
          </p>
        </aside>
      </div>
    </div>
  );
};

export default ShareFeed;
