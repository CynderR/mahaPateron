import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Auth.css';

const SignUp: React.FC = () => {
  const location = useLocation();
  const isMixcloudSignup = location.pathname.includes('/mixcloud');
  
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    patreon_id: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);

    try {
      const { confirmPassword, ...registerData } = formData;
      // Add is_mixcloud flag if this is a Mixcloud signup
      const finalRegisterData = {
        ...registerData,
        is_mixcloud: isMixcloudSignup
      };
      await register(finalRegisterData);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      {/* Fixed content layer */}
      <div className="auth-content-layer">
        <div className="auth-card">
        {error && (
          <div className="error-message">
            {error}
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
              placeholder="Create a password"
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

          <button
            type="submit"
            disabled={loading}
            className="auth-button"
          >
            {loading
              ? (isMixcloudSignup ? 'Signing up with Mixcloud...' : 'Creating Account...')
              : (isMixcloudSignup ? 'Sign up with Mixcloud' : 'Create Account')}
          </button>
        </form>

        {!isMixcloudSignup && (
          <>
            <div className="oauth-divider">
              <span>or</span>
            </div>

            <button
              type="button"
              onClick={() => {
                const backendUrl = process.env.NODE_ENV === 'production'
                  ? '/api/auth/patreon'
                  : 'http://localhost:5000/api/auth/patreon';
                window.location.href = backendUrl;
              }}
              className="patreon-oauth-button"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M0 .48v23.04h4.32V.48zm7.405 0C11.135.48 13.2 2.16 13.2 5.04c0 2.88-2.065 4.56-5.795 4.56H4.32v8.4H0V.48zm0 7.68h2.64c1.92 0 2.88-.96 2.88-2.4 0-1.44-.96-2.4-2.88-2.4H7.405z"/>
              </svg>
              Sign up with Patreon
            </button>
          </>
        )}

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