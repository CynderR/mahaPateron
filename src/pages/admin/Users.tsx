import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import PodcastNav from '../../components/PodcastNav';
import UserTable, { AdminUser } from '../../components/UserTable';
import SubscriptionToggle from '../../components/admin/SubscriptionToggle';
import { ROUTER_BASENAME } from '../../config';
import {
  NOT_SUBSCRIBED_PAYMENT_CATEGORY,
  SUBSCRIPTION_STATUS_OPTIONS,
  SubscriptionStatus,
  subscriptionFieldsFromStatus
} from '../../utils/paymentCategories';

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
  subscription_status: 'not_subscribed' as SubscriptionStatus,
  payment_category: NOT_SUBSCRIBED_PAYMENT_CATEGORY,
  access_type: 'streaming',
  download_access: false,
  subscription_price: '',
  is_paying: false,
  is_admin: false,
  back_catalog_access: false,
  monthly_payments: true
};

const Users: React.FC = () => {
  const [data, setData] = useState<UsersResponse | null>(null);
  const [filters, setFilters] = useState({
    is_paying: '',
    subscription_status: '',
    access_type: '',
    is_admin: ''
  });
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
      if (filters.subscription_status) params.subscription_status = filters.subscription_status;
      if (filters.access_type) params.access_type = filters.access_type;
      if (filters.is_admin) params.is_admin = filters.is_admin;
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

  const handleSubscriptionChange = async (
    id: number,
    status: SubscriptionStatus,
    currentCategory: string
  ) => {
    setError('');
    try {
      await axios.put(`/admin/users/${id}`, subscriptionFieldsFromStatus(status, currentCategory));
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
      const { subscription_status, ...rest } = newUser;
      const subscriptionFields = subscriptionFieldsFromStatus(subscription_status, rest.payment_category);
      await axios.post('/admin/users', { ...rest, ...subscriptionFields });
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
      <main className="podcast-main podcast-main-wide">
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
              <label>Role</label>
              <select className="pod-select" value={newUser.is_admin ? 'admin' : 'user'} onChange={(e) => setNewUser({ ...newUser, is_admin: e.target.value === 'admin' })}>
                <option value="user">user</option>
                <option value="admin">admin</option>
              </select>
            </div>
            <div className="pod-form-group">
              <label>Payment</label>
              <SubscriptionToggle
                value={newUser.subscription_status}
                onChange={(subscription_status) => {
                  setNewUser({
                    ...newUser,
                    subscription_status,
                    ...subscriptionFieldsFromStatus(subscription_status, newUser.payment_category)
                  });
                }}
              />
            </div>
            <div className="pod-form-group">
              <label>Access type</label>
              <select className="pod-select" value={newUser.access_type} onChange={(e) => setNewUser({ ...newUser, access_type: e.target.value })}>
                <option value="streaming">streaming</option>
                <option value="rss">rss</option>
                <option value="both">both</option>
              </select>
            </div>
            <div className="pod-form-group">
              <label>
                <input
                  type="checkbox"
                  checked={newUser.download_access}
                  onChange={(e) => setNewUser({ ...newUser, download_access: e.target.checked })}
                />{' '}
                Download access
              </label>
            </div>
            <div className="pod-form-group">
              <label>Subscription price (leave blank for platform default)</label>
              <input className="pod-input" type="number" step="0.01" min="0" value={newUser.subscription_price} onChange={(e) => setNewUser({ ...newUser, subscription_price: e.target.value })} />
            </div>
            <div className="pod-form-group">
              <label>
                <input type="checkbox" checked={newUser.back_catalog_access} onChange={(e) => setNewUser({ ...newUser, back_catalog_access: e.target.checked })} /> Archive access
              </label>
            </div>
            <div className="pod-form-group">
              <label>
                <input type="checkbox" checked={newUser.monthly_payments} onChange={(e) => setNewUser({ ...newUser, monthly_payments: e.target.checked })} /> Require monthly Stripe payments
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
              <label>Role</label>
              <select className="pod-select" value={filters.is_admin} onChange={(e) => { setPage(1); setFilters({ ...filters, is_admin: e.target.value }); }}>
                <option value="">All</option>
                <option value="true">admin</option>
                <option value="false">user</option>
              </select>
            </div>
            <div className="pod-form-group" style={{ marginBottom: 0 }}>
              <label>Payment</label>
              <select
                className="pod-select"
                value={filters.subscription_status}
                onChange={(e) => {
                  setPage(1);
                  setFilters({ ...filters, subscription_status: e.target.value });
                }}
              >
                <option value="">All</option>
                {SUBSCRIPTION_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
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
          <UserTable
            users={data.users}
            rssBaseUrl={rssBaseUrl}
            onUpdate={handleUpdate}
            onSubscriptionChange={handleSubscriptionChange}
            onDelete={handleDelete}
          />
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
