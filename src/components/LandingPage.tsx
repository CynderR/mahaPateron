import React from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';

const LandingPage: React.FC = () => {
  return (
    <div className="landing-page">
      <div className="sky">
        {/* Cloud elements */}
        <div className="cloud cloud-1"></div>
        <div className="cloud cloud-2"></div>
        <div className="cloud cloud-3"></div>
        <div className="cloud cloud-4"></div>
        <div className="cloud cloud-5"></div>
        <div className="cloud cloud-6"></div>
        
        {/* Sign In Button */}
        <Link to="/signin" className="sign-in-button">
          Sign In
        </Link>
        
        {/* Title */}
        <div className="title-container">
          <h1 className="main-title">Aakash</h1>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;



