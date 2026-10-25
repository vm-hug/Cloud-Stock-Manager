import React from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';
import {
  Users,
  History,
  Activity,
  UserCheck,
  LogOut,
  Boxes,
  Home,
} from 'lucide-react';
import './AppLayout.scss';

export const AppLayout: React.FC = () => {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getPageTitle = () => {
    if (location.pathname.startsWith('/users')) return 'Staff & User Management';
    if (location.pathname.startsWith('/audit-logs')) return 'Security Audit Trail';
    if (location.pathname.startsWith('/system/health')) return 'Cloud Infrastructure Health';
    if (location.pathname.startsWith('/profile')) return 'My Profile & Session Security';
    return 'Cloud Stock Management';
  };

  return (
    <div className="layout-wrapper">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="brand-icon">
            <Boxes size={20} />
          </div>
          <div>
            <div className="brand-name">Cloud Stock</div>
            <div className="brand-phase">Phase 2 Security</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
            <Home size={18} />
            <span>Architecture Home</span>
          </NavLink>

          <div className="nav-label">Identity & Access</div>

          {(role === 'ADMIN' || role === 'MANAGER') && (
            <NavLink to="/users" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Users size={18} />
              <span>User Directory</span>
            </NavLink>
          )}

          {role === 'ADMIN' && (
            <>
              <NavLink to="/audit-logs" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <History size={18} />
                <span>Audit Logs</span>
              </NavLink>

              <NavLink to="/system/health" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <Activity size={18} />
                <span>Cloud Health</span>
              </NavLink>
            </>
          )}

          <div className="nav-label">Account</div>

          <NavLink to="/profile" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <UserCheck size={18} />
            <span>My Profile</span>
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          {user && (
            <div className="user-card">
              <div className="avatar">{user.name.charAt(0).toUpperCase()}</div>
              <div className="info">
                <div className="name" title={user.name}>{user.name}</div>
                <span className={`role-tag ${user.role}`}>{user.role}</span>
              </div>
            </div>
          )}
          <button className="logout-btn" onClick={handleLogout}>
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="main-content">
        <header className="topbar">
          <h1 className="page-title">{getPageTitle()}</h1>
          <div className="topbar-right">
            <div className="health-indicator">
              <span className="dot" />
              <span>Online • Modular Monolith</span>
            </div>
          </div>
        </header>

        <main className="content-body">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
