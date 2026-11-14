import React, { useEffect, useState, useCallback } from 'react';
import { usersApi } from '../../features/users/users.api';
import { useAuth } from '../../features/auth/AuthContext';
import { useI18n } from '../../features/i18n/I18nContext';
import { UserProfile, Role } from '@cloud-stock/shared';
import { formatDate } from '../../lib/utils';
import { PasswordInput } from '../../components/common/PasswordInput/PasswordInput';
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
  const { t } = useI18n();
  const isAdmin = currentUserRole === 'ADMIN';

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState<UserProfile | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState<UserProfile | null>(null);

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
        message: err instanceof Error ? err.message : t('users.emptyDesc'),
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
        setNotification({ type: 'success', message: t('users.createdSuccess') });
        fetchUsers();
      } else {
        setNotification({
          type: 'error',
          message: res.error?.message || t('users.emptyDesc'),
        });
      }
    } catch (err) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : t('users.emptyDesc'),
      });
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
        setNotification({
          type: 'success',
          message: t('users.roleChangedSuccess', { role: newRole }),
        });
        fetchUsers();
      } else {
        setNotification({
          type: 'error',
          message: res.error?.message || t('users.emptyDesc'),
        });
      }
    } catch (err) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : t('users.emptyDesc'),
      });
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
        setNotification({ type: 'success', message: t('users.passwordResetSuccess') });
      } else {
        setNotification({
          type: 'error',
          message: res.error?.message || t('users.emptyDesc'),
        });
      }
    } catch (err) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : t('users.emptyDesc'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (user: UserProfile) => {
    const actionLabel = user.isActive
      ? t('warehouses.deactivateBtn').toLowerCase()
      : t('warehouses.activateBtn').toLowerCase();
    if (!window.confirm(t('users.confirmToggleStatus', { action: actionLabel, email: user.email }))) {
      return;
    }

    try {
      const res = await usersApi.changeUserStatus(user.id, !user.isActive);
      if (res.success) {
        const nextState = !user.isActive
          ? t('users.statusActive').toLowerCase()
          : t('users.statusLocked').toLowerCase();
        setNotification({
          type: 'success',
          message: t('users.statusChangedSuccess', { email: user.email, state: nextState }),
        });
        fetchUsers();
      } else {
        setNotification({
          type: 'error',
          message: res.error?.message || t('users.emptyDesc'),
        });
      }
    } catch (err) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : t('users.emptyDesc'),
      });
    }
  };

  return (
    <div className="users-page">
      <div className="page-header-actions">
        <div className="header-left">
          <h2 className="title">{t('users.title')}</h2>
          <p className="description">{t('users.subtitle')}</p>
        </div>

        {isAdmin && (
          <button className="primary-btn" onClick={() => setShowCreateModal(true)}>
            <UserPlus size={18} />
            <span>{t('users.createUserBtn')}</span>
          </button>
        )}
      </div>

      {notification && (
        <div className={notification.type === 'success' ? 'success-banner' : 'error-banner'} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={16} />
          <span>{notification.message}</span>
        </div>
      )}

      <div className="filters-bar">
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder={t('users.searchPlaceholder')}
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
          <option value="ALL">{t('users.allRoles')}</option>
          <option value="ADMIN">{t('roles.ADMIN')}</option>
          <option value="MANAGER">{t('roles.MANAGER')}</option>
          <option value="STAFF">{t('roles.STAFF')}</option>
        </select>

        <select
          className="select-filter"
          value={selectedStatus}
          onChange={(e) => {
            setSelectedStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="ALL">{t('users.allStatuses')}</option>
          <option value="ACTIVE">{t('users.activeOnly')}</option>
          <option value="INACTIVE">{t('users.inactiveOnly')}</option>
        </select>

        <button
          onClick={() => fetchUsers()}
          style={{
            padding: '0.5rem 0.75rem',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '0.5rem',
            color: 'var(--color-text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            cursor: 'pointer',
          }}
          title={t('common.refresh')}
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          <span>{t('common.refresh')}</span>
        </button>
      </div>

      <div className="table-card">
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>{t('users.colIdentity')}</th>
                <th>{t('users.colRole')}</th>
                <th>{t('users.colStatus')}</th>
                <th>{t('users.colLastActive')}</th>
                <th>{t('users.colRegistered')}</th>
                {isAdmin && <th>{t('users.colActions')}</th>}
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td
                    colSpan={isAdmin ? 6 : 5}
                    style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}
                  >
                    {isLoading ? t('users.loading') : t('users.emptyDesc')}
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
                        {u.isActive ? t('users.statusActive') : t('users.statusLocked')}
                      </span>
                    </td>
                    <td>{u.lastLoginAt ? formatDate(u.lastLoginAt) : t('users.neverLoggedIn')}</td>
                    <td>{formatDate(u.createdAt)}</td>
                    {isAdmin && (
                      <td>
                        <div className="action-buttons">
                          <button
                            className="icon-btn"
                            title={t('users.changeRoleTooltip')}
                            onClick={() => {
                              setShowRoleModal(u);
                              setNewRole(u.role);
                            }}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            className="icon-btn"
                            title={t('users.resetPasswordTooltip')}
                            onClick={() => {
                              setShowPasswordModal(u);
                              setNewPassword('');
                            }}
                          >
                            <KeyRound size={14} />
                          </button>
                          <button
                            className={`icon-btn ${u.isActive ? 'danger' : ''}`}
                            title={
                              u.isActive
                                ? t('users.deactivateTooltip')
                                : t('users.activateTooltip')
                            }
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

        <div className="pagination">
          <span>{t('common.showingOf', { count: users.length, total })}</span>
          <div className="btn-group">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              {t('common.previous')}
            </button>
            <span style={{ padding: '0.35rem 0.75rem' }}>
              {t('common.pageOf', { page, total: totalPages })}
            </span>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              {t('common.next')}
            </button>
          </div>
        </div>
      </div>

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="title">{t('users.createModalTitle')}</h3>
                <p className="modal-subtitle">{t('users.createModalSubtitle')}</p>
              </div>
              <button className="close-btn" onClick={() => setShowCreateModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="modal-form">
              <div className="form-group">
                <label>{t('users.fullNameLabel')}</label>
                <input
                  type="text"
                  required
                  placeholder="Nguyen Van A"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>{t('users.emailLabel')}</label>
                <input
                  type="email"
                  required
                  placeholder="user@cloudstock.dev"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>{t('users.passwordLabel')}</label>
                <PasswordInput
                  required
                  placeholder={t('users.passwordPlaceholder')}
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  autoComplete="new-password"
                />
              </div>

              <div className="form-group">
                <label>{t('users.roleLabel')}</label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as Role })}
                >
                  <option value={Role.STAFF}>{t('roles.STAFF')}</option>
                  <option value={Role.MANAGER}>{t('roles.MANAGER')}</option>
                  <option value={Role.ADMIN}>{t('roles.ADMIN')}</option>
                </select>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setShowCreateModal(false)}
                >
                  {t('common.cancel')}
                </button>
                <button type="submit" className="save-btn" disabled={isSubmitting}>
                  {isSubmitting ? t('users.creatingSubmit') : t('users.createAccountSubmit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRoleModal && (
        <div className="modal-overlay" onClick={() => setShowRoleModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="title">{t('users.roleModalTitle')}</h3>
                <p className="modal-subtitle">{showRoleModal.name}</p>
              </div>
              <button className="close-btn" onClick={() => setShowRoleModal(null)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleChangeRole} className="modal-form">
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', margin: 0 }}>
                {t('users.roleModalPrompt', { email: showRoleModal.email })}
              </p>
              <div className="form-group">
                <label>{t('users.newRoleLabel')}</label>
                <select value={newRole} onChange={(e) => setNewRole(e.target.value as Role)}>
                  <option value={Role.STAFF}>{t('roles.STAFF')}</option>
                  <option value={Role.MANAGER}>{t('roles.MANAGER')}</option>
                  <option value={Role.ADMIN}>{t('roles.ADMIN')}</option>
                </select>
              </div>

              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={() => setShowRoleModal(null)}>
                  {t('common.cancel')}
                </button>
                <button type="submit" className="save-btn" disabled={isSubmitting}>
                  {isSubmitting ? t('users.updatingBtn') : t('users.saveRoleBtn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPasswordModal && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="title">{t('users.passwordModalTitle')}</h3>
                <p className="modal-subtitle">{showPasswordModal.email}</p>
              </div>
              <button className="close-btn" onClick={() => setShowPasswordModal(null)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleResetPassword} className="modal-form">
              <p style={{ color: 'var(--color-danger-text)', fontSize: '0.85rem', margin: 0 }}>
                {t('users.passwordModalPrompt', { email: showPasswordModal.email })}
              </p>
              <div className="form-group">
                <label>{t('users.newPasswordLabel')}</label>
                <PasswordInput
                  required
                  placeholder={t('users.newPasswordPlaceholder')}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setShowPasswordModal(null)}
                >
                  {t('common.cancel')}
                </button>
                <button type="submit" className="save-btn" disabled={isSubmitting}>
                  {isSubmitting ? t('users.updatingBtn') : t('users.resetPasswordBtn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
