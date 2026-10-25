import React, { useEffect, useState, useCallback } from 'react';
import { usersApi } from '../../features/users/users.api';
import { useAuth } from '../../features/auth/AuthContext';
import { UserProfile, Role } from '@cloud-stock/shared';
import { formatDate } from '../../lib/utils';
import {
  UserPlus,
  Search,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  Edit2,
  X,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import './UsersPage.scss';

export const UsersPage: React.FC = () => {
  const { role: currentUserRole } = useAuth();
  const isAdmin = currentUserRole === 'ADMIN';

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState<UserProfile | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState<UserProfile | null>(null);

  // Form states
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    password: '',
    role: Role.STAFF,
  });
  const [newRole, setNewRole] = useState<Role>(Role.STAFF);
  const [newPassword, setNewPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await usersApi.getUsers({
        page,
        limit: 10,
        search: search.trim() || undefined,
        role: selectedRole !== 'ALL' ? (selectedRole as Role) : undefined,
        isActive: selectedStatus === 'ALL' ? undefined : selectedStatus === 'ACTIVE',
      });

      if (res.success && res.data) {
        setUsers(res.data.items);
        setTotal(res.data.pagination.total);
        setTotalPages(res.data.pagination.totalPages);
      }
    } catch (err) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to load users list',
      });
    } finally {
      setIsLoading(false);
    }
  }, [page, search, selectedRole, selectedStatus]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setNotification(null);

    try {
      const res = await usersApi.createUser(createForm);
      if (res.success) {
        setShowCreateModal(false);
        setCreateForm({ name: '', email: '', password: '', role: Role.STAFF });
        setNotification({ type: 'success', message: 'Staff account created successfully!' });
        fetchUsers();
      } else {
        setNotification({ type: 'error', message: res.error?.message || 'Failed to create user' });
      }
    } catch (err) {
      setNotification({ type: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangeRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showRoleModal) return;
    setIsSubmitting(true);
    setNotification(null);

    try {
      const res = await usersApi.changeUserRole(showRoleModal.id, newRole);
      if (res.success) {
        setShowRoleModal(null);
        setNotification({ type: 'success', message: `Role changed to ${newRole} successfully!` });
        fetchUsers();
      } else {
        setNotification({ type: 'error', message: res.error?.message || 'Failed to change role' });
      }
    } catch (err) {
      setNotification({ type: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showPasswordModal) return;
    setIsSubmitting(true);
    setNotification(null);

    try {
      const res = await usersApi.resetUserPassword(showPasswordModal.id, newPassword);
      if (res.success) {
        setShowPasswordModal(null);
        setNewPassword('');
        setNotification({ type: 'success', message: 'Password reset and sessions revoked successfully!' });
      } else {
        setNotification({ type: 'error', message: res.error?.message || 'Failed to reset password' });
      }
    } catch (err) {
      setNotification({ type: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (user: UserProfile) => {
    const actionName = user.isActive ? 'deactivate' : 'activate';
    if (!window.confirm(`Are you sure you want to ${actionName} account "${user.email}"?`)) {
      return;
    }

    try {
      const res = await usersApi.changeUserStatus(user.id, !user.isActive);
      if (res.success) {
        setNotification({
          type: 'success',
          message: `User ${user.email} ${!user.isActive ? 'activated' : 'deactivated'} successfully!`,
        });
        fetchUsers();
      } else {
        setNotification({ type: 'error', message: res.error?.message || `Failed to ${actionName} user` });
      }
    } catch (err) {
      setNotification({ type: 'error', message: err instanceof Error ? err.message : 'Operation failed' });
    }
  };

  return (
    <div className="users-page">
      {/* Top Header & Actions */}
      <div className="page-header-actions">
        <div className="header-left">
          <h2 className="title">User & Staff Directory</h2>
          <p className="description">
            Enterprise Role-Based Access Control (RBAC). Admin & Manager supervision view.
          </p>
        </div>

        {isAdmin && (
          <button className="primary-btn" onClick={() => setShowCreateModal(true)}>
            <UserPlus size={18} />
            <span>Create New User</span>
          </button>
        )}
      </div>

      {notification && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
            background: notification.type === 'success' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${notification.type === 'success' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            color: notification.type === 'success' ? '#4ade80' : '#f87171',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.875rem',
          }}
        >
          <AlertCircle size={16} />
          <span>{notification.message}</span>
        </div>
      )}

      {/* Filters Toolbar */}
      <div className="filters-bar">
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search by full name or email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <select
          className="select-filter"
          value={selectedRole}
          onChange={(e) => {
            setSelectedRole(e.target.value);
            setPage(1);
          }}
        >
          <option value="ALL">All Roles</option>
          <option value="ADMIN">ADMIN</option>
          <option value="MANAGER">MANAGER</option>
          <option value="STAFF">STAFF</option>
        </select>

        <select
          className="select-filter"
          value={selectedStatus}
          onChange={(e) => {
            setSelectedStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="ALL">All Statuses</option>
          <option value="ACTIVE">Active Only</option>
          <option value="INACTIVE">Deactivated Only</option>
        </select>

        <button
          onClick={() => fetchUsers()}
          style={{ padding: '0.5rem 0.75rem', background: 'transparent', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '0.375rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
          title="Refresh List"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Users Table */}
      <div className="table-card">
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>User Identity</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Active</th>
                <th>Registered</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                    {isLoading ? 'Loading staff records...' : 'No users found matching query filters.'}
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="user-cell">
                        <div className="user-avatar">{u.name.charAt(0).toUpperCase()}</div>
                        <div className="user-details">
                          <div className="name">{u.name}</div>
                          <div className="email">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`badge badge--${u.role.toLowerCase()}`}>{u.role}</span>
                    </td>
                    <td>
                      <span className={`status-pill ${u.isActive ? 'active' : 'inactive'}`}>
                        {u.isActive ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />}
                        {u.isActive ? 'Active' : 'Locked'}
                      </span>
                    </td>
                    <td>{u.lastLoginAt ? formatDate(u.lastLoginAt) : 'Never logged in'}</td>
                    <td>{formatDate(u.createdAt)}</td>
                    {isAdmin && (
                      <td>
                        <div className="action-buttons">
                          <button
                            className="icon-btn"
                            title="Change Role"
                            onClick={() => {
                              setShowRoleModal(u);
                              setNewRole(u.role);
                            }}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            className="icon-btn"
                            title="Reset Password"
                            onClick={() => {
                              setShowPasswordModal(u);
                              setNewPassword('');
                            }}
                          >
                            <KeyRound size={14} />
                          </button>
                          <button
                            className={`icon-btn ${u.isActive ? 'danger' : ''}`}
                            title={u.isActive ? 'Deactivate Account' : 'Reactivate Account'}
                            onClick={() => handleToggleStatus(u)}
                          >
                            {u.isActive ? <ShieldAlert size={14} /> : <ShieldCheck size={14} />}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="pagination">
          <span>
            Showing {users.length} of {total} registered personnel
          </span>
          <div className="btn-group">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <span style={{ padding: '0.35rem 0.75rem' }}>
              Page {page} of {totalPages}
            </span>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Create User */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="title">Create Personnel Account</h3>
              <button className="close-btn" onClick={() => setShowCreateModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="modal-form">
              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Corporate Email</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. jdoe@cloudstock.dev"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Initial Temporary Password (min 8 chars, 1 upper, 1 lower, 1 digit, 1 special)</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>System Role Assignment</label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as Role })}
                >
                  <option value={Role.STAFF}>STAFF (Operational inventory only)</option>
                  <option value={Role.MANAGER}>MANAGER (Inventory supervisor & staff directory)</option>
                  <option value={Role.ADMIN}>ADMIN (Full system & security authority)</option>
                </select>
              </div>

              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="save-btn" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Change Role */}
      {showRoleModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="title">Change Role for {showRoleModal.name}</h3>
              <button className="close-btn" onClick={() => setShowRoleModal(null)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleChangeRole} className="modal-form">
              <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                Note: Changing role will automatically revoke all existing sessions for this user.
              </p>
              <div className="form-group">
                <label>New Role</label>
                <select value={newRole} onChange={(e) => setNewRole(e.target.value as Role)}>
                  <option value={Role.STAFF}>STAFF</option>
                  <option value={Role.MANAGER}>MANAGER</option>
                  <option value={Role.ADMIN}>ADMIN</option>
                </select>
              </div>

              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={() => setShowRoleModal(null)}>
                  Cancel
                </button>
                <button type="submit" className="save-btn" disabled={isSubmitting}>
                  {isSubmitting ? 'Updating...' : 'Save Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reset Password */}
      {showPasswordModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="title">Reset Password: {showPasswordModal.email}</h3>
              <button className="close-btn" onClick={() => setShowPasswordModal(null)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleResetPassword} className="modal-form">
              <p style={{ color: '#f87171', fontSize: '0.85rem' }}>
                Warning: Resetting password will immediately invalidate all active sessions across all devices for this account.
              </p>
              <div className="form-group">
                <label>New Password (min 8 chars, 1 upper, 1 lower, 1 digit, 1 special)</label>
                <input
                  type="password"
                  required
                  placeholder="NewStrongPassword123!"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={() => setShowPasswordModal(null)}>
                  Cancel
                </button>
                <button type="submit" className="save-btn" disabled={isSubmitting}>
                  {isSubmitting ? 'Resetting...' : 'Reset & Revoke Sessions'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
