import React, { useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ThemeToggleFixed } from './ThemeToggle';
import './Auth.css';

const SignUp: React.FC = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    verificationCode: ''
  });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [verificationSent, setVerificationSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { register } = useAuth();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    if (name === 'email') {
      setVerificationSent(false);
      setMessage('');
    }
  };

  const validateAccountFields = () => {
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return false;
    }

    return true;
  };

  const requestVerificationCode = async () => {
    if (!validateAccountFields()) return;

    setLoading(true);
    setMessage('');

    try {
      await axios.post('/auth/request-email-verification', {
        username: formData.username,
        email: formData.email,
        password: formData.password
      });
      setVerificationSent(true);
      setMessage('Verification code sent. Check your email, then enter the code below.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not send verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAccountFields()) return;

    if (!verificationSent) {
      await requestVerificationCode();
      return;
    }

    if (!formData.verificationCode.trim()) {
      setError('Enter the verification code sent to your email.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await register({
        username: formData.username,
        email: formData.email,
        password: formData.password,
        verificationCode: formData.verificationCode.trim()
      });
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <ThemeToggleFixed />
      {/* Fixed content layer */}
      <div className="auth-content-layer">
        <div className="auth-card">
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
        {message && (
          <div className="success-message">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="username">Username *</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              placeholder="Choose a username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email Address *</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="Enter your email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password *</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              minLength={8}
              placeholder="Create a password (8+ characters)"
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password *</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              placeholder="Confirm your password"
            />
          </div>

          {verificationSent && (
            <div className="form-group">
              <label htmlFor="verificationCode">Verification Code *</label>
              <input
                type="text"
                id="verificationCode"
                name="verificationCode"
                value={formData.verificationCode}
                onChange={handleChange}
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="Enter the 6-digit code"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="auth-button"
          >
            {loading
              ? verificationSent
                ? 'Creating account...'
                : 'Sending code...'
              : verificationSent
                ? 'Create Account'
                : 'Send Verification Code'}
          </button>
          {verificationSent && (
            <button
              type="button"
              className="auth-button auth-button-secondary"
              disabled={loading}
              onClick={requestVerificationCode}
            >
              Resend Code
            </button>
          )}
        </form>

        <div className="auth-footer">
          <p>
            Already have an account?{' '}
            <Link to="/signin" className="auth-link">
              Sign in here
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

export default SignUp;