import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';

const LandingPage: React.FC = () => {
  // Array of background images
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

  return (
    <div className="landing-page">
      {/* Background with parallax effect */}
      <div 
        className="sky"
        style={{
          backgroundImage: selectedImage ? `url(${selectedImage})` : undefined,
          transform: `translate(${parallaxOffset.x}%, ${parallaxOffset.y}%)`
        }}
      >
        {/* Overlay for better text readability */}
        <div className="background-overlay"></div>
      </div>
      
      {/* Fixed content layer - doesn't move with parallax */}
      <div className="content-layer">
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



