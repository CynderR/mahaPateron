import React, { useEffect, useState } from 'react';
import axios from 'axios';
import PodcastNav from '../components/PodcastNav';
import LibraryAddForm from '../components/LibraryAddForm';

interface LibraryEntry {
  id: string;
  title: string;
  description?: string;
  duration_secs?: number;
  is_published: boolean;
  published_at?: string;
}

interface LibraryResponse {
  total: number;
  published: number;
  entries: LibraryEntry[];
}

const formatDuration = (secs?: number): string => {
  if (!secs && secs !== 0) return '—';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

const AdminLibrary: React.FC = () => {
  const [data, setData] = useState<LibraryResponse | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    setError('');
    try {
      const res = await axios.get<LibraryResponse>('/admin/library');
      setData(res.data);
    } catch (e) {
      setError('Could not load the library.');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const togglePublished = async (entry: LibraryEntry) => {
    try {
      const form = new FormData();
      form.append('is_published', String(!entry.is_published));
      await axios.put(`/admin/library/${entry.id}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      load();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Update failed.');
    }
  };

  const deleteEntry = async (id: string) => {
    if (!window.confirm('Remove this episode from the library?')) return;
    try {
      await axios.delete(`/admin/library/${id}`);
      setMessage('Library entry removed.');
      load();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Delete failed.');
    }
  };

  return (
    <div className="podcast-page">
      <PodcastNav />
      <main className="podcast-main">
        <h2 className="podcast-section-title">
          Library {data ? `(${data.total})` : ''}
        </h2>

        {error && <div className="pod-banner pod-banner-error">{error}</div>}
        {message && <div className="pod-banner pod-banner-success">{message}</div>}

        <LibraryAddForm
          onAdded={() => {
            setMessage('Episode added to the library.');
            load();
          }}
        />

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
              {data?.entries.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{entry.title}</div>
                    {entry.description && (
                      <div style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem' }}>{entry.description}</div>
                    )}
                  </td>
                  <td>{formatDuration(entry.duration_secs)}</td>
                  <td>
                    <span className={`pod-badge ${entry.is_published ? 'pod-badge-on' : 'pod-badge-off'}`}>
                      {entry.is_published ? 'Published' : 'Hidden'}
                    </span>
                  </td>
                  <td>{entry.published_at ? new Date(entry.published_at).toLocaleDateString() : ''}</td>
                  <td>
                    <div className="pod-inline-actions">
                      <button
                        type="button"
                        className="pod-btn pod-btn-secondary pod-btn-sm"
                        onClick={() => togglePublished(entry)}
                      >
                        {entry.is_published ? 'Unpublish' : 'Publish'}
                      </button>
                      <button
                        type="button"
                        className="pod-btn pod-btn-danger pod-btn-sm"
                        onClick={() => deleteEntry(entry.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {data && data.entries.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>
                    No library entries yet.
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

export default AdminLibrary;
