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
  const [rssUrl, setRssUrl] = useState<string | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [editForm, setEditForm] = useState({
    username: user?.username || '',
    email: user?.email || '',
    patreon_id: user?.patreon_id || '',
    is_free: user?.is_free || true,
    is_admin: user?.is_admin || false
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    // Fetch RSS URL and posts if Patreon is linked
    if (profile?.patreon_id) {
      fetchPatreonRSS();
      fetchPatreonPosts();
    }
  }, [profile?.patreon_id]);

  const fetchPatreonRSS = async () => {
    try {
      const response = await axios.get('/patreon/rss-url');
      setRssUrl(response.data.rssUrl);
    } catch (err: any) {
      // RSS URL not available or Patreon not configured - that's okay
      console.log('RSS URL not available:', err.response?.data?.error);
    }
  };

  const fetchPatreonPosts = async () => {
    setLoadingPosts(true);
    try {
      const response = await axios.get('/patreon/posts');
      setPosts(response.data.posts || []);
    } catch (err: any) {
      console.error('Failed to fetch Patreon posts:', err);
      // If RSS feed is not available, that's okay - just don't show posts
      // The RSS link will still be available for users to subscribe
      setPosts([]);
    } finally {
      setLoadingPosts(false);
    }
  };

  const fetchProfile = async () => {
    try {
      const response = await axios.get('/profile');
      setProfile(response.data);
      setEditForm({
        username: response.data.username,
        email: response.data.email,
        patreon_id: response.data.patreon_id || '',
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
      patreon_id: profile?.patreon_id || '',
      is_free: profile?.is_free || true,
      is_admin: profile?.is_admin || false
    });
    setIsEditing(false);
    setError('');
  };

  const handlePasswordInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordForm(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear errors when user starts typing
    if (passwordError) setPasswordError('');
    if (passwordSuccess) setPasswordSuccess('');
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');
    setLoading(true);

    // Validate passwords match
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New password and confirmation do not match');
      setLoading(false);
      return;
    }

    // Validate password length
    if (passwordForm.newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    try {
      await axios.post('/profile/change-password', passwordForm);
      setPasswordSuccess('Password changed successfully!');
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setIsChangingPassword(false);
    } catch (err: any) {
      setPasswordError(err.response?.data?.error || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordCancel = () => {
    setPasswordForm({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    setIsChangingPassword(false);
    setPasswordError('');
    setPasswordSuccess('');
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
                    <label>Patreon ID</label>
                    {profile?.patreon_id ? (
                      <p>{profile.patreon_id}</p>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              // Use the authenticated linking endpoint which gets userId from JWT token
                              // Note: axios baseURL is already set to '/api' in production, so we just need '/auth/patreon/link'
                              const backendUrl = process.env.NODE_ENV === 'production' 
                                ? '/auth/patreon/link' 
                                : 'http://localhost:5000/api/auth/patreon/link';
                              
                              // Make request with auth header - backend returns the Patreon URL in JSON
                              const response = await axios.get(backendUrl);
                              
                              console.log('Patreon link response:', response.data);
                              
                              // Redirect to Patreon using the URL from the response
                              if (response.data && response.data.redirectUrl) {
                                window.location.href = response.data.redirectUrl;
                              } else {
                                console.error('Unexpected response format:', response.data);
                                setError('Unexpected response from server. Please try again.');
                              }
                            } catch (error: any) {
                              console.error('Error initiating Patreon link:', error);
                              console.error('Error response:', error.response?.data);
                              
                              // If we got a 200 response but axios still threw, check if redirectUrl is in the response
                              if (error.response?.status === 200 && error.response?.data?.redirectUrl) {
                                window.location.href = error.response.data.redirectUrl;
                                return;
                              }
                              
                              if (error.response?.status === 401) {
                                setError('Please log in again to link your Patreon account.');
                              } else {
                                setError('Failed to initiate Patreon linking. Please try again.');
                              }
                            }
                          }}
                          className="btn-link-patreon"
                        >
                          Link to Patreon Account
                        </button>
                      </div>
                    )}
                  </div>
                  {profile?.is_mixcloud ? (
                    <div className="info-item">
                      <label>Mixcloud Account</label>
                      <p>
                        <span className="user-type premium">Yes</span>
                      </p>
                    </div>
                  ) : <div className="info-item"> 
                    <label></label>
                    <p>
                      <span className=""></span>
                    </p>
                    </div>}
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

          {!profile?.patreon_id && (
            <div className="password-section">
              <div className="password-header">
                <h2>Change Password</h2>
                {!isChangingPassword && (
                  <button
                    onClick={() => setIsChangingPassword(true)}
                    className="btn-edit"
                  >
                    Change Password
                  </button>
                )}
              </div>

              {isChangingPassword ? (
                <form onSubmit={handlePasswordSubmit} className="password-form">
                  {passwordError && (
                    <div className="error-banner">
                      {passwordError}
                      <button onClick={() => setPasswordError('')} className="close-btn">×</button>
                    </div>
                  )}

                  {passwordSuccess && (
                    <div className="success-banner">
                      {passwordSuccess}
                      <button onClick={() => setPasswordSuccess('')} className="close-btn">×</button>
                    </div>
                  )}

                  <div className="form-group">
                    <label>Current Password</label>
                    <input
                      type="password"
                      name="currentPassword"
                      value={passwordForm.currentPassword}
                      onChange={handlePasswordInputChange}
                      required
                      autoComplete="current-password"
                    />
                  </div>

                  <div className="form-group">
                    <label>New Password</label>
                    <input
                      type="password"
                      name="newPassword"
                      value={passwordForm.newPassword}
                      onChange={handlePasswordInputChange}
                      required
                      minLength={6}
                      autoComplete="new-password"
                    />
                    <small>Password must be at least 6 characters long</small>
                  </div>

                  <div className="form-group">
                    <label>Confirm New Password</label>
                    <input
                      type="password"
                      name="confirmPassword"
                      value={passwordForm.confirmPassword}
                      onChange={handlePasswordInputChange}
                      required
                      minLength={6}
                      autoComplete="new-password"
                    />
                  </div>

                  <div className="form-actions">
                    <button
                      type="button"
                      onClick={handlePasswordCancel}
                      className="btn-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="btn-primary"
                    >
                      {loading ? 'Changing...' : 'Change Password'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="password-info">
                  <p>Keep your account secure by changing your password regularly.</p>
                </div>
              )}
            </div>
          )}

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

          {/* {profile?.patreon_id && (
            <div className="patreon-section">
              <h3>Patreon</h3>
              {rssUrl && (
                <div className="rss-link-container">
                  <a 
                    href={rssUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="rss-link"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '0.5rem' }}>
                      <path d="M6.503 20.752c0 1.794-1.456 3.248-3.251 3.248-1.796 0-3.252-1.454-3.252-3.248 0-1.794 1.456-3.248 3.252-3.248 1.795.001 3.251 1.454 3.251 3.248zm-6.503-12.572v4.811c6.05.062 10.96 4.966 11.022 11.009h4.817c-.062-8.71-7.118-15.758-15.839-15.82zm0-3.368c10.58.046 19.152 8.594 19.183 19.188h4.817c-.03-13.231-10.755-23.954-24-24v4.812z"/>
                    </svg>
                    RSS Feed
                  </a>
                </div>
              )}
              
              <div className="patreon-posts">
                <h4>Recent Posts</h4>
                {loadingPosts ? (
                  <p>Loading posts...</p>
                ) : posts.length > 0 ? (
                  <div className="posts-list">
                    {posts.map((post, index) => (
                      <div key={index} className="post-item">
                        <h5>
                          <a 
                            href={post.link} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="post-link"
                          >
                            {post.title}
                          </a>
                        </h5>
                        {post.pubDate && (
                          <p className="post-date">
                            {new Date(post.pubDate).toLocaleDateString()}
                          </p>
                        )}
                        {post.description && (
                          <p className="post-description">{post.description}...</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="posts-unavailable">
                    Posts are not available via RSS feed. You can subscribe to the RSS feed above to get updates in your RSS reader.
                  </p>
                )}
              </div>
            </div>
          )} */}
        </div>
      </main>
    </div>
  );
};

export default UserDashboard;

