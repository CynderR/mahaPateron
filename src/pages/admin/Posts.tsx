import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import PodcastNav from '../../components/PodcastNav';
import UploadForm from '../../components/UploadForm';

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

  const deletePost = async (id: string) => {
    if (!window.confirm('Delete this episode?')) return;
    try {
      await axios.delete(`/admin/posts/${id}`);
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

        <div className="pod-table-wrap" style={{ marginTop: '1.5rem' }}>
          <table className="pod-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Duration</th>
                <th>Published</th>
                <th>Date</th>
                <th></th>
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
                      <button type="button" className="pod-btn pod-btn-secondary pod-btn-sm" onClick={() => togglePublished(post)}>
                        {post.is_published ? 'Unpublish' : 'Publish'}
                      </button>
                      <button type="button" className="pod-btn pod-btn-danger pod-btn-sm" onClick={() => deletePost(post.id)}>
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
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
};

export default Posts;
