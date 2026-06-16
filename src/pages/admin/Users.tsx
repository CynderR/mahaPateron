import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import PodcastNav from '../../components/PodcastNav';
import UserTable, { AdminUser } from '../../components/UserTable';
import { ROUTER_BASENAME } from '../../config';

interface UsersResponse {
  users: AdminUser[];
  total: number;
  page: number;
  limit: number;
}

const emptyNewUser = {
  username: '',
  email: '',
  whatsapp_id: '',
  signal_id: '',
  payment_category: 'full',
  access_type: 'both',
  subscription_price: '',
  is_paying: false,
  back_catalog_access: false
};

const Users: React.FC = () => {
  const [data, setData] = useState<UsersResponse | null>(null);
  const [filters, setFilters] = useState({ is_paying: '', payment_category: '', access_type: '' });
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newUser, setNewUser] = useState({ ...emptyNewUser });

  const rssBaseUrl = `${window.location.origin}${ROUTER_BASENAME}`;
  const limit = 20;

  const load = useCallback(async () => {
    setError('');
    try {
      const params: Record<string, string | number> = { page, limit };
      if (filters.is_paying) params.is_paying = filters.is_paying;
      if (filters.payment_category) params.payment_category = filters.payment_category;
      if (filters.access_type) params.access_type = filters.access_type;
      const res = await axios.get<UsersResponse>('/admin/users', { params });
      setData(res.data);
    } catch (e) {
      setError('Could not load users.');
    }
  }, [page, filters]);

  useEffect(() => {
    load();
  }, [load]);

  const handleUpdate = async (id: number, field: string, value: unknown) => {
    setError('');
    try {
      await axios.put(`/admin/users/${id}`, { [field]: value });
      load();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Update failed.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this user? Their RSS feed will be disabled.')) return;
    try {
      await axios.delete(`/admin/users/${id}`);
      load();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Delete failed.');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await axios.post('/admin/users', newUser);
      setMessage(`User ${newUser.username} created.`);
      setNewUser({ ...emptyNewUser });
      setShowAdd(false);
      load();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Could not create user.');
    }
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="podcast-page">
      <PodcastNav />
      <main className="podcast-main">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <h2 className="podcast-section-title" style={{ marginBottom: 0 }}>
            Users {data ? `(${data.total})` : ''}
          </h2>
          <button type="button" className="pod-btn" onClick={() => setShowAdd((s) => !s)}>
            {showAdd ? 'Close' : 'Add User'}
          </button>
        </div>

        {error && <div className="pod-banner pod-banner-error">{error}</div>}
        {message && <div className="pod-banner pod-banner-success">{message}</div>}

        {showAdd && (
          <form className="pod-card" onSubmit={handleCreate}>
            <h3 style={{ marginTop: 0 }}>Add User</h3>
            <div className="pod-form-group">
              <label>Username</label>
              <input className="pod-input" value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} required />
            </div>
            <div className="pod-form-group">
              <label>Email</label>
              <input className="pod-input" type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} required />
            </div>
            <div className="pod-form-group">
              <label>WhatsApp ID</label>
              <input className="pod-input" value={newUser.whatsapp_id} onChange={(e) => setNewUser({ ...newUser, whatsapp_id: e.target.value })} />
            </div>
            <div className="pod-form-group">
              <label>Signal ID</label>
              <input className="pod-input" value={newUser.signal_id} onChange={(e) => setNewUser({ ...newUser, signal_id: e.target.value })} />
            </div>
            <div className="pod-form-group">
              <label>Payment category</label>
              <select className="pod-select" value={newUser.payment_category} onChange={(e) => setNewUser({ ...newUser, payment_category: e.target.value })}>
                <option value="full">full</option>
                <option value="free">free</option>
                <option value="discounted">discounted</option>
                <option value="non_card">non_card</option>
              </select>
            </div>
            <div className="pod-form-group">
              <label>Access type</label>
              <select className="pod-select" value={newUser.access_type} onChange={(e) => setNewUser({ ...newUser, access_type: e.target.value })}>
                <option value="both">both</option>
                <option value="rss">rss</option>
                <option value="streaming">streaming</option>
              </select>
            </div>
            <div className="pod-form-group">
              <label>Subscription price (leave blank for platform default)</label>
              <input className="pod-input" type="number" step="0.01" min="0" value={newUser.subscription_price} onChange={(e) => setNewUser({ ...newUser, subscription_price: e.target.value })} />
            </div>
            <div className="pod-form-group">
              <label>
                <input type="checkbox" checked={newUser.is_paying} onChange={(e) => setNewUser({ ...newUser, is_paying: e.target.checked })} /> Mark as paying
              </label>
            </div>
            <div className="pod-form-group">
              <label>
                <input type="checkbox" checked={newUser.back_catalog_access} onChange={(e) => setNewUser({ ...newUser, back_catalog_access: e.target.checked })} /> Grant access to all prior episodes
              </label>
            </div>
            <button type="submit" className="pod-btn">
              Create user
            </button>
          </form>
        )}

        <div className="pod-card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="pod-form-group" style={{ marginBottom: 0 }}>
              <label>Paying</label>
              <select className="pod-select" value={filters.is_paying} onChange={(e) => { setPage(1); setFilters({ ...filters, is_paying: e.target.value }); }}>
                <option value="">All</option>
                <option value="true">Paying</option>
                <option value="false">Not paying</option>
              </select>
            </div>
            <div className="pod-form-group" style={{ marginBottom: 0 }}>
              <label>Category</label>
              <select className="pod-select" value={filters.payment_category} onChange={(e) => { setPage(1); setFilters({ ...filters, payment_category: e.target.value }); }}>
                <option value="">All</option>
                <option value="full">full</option>
                <option value="free">free</option>
                <option value="discounted">discounted</option>
                <option value="non_card">non_card</option>
              </select>
            </div>
            <div className="pod-form-group" style={{ marginBottom: 0 }}>
              <label>Access</label>
              <select className="pod-select" value={filters.access_type} onChange={(e) => { setPage(1); setFilters({ ...filters, access_type: e.target.value }); }}>
                <option value="">All</option>
                <option value="both">both</option>
                <option value="rss">rss</option>
                <option value="streaming">streaming</option>
              </select>
            </div>
          </div>
        </div>

        {data && (
          <UserTable users={data.users} rssBaseUrl={rssBaseUrl} onUpdate={handleUpdate} onDelete={handleDelete} />
        )}

        <div className="pod-inline-actions" style={{ marginTop: '1.5rem', justifyContent: 'center' }}>
          <button type="button" className="pod-btn pod-btn-secondary pod-btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span style={{ alignSelf: 'center', color: 'var(--text-secondary)' }}>
            Page {page} of {totalPages}
          </span>
          <button type="button" className="pod-btn pod-btn-secondary pod-btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      </main>
    </div>
  );
};

export default Users;
