import React, { useState } from 'react';
import { useAuth } from '../../features/auth/AuthContext';
import { formatDate } from '../../lib/utils';
import { ShieldCheck, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './ProfilePage.scss';

export const ProfilePage: React.FC = () => {
  const { user, logoutAll } = useAuth();
  const navigate = useNavigate();
  const [isRevoking, setIsRevoking] = useState(false);

  if (!user) return null;

  const handleRevokeAll = async () => {
    if (!window.confirm('Are you sure you want to sign out from all active sessions across all devices?')) {
      return;
    }
    setIsRevoking(true);
    try {
      await logoutAll();
      navigate('/login');
    } catch {
      setIsRevoking(false);
    }
  };

  return (
    <div className="profile-page">
      <div className="profile-card">
        <div className="profile-top">
          <div className="large-avatar">{user.name.charAt(0).toUpperCase()}</div>
          <div className="user-titles">
            <h2 className="name">{user.name}</h2>
            <div className="email">{user.email}</div>
          </div>
        </div>

        <div className="details-grid">
          <div className="detail-item">
            <div className="label">Assigned System Role</div>
            <div className="value">
              <span className={`badge badge--${user.role.toLowerCase()}`}>{user.role}</span>
            </div>
          </div>

          <div className="detail-item">
            <div className="label">Account Status</div>
            <div className="value" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#4ade80' }}>
              <ShieldCheck size={16} />
              <span>{user.isActive ? 'Active & Authorized' : 'Locked'}</span>
            </div>
          </div>

          <div className="detail-item">
            <div className="label">Last Authentication</div>
            <div className="value">{user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Current active session'}</div>
          </div>

          <div className="detail-item">
            <div className="label">Member Since</div>
            <div className="value">{formatDate(user.createdAt)}</div>
          </div>
        </div>

        <div className="security-section">
          <h3 className="section-title">Session Security Management</h3>
          <p className="section-desc">
            If you suspect unauthorized access or have lost a connected device, you can terminate all active refresh
            sessions immediately. You will be redirected to re-authenticate.
          </p>
          <button className="revoke-all-btn" onClick={handleRevokeAll} disabled={isRevoking}>
            <LogOut size={16} />
            <span>{isRevoking ? 'Revoking Sessions...' : 'Sign Out of All Devices'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
