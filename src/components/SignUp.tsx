import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
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
      
      // Redirect new users to Patreon account linking (same as "Create Patreon Account" on dashboard)
      try {
        const backendUrl = process.env.NODE_ENV === 'production' 
          ? '/auth/patreon/link' 
          : 'http://localhost:5000/api/auth/patreon/link';
        
        const response = await axios.get(backendUrl);
        
        if (response.data && response.data.redirectUrl) {
          window.location.href = response.data.redirectUrl;
          return;
        }
      } catch (patreonError: any) {
        // If we got a 200 response but axios still threw, check if redirectUrl is in the response
        if (patreonError.response?.status === 200 && patreonError.response?.data?.redirectUrl) {
          window.location.href = patreonError.response.data.redirectUrl;
          return;
        }
        console.error('Error initiating Patreon link after signup:', patreonError);
      }
      
      // Fallback to dashboard if Patreon redirect fails
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
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
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