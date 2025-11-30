import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';

const LandingPage: React.FC = () => {
  // Array of background images
  const backgroundImages = [

    '/signal-2.jpeg',
    '/signal-3.jpeg',
    '/signal-4.jpeg'
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
        {/* Sign In Button */}
        <Link to="/signin" className="sign-in-button">
          Sign In
        </Link>
        
      </div>
    </div>
  );
};

export default LandingPage;



