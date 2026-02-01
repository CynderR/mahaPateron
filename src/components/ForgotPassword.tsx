import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Auth.css';

// Configure axios baseURL (same as AuthContext)
axios.defaults.baseURL = process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:5000/api';

const ForgotPassword: React.FC = () => {
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

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await axios.post('/auth/forgot-password', { email });
      setSuccess(response.data.message);
      // Optionally redirect after a delay
      setTimeout(() => {
        navigate('/signin');
      }, 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send reset email. Please try again.');
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
            <h1>Forgot Password</h1>
            <p>Enter your email address and we'll send you a link to reset your password</p>
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

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Enter your email"
                disabled={loading || !!success}
              />
            </div>

            <button
              type="submit"
              disabled={loading || !!success}
              className="auth-button"
            >
              {loading ? 'Sending...' : success ? 'Email Sent!' : 'Send Reset Link'}
            </button>
          </form>

          <div className="auth-footer">
            <p>
              Remember your password?{' '}
              <Link to="/signin" className="auth-link">
                Sign in here
              </Link>
            </p>
            <p>
              Don't have an account?{' '}
              <Link to="/signup" className="auth-link">
                Sign up here
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

export default ForgotPassword;

