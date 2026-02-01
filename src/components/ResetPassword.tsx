import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import './Auth.css';

const ResetPassword: React.FC = () => {
  // Array of background images (same as landing page)
  const backgroundImages = [

    '/signal-2026-02-01-105917_002.jpeg'
  ];

  // Randomly select an image on component mount
  const [selectedImage, setSelectedImage] = useState<string>('');

  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * backgroundImages.length);
    setSelectedImage(backgroundImages[randomIndex]);
  }, []);

  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Invalid reset link. Please request a new password reset.');
    }
  }, [token]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear errors when user starts typing
    if (error) setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validate passwords match
    if (formData.newPassword !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate password length
    if (formData.newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    if (!token) {
      setError('Invalid reset token');
      return;
    }

    setLoading(true);

    try {
      await axios.post('/auth/reset-password', {
        token,
        newPassword: formData.newPassword,
        confirmPassword: formData.confirmPassword
      });
      setSuccess('Password reset successfully! Redirecting to sign in...');
      setTimeout(() => {
        navigate('/signin');
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      {/* Background with parallax effect */}
      <div 
        className="auth-background"
        style={{
          backgroundImage: selectedImage ? `url(${selectedImage})` : undefined
        }}
      >
        <div className="background-overlay"></div>
      </div>
      
      {/* Fixed content layer */}
      <div className="auth-content-layer">
        <div className="auth-card">
          <div className="auth-header">
            <h1>Reset Password</h1>
            <p>Enter your new password</p>
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {success && (
            <div className="success-message" style={{ 
              backgroundColor: '#d4edda', 
              color: '#155724', 
              padding: '12px', 
              borderRadius: '4px', 
              marginBottom: '20px',
              border: '1px solid #c3e6cb'
            }}>
              {success}
            </div>
          )}

          {token ? (
            <form onSubmit={handleSubmit} className="auth-form">
              <div className="form-group">
                <label htmlFor="newPassword">New Password</label>
                <input
                  type="password"
                  id="newPassword"
                  name="newPassword"
                  value={formData.newPassword}
                  onChange={handleInputChange}
                  required
                  minLength={6}
                  placeholder="Enter new password"
                  disabled={loading || !!success}
                  autoComplete="new-password"
                />
                <small style={{ display: 'block', marginTop: '4px', color: '#666', fontSize: '0.875rem' }}>
                  Password must be at least 6 characters long
                </small>
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm New Password</label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  required
                  minLength={6}
                  placeholder="Confirm new password"
                  disabled={loading || !!success}
                  autoComplete="new-password"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !!success}
                className="auth-button"
              >
                {loading ? 'Resetting...' : success ? 'Password Reset!' : 'Reset Password'}
              </button>
            </form>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <p style={{ color: '#dc3545', marginBottom: '20px' }}>
                Invalid or missing reset token. Please request a new password reset.
              </p>
              <Link to="/forgot-password" className="auth-link">
                Request New Reset Link
              </Link>
            </div>
          )}

          <div className="auth-footer">
            <p>
              <Link to="/signin" className="auth-link">
                ← Back to Sign In
              </Link>
            </p>
            <p>
              <Link to="/" className="auth-link">
                ← Back to Home
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;

