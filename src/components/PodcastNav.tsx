import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { PODCAST_AUTHOR } from '../podcastMeta';
import { memberCanRss } from '../utils/accessPermissions';
import { isNativeApp } from '../native/platform';
import ThemeToggle from './ThemeToggle';

// Shared top navigation for the member and admin areas.
const PodcastNav: React.FC = () => {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const native = isNativeApp();
  const hasRssAccess = !native && memberCanRss(user?.access_type);

  const handleLogout = () => {
    logout();
    navigate('/signin');
  };

  return (
    <header className="podcast-header">
      <div className="podcast-header-inner">
        <h1 className="podcast-brand">
          <NavLink to="/feed" end className="podcast-brand-link">
            {PODCAST_AUTHOR}
          </NavLink>
        </h1>
        <nav className="podcast-nav">
          <NavLink to="/feed" end>
            Recent uploads
          </NavLink>
          <NavLink to="/library">Library</NavLink>
          <NavLink to="/playlists">Playlists</NavLink>
          {native && <NavLink to="/downloads">Downloads</NavLink>}
          {hasRssAccess && <NavLink to="/account/rss">RSS</NavLink>}
          {!native && <NavLink to="/account/billing">Billing</NavLink>}
          <NavLink to="/account/settings">Settings</NavLink>
          {!native && isAdmin && <NavLink to="/admin">Admin</NavLink>}
          {!native && isAdmin && <NavLink to="/admin/bulk-upload">Bulk Upload</NavLink>}
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
