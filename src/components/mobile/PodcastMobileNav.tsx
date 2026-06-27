import React from 'react';
import { NavLink } from 'react-router-dom';
import ThemeToggle from '../ThemeToggle';

const PodcastMobileNav: React.FC = () => {
  return (
    <nav className="pod-mobile-nav pod-mobile-only" aria-label="Podcast navigation">
      <NavLink to="/feed" end className="pod-mobile-nav-link">
        <svg viewBox="0 0 24 24" aria-hidden>
          <path fill="currentColor" d="M12 3v10.55A4 4 0 1012 3zm0 14a6 6 0 100 12 6 6 0 000-12z" />
        </svg>
        <span>Episodes</span>
      </NavLink>
      <NavLink to="/library" className="pod-mobile-nav-link">
        <svg viewBox="0 0 24 24" aria-hidden>
          <path fill="currentColor" d="M4 6H2v14a2 2 0 002 2h14v-2H4V6zm16-4H8a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2zm0 14H8V4h12v12z" />
        </svg>
        <span>Library</span>
      </NavLink>
      <NavLink to="/playlists" className="pod-mobile-nav-link">
        <svg viewBox="0 0 24 24" aria-hidden>
          <path fill="currentColor" d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18A3 3 0 0114.82 17H6v2h8.82A5 5 0 0020 14.18V6h-3z" />
        </svg>
        <span>Lists</span>
      </NavLink>
      <NavLink to="/account/settings" className="pod-mobile-nav-link">
        <svg viewBox="0 0 24 24" aria-hidden>
          <path
            fill="currentColor"
            d="M12 8a4 4 0 110 8 4 4 0 010-8zm9.4 4a7.4 7.4 0 01-.12 1.2l2.07 1.62-2 3.46-2.47-1a7.52 7.52 0 01-2.08 1.2l-.38 2.65H9.58l-.38-2.65a7.52 7.52 0 01-2.08-1.2l-2.47 1-2-3.46 2.07-1.62A7.4 7.4 0 014.6 12c0-.41.04-.81.12-1.2L2.65 9.18l2-3.46 2.47 1c.64-.52 1.35-.92 2.08-1.2l.38-2.65h4.84l.38 2.65c.73.28 1.44.68 2.08 1.2l2.47-1 2 3.46-2.07 1.62c.08.39.12.79.12 1.2z"
          />
        </svg>
        <span>Settings</span>
      </NavLink>
    </nav>
  );
};

export const PodcastMobileHeader: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => (
  <header className="pod-mobile-header pod-mobile-only">
    <div>
      <h1 className="pod-mobile-header-title">{title}</h1>
      {subtitle && <p className="pod-mobile-header-subtitle">{subtitle}</p>}
    </div>
    <div className="theme-toggle-row">
      <ThemeToggle />
    </div>
  </header>
);

export default PodcastMobileNav;
