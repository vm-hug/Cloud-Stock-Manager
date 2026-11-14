import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { Role } from '@cloud-stock/shared';
import { ShieldAlert } from 'lucide-react';

interface RoleRouteProps {
  allowedRoles: Role[];
}

export const RoleRoute: React.FC<RoleRouteProps> = ({ allowedRoles }) => {
  const { role, user } = useAuth();

  if (!user || !role || !allowedRoles.includes(role)) {
    return (
      <div className="role-forbidden-view">
        <div className="forbidden-icon-badge">
          <ShieldAlert size={48} />
        </div>
        <h2 className="forbidden-title">403 — Access Forbidden</h2>
        <p className="forbidden-desc">
          Your current role (<strong>{role || 'UNKNOWN'}</strong>) does not have sufficient permission to view this section.
          Required role: <strong>{allowedRoles.join(' or ')}</strong>.
        </p>
        <Link to="/profile" className="forbidden-cta">
          Return to Profile
        </Link>
      </div>
    );
  }

  return <Outlet />;
};
