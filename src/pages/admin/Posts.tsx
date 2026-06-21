import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import PodcastNav from '../../components/PodcastNav';
import UploadForm from '../../components/UploadForm';
import AdminTableToolbar from '../../components/AdminTableToolbar';
import SortableTableHeader from '../../components/SortableTableHeader';
import {
  AdminSortDir,
  AdminSortField,
  filterAdminItems,
  nextSortState,
  sortAdminItems
} from '../../utils/adminTableHelpers';

interface AdminPost {
  id: string;
  title: string;
  description?: string;
  duration_secs?: number;
  is_published: boolean | number;
  published_at?: string;
}

const formatDuration = (secs?: number): string => {
  if (!secs && secs !== 0) return '—';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

const Posts: React.FC = () => {
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<AdminSortField | null>('date');
  const [sortDir, setSortDir] = useState<AdminSortDir>('desc');

  const load = async () => {
    setError('');
    try {
      const res = await axios.get<{ posts: AdminPost[] }>('/admin/posts');
      setPosts(res.data.posts);
    } catch (e) {
      setError('Could not load posts.');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const visiblePosts = useMemo(
    () => sortAdminItems(filterAdminItems(posts, searchQuery), sortField, sortDir),
    [posts, searchQuery, sortField, sortDir]
  );

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
      load();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Update failed.');
    }
  };

  const deletePost = async (post: AdminPost) => {
    if (!window.confirm(`Delete "${post.title}"? This cannot be undone.`)) return;
    try {
      await axios.delete(`/admin/posts/${post.id}`);
      load();
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

        <UploadForm onUploaded={load} />

        <AdminTableToolbar
          onSearch={setSearchQuery}
          totalCount={posts.length}
          resultCount={visiblePosts.length}
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
              {visiblePosts.map((post) => (
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
              {posts.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>
                    No episodes yet.
                  </td>
                </tr>
              )}
              {posts.length > 0 && visiblePosts.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>
                    No posts match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
};

export default Posts;
