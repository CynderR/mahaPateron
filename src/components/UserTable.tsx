import React from 'react';

import { ACCESS_TYPE_OPTIONS } from '../utils/accessPermissions';
import SubscriptionToggle from './admin/SubscriptionToggle';
import {
  SubscriptionStatus,
  subscriptionStatusFromCategory
} from '../utils/paymentCategories';

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  is_admin: boolean | number;
  is_paying: boolean | number;
  back_catalog_access: boolean | number;
  monthly_payments: boolean | number;
  payment_category: 'full' | 'free' | 'discounted' | 'non_card';
  access_type: 'rss' | 'streaming' | 'both';
  download_access: boolean | number;
  subscription_price: number | null;
  rss_token: string;
}

interface UserTableProps {
  users: AdminUser[];
  rssBaseUrl: string;
  onUpdate: (id: number, field: string, value: unknown) => void;
  onSubscriptionChange: (id: number, status: SubscriptionStatus, currentCategory: string) => void;
  onDelete: (id: number) => void;
}

const UserTable: React.FC<UserTableProps> = ({
  users,
  rssBaseUrl,
  onUpdate,
  onSubscriptionChange,
  onDelete
}) => {
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
            <th title="Grants access to all episodes published before the user subscribed">Archive access</th>
            <th title="User is billed monthly via Stripe">Monthly</th>
            <th>Access</th>
            <th title="Allow episode downloads for this user">Download</th>
            <th>Price</th>
            <th>RSS</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>
                <div style={{ fontWeight: 600 }}>{u.username}</div>
                <div style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem' }}>{u.email}</div>
              </td>
              <td>
                <select
                  className="pod-select"
                  value={u.is_admin ? 'admin' : 'user'}
                  onChange={(e) => onUpdate(u.id, 'is_admin', e.target.value === 'admin')}
                >
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
              </td>
              <td>
                <SubscriptionToggle
                  value={subscriptionStatusFromCategory(u.payment_category)}
                  onChange={(status) => onSubscriptionChange(u.id, status, u.payment_category)}
                />
              </td>
              <td>
                <input
                  type="checkbox"
                  checked={!!u.is_paying}
                  onChange={(e) => onUpdate(u.id, 'is_paying', e.target.checked)}
                />
              </td>
              <td>
                <input
                  type="checkbox"
                  checked={!!u.back_catalog_access}
                  title="Archive access — all prior episodes"
                  onChange={(e) => onUpdate(u.id, 'back_catalog_access', e.target.checked)}
                />
              </td>
              <td>
                <input
                  type="checkbox"
                  checked={u.monthly_payments !== false && u.monthly_payments !== 0}
                  title="Bill via Stripe monthly"
                  onChange={(e) => onUpdate(u.id, 'monthly_payments', e.target.checked)}
                />
              </td>
              <td>
                <select
                  className="pod-select"
                  value={u.access_type === 'download' ? 'streaming' : u.access_type}
                  onChange={(e) => onUpdate(u.id, 'access_type', e.target.value)}
                >
                  {ACCESS_TYPE_OPTIONS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <input
                  type="checkbox"
                  checked={!!u.download_access}
                  title="Episode download access"
                  onChange={(e) => onUpdate(u.id, 'download_access', e.target.checked)}
                />
              </td>
              <td>
                <input
                  className="pod-input"
                  type="number"
                  step="0.01"
                  min="0"
                  style={{ width: '90px' }}
                  placeholder="default"
                  defaultValue={u.subscription_price ?? ''}
                  onBlur={(e) => onUpdate(u.id, 'subscription_price', e.target.value)}
                />
              </td>
              <td>
                <button type="button" className="pod-btn pod-btn-secondary pod-btn-sm" onClick={() => copyRss(u.rss_token)}>
                  Copy URL
                </button>
              </td>
              <td>
                <button type="button" className="pod-btn pod-btn-danger pod-btn-sm" onClick={() => onDelete(u.id)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default UserTable;
