import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';

const LandingPage: React.FC = () => {
  // Array of background images
  const backgroundImages = [

    '/signal-2026-02-01-105917_002.jpeg'
  ];
  // Randomly select an image on component mount
  const [selectedImage, setSelectedImage] = useState<string>('');

  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * backgroundImages.length);
    setSelectedImage(backgroundImages[randomIndex]);
  }, []);



  return (
    <div className="landing-page">
      {/* Background with parallax effect */}
      <div 
        className="sky"
        style={{
          backgroundImage: selectedImage ? `url(${selectedImage})` : undefined,
        }}
      >
        {/* Overlay for better text readability */}
        <div className="background-overlay"></div>
      </div>
      
      {/* Fixed content layer - doesn't move with parallax */}
      <div className="content-layer">
        {/* Page title - top left */}
        <h1 className="landing-page-title">Shyam Akaash</h1>
        {/* Sign In Button */}
        <Link to="/signup" className="sign-in-button">
          Create Account
        </Link>
        
      </div>
    </div>
  );
};

export default LandingPage;



