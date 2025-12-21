import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import PatreonConfig from './PatreonConfig';
import PatreonSubscribers from './PatreonSubscribers';
import SubscriptionAlerts from './SubscriptionAlerts';
import ThemeToggle from './ThemeToggle';
import './Dashboard.css';

interface User {
  id: number;
  username: string;
  email: string;
  patreon_id?: string;
  is_mixcloud?: boolean;
  is_free: boolean;
  is_admin: boolean;
  patreon_subscription_status?: string;
  last_patreon_sync?: string;
  subscription_alert_sent?: boolean;
  created_at: string;
}

type UserSortColumn = 'id' | 'username' | 'email' | 'patreon' | 'mixcloud' | 'type' | 'admin' | 'created' | null;
type UserSortDirection = 'asc' | 'desc';

const AdminDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState<Partial<User>>({});
  const [patreonAccessToken, setPatreonAccessToken] = useState<string>('');
  const [patreonConnected, setPatreonConnected] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'patreon'>('users');
  const [sortColumn, setSortColumn] = useState<UserSortColumn>(null);
  const [sortDirection, setSortDirection] = useState<UserSortDirection>('asc');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await axios.get('/users');
      setUsers(response.data);
    } catch (err: any) {
      setError('Failed to fetch users');
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setEditForm({
      username: user.username,
      email: user.email,
      patreon_id: user.patreon_id || '',
      is_mixcloud: user.is_mixcloud || false,
      is_free: user.is_free,
      is_admin: user.is_admin
    });
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      await axios.put(`/users/${editingUser.id}`, editForm);
      await fetchUsers();
      setEditingUser(null);
      setEditForm({});
    } catch (err: any) {
      setError('Failed to update user');
      console.error('Error updating user:', err);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!window.confirm('Are you sure you want to delete this user?')) {
      return;
    }

    try {
      await axios.delete(`/users/${userId}`);
      await fetchUsers();
    } catch (err: any) {
      setError('Failed to delete user');
      console.error('Error deleting user:', err);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setEditForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handlePatreonConfigSuccess = (campaign: any) => {
    setPatreonConnected(true);
    // Store the access token in state (in a real app, you'd want to store this more securely)
    setPatreonAccessToken('configured'); // We'll need to handle this differently
  };

  const handleSort = (column: UserSortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const getSortedUsers = () => {
    if (!sortColumn) return users;

    const sorted = [...users].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortColumn) {
        case 'id':
          aValue = a.id;
          bValue = b.id;
          break;
        case 'username':
          aValue = a.username || '';
          bValue = b.username || '';
          break;
        case 'email':
          aValue = a.email || '';
          bValue = b.email || '';
          break;
        case 'patreon':
          aValue = a.patreon_id || '';
          bValue = b.patreon_id || '';
          break;
        case 'mixcloud':
          aValue = a.is_mixcloud ? 'Yes' : 'No';
          bValue = b.is_mixcloud ? 'Yes' : 'No';
          break;
        case 'type':
          aValue = a.is_free ? 'Free' : 'Premium';
          bValue = b.is_free ? 'Free' : 'Premium';
          break;
        case 'admin':
          aValue = a.is_admin ? 'Admin' : 'User';
          bValue = b.is_admin ? 'Admin' : 'User';
          break;
        case 'created':
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
          break;
        default:
          return 0;
      }

      if (aValue === null || aValue === undefined) aValue = '';
      if (bValue === null || bValue === undefined) bValue = '';

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      } else {
        return sortDirection === 'asc' 
          ? (aValue as number) - (bValue as number)
          : (bValue as number) - (aValue as number);
      }
    });

    return sorted;
  };

  const getSortIcon = (column: UserSortColumn) => {
    if (sortColumn !== column) {
      return <span className="sort-icon">↕</span>;
    }
    return sortDirection === 'asc' 
      ? <span className="sort-icon">↑</span>
      : <span className="sort-icon">↓</span>;
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>Admin Dashboard</h1>
          <div className="header-actions">
            <span className="welcome-text">Welcome, {user?.username}</span>
            <ThemeToggle />
            <button onClick={logout} className="logout-btn">
              Logout
            </button>
          </div>
        </div>
        <div className="dashboard-tabs">
          <button
            className={`tab-button ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            👥 User Management
          </button>
          <button
            className={`tab-button ${activeTab === 'patreon' ? 'active' : ''}`}
            onClick={() => setActiveTab('patreon')}
          >
            🎨 Patreon Integration
          </button>
        </div>
      </header>

      <main className="dashboard-main">
        {error && (
          <div className="error-banner">
            {error}
            <button onClick={() => setError('')} className="close-btn">×</button>
          </div>
        )}

        <div className="dashboard-content">
          {activeTab === 'users' && (
            <>
              <div className="stats-grid">
                <div className="stat-card">
                  <h3>Total Users</h3>
                  <p className="stat-number">{users.length}</p>
                </div>
                <div className="stat-card">
                  <h3>Free Users</h3>
                  <p className="stat-number">{users.filter(u => u.is_free).length}</p>
                </div>
                <div className="stat-card">
                  <h3>Premium Users</h3>
                  <p className="stat-number">{users.filter(u => !u.is_free).length}</p>
                </div>
              </div>

              <div className="users-section">
                <h2>User Management</h2>
                <div className="users-table-container">
                  <table className="users-table">
                    <thead>
                      <tr>
                        <th 
                          className="sortable" 
                          onClick={() => handleSort('id')}
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                        >
                          ID {getSortIcon('id')}
                        </th>
                        <th 
                          className="sortable" 
                          onClick={() => handleSort('username')}
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                        >
                          Username {getSortIcon('username')}
                        </th>
                        <th 
                          className="sortable" 
                          onClick={() => handleSort('email')}
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                        >
                          Email {getSortIcon('email')}
                        </th>
                        <th 
                          className="sortable" 
                          onClick={() => handleSort('patreon')}
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                        >
                          Patreon ID {getSortIcon('patreon')}
                        </th>
                        <th 
                          className="sortable" 
                          onClick={() => handleSort('mixcloud')}
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                        >
                          Mixcloud {getSortIcon('mixcloud')}
                        </th>
                        <th 
                          className="sortable" 
                          onClick={() => handleSort('type')}
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                        >
                          Type {getSortIcon('type')}
                        </th>
                        <th 
                          className="sortable" 
                          onClick={() => handleSort('admin')}
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                        >
                          Admin {getSortIcon('admin')}
                        </th>
                        <th 
                          className="sortable" 
                          onClick={() => handleSort('created')}
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                        >
                          Created {getSortIcon('created')}
                        </th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getSortedUsers().map((user) => (
                        <tr key={user.id}>
                          <td>{user.id}</td>
                          <td>{user.username}</td>
                          <td>{user.email}</td>
                          <td>{user.patreon_id || '-'}</td>
                          <td>
                            <span className={`user-type ${user.is_mixcloud ? 'premium' : 'free'}`}>
                              {user.is_mixcloud ? 'Yes' : 'No'}
                            </span>
                          </td>
                          <td>
                            <span className={`user-type ${user.is_free ? 'free' : 'premium'}`}>
                              {user.is_free ? 'Free' : 'Premium'}
                            </span>
                          </td>
                          <td>
                            <span className={`admin-badge ${user.is_admin ? 'admin' : 'user'}`}>
                              {user.is_admin ? 'Admin' : 'User'}
                            </span>
                          </td>
                          <td>{new Date(user.created_at).toLocaleDateString()}</td>
                          <td>
                            <div className="action-buttons">
                              <button
                                onClick={() => handleEditUser(user)}
                                className="btn-edit"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteUser(user.id)}
                                className="btn-delete"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {activeTab === 'patreon' && (
            <>
              <SubscriptionAlerts />
              <PatreonConfig onConfigSuccess={handlePatreonConfigSuccess} />
              {patreonConnected && (
                <PatreonSubscribers />
              )}
            </>
          )}
        </div>
      </main>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Edit User: {editingUser.username}</h3>
              <button
                onClick={() => setEditingUser(null)}
                className="close-btn"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleUpdateUser} className="modal-form">
              <div className="form-group">
                <label>Username</label>
                <input
                  type="text"
                  name="username"
                  value={editForm.username || ''}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  name="email"
                  value={editForm.email || ''}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Patreon ID</label>
                <input
                  type="text"
                  name="patreon_id"
                  value={editForm.patreon_id || ''}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="is_mixcloud"
                    checked={editForm.is_mixcloud || false}
                    onChange={handleInputChange}
                  />
                  Mixcloud Account
                </label>
              </div>
              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="is_free"
                    checked={editForm.is_free || false}
                    onChange={handleInputChange}
                  />
                  Free Account
                </label>
              </div>
              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="is_admin"
                    checked={editForm.is_admin || false}
                    onChange={handleInputChange}
                  />
                  Admin User
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setEditingUser(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Update User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;

