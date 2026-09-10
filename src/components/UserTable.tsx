import React, { useEffect, useState } from 'react';
import axios from 'axios';

import {
  ADMIN_ACCESS_TYPE_OPTIONS,
  adminAccessTypeValue
} from '../utils/accessPermissions';
import { parseOfflineUse, serializeOfflineUse, OfflineUseMode } from '../utils/appAccess';
import PayingTierSelect from './admin/PayingTierSelect';
import SubscriptionToggle from './admin/SubscriptionToggle';
import SortableTableHeader from './SortableTableHeader';
import {
  PayingTier,
  SubscriptionStatus,
  subscriptionStatusFromUser
} from '../utils/paymentCategories';
import { AdminSortDir, AdminSortField } from '../utils/adminTableHelpers';

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  is_admin: boolean | number;
  is_paying: boolean | number;
  payment_category: 'full' | 'free' | 'paying_subscriber' | 'non_card';
  access_type: 'rss' | 'streaming' | 'both';
  download_access: boolean | number;
  app_access?: boolean | number;
  offline_use?: string | null;
  episodes_to_keep?: number | null;
  subscription_price: number | null;
  subscribed_at?: string | null;
  deleted_at?: string | null;
}

export type AdminDeleteMode = 'reuse_email' | 'permanent';

/** Format subscribed_at for admin display as yyyy-mm-dd. */
const formatSubscribedDate = (value?: string | null): string => {
  if (!value) return '';
  const day = String(value).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : '';
};

const isValidSubscribedDate = (value: string): boolean =>
  value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value);

interface UserTableProps {
  users: AdminUser[];
  onUpdate: (id: number, field: string, value: unknown) => void;
  onSubscriptionChange: (id: number, status: SubscriptionStatus, currentCategory: string) => void;
  onPayingTierChange: (id: number, tier: PayingTier) => void;
  onDelete: (id: number, mode: AdminDeleteMode) => void;
  onRestore: (id: number) => void;
  sortField?: AdminSortField | null;
  sortDir?: AdminSortDir;
  onSort?: (field: AdminSortField) => void;
}

const useIsMobileUsersLayout = (): boolean => {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 768px)').matches : false
  );

  useEffect(() => {
    const media = window.matchMedia('(max-width: 768px)');
    const onChange = () => setIsMobile(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  return isMobile;
};

const UserTable: React.FC<UserTableProps> = ({
  users,
  onUpdate,
  onSubscriptionChange,
  onPayingTierChange,
  onDelete,
  onRestore,
  sortField = null,
  sortDir = 'desc',
  onSort
}) => {
  const [deleteModes, setDeleteModes] = useState<Record<number, AdminDeleteMode>>({});
  const [rssBusyId, setRssBusyId] = useState<number | null>(null);
  const isMobile = useIsMobileUsersLayout();

  const copyRss = async (userId: number) => {
    setRssBusyId(userId);
    try {
      const res = await axios.get<{ rssUrl: string }>(`/admin/users/${userId}/rss`);
      await navigator.clipboard.writeText(res.data.rssUrl);
    } catch {
      // Clipboard / network failure — ignore for admin UX.
    } finally {
      setRssBusyId(null);
    }
  };

  const rotateRss = async (userId: number) => {
    if (!window.confirm('Rotate this member’s RSS URL? Their old podcast feed link will stop working.')) {
      return;
    }
    setRssBusyId(userId);
    try {
      const res = await axios.post<{ rssUrl: string }>(`/admin/users/${userId}/rotate-rss-token`);
      await navigator.clipboard.writeText(res.data.rssUrl);
    } catch {
      // ignore
    } finally {
      setRssBusyId(null);
    }
  };

  const renderAccessControls = (u: AdminUser, isDeleted: boolean) => (
    <>
      <label className="pod-user-field">
        <span className="pod-user-field-label">Role</span>
        <select
          className="pod-select"
          value={u.is_admin ? 'admin' : 'user'}
          disabled={isDeleted}
          onChange={(e) => onUpdate(u.id, 'is_admin', e.target.value === 'admin')}
        >
          <option value="user">user</option>
          <option value="admin">admin</option>
        </select>
      </label>

      <div className="pod-user-field">
        <span className="pod-user-field-label">Payment</span>
        <SubscriptionToggle
          value={subscriptionStatusFromUser(u.payment_category, u.is_paying)}
          disabled={isDeleted}
          onChange={(status) => onSubscriptionChange(u.id, status, u.payment_category)}
        />
      </div>

      <label className="pod-user-field">
        <span className="pod-user-field-label">Paying</span>
        <PayingTierSelect
          paymentCategory={u.payment_category}
          isPaying={u.is_paying}
          disabled={isDeleted}
          onChange={(tier) => onPayingTierChange(u.id, tier)}
        />
      </label>

      <label className="pod-user-field">
        <span className="pod-user-field-label">Date subscribed</span>
        <input
          className="pod-input pod-user-subscribed-at"
          type="text"
          inputMode="numeric"
          placeholder="yyyy-mm-dd"
          defaultValue={formatSubscribedDate(u.subscribed_at)}
          key={`${u.id}-${formatSubscribedDate(u.subscribed_at)}`}
          disabled={isDeleted}
          maxLength={10}
          pattern="\d{4}-\d{2}-\d{2}"
          title="yyyy-mm-dd"
          onBlur={(e) => {
            const next = e.target.value.trim();
            if (!isValidSubscribedDate(next)) {
              e.target.value = formatSubscribedDate(u.subscribed_at);
              return;
            }
            if (next !== formatSubscribedDate(u.subscribed_at)) {
              onUpdate(u.id, 'subscribed_at', next || null);
            }
          }}
        />
      </label>

      <label className="pod-user-field">
        <span className="pod-user-field-label" title="streaming: web player only. rss: web player plus podcast RSS feed.">
          Access
        </span>
        <select
          className="pod-select"
          value={adminAccessTypeValue(u.access_type)}
          disabled={isDeleted}
          onChange={(e) => onUpdate(u.id, 'access_type', e.target.value)}
        >
          {ADMIN_ACCESS_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="pod-user-field pod-user-field-inline">
        <input
          type="checkbox"
          checked={!!u.download_access}
          title="Episode download access"
          disabled={isDeleted}
          onChange={(e) => onUpdate(u.id, 'download_access', e.target.checked)}
        />
        <span>Download access</span>
      </label>

      <label className="pod-user-field pod-user-field-inline">
        <input
          type="checkbox"
          checked={!!u.app_access}
          title="Allow this member to use the native app"
          disabled={isDeleted}
          onChange={(e) => onUpdate(u.id, 'app_access', e.target.checked)}
        />
        <span>App access</span>
      </label>

      {(() => {
        const offline = parseOfflineUse(u.offline_use);
        return (
          <>
            <label className="pod-user-field">
              <span className="pod-user-field-label">Offline use</span>
              <select
                className="pod-select"
                value={offline.mode}
                disabled={isDeleted || !u.app_access}
                onChange={(e) => {
                  const mode = e.target.value as OfflineUseMode;
                  onUpdate(u.id, 'offline_use', serializeOfflineUse(mode, offline.days));
                }}
              >
                <option value="false">Auth required to download</option>
                <option value="true">Always offline</option>
                <option value="days">Days until re-auth</option>
              </select>
            </label>
            {offline.mode === 'days' && (
              <label className="pod-user-field">
                <span className="pod-user-field-label">Offline days</span>
                <input
                  className="pod-input"
                  type="number"
                  min={1}
                  value={offline.days}
                  disabled={isDeleted || !u.app_access}
                  onChange={(e) => {
                    const days = Math.max(1, parseInt(e.target.value, 10) || 1);
                    onUpdate(u.id, 'offline_use', serializeOfflineUse('days', days));
                  }}
                />
              </label>
            )}
          </>
        );
      })()}

      <label className="pod-user-field">
        <span className="pod-user-field-label" title="App only: how many recent episodes to show">
          Episodes to keep
        </span>
        <input
          className="pod-input"
          type="number"
          min={1}
          placeholder="All"
          value={u.episodes_to_keep != null ? u.episodes_to_keep : ''}
          disabled={isDeleted || !u.app_access}
          onChange={(e) => {
            const raw = e.target.value.trim();
            onUpdate(u.id, 'episodes_to_keep', raw === '' ? null : Math.max(1, parseInt(raw, 10) || 1));
          }}
        />
      </label>
    </>
  );

  const renderActions = (u: AdminUser, isDeleted: boolean) => (
    <div className="pod-user-actions">
      <button
        type="button"
        className="pod-btn pod-btn-secondary pod-btn-sm"
        disabled={isDeleted || rssBusyId === u.id}
        onClick={() => copyRss(u.id)}
      >
        Copy RSS URL
      </button>
      <button
        type="button"
        className="pod-btn pod-btn-secondary pod-btn-sm"
        disabled={isDeleted || rssBusyId === u.id}
        onClick={() => rotateRss(u.id)}
        title="Invalidate the old feed URL and copy the new one"
      >
        Rotate RSS
      </button>

      {isDeleted ? (
        <>
          <button type="button" className="pod-btn pod-btn-sm" onClick={() => onRestore(u.id)}>
            Undelete
          </button>
          <button
            type="button"
            className="pod-btn pod-btn-danger pod-btn-sm"
            onClick={() => onDelete(u.id, 'permanent')}
          >
            Permanently delete
          </button>
        </>
      ) : (
        <>
          <select
            className="pod-select"
            value={deleteModes[u.id] || 'reuse_email'}
            title="Choose how this account should be deleted"
            onChange={(e) =>
              setDeleteModes((current) => ({
                ...current,
                [u.id]: e.target.value as AdminDeleteMode
              }))
            }
          >
            <option value="reuse_email">Clear email + delete</option>
            <option value="permanent">Permanently delete</option>
          </select>
          <button
            type="button"
            className="pod-btn pod-btn-danger pod-btn-sm"
            onClick={() => onDelete(u.id, deleteModes[u.id] || 'reuse_email')}
          >
            Delete
          </button>
        </>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <div className="pod-users-mobile" role="list">
        {users.map((u) => {
          const isDeleted = !!u.deleted_at;

          return (
            <article
              key={u.id}
              className={`pod-user-card${isDeleted ? ' pod-user-card-muted' : ''}`}
              role="listitem"
            >
              <header className="pod-user-card-header">
                <div className="pod-user-card-name">{u.username}</div>
                <div className="pod-user-card-email">{u.email}</div>
                {isDeleted && <div className="pod-user-card-badge">Deleted</div>}
              </header>
              <div className="pod-user-card-fields">{renderAccessControls(u, isDeleted)}</div>
              {renderActions(u, isDeleted)}
            </article>
          );
        })}
      </div>
    );
  }

  return (
    <div className="pod-table-wrap pod-table-wrap-users pod-users-desktop">
      <table className="pod-table">
        <thead>
          <tr>
            {onSort ? (
              <SortableTableHeader
                label="User"
                field="username"
                activeField={sortField}
                activeDir={sortDir}
                onSort={onSort}
              />
            ) : (
              <th>User</th>
            )}
            <th>Role</th>
            <th title="Subscribed or Not Subscribed">Payment</th>
            <th>Paying</th>
            {onSort ? (
              <SortableTableHeader
                label="Date subscribed"
                field="subscribed_at"
                activeField={sortField}
                activeDir={sortDir}
                onSort={onSort}
              />
            ) : (
              <th title="Subscription start date (yyyy-mm-dd)">Date subscribed</th>
            )}
            <th title="streaming: web player only. rss: web player plus podcast RSS feed.">Access</th>
            <th title="Allow episode downloads for this user">Download</th>
            <th title="Allow native app access">App</th>
            <th title="Offline use policy for the native app">Offline</th>
            <th title="App only: max recent episodes to show">Keep</th>
            <th>RSS</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const isDeleted = !!u.deleted_at;

            return (
              <tr key={u.id} className={isDeleted ? 'pod-table-row-muted' : undefined}>
                <td>
                  <div style={{ fontWeight: 600 }}>{u.username}</div>
                  <div style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem' }}>{u.email}</div>
                  {isDeleted && (
                    <div style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem', marginTop: '0.2rem' }}>
                      Deleted
                    </div>
                  )}
                </td>
                <td>
                  <select
                    className="pod-select"
                    value={u.is_admin ? 'admin' : 'user'}
                    disabled={isDeleted}
                    onChange={(e) => onUpdate(u.id, 'is_admin', e.target.value === 'admin')}
                  >
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
                <td>
                  <SubscriptionToggle
                    value={subscriptionStatusFromUser(u.payment_category, u.is_paying)}
                    disabled={isDeleted}
                    onChange={(status) => onSubscriptionChange(u.id, status, u.payment_category)}
                  />
                </td>
                <td>
                  <PayingTierSelect
                    paymentCategory={u.payment_category}
                    isPaying={u.is_paying}
                    disabled={isDeleted}
                    onChange={(tier) => onPayingTierChange(u.id, tier)}
                  />
                </td>
                <td>
                  <input
                    className="pod-input pod-user-subscribed-at"
                    type="text"
                    inputMode="numeric"
                    placeholder="yyyy-mm-dd"
                    defaultValue={formatSubscribedDate(u.subscribed_at)}
                    key={`${u.id}-${formatSubscribedDate(u.subscribed_at)}`}
                    disabled={isDeleted}
                    maxLength={10}
                    pattern="\d{4}-\d{2}-\d{2}"
                    title="yyyy-mm-dd"
                    aria-label="Date subscribed"
                    onBlur={(e) => {
                      const next = e.target.value.trim();
                      if (!isValidSubscribedDate(next)) {
                        e.target.value = formatSubscribedDate(u.subscribed_at);
                        return;
                      }
                      if (next !== formatSubscribedDate(u.subscribed_at)) {
                        onUpdate(u.id, 'subscribed_at', next || null);
                      }
                    }}
                  />
                </td>
                <td>
                  <select
                    className="pod-select"
                    value={adminAccessTypeValue(u.access_type)}
                    disabled={isDeleted}
                    onChange={(e) => onUpdate(u.id, 'access_type', e.target.value)}
                  >
                    {ADMIN_ACCESS_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={!!u.download_access}
                    title="Episode download access"
                    disabled={isDeleted}
                    onChange={(e) => onUpdate(u.id, 'download_access', e.target.checked)}
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={!!u.app_access}
                    title="Allow native app access"
                    disabled={isDeleted}
                    onChange={(e) => onUpdate(u.id, 'app_access', e.target.checked)}
                  />
                </td>
                <td>
                  {(() => {
                    const offline = parseOfflineUse(u.offline_use);
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: '9rem' }}>
                        <select
                          className="pod-select"
                          value={offline.mode}
                          disabled={isDeleted || !u.app_access}
                          title="Offline use policy"
                          onChange={(e) => {
                            const mode = e.target.value as OfflineUseMode;
                            onUpdate(u.id, 'offline_use', serializeOfflineUse(mode, offline.days));
                          }}
                        >
                          <option value="false">Auth to download</option>
                          <option value="true">Always</option>
                          <option value="days">Days</option>
                        </select>
                        {offline.mode === 'days' && (
                          <input
                            className="pod-input"
                            type="number"
                            min={1}
                            value={offline.days}
                            disabled={isDeleted || !u.app_access}
                            title="Days until re-authentication is required"
                            onChange={(e) => {
                              const days = Math.max(1, parseInt(e.target.value, 10) || 1);
                              onUpdate(u.id, 'offline_use', serializeOfflineUse('days', days));
                            }}
                          />
                        )}
                      </div>
                    );
                  })()}
                </td>
                <td>
                  <input
                    className="pod-input"
                    type="number"
                    min={1}
                    placeholder="All"
                    style={{ width: '4.5rem' }}
                    value={u.episodes_to_keep != null ? u.episodes_to_keep : ''}
                    disabled={isDeleted || !u.app_access}
                    title="Episodes to keep in the app (empty = all)"
                    onChange={(e) => {
                      const raw = e.target.value.trim();
                      onUpdate(u.id, 'episodes_to_keep', raw === '' ? null : Math.max(1, parseInt(raw, 10) || 1));
                    }}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="pod-btn pod-btn-secondary pod-btn-sm"
                    disabled={isDeleted || rssBusyId === u.id}
                    onClick={() => copyRss(u.id)}
                  >
                    Copy URL
                  </button>
                  <button
                    type="button"
                    className="pod-btn pod-btn-secondary pod-btn-sm"
                    style={{ marginTop: '0.35rem' }}
                    disabled={isDeleted || rssBusyId === u.id}
                    onClick={() => rotateRss(u.id)}
                    title="Invalidate the old feed URL and copy the new one"
                  >
                    Rotate
                  </button>
                </td>
                <td>
                  {isDeleted ? (
                    <>
                      <button type="button" className="pod-btn pod-btn-sm" onClick={() => onRestore(u.id)}>
                        Undelete
                      </button>
                      <button
                        type="button"
                        className="pod-btn pod-btn-danger pod-btn-sm"
                        style={{ marginTop: '0.35rem' }}
                        onClick={() => onDelete(u.id, 'permanent')}
                      >
                        Permanently delete
                      </button>
                    </>
                  ) : (
                    <>
                      <select
                        className="pod-select"
                        value={deleteModes[u.id] || 'reuse_email'}
                        title="Choose how this account should be deleted"
                        onChange={(e) =>
                          setDeleteModes((current) => ({
                            ...current,
                            [u.id]: e.target.value as AdminDeleteMode
                          }))
                        }
                      >
                        <option value="reuse_email">Clear email + delete</option>
                        <option value="permanent">Permanently delete</option>
                      </select>
                      <button
                        type="button"
                        className="pod-btn pod-btn-danger pod-btn-sm"
                        style={{ marginTop: '0.35rem' }}
                        onClick={() => onDelete(u.id, deleteModes[u.id] || 'reuse_email')}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default UserTable;
