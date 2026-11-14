import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { getSafeRedirectPath } from './routeHelpers';

export const PublicOnlyRoute: React.FC = () => {
  const { isAuthenticated, isLoading, role } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="auth-loading-screen">
        <div className="auth-loading-spinner" />
        <p className="auth-loading-text">Checking active session...</p>
      </div>
    );
  }

  if (isAuthenticated) {
    const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
    return <Navigate to={getSafeRedirectPath(from, role)} replace />;
  }

  return <Outlet />;
};

