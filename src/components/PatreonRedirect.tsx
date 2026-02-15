import React, { useEffect } from 'react';
import './Auth.css';

const PatreonRedirect: React.FC = () => {
  useEffect(() => {
    window.location.href = 'https://www.patreon.com/shyamaakash';
  }, []);

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Redirecting to Patreon...</h1>
          <p>You will be redirected shortly</p>
        </div>
      </div>
    </div>
  );
};

export default PatreonRedirect;
