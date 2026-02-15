import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import './Auth.css';

const PatreonOAuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (error) {
      // Handle OAuth errors
      navigate(`/signin?error=${error}`);
      return;
    }

    if (token) {
      // Store token and set axios header
      localStorage.setItem('token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      const isNewSignup = searchParams.get('newSignup') === 'true';
      
      if (isNewSignup) {
        // New signups go to the Patreon page after linking
        window.location.href = 'https://www.patreon.com/shyamaakash';
      } else {
        // Existing users go to the dashboard
        window.location.href = 'https://www.patreon.com/shyamaakash';
      }
    } else {
      navigate('/signin?error=no_token');
    }
  }, [searchParams, navigate]);

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Completing Sign In...</h1>
          <p>Please wait while we sign you in with Patreon</p>
        </div>
      </div>
    </div>
  );
};

export default PatreonOAuthCallback;

