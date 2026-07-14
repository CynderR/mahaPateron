import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import PodcastNav from '../../components/PodcastNav';
import UserTable, { AdminDeleteMode, AdminUser } from '../../components/UserTable';
import PayingTierSelect from '../../components/admin/PayingTierSelect';
import SubscriptionToggle from '../../components/admin/SubscriptionToggle';
import PasswordInput from '../../components/PasswordInput';
import { buildRssBaseUrl } from '../../config';
import {
  fieldsFromPayingTier,
  NOT_SUBSCRIBED_PAYMENT_CATEGORY,
  PayingTier,
  PaymentCategory,
  PAYING_TIER_OPTIONS,
  SUBSCRIPTION_STATUS_OPTIONS,
  SubscriptionStatus,
  subscriptionFieldsFromStatus
} from '../../utils/paymentCategories';
import { ADMIN_ACCESS_TYPE_OPTIONS } from '../../utils/accessPermissions';

interface NewUserForm {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  whatsapp_id: string;
  signal_id: string;
  subscription_status: SubscriptionStatus;
  paying_tier: PayingTier;
  payment_category: PaymentCategory;
  access_type: string;
  download_access: boolean;
  subscription_price: string;
  is_paying: boolean;
  is_admin: boolean;
}

interface UsersResponse {
  users: AdminUser[];
  total: number;
  page: number;
  limit: number;
}

const emptyNewUser: NewUserForm = {
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  whatsapp_id: '',
  signal_id: '',
  subscription_status: 'not_subscribed' as SubscriptionStatus,
  paying_tier: 'paying_subscriber' as PayingTier,
  payment_category: NOT_SUBSCRIBED_PAYMENT_CATEGORY,
  access_type: 'streaming',
  download_access: false,
  subscription_price: '',
  is_paying: false,
  is_admin: false
};

const Users: React.FC = () => {
  const [data, setData] = useState<UsersResponse | null>(null);
  const [filters, setFilters] = useState({
    q: '',
    payment_category: '',
    subscription_status: '',
    access_type: '',
    is_admin: '',
    account_status: 'active'
  });
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newUser, setNewUser] = useState<NewUserForm>({ ...emptyNewUser });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const rssBaseUrl = buildRssBaseUrl();
  const limit = 20;

  const load = useCallback(async () => {
    setError('');
    try {
      const params: Record<string, string | number> = { page, limit };
      if (filters.q.trim()) params.q = filters.q.trim();
      if (filters.payment_category) params.payment_category = filters.payment_category;
      if (filters.subscription_status) params.subscription_status = filters.subscription_status;
      if (filters.access_type) params.access_type = filters.access_type;
      if (filters.is_admin) params.is_admin = filters.is_admin;
      if (filters.account_status) params.account_status = filters.account_status;
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

  const handlePayingTierChange = async (id: number, tier: PayingTier) => {
    setError('');
    try {
      await axios.put(`/admin/users/${id}`, fieldsFromPayingTier(tier));
      load();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Update failed.');
    }
  };

  const handleDelete = async (id: number, mode: AdminDeleteMode) => {
    const confirmation =
      mode === 'permanent'
        ? 'Permanently delete this user and all account records? This cannot be undone.'
        : 'Delete this user and clear their email address so it can be reused? Their RSS feed will be disabled.';
    if (!window.confirm(confirmation)) return;
    try {
      await axios.delete(`/admin/users/${id}`, { data: { mode } });
      load();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Delete failed.');
    }
  };

  const handleRestore = async (id: number) => {
    if (!window.confirm('Undelete this account and make it active again?')) return;
    setError('');
    setMessage('');
    try {
      await axios.post(`/admin/users/${id}/restore`);
      setMessage('User restored.');
      load();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Restore failed.');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!newUser.email.trim()) {
      setError('Email is required.');
      return;
    }
    if (!newUser.password) {
      setError('Password is required.');
      return;
    }
    if (newUser.password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (newUser.password !== newUser.confirmPassword) {
      setError('Password and confirmation do not match.');
      return;
    }
    try {
      const { subscription_status, paying_tier, confirmPassword, password, ...rest } = newUser;
      const subscriptionFields = subscriptionFieldsFromStatus(
        subscription_status,
        subscription_status === 'subscribed'
          ? fieldsFromPayingTier(paying_tier).payment_category
          : rest.payment_category
      );
      const payingFields =
        subscription_status === 'subscribed' ? fieldsFromPayingTier(paying_tier) : subscriptionFields;
      await axios.post('/admin/users', {
        ...rest,
        ...payingFields,
        password
      });
      setMessage(
        `User ${newUser.username} created. They can sign in with ${newUser.email.trim()} and the password you set.`
      );
      setNewUser({ ...emptyNewUser });
      setShowPassword(false);
      setShowConfirmPassword(false);
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
            <p style={{ marginTop: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Create a login with email and password. Share those credentials with the member so they can sign in.
            </p>
            <div className="pod-form-group">
              <label htmlFor="admin-new-username">Username</label>
              <input
                id="admin-new-username"
                className="pod-input"
                value={newUser.username}
                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                required
                autoComplete="off"
              />
            </div>
            <div className="pod-form-group">
              <label htmlFor="admin-new-email">Email</label>
              <input
                id="admin-new-email"
                className="pod-input"
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                required
                autoComplete="off"
              />
            </div>
            <div className="pod-form-group">
              <label htmlFor="admin-new-password">Password</label>
              <PasswordInput
                id="admin-new-password"
                className="pod-input"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                placeholder="At least 8 characters"
                required
                minLength={8}
                autoComplete="new-password"
                show={showPassword}
                onToggle={() => setShowPassword((v) => !v)}
              />
            </div>
            <div className="pod-form-group">
              <label htmlFor="admin-new-confirm-password">Confirm password</label>
              <PasswordInput
                id="admin-new-confirm-password"
                className="pod-input"
                value={newUser.confirmPassword}
                onChange={(e) => setNewUser({ ...newUser, confirmPassword: e.target.value })}
                placeholder="Re-enter password"
                required
                minLength={8}
                autoComplete="new-password"
                show={showConfirmPassword}
                onToggle={() => setShowConfirmPassword((v) => !v)}
              />
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
                  const subscriptionFields = subscriptionFieldsFromStatus(
                    subscription_status,
                    subscription_status === 'subscribed'
                      ? fieldsFromPayingTier(newUser.paying_tier).payment_category
                      : newUser.payment_category
                  );
                  setNewUser({
                    ...newUser,
                    subscription_status,
                    ...subscriptionFields
                  });
                }}
              />
            </div>
            {newUser.subscription_status === 'subscribed' && (
              <div className="pod-form-group">
                <label>Paying</label>
                <PayingTierSelect
                  paymentCategory={fieldsFromPayingTier(newUser.paying_tier).payment_category}
                  onChange={(paying_tier) => {
                    setNewUser({
                      ...newUser,
                      paying_tier,
                      ...fieldsFromPayingTier(paying_tier)
                    });
                  }}
                />
              </div>
            )}
            <div className="pod-form-group">
              <label>Access type</label>
              <select className="pod-select" value={newUser.access_type} onChange={(e) => setNewUser({ ...newUser, access_type: e.target.value })}>
                {ADMIN_ACCESS_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                streaming — stream talks in the web player. rss — stream talks and include a podcast RSS feed link.
              </p>
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
              <label>Subscription price (optional; for records only)</label>
              <input
                className="pod-input"
                type="number"
                step="0.01"
                min="0"
                value={newUser.subscription_price}
                onChange={(e) => setNewUser({ ...newUser, subscription_price: e.target.value })}
              />
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Stripe checkout bills every paying subscriber with the official Dashboard Price
                (<code>stripe_price_id</code> / <code>STRIPE_PRICE_ID</code>). This field does not change the charged amount.
              </p>
            </div>
            <button type="submit" className="pod-btn">
              Create user
            </button>
          </form>
        )}

        <div className="pod-card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="pod-form-group" style={{ marginBottom: 0 }}>
              <label>Search users</label>
              <input
                className="pod-input"
                type="search"
                value={filters.q}
                placeholder="Username or email"
                onChange={(e) => {
                  setPage(1);
                  setFilters({ ...filters, q: e.target.value });
                }}
              />
            </div>
            <div className="pod-form-group" style={{ marginBottom: 0 }}>
              <label>Paying</label>
              <select
                className="pod-select"
                value={filters.payment_category}
                onChange={(e) => {
                  setPage(1);
                  setFilters({ ...filters, payment_category: e.target.value });
                }}
              >
                <option value="">All</option>
                {PAYING_TIER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.payment_category}>
                    {option.label}
                  </option>
                ))}
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
                {ADMIN_ACCESS_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="pod-form-group" style={{ marginBottom: 0 }}>
              <label>Account status</label>
              <select
                className="pod-select"
                value={filters.account_status}
                onChange={(e) => {
                  setPage(1);
                  setFilters({ ...filters, account_status: e.target.value });
                }}
              >
                <option value="active">Active</option>
                <option value="deleted">Deleted</option>
                <option value="all">All</option>
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
            onPayingTierChange={handlePayingTierChange}
            onDelete={handleDelete}
            onRestore={handleRestore}
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
