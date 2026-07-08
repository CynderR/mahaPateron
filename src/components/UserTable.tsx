import React, { useState } from 'react';

import {
  ADMIN_ACCESS_TYPE_OPTIONS,
  adminAccessTypeValue
} from '../utils/accessPermissions';
import PayingTierSelect from './admin/PayingTierSelect';
import SubscriptionToggle from './admin/SubscriptionToggle';
import {
  PayingTier,
  SubscriptionStatus,
  subscriptionStatusFromCategory
} from '../utils/paymentCategories';

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  is_admin: boolean | number;
  is_paying: boolean | number;
  payment_category: 'full' | 'free' | 'paying_subscriber' | 'non_card';
  access_type: 'rss' | 'streaming' | 'both';
  download_access: boolean | number;
  subscription_price: number | null;
  rss_token: string;
  deleted_at?: string | null;
}

export type AdminDeleteMode = 'reuse_email' | 'permanent';

interface UserTableProps {
  users: AdminUser[];
  rssBaseUrl: string;
  onUpdate: (id: number, field: string, value: unknown) => void;
  onSubscriptionChange: (id: number, status: SubscriptionStatus, currentCategory: string) => void;
  onPayingTierChange: (id: number, tier: PayingTier) => void;
  onDelete: (id: number, mode: AdminDeleteMode) => void;
  onRestore: (id: number) => void;
}

const UserTable: React.FC<UserTableProps> = ({
  users,
  rssBaseUrl,
  onUpdate,
  onSubscriptionChange,
  onPayingTierChange,
  onDelete,
  onRestore
}) => {
  const [deleteModes, setDeleteModes] = useState<Record<number, AdminDeleteMode>>({});

  const copyRss = (token: string) => {
    navigator.clipboard.writeText(`${rssBaseUrl}/rss/${token}`).catch(() => {});
  };

  return (
    <div className="pod-table-wrap pod-table-wrap-users">
      <table className="pod-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Role</th>
            <th title="Subscribed or Not Subscribed">Payment</th>
            <th>Paying</th>
            <th title="streaming: web player only. rss: web player plus podcast RSS feed.">Access</th>
            <th title="Allow episode downloads for this user">Download</th>
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
                  value={subscriptionStatusFromCategory(u.payment_category)}
                  disabled={isDeleted}
                  onChange={(status) => onSubscriptionChange(u.id, status, u.payment_category)}
                />
              </td>
              <td>
                <PayingTierSelect
                  paymentCategory={u.payment_category}
                  disabled={isDeleted}
                  onChange={(tier) => onPayingTierChange(u.id, tier)}
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
                <button
                  type="button"
                  className="pod-btn pod-btn-secondary pod-btn-sm"
                  disabled={isDeleted}
                  onClick={() => copyRss(u.rss_token)}
                >
                  Copy URL
                </button>
              </td>
              <td>
                {isDeleted ? (
                  <>
                    <button
                      type="button"
                      className="pod-btn pod-btn-sm"
                      onClick={() => onRestore(u.id)}
                    >
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
