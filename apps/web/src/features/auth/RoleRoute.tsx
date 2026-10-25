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
      <div style={{ padding: '3rem 1.5rem', textAlign: 'center', maxWidth: 600, margin: '2rem auto' }}>
        <div style={{ display: 'inline-flex', padding: '1rem', background: 'rgba(239, 68, 68, 0.15)', borderRadius: '50%', color: '#f87171', marginBottom: '1.5rem' }}>
          <ShieldAlert size={48} />
        </div>
        <h2 style={{ fontSize: '1.75rem', marginBottom: '0.75rem', color: '#f1f5f9' }}>403 — Access Forbidden</h2>
        <p style={{ color: '#94a3b8', lineHeight: 1.6, marginBottom: '2rem' }}>
          Your current role (<strong>{role || 'UNKNOWN'}</strong>) does not have sufficient permission to view this section.
          Required role: <strong>{allowedRoles.join(' or ')}</strong>.
        </p>
        <Link
          to="/profile"
          style={{
            display: 'inline-block',
            padding: '0.625rem 1.25rem',
            background: '#4f46e5',
            color: '#fff',
            borderRadius: '0.5rem',
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          Return to Profile
        </Link>
      </div>
    );
  }

  return <Outlet />;
};
