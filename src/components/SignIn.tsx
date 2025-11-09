import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Auth.css';

const SignIn: React.FC = () => {
  // Array of background images (same as landing page)
  const backgroundImages = [
    '/signal-2025-11-09-113257.jpeg',
    '/signal-2025-11-09-113257_002.jpeg',
    '/signal-2025-11-09-113257_003.jpeg',
    '/signal-2025-11-09-113257_004.jpeg'
  ];

  // Randomly select an image on component mount
  const [selectedImage, setSelectedImage] = useState<string>('');

  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * backgroundImages.length);
    setSelectedImage(backgroundImages[randomIndex]);
  }, []);

  // Parallax effect on mouse move
  const [parallaxOffset, setParallaxOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const { clientX, clientY } = e;
      const { innerWidth, innerHeight } = window;
      
      // Calculate offset as percentage (-50% to 50%)
      const xOffset = ((clientX / innerWidth) - 0.5) * 2;
      const yOffset = ((clientY / innerHeight) - 0.5) * 2;
      
      // Apply subtle parallax (max 0.5% movement - very subtle)
      setParallaxOffset({
        x: xOffset * 0.5,
        y: yOffset * 0.5
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message);
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
          backgroundImage: selectedImage ? `url(${selectedImage})` : undefined,
          transform: `translate(${parallaxOffset.x}%, ${parallaxOffset.y}%)`
        }}
      >
        <div className="background-overlay"></div>
      </div>
      
      {/* Fixed content layer */}
      <div className="auth-content-layer">
        <div className="auth-card">
        <div className="auth-header">
          <h1>Welcome Back</h1>
          <p>Sign in to your account</p>
        </div>

        {error && (
          <div className="error-message">
            {error}
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
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="auth-button"
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

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
          Sign in with Patreon
        </button>

        <div className="auth-footer">
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

export default SignIn;








