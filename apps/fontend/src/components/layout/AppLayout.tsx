import React, { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';
import { useTheme } from '../../features/theme/ThemeContext';
import { useI18n } from '../../features/i18n/I18nContext';
import { useNotifications, AppNotificationItem } from '../../features/notifications/NotificationContext';
import {
  Users,
  History,
  Activity,
  UserCheck,
  LogOut,
  Boxes,
  Home,
  Layers,
  Package,
  Building2,
  Warehouse as WarehouseIcon,
  AlertTriangle,
  FileText,
  Clock,
  ArrowRightLeft,
  UploadCloud,
  Sun,
  Moon,
  Globe,
  ChevronDown,
  Menu,
  X,
  Bell,
  CheckCheck,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import './AppLayout.scss';

export const AppLayout: React.FC = () => {
  const { user, role, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { lang, toggleLang, t } = useI18n();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifMenuOpen, setNotifMenuOpen] = useState(false);
  const [notifFilter, setNotifFilter] = useState<'ALL' | 'UNREAD'>('ALL');
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [user?.avatarUrl]);

  useEffect(() => {
    setMobileNavOpen(false);
    setUserMenuOpen(false);
    setNotifMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(event.target as Node)) {
        setNotifMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const filteredNotifications =
    notifFilter === 'UNREAD' ? notifications.filter((n) => !n.read) : notifications;

  const formatNotifTime = (iso: string) => {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return lang === 'vi' ? 'Vừa xong' : 'Just now';
    if (mins < 60) return lang === 'vi' ? `${mins} phút trước` : `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return lang === 'vi' ? `${hours} giờ trước` : `${hours}h ago`;
    return new Date(iso).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US');
  };

  const renderNotifIcon = (type: AppNotificationItem['type']) => {
    switch (type) {
      case 'PENDING_APPROVAL':
        return (
          <span className="notif-type-icon pending">
            <Clock size={15} />
          </span>
        );
      case 'DOCUMENT_APPROVED':
        return (
          <span className="notif-type-icon approved">
            <CheckCircle2 size={15} />
          </span>
        );
      case 'DOCUMENT_REJECTED':
        return (
          <span className="notif-type-icon rejected">
            <XCircle size={15} />
          </span>
        );
      case 'LOW_STOCK_ALERT':
        return (
          <span className="notif-type-icon alert">
            <AlertTriangle size={15} />
          </span>
        );
      default:
        return (
          <span className="notif-type-icon info">
            <Bell size={15} />
          </span>
        );
    }
  };

  const handleLogout = async () => {
    setUserMenuOpen(false);
    await logout();
    navigate('/login');
  };

  const getPageTitle = () => {
    if (location.pathname.startsWith('/dashboard')) return t('nav.workspaceHome');
    if (location.pathname.startsWith('/warehouses')) return t('pageTitles.warehouses');
    if (location.pathname.startsWith('/inventory/low-stock')) return t('pageTitles.lowStock');
    if (location.pathname.startsWith('/inventory')) return t('pageTitles.inventory');
    if (location.pathname.startsWith('/stock-documents')) return t('pageTitles.stockDocuments');
    if (location.pathname.startsWith('/approvals')) return t('pageTitles.approvals');
    if (location.pathname.startsWith('/movements')) return t('pageTitles.movements');
    if (location.pathname.startsWith('/import-export')) return t('pageTitles.importExport');
    if (location.pathname.startsWith('/categories')) return t('pageTitles.categories');
    if (location.pathname.startsWith('/products')) return t('pageTitles.products');
    if (location.pathname.startsWith('/users')) return t('pageTitles.users');
    if (location.pathname.startsWith('/audit-logs')) return t('pageTitles.auditLogs');
    if (location.pathname.startsWith('/system/health')) return t('pageTitles.systemHealth');
    if (location.pathname.startsWith('/profile')) return t('pageTitles.profile');
    return t('pageTitles.default');
  };

  const roleLabel = role ? t(`roles.${role}`) : '';

  const renderAvatar = (sizeClass: 'sm' | 'md') => {
    if (user?.avatarUrl && !avatarLoadFailed) {
      return (
        <img
          src={user.avatarUrl}
          alt={user.name}
          className={`user-avatar-img ${sizeClass}`}
          onError={() => setAvatarLoadFailed(true)}
        />
      );
    }
    return (
      <div className={`avatar-fallback ${sizeClass}`}>
        {user?.name?.charAt(0).toUpperCase() || '?'}
      </div>
    );
  };

  return (
    <div className="layout-wrapper">
      {mobileNavOpen && (
        <div
          className="sidebar-mobile-backdrop"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`sidebar ${mobileNavOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="brand-icon">
            <Boxes size={20} />
          </div>
          <div className="brand-copy">
            <div className="brand-name">Cloud Stock</div>
            <div className="brand-phase">Enterprise Inventory</div>
          </div>
          <button
            type="button"
            className="mobile-close-btn"
            onClick={() => setMobileNavOpen(false)}
            aria-label={t('common.toggleMenu')}
          >
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-nav">
          <NavLink to="/dashboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
            <Home size={18} />
            <span>{t('nav.workspaceHome')}</span>
          </NavLink>

          <div className="nav-label">{t('nav.sectionWorkspace')}</div>

          <NavLink to="/warehouses" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Building2 size={18} />
            <span>{t('nav.warehouses')}</span>
          </NavLink>

          <NavLink to="/inventory" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
            <WarehouseIcon size={18} />
            <span>{t('nav.inventoryBalances')}</span>
          </NavLink>

          <NavLink to="/inventory/low-stock" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <AlertTriangle size={18} />
            <span>{t('nav.lowStockAlerts')}</span>
          </NavLink>

          <NavLink to="/stock-documents" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <FileText size={18} />
            <span>{t('nav.stockDocuments')}</span>
          </NavLink>

          {(role === 'ADMIN' || role === 'MANAGER') && (
            <NavLink to="/approvals" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Clock size={18} />
              <span>{t('nav.approvalQueue')}</span>
            </NavLink>
          )}

          <NavLink to="/movements" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <ArrowRightLeft size={18} />
            <span>{t('nav.movementsLedger')}</span>
          </NavLink>

          <NavLink to="/import-export" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <UploadCloud size={18} />
            <span>{t('nav.importExport')}</span>
          </NavLink>

          <div className="nav-label">{t('nav.sectionCatalog')}</div>

          <NavLink to="/categories" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Layers size={18} />
            <span>{t('nav.categories')}</span>
          </NavLink>

          <NavLink to="/products" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Package size={18} />
            <span>{t('nav.productsSkus')}</span>
          </NavLink>

          {(role === 'ADMIN' || role === 'MANAGER') && (
            <div className="nav-label">{t('nav.sectionIdentity')}</div>
          )}

          {(role === 'ADMIN' || role === 'MANAGER') && (
            <NavLink to="/users" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Users size={18} />
              <span>{t('nav.userDirectory')}</span>
            </NavLink>
          )}

          {role === 'ADMIN' && (
            <>
              <NavLink to="/audit-logs" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <History size={18} />
                <span>{t('nav.auditLogs')}</span>
              </NavLink>

              <NavLink to="/system/health" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <Activity size={18} />
                <span>{t('nav.cloudHealth')}</span>
              </NavLink>
            </>
          )}

          <div className="nav-label">{t('nav.sectionAccount')}</div>

          <NavLink to="/profile" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <UserCheck size={18} />
            <span>{t('nav.myProfile')}</span>
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          {user && (
            <div className="user-card">
              {renderAvatar('sm')}
              <div className="info">
                <div className="name" title={user.name}>{user.name}</div>
                <span className={`role-tag ${user.role}`}>{roleLabel}</span>
              </div>
            </div>
          )}
          <button type="button" className="logout-btn" onClick={handleLogout}>
            <LogOut size={16} />
            <span>{t('common.signOut')}</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="mobile-menu-btn"
              onClick={() => setMobileNavOpen(true)}
              aria-label={t('common.toggleMenu')}
            >
              <Menu size={20} />
            </button>
            <h1 className="page-title">{getPageTitle()}</h1>
          </div>

          <div className="topbar-right">
            {/* Notification Bell + Badge + Dropdown right next to Language Switcher */}
            <div className="header-notif-wrapper" ref={notifMenuRef}>
              <button
                type="button"
                className={`header-control-btn icon-only notif-trigger ${
                  notifMenuOpen ? 'active' : ''
                } ${unreadCount > 0 ? 'has-unread' : ''}`}
                onClick={() => setNotifMenuOpen((prev) => !prev)}
                aria-label={lang === 'vi' ? 'Thông báo' : 'Notifications'}
                title={lang === 'vi' ? 'Thông báo hệ thống' : 'System Notifications'}
              >
                <Bell size={16} />
                {unreadCount > 0 && (
                  <span className="notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                )}
              </button>

              {notifMenuOpen && (
                <div className="header-notif-dropdown" role="dialog">
                  <div className="notif-dropdown-header">
                    <div className="notif-title-row">
                      <span className="notif-title">
                        {lang === 'vi' ? 'Thông báo' : 'Notifications'}
                      </span>
                      {unreadCount > 0 && (
                        <span className="notif-unread-pill">
                          {unreadCount} {lang === 'vi' ? 'mới' : 'new'}
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        className="notif-mark-all-btn"
                        onClick={markAllAsRead}
                      >
                        <CheckCheck size={13} />
                        <span>{lang === 'vi' ? 'Đọc tất cả' : 'Mark all read'}</span>
                      </button>
                    )}
                  </div>

                  <div className="notif-filter-tabs">
                    <button
                      type="button"
                      className={notifFilter === 'ALL' ? 'active' : ''}
                      onClick={() => setNotifFilter('ALL')}
                    >
                      {lang === 'vi' ? 'Tất cả' : 'All'} ({notifications.length})
                    </button>
                    <button
                      type="button"
                      className={notifFilter === 'UNREAD' ? 'active' : ''}
                      onClick={() => setNotifFilter('UNREAD')}
                    >
                      {lang === 'vi' ? 'Chưa đọc' : 'Unread'} ({unreadCount})
                    </button>
                  </div>

                  <div className="notif-list">
                    {filteredNotifications.length === 0 ? (
                      <div className="notif-empty">
                        <Bell size={24} />
                        <p>
                          {lang === 'vi'
                            ? 'Hiện không có thông báo nào.'
                            : 'No notifications right now.'}
                        </p>
                      </div>
                    ) : (
                      filteredNotifications.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          className={`notif-item ${!n.read ? 'unread' : ''}`}
                          onClick={() => {
                            markAsRead(n.id);
                            setNotifMenuOpen(false);
                            navigate(n.link);
                          }}
                        >
                          {renderNotifIcon(n.type)}
                          <div className="notif-item-body">
                            <div className="notif-item-top">
                              <span className="notif-item-title">
                                {lang === 'vi' ? n.titleVi : n.titleEn}
                              </span>
                              <span className="notif-item-time">
                                {formatNotifTime(n.createdAt)}
                              </span>
                            </div>
                            <p className="notif-item-msg">
                              {lang === 'vi' ? n.messageVi : n.messageEn}
                            </p>
                          </div>
                          {!n.read && <span className="notif-unread-dot" />}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              className="header-control-btn"
              onClick={toggleLang}
              aria-label={t('common.language')}
              title={t('common.language')}
            >
              <Globe size={16} />
              <span className="control-label">{lang.toUpperCase()}</span>
            </button>

            <button
              type="button"
              className="header-control-btn icon-only"
              onClick={toggleTheme}
              aria-label={theme === 'light' ? t('common.switchToDark') : t('common.switchToLight')}
              title={theme === 'light' ? t('common.switchToDark') : t('common.switchToLight')}
            >
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>

            {user && (
              <div className="header-user-wrapper" ref={userMenuRef}>
                <button
                  type="button"
                  className="header-user-trigger"
                  onClick={() => setUserMenuOpen((prev) => !prev)}
                  aria-expanded={userMenuOpen}
                  aria-haspopup="menu"
                >
                  {renderAvatar('sm')}
                  <div className="header-user-meta">
                    <span className="header-user-name">{user.name}</span>
                    <span className={`header-role-pill ${user.role}`}>{roleLabel}</span>
                  </div>
                  <ChevronDown size={15} className={`chevron ${userMenuOpen ? 'open' : ''}`} />
                </button>

                {userMenuOpen && (
                  <div className="header-user-dropdown" role="menu">
                    <div className="dropdown-user-summary">
                      <div className="summary-name">{user.name}</div>
                      <div className="summary-email">{user.email}</div>
                    </div>
                    <button
                      type="button"
                      className="dropdown-item"
                      role="menuitem"
                      onClick={() => {
                        setUserMenuOpen(false);
                        navigate('/profile');
                      }}
                    >
                      <UserCheck size={15} />
                      <span>{t('nav.myProfile')}</span>
                    </button>
                    <button
                      type="button"
                      className="dropdown-item danger"
                      role="menuitem"
                      onClick={handleLogout}
                    >
                      <LogOut size={15} />
                      <span>{t('common.signOut')}</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        <main className="content-body">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
