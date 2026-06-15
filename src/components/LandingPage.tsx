import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './LandingPage.css';

const LANDING_VIDEO_ID = 'UU5YZ3JnVMM';
const publicUrl = process.env.PUBLIC_URL || '';
const BACKGROUND_IMAGES = [`${publicUrl}/signal-2026-02-01-105917_002.jpeg`];

const LandingPage: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<string>('');
  const navigate = useNavigate();

  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * BACKGROUND_IMAGES.length);
    setSelectedImage(BACKGROUND_IMAGES[randomIndex]);
  }, []);

  return (
    <div className="landing-page">
      <div
        className="sky"
        style={{
          backgroundImage: selectedImage ? `url(${selectedImage})` : undefined,
        }}
      >
        <div className="background-overlay" />
      </div>

      <div className="content-layer landing-layout">
        <header className="landing-top-bar">
          <h1 className="landing-page-title">Shyam Akaash?</h1>
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

        <div className="landing-video-shell">
          <iframe
            title="Shyam Akaash tutorial"
            src={`https://www.youtube.com/embed/${LANDING_VIDEO_ID}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="landing-main-video"
          />
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
