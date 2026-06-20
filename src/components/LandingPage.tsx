import React from 'react';
import { useNavigate } from 'react-router-dom';
import './LandingPage.css';

const publicUrl = process.env.PUBLIC_URL || '';
const LANDING_IMAGE = `${publicUrl}/shyam-akaash-landing.png`;

const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="landing-page">
      <div
        className="sky"
        style={{
          backgroundImage: `url(${LANDING_IMAGE})`
        }}
      >
        <div className="background-overlay" />
      </div>

      <div className="content-layer landing-layout">
        <header className="landing-top-bar">
          <h1 className="landing-page-title">Shyam Akaash</h1>
          <div className="landing-cta-group">
            <button
              type="button"
              className="sign-in-button"
              onClick={() => navigate('/signin')}
            >
              Sign In
            </button>
            <button
              type="button"
              className="sign-in-button"
              onClick={() => navigate('/signup')}
            >
              Become a Member
            </button>
          </div>
        </header>
      </div>
    </div>
  );
};

export default LandingPage;
