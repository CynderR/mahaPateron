import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ThemeToggle from './ThemeToggle';

// Shared top navigation for the member and admin areas.
const PodcastNav: React.FC = () => {
  const { isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/signin');
  };

  return (
    <header className="podcast-header">
      <div className="podcast-header-inner">
        <h1 className="podcast-brand">Shyam Akaash</h1>
        <nav className="podcast-nav">
          <NavLink to="/feed">Feed</NavLink>
          <NavLink to="/account/rss">RSS</NavLink>
          <NavLink to="/account/billing">Billing</NavLink>
          <NavLink to="/account/settings">Settings</NavLink>
          {isAdmin && <NavLink to="/admin">Admin</NavLink>}
          <ThemeToggle />
          <button type="button" className="pod-btn pod-btn-secondary pod-btn-sm" onClick={handleLogout}>
            Log out
          </button>
        </nav>
      </div>
    </header>
  );
};

export default PodcastNav;
