import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import ThemeToggle from './ThemeToggle';
import './Dashboard.css';

const UserDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState(user);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    username: user?.username || '',
    email: user?.email || '',
    whatsapp_number: user?.whatsapp_number || '',
    patreon_id: user?.patreon_id || '',
    mixcloud_id: user?.mixcloud_id || '',
    is_free: user?.is_free || true,
    is_admin: user?.is_admin || false
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await axios.get('/profile');
      setProfile(response.data);
      setEditForm({
        username: response.data.username,
        email: response.data.email,
        whatsapp_number: response.data.whatsapp_number || '',
        patreon_id: response.data.patreon_id || '',
        mixcloud_id: response.data.mixcloud_id || '',
        is_free: response.data.is_free,
        is_admin: response.data.is_admin
      });
    } catch (err: any) {
      setError('Failed to fetch profile');
      console.error('Error fetching profile:', err);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setEditForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await axios.put('/profile', editForm);
      setProfile(response.data.user);
      setIsEditing(false);
      setSuccess('Profile updated successfully!');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEditForm({
      username: profile?.username || '',
      email: profile?.email || '',
      whatsapp_number: profile?.whatsapp_number || '',
      patreon_id: profile?.patreon_id || '',
      mixcloud_id: profile?.mixcloud_id || '',
      is_free: profile?.is_free || true,
      is_admin: profile?.is_admin || false
    });
    setIsEditing(false);
    setError('');
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>My Dashboard</h1>
          <div className="header-actions">
            <span className="welcome-text">Welcome, {profile?.username}</span>
            <ThemeToggle />
            <button onClick={logout} className="logout-btn">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        {error && (
          <div className="error-banner">
            {error}
            <button onClick={() => setError('')} className="close-btn">×</button>
          </div>
        )}

        {success && (
          <div className="success-banner">
            {success}
            <button onClick={() => setSuccess('')} className="close-btn">×</button>
          </div>
        )}

        <div className="dashboard-content">
          <div className="profile-section">
            <div className="profile-header">
              <h2>Profile Information</h2>
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="btn-edit"
                >
                  Edit Profile
                </button>
              )}
            </div>

            {isEditing ? (
              <form onSubmit={handleSubmit} className="profile-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Username</label>
                    <input
                      type="text"
                      name="username"
                      value={editForm.username}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input
                      type="email"
                      name="email"
                      value={editForm.email}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>WhatsApp Number</label>
                    <input
                      type="tel"
                      name="whatsapp_number"
                      value={editForm.whatsapp_number}
                      onChange={handleInputChange}
                      placeholder="Optional"
                    />
                  </div>
                  <div className="form-group">
                    <label>Patreon ID</label>
                    <input
                      type="text"
                      name="patreon_id"
                      value={editForm.patreon_id}
                      onChange={handleInputChange}
                      placeholder="Optional"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Mixcloud ID</label>
                    <input
                      type="text"
                      name="mixcloud_id"
                      value={editForm.mixcloud_id}
                      onChange={handleInputChange}
                      placeholder="Optional"
                    />
                  </div>
            
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary"
                  >
                    {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="profile-info">
                <div className="info-grid">
                  <div className="info-item">
                    <label>Username</label>
                    <p>{profile?.username}</p>
                  </div>
                  <div className="info-item">
                    <label>Email</label>
                    <p>{profile?.email}</p>
                  </div>
                  <div className="info-item">
                    <label>WhatsApp Number</label>
                    <p>{profile?.whatsapp_number || 'Not provided'}</p>
                  </div>
                  <div className="info-item">
                    <label>Patreon ID</label>
                    {profile?.patreon_id ? (
                      <p>{profile.patreon_id}</p>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <p style={{ margin: 0 }}>Not linked</p>
                        <button
                          type="button"
                          onClick={() => {
                            // Get userId from profile (which is fetched from /api/profile and should have id)
                            // Fallback to user from AuthContext
                            // Also try to decode from JWT token as last resort
                            let userId = profile?.id || user?.id;
                            
                            // If still no userId, try to decode from JWT token
                            if (!userId) {
                              try {
                                const token = localStorage.getItem('token');
                                if (token) {
                                  // Decode JWT token (without verification, just to get the payload)
                                  const base64Url = token.split('.')[1];
                                  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                                  const jsonPayload = decodeURIComponent(atob(base64).split('').map((c) => {
                                    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                                  }).join(''));
                                  const decoded = JSON.parse(jsonPayload);
                                  userId = decoded.id;
                                  console.log('Got userId from JWT token:', userId);
                                }
                              } catch (err) {
                                console.error('Error decoding JWT token:', err);
                              }
                            }
                            
                            console.log('Link Patreon - profile?.id:', profile?.id, 'user?.id:', user?.id, 'final userId:', userId);
                            
                            if (!userId) {
                              console.error('Cannot link Patreon: User ID not available');
                              setError('Unable to link account. Please refresh the page and try again.');
                              return;
                            }
                            
                            const backendUrl = process.env.NODE_ENV === 'production' 
                              ? '/api/auth/patreon' 
                              : 'http://localhost:5000/api/auth/patreon';
                            const url = `${backendUrl}?link=true&userId=${userId}`;
                            console.log('Linking Patreon account - redirecting to:', url);
                            window.location.href = url;
                          }}
                          className="btn-link-patreon"
                        >
                          Link Patreon Account
                        </button>
                      </div>
                    )}
                  </div>
                  {profile?.mixcloud_id && (
                    <div className="info-item">
                      <label>Mixcloud ID</label>
                      <p>{profile.mixcloud_id}</p>
                    </div>
                  )}
                  <div className="info-item">
                    <label>Account Type</label>
                    <p>
                      <span className={`user-type ${profile?.is_free ? 'free' : 'premium'}`}>
                        {profile?.is_free ? 'Free' : 'Premium'}
                      </span>
                    </p>
                  </div>
                  <div className="info-item">
                    <label>Role</label>
                    <p>
                      <span className={`admin-badge ${profile?.is_admin ? 'admin' : 'user'}`}>
                        {profile?.is_admin ? 'Admin' : 'User'}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="account-stats">
            <h3>Account Statistics</h3>
            <div className="stats-grid">
              <div className="stat-card">
                <h4>Member Since</h4>
                <p>{profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'N/A'}</p>
              </div>
              <div className="stat-card">
                <h4>Account Status</h4>
                <p className={`status ${profile?.is_free ? 'free' : 'premium'}`}>
                  {profile?.is_free ? 'Free Account' : 'Premium Account'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default UserDashboard;

