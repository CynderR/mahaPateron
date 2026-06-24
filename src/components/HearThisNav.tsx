import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { PODCAST_AUTHOR } from '../podcastMeta';
import DownloadLatestButton from './DownloadLatestButton';
import ThemeToggle from './ThemeToggle';

const HearThisNav: React.FC = () => {
  const { isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/signin');
  };

  return (
    <header className="ht-nav">
      <div className="ht-nav-inner">
        <NavLink to="/feed" className="ht-nav-brand">
          {PODCAST_AUTHOR}
        </NavLink>
        <nav className="ht-nav-links" aria-label="Member navigation">
          <NavLink to="/feed" end>
            Recent uploads
          </NavLink>
          <NavLink to="/library">Library</NavLink>
          <NavLink to="/playlists">Playlists</NavLink>
          <NavLink to="/account/rss">RSS</NavLink>
          <DownloadLatestButton compact />
          <NavLink to="/account/billing">Billing</NavLink>
          <NavLink to="/account/settings">Settings</NavLink>
          {isAdmin && <NavLink to="/admin">Admin</NavLink>}
          <ThemeToggle />
          <button type="button" className="ht-nav-signout" onClick={handleLogout}>
            Log out
          </button>
        </nav>
      </div>
    </header>
  );
};

export default HearThisNav;
