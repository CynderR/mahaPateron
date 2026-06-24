import React from 'react';
import { NavLink } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import { useShare } from '../contexts/ShareContext';

const ShareMobileNav: React.FC = () => {
  const { basePath } = useShare();

  return (
    <nav className="pod-mobile-nav pod-mobile-only" aria-label="Shared listening navigation">
      <NavLink to={basePath} end className="pod-mobile-nav-link">
        <svg viewBox="0 0 24 24" aria-hidden>
          <path fill="currentColor" d="M12 3v10.55A4 4 0 1012 3zm0 14a6 6 0 100 12 6 6 0 000-12z" />
        </svg>
        <span>Episodes</span>
      </NavLink>
      <NavLink to={`${basePath}/library`} className="pod-mobile-nav-link">
        <svg viewBox="0 0 24 24" aria-hidden>
          <path fill="currentColor" d="M4 6H2v14a2 2 0 002 2h14v-2H4V6zm16-4H8a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2zm0 14H8V4h12v12z" />
        </svg>
        <span>Library</span>
      </NavLink>
      <NavLink to="/signin" className="pod-mobile-nav-link">
        <svg viewBox="0 0 24 24" aria-hidden>
          <path
            fill="currentColor"
            d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
          />
        </svg>
        <span>Sign in</span>
      </NavLink>
    </nav>
  );
};

export const ShareMobileHeader: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => (
  <header className="pod-mobile-header pod-mobile-only">
    <div>
      <h1 className="pod-mobile-header-title">{title}</h1>
      {subtitle && <p className="pod-mobile-header-subtitle">{subtitle}</p>}
    </div>
    <ThemeToggle />
  </header>
);

export default ShareMobileNav;
