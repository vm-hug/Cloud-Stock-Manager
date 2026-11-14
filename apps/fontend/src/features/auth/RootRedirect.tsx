import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { getDefaultRouteForRole } from './routeHelpers';

export const RootRedirect: React.FC = () => {
  const { isAuthenticated, isLoading, role } = useAuth();
  const { t } = useI18n();

  if (isLoading) {
    return (
      <div className="auth-loading-screen">
        <div className="auth-loading-spinner" />
        <p className="auth-loading-text">{t('auth.initializingSession')}</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={getDefaultRouteForRole(role)} replace />;
};
