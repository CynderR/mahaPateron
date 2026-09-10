import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isNativeApp } from '../native/platform';
import { memberHasAppAccess } from '../utils/appAccess';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  /** When true (default on native), members without app_access are sent to the denial screen. */
  requireAppAccess?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAdmin = false,
  requireAppAccess
}) => {
  const { user, loading, isAdmin } = useAuth();
  const enforceAppAccess = requireAppAccess ?? isNativeApp();

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          fontSize: '1.125rem',
          color: '#4a5568'
        }}
      >
        Loading...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/signin" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (enforceAppAccess && !memberHasAppAccess(user.app_access) && !isAdmin) {
    return <Navigate to="/app-access-denied" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
