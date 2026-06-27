import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import PodcastNav from '../../components/PodcastNav';
import UploadForm from '../../components/UploadForm';
import AdminFeedPostShareButton from '../../components/admin/AdminFeedPostShareButton';
import AdminPostEditButton from '../../components/admin/AdminPostEditButton';
import AdminTableToolbar from '../../components/AdminTableToolbar';
import LibraryInfiniteFooter from '../../components/LibraryInfiniteFooter';
import SortableTableHeader from '../../components/SortableTableHeader';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import {
  AdminSortDir,
  AdminSortField,
  nextSortState
} from '../../utils/adminTableHelpers';

interface AdminPost {
  id: string;
  title: string;
  description?: string;
  duration_secs?: number;
  is_published: boolean | number;
  published_at?: string;
  share_token?: string | null;
}

interface AdminPostsResponse {
  total: number;
  page: number;
  limit: number;
  posts: AdminPost[];
}

const formatDuration = (secs?: number): string => {
  if (!secs && secs !== 0) return '—';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

const Posts: React.FC = () => {
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [total, setTotal] = useState(0);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<AdminSortField | null>('date');
  const [sortDir, setSortDir] = useState<AdminSortDir>('desc');
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const limit = 20;
  const hasMore = posts.length < total;

  useEffect(() => {
    setPage(1);
    setPosts([]);
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
        if (sortField) params.sort = sortField;
        params.dir = sortDir;

        const res = await axios.get<AdminPostsResponse>('/admin/posts', { params });
        if (cancelled) return;

        const { posts: pagePosts, page: responsePage, total: responseTotal } = res.data;
        setTotal(responseTotal);
        if (page === 1 && !searchQuery) {
          setCatalogTotal(responseTotal);
        }
        setPosts((prev) => (page === 1 ? pagePosts : [...prev, ...pagePosts]));

        if (pagePosts.length === 0 && responsePage > 1 && responseTotal > 0) {
          setPage(responsePage - 1);
        }
      } catch (e) {
        if (!cancelled) setError('Could not load posts.');
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
    setPosts([]);
    setPage(1);
    setRefreshKey((key) => key + 1);
  };

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) return;
    setPage((current) => current + 1);
  }, [loading, loadingMore, hasMore]);

  const sentinelRef = useInfiniteScroll(loadMore, hasMore && !loading && !loadingMore);

  const handleSort = (field: AdminSortField) => {
    const next = nextSortState(field, sortField, sortDir);
    setSortField(next.field);
    setSortDir(next.dir);
  };

  const togglePublished = async (post: AdminPost) => {
    try {
      const form = new FormData();
      form.append('is_published', String(!post.is_published));
      await axios.put(`/admin/posts/${post.id}`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      reload();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Update failed.');
    }
  };

  const deletePost = async (post: AdminPost) => {
    if (!window.confirm(`Delete "${post.title}"? This cannot be undone.`)) return;
    try {
      await axios.delete(`/admin/posts/${post.id}`);
      reload();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Delete failed.');
    }
  };

  return (
    <div className="podcast-page">
      <PodcastNav />
      <main className="podcast-main">
        <div className="podcast-section-title-row">
          <h2 className="podcast-section-title">Posts</h2>
          <Link to="/admin/bulk-upload" className="pod-btn pod-btn-secondary">
            Bulk upload
          </Link>
        </div>
        {error && <div className="pod-banner pod-banner-error">{error}</div>}

        <UploadForm onUploaded={reload} />

        <AdminTableToolbar
          onSearch={setSearchQuery}
          totalCount={catalogTotal || total}
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
              {posts.map((post) => (
                <tr key={post.id}>
                  <td>{post.title}</td>
                  <td>{formatDuration(post.duration_secs)}</td>
                  <td>
                    <span className={`pod-badge ${post.is_published ? 'pod-badge-on' : 'pod-badge-off'}`}>
                      {post.is_published ? 'Published' : 'Hidden'}
                    </span>
                  </td>
                  <td>{post.published_at ? new Date(post.published_at).toLocaleDateString() : ''}</td>
                  <td>
                    <div className="pod-inline-actions">
                      <AdminPostEditButton postId={post.id} postTitle={post.title} onSaved={reload} />
                      <AdminFeedPostShareButton
                        postId={post.id}
                        postTitle={post.title}
                        shareToken={post.share_token}
                        isPublished={!!post.is_published}
                      />
                      <button type="button" className="pod-btn pod-btn-secondary pod-btn-sm" onClick={() => togglePublished(post)}>
                        {post.is_published ? 'Unpublish' : 'Publish'}
                      </button>
                      <button type="button" className="pod-btn pod-btn-danger pod-btn-sm" onClick={() => deletePost(post)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {loading && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>
                    Loading posts…
                  </td>
                </tr>
              )}
              {!loading && catalogTotal === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>
                    No episodes yet.
                  </td>
                </tr>
              )}
              {!loading && catalogTotal > 0 && posts.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>
                    No posts match your search.
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

export default Posts;
