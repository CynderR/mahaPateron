import React from 'react';
import { NavLink } from 'react-router-dom';
import { PODCAST_AUTHOR } from '../podcastMeta';
import ThemeToggle from './ThemeToggle';
import { useShare } from '../contexts/ShareContext';

const ShareNav: React.FC = () => {
  const { basePath } = useShare();

  return (
    <header className="ht-nav">
      <div className="ht-nav-inner">
        <NavLink to={basePath} end className="ht-nav-brand">
          {PODCAST_AUTHOR}
        </NavLink>
        <nav className="ht-nav-links" aria-label="Shared listening navigation">
          <NavLink to={basePath} end>
            Recent uploads
          </NavLink>
          <NavLink to={`${basePath}/library`}>Library</NavLink>
          <ThemeToggle />
          <NavLink to="/signin" className="ht-nav-signout">
            Member sign in
          </NavLink>
        </nav>
      </div>
    </header>
  );
};

export default ShareNav;
