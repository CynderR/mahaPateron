import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import PodcastNav from '../../components/PodcastNav';

const Settings: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState({ username: '', email: '', whatsapp_id: '', signal_id: '' });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setProfile({
        username: user.username || '',
        email: user.email || '',
        whatsapp_id: user.whatsapp_id || '',
        signal_id: user.signal_id || ''
      });
    }
  }, [user]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await axios.put('/account/settings', profile);
      setMessage('Profile updated.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not update profile.');
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (passwords.newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    if (passwords.newPassword !== passwords.confirmPassword) {
      setError('New password and confirmation do not match');
      return;
    }
    try {
      await axios.post('/profile/change-password', passwords);
      setMessage('Password changed.');
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not change password.');
    }
  };

  const deleteAccount = async () => {
    if (!window.confirm('Delete your account? This cancels your subscription and cannot be undone.')) {
      return;
    }
    try {
      await axios.delete('/account');
      logout();
      navigate('/signin');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not delete account.');
    }
  };

  return (
    <div className="podcast-page">
      <PodcastNav />
      <main className="podcast-main">
        <h2 className="podcast-section-title">Account Settings</h2>

        {error && <div className="pod-banner pod-banner-error">{error}</div>}
        {message && <div className="pod-banner pod-banner-success">{message}</div>}

        <form className="pod-card" onSubmit={saveProfile}>
          <h3 style={{ marginTop: 0 }}>Profile</h3>
          <div className="pod-form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              className="pod-input"
              value={profile.username}
              onChange={(e) => setProfile({ ...profile, username: e.target.value })}
            />
          </div>
          <div className="pod-form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="pod-input"
              value={profile.email}
              onChange={(e) => setProfile({ ...profile, email: e.target.value })}
            />
          </div>
          <div className="pod-form-group">
            <label htmlFor="whatsapp">WhatsApp ID</label>
            <input
              id="whatsapp"
              className="pod-input"
              value={profile.whatsapp_id}
              onChange={(e) => setProfile({ ...profile, whatsapp_id: e.target.value })}
            />
          </div>
          <div className="pod-form-group">
            <label htmlFor="signal">Signal ID</label>
            <input
              id="signal"
              className="pod-input"
              value={profile.signal_id}
              onChange={(e) => setProfile({ ...profile, signal_id: e.target.value })}
            />
          </div>
          <button type="submit" className="pod-btn">
            Save profile
          </button>
        </form>

        <form className="pod-card" onSubmit={changePassword}>
          <h3 style={{ marginTop: 0 }}>Change Password</h3>
          <div className="pod-form-group">
            <label htmlFor="currentPassword">Current password</label>
            <input
              id="currentPassword"
              type="password"
              className="pod-input"
              value={passwords.currentPassword}
              onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
            />
          </div>
          <div className="pod-form-group">
            <label htmlFor="newPassword">New password</label>
            <input
              id="newPassword"
              type="password"
              className="pod-input"
              value={passwords.newPassword}
              onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
            />
          </div>
          <div className="pod-form-group">
            <label htmlFor="confirmPassword">Confirm new password</label>
            <input
              id="confirmPassword"
              type="password"
              className="pod-input"
              value={passwords.confirmPassword}
              onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
            />
          </div>
          <button type="submit" className="pod-btn">
            Change password
          </button>
        </form>

        <div className="pod-card" style={{ borderColor: 'var(--border-error)' }}>
          <h3 style={{ marginTop: 0, color: 'var(--text-error)' }}>Danger Zone</h3>
          <p style={{ marginTop: 0 }}>
            Deleting your account anonymizes your data, cancels your subscription, and disables your RSS feed.
          </p>
          <button type="button" className="pod-btn pod-btn-danger" onClick={deleteAccount}>
            Unsubscribe
          </button>
        </div>
      </main>
    </div>
  );
};

export default Settings;
