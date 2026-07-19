import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import PodcastNav from '../../components/PodcastNav';
import UserTable, { AdminDeleteMode, AdminUser } from '../../components/UserTable';
import LibraryInfiniteFooter from '../../components/LibraryInfiniteFooter';
import PayingTierSelect from '../../components/admin/PayingTierSelect';
import SubscriptionToggle from '../../components/admin/SubscriptionToggle';
import PasswordInput from '../../components/PasswordInput';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
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
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({
    q: '',
    payment_category: '',
    subscription_status: '',
    access_type: '',
    is_admin: '',
    account_status: 'active'
  });
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [listEpoch, setListEpoch] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newUser, setNewUser] = useState<NewUserForm>({ ...emptyNewUser });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const limit = 20;
  const hasMore = users.length < total;

  // Debounce search so typing does not reset/jitter the list on every keypress.
  useEffect(() => {
    const handle = window.setTimeout(() => {
      setFilters((prev) => (prev.q === searchInput ? prev : { ...prev, q: searchInput }));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  // Reset pagination when filters change without blanking the current list mid-scroll.
  useEffect(() => {
    setPage(1);
  }, [filters]);

  useEffect(() => {
    let cancelled = false;
    const requestedPage = page;

    const load = async () => {
      setError('');
      if (requestedPage === 1) setLoading(true);
      else setLoadingMore(true);

      try {
        const params: Record<string, string | number> = { page: requestedPage, limit };
        if (filters.q.trim()) params.q = filters.q.trim();
        if (filters.payment_category) params.payment_category = filters.payment_category;
        if (filters.subscription_status) params.subscription_status = filters.subscription_status;
        if (filters.access_type) params.access_type = filters.access_type;
        if (filters.is_admin) params.is_admin = filters.is_admin;
        if (filters.account_status) params.account_status = filters.account_status;

        const res = await axios.get<UsersResponse>('/admin/users', { params });
        if (cancelled) return;

        const { users: pageUsers, total: responseTotal } = res.data;
        setTotal(responseTotal);
        setUsers((prev) => {
          if (requestedPage === 1) return pageUsers;
          const seen = new Set(prev.map((user) => user.id));
          const appended = pageUsers.filter((user) => !seen.has(user.id));
          return appended.length === 0 ? prev : [...prev, ...appended];
        });
      } catch (e) {
        if (!cancelled) setError('Could not load users.');
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
  }, [page, filters, listEpoch]);

  const reload = useCallback(() => {
    setPage(1);
    setListEpoch((epoch) => epoch + 1);
  }, []);

  const patchUser = useCallback((id: number, patch: Partial<AdminUser>) => {
    setUsers((prev) => prev.map((user) => (user.id === id ? { ...user, ...patch } : user)));
  }, []);

  const removeUser = useCallback((id: number) => {
    setUsers((prev) => prev.filter((user) => user.id !== id));
    setTotal((prev) => Math.max(0, prev - 1));
  }, []);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) return;
    setLoadingMore(true);
    setPage((current) => current + 1);
  }, [loading, loadingMore, hasMore]);

  const sentinelRef = useInfiniteScroll(loadMore, hasMore && !loading && !loadingMore);

  const handleUpdate = async (id: number, field: string, value: unknown) => {
    setError('');
    const previous = users.find((user) => user.id === id);
    patchUser(id, { [field]: value } as Partial<AdminUser>);
    try {
      await axios.put(`/admin/users/${id}`, { [field]: value });
    } catch (e: any) {
      if (previous) patchUser(id, previous);
      setError(e.response?.data?.error || 'Update failed.');
    }
  };

  const handleSubscriptionChange = async (
    id: number,
    status: SubscriptionStatus,
    currentCategory: string
  ) => {
    setError('');
    const previous = users.find((user) => user.id === id);
    const fields = subscriptionFieldsFromStatus(status, currentCategory);
    patchUser(id, fields as Partial<AdminUser>);
    try {
      await axios.put(`/admin/users/${id}`, fields);
    } catch (e: any) {
      if (previous) patchUser(id, previous);
      setError(e.response?.data?.error || 'Update failed.');
    }
  };

  const handlePayingTierChange = async (id: number, tier: PayingTier) => {
    setError('');
    const previous = users.find((user) => user.id === id);
    const fields = fieldsFromPayingTier(tier);
    patchUser(id, fields as Partial<AdminUser>);
    try {
      await axios.put(`/admin/users/${id}`, fields);
    } catch (e: any) {
      if (previous) patchUser(id, previous);
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
      removeUser(id);
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
      removeUser(id);
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
      reload();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Could not create user.');
    }
  };

  const updateFilter = (patch: Partial<typeof filters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  };

  return (
    <div className="podcast-page">
      <PodcastNav />
      <main className="podcast-main podcast-main-wide">
        <h2 className="podcast-section-title">Users {total ? `(${total})` : ''}</h2>

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
              <label>Role</label>
              <select
                className="pod-select"
                value={newUser.is_admin ? 'admin' : 'user'}
                onChange={(e) => setNewUser({ ...newUser, is_admin: e.target.value === 'admin' })}
              >
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
              <select
                className="pod-select"
                value={newUser.access_type}
                onChange={(e) => setNewUser({ ...newUser, access_type: e.target.value })}
              >
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
                (<code>stripe_price_id</code> / <code>STRIPE_PRICE_ID</code>). This field does not change the charged
                amount.
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
                value={searchInput}
                placeholder="Username or email"
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <div className="pod-form-group" style={{ marginBottom: 0 }}>
              <label>Paying</label>
              <select
                className="pod-select"
                value={filters.payment_category}
                onChange={(e) => updateFilter({ payment_category: e.target.value })}
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
              <select
                className="pod-select"
                value={filters.is_admin}
                onChange={(e) => updateFilter({ is_admin: e.target.value })}
              >
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
                onChange={(e) => updateFilter({ subscription_status: e.target.value })}
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
              <select
                className="pod-select"
                value={filters.access_type}
                onChange={(e) => updateFilter({ access_type: e.target.value })}
              >
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
                onChange={(e) => updateFilter({ account_status: e.target.value })}
              >
                <option value="active">Active</option>
                <option value="deleted">Deleted</option>
                <option value="all">All</option>
              </select>
            </div>
            <div className="pod-form-group" style={{ marginBottom: 0 }}>
              <label>&nbsp;</label>
              <button type="button" className="pod-btn" onClick={() => setShowAdd((s) => !s)}>
                {showAdd ? 'Close' : 'Add User'}
              </button>
            </div>
          </div>
        </div>

        {loading && users.length === 0 ? (
          <div className="pod-empty">Loading users…</div>
        ) : (
          <>
            <UserTable
              users={users}
              onUpdate={handleUpdate}
              onSubscriptionChange={handleSubscriptionChange}
              onPayingTierChange={handlePayingTierChange}
              onDelete={handleDelete}
              onRestore={handleRestore}
            />
            <LibraryInfiniteFooter
              sentinelRef={sentinelRef}
              loadingMore={loadingMore}
              hasMore={hasMore}
            />
          </>
        )}
      </main>
    </div>
  );
};

export default Users;
