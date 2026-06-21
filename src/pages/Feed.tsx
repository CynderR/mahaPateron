import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import HearThisNav from '../components/HearThisNav';
import ProfileFeaturedTrack from '../components/ProfileFeaturedTrack';
import ProfileTrackRow from '../components/ProfileTrackRow';
import PodcastMobileNav, { PodcastMobileHeader } from '../components/mobile/PodcastMobileNav';
import PodcastFeaturedEpisode from '../components/mobile/PodcastFeaturedEpisode';
import PodcastEpisodeCard from '../components/mobile/PodcastEpisodeCard';
import { FeedPost } from '../components/PostCard';
import { buildImageUrl } from '../config';
import {
  formatMemberSince,
  PODCAST_AUTHOR,
  PODCAST_BANNER_URL,
  PODCAST_PROFILE_BIO
} from '../podcastMeta';

interface FeedResponse {
  is_paying: boolean;
  canStream: boolean;
  canRss: boolean;
  posts: FeedPost[];
}

const Feed: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<FeedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
  const featured = posts[0] ?? null;
  const listPosts = posts.slice(1);

  const memberSinceSource = useMemo(() => {
    if (posts.length === 0) return undefined;
    const oldest = posts.reduce((min, p) => {
      if (!p.published_at) return min;
      if (!min) return p.published_at;
      return new Date(p.published_at) < new Date(min) ? p.published_at : min;
    }, '' as string);
    return oldest || undefined;
  }, [posts]);

  const memberSince = formatMemberSince(memberSinceSource);
  const soundCount = posts.length;

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

        {loading ? (
          <div className="pod-empty">Loading episodes…</div>
        ) : posts.length > 0 ? (
          <>
            {featured && (
              <PodcastFeaturedEpisode post={featured} canStream={canStream} memberSince={memberSince} />
            )}
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
          <div className="pod-empty">No episodes have been published yet.</div>
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
            <p className="ht-profile-since">
              Member since:{memberSince ? ` ${memberSince}` : ''}
            </p>
          </div>
        </div>
      </section>

      <div className="ht-layout feed-ht-desktop-only">
        <main className="ht-main">
          <div className="ht-tabs-bar">
            <div className="ht-tabs">
              <span className="ht-tab ht-tab-active">
                {soundCount} {soundCount === 1 ? 'Sound' : 'Sounds'}
              </span>
              <Link to="/library" className="ht-tab">
                Library
              </Link>
              <Link to="/account/rss" className="ht-tab">
                RSS
              </Link>
            </div>
            {memberSince && <span className="ht-tabs-since">Member since: {memberSince}</span>}
          </div>

          {error && <div className="ht-banner ht-banner-error">{error}</div>}

          {!loading && data && !data.is_paying && (
            <div className="ht-banner ht-banner-info">
              Your subscription is inactive. <Link to="/account/billing">Reactivate it</Link> to listen to
              episodes.
            </div>
          )}

          {loading ? (
            <div className="ht-empty">Loading sounds…</div>
          ) : posts.length > 0 ? (
            <>
              {featured && <ProfileFeaturedTrack post={featured} canStream={canStream} />}
              <div className="ht-track-list">
                {listPosts.map((post, index) => (
                  <ProfileTrackRow key={post.id} post={post} rank={index + 2} canStream={canStream} />
                ))}
              </div>
            </>
          ) : (
            <div className="ht-empty">No episodes have been published yet.</div>
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
                  <Link key={post.id} to={`/stream/${post.id}`} className="ht-sidebar-thumb">
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
