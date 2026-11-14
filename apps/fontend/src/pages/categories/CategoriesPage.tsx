import React, { useState, useEffect, useCallback } from 'react';
import { Category } from '@cloud-stock/shared';
import { catalogApi } from '../../features/catalog/catalog.api';
import { useAuth } from '../../features/auth/AuthContext';
import { useI18n } from '../../features/i18n/I18nContext';
import {
  Layers,
  Search,
  Plus,
  Edit2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Package,
  X,
  RefreshCw,
} from 'lucide-react';
import './CategoriesPage.scss';

export const CategoriesPage: React.FC = () => {
  const { role } = useAuth();
  const { t, lang } = useI18n();
  const canManage = role === 'ADMIN' || role === 'MANAGER';

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Status & Notifications
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const filterActive =
        statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined;
      const res = await catalogApi.getCategories({
        search: search.trim() || undefined,
        isActive: filterActive,
      });

      if (res.success && res.data) {
        setCategories(res.data);
      } else {
        setErrorMsg(res.error?.message || 'Failed to load categories');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error fetching categories');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleOpenCreateModal = () => {
    setEditingCategory(null);
    setName('');
    setSlug('');
    setDescription('');
    setIsActive(true);
    setErrorMsg(null);
    setModalOpen(true);
  };

  const handleOpenEditModal = (cat: Category) => {
    setEditingCategory(cat);
    setName(cat.name);
    setSlug(cat.slug);
    setDescription(cat.description || '');
    setIsActive(cat.isActive);
    setErrorMsg(null);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingCategory(null);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg(t('categories.nameRequiredError'));
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      if (editingCategory) {
        const res = await catalogApi.updateCategory(editingCategory.id, {
          name: name.trim(),
          slug: slug.trim() || undefined,
          description: description.trim() || null,
          isActive,
        });

        if (res.success) {
          setSuccessMsg(t('categories.updatedSuccess', { name: name.trim() }));
          handleCloseModal();
          fetchCategories();
        } else {
          setErrorMsg(res.error?.message || t('categories.emptyDesc'));
        }
      } else {
        const res = await catalogApi.createCategory({
          name: name.trim(),
          slug: slug.trim() || undefined,
          description: description.trim() || null,
          isActive,
        });

        if (res.success) {
          setSuccessMsg(t('categories.createdSuccess', { name: name.trim() }));
          handleCloseModal();
          fetchCategories();
        } else {
          setErrorMsg(res.error?.message || t('categories.emptyDesc'));
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t('categories.emptyDesc'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (cat: Category) => {
    if (!canManage) return;
    setErrorMsg(null);

    try {
      const nextStatus = !cat.isActive;
      const res = await catalogApi.updateCategoryStatus(cat.id, nextStatus);

      if (res.success) {
        setSuccessMsg(
          nextStatus
            ? t('categories.activatedSuccess', { name: cat.name })
            : t('categories.deactivatedSuccess', { name: cat.name })
        );
        fetchCategories();
      } else {
        setErrorMsg(res.error?.message || t('categories.emptyDesc'));
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t('categories.emptyDesc'));
    }
  };

  return (
    <div className="categories-page">
      {/* Top Header */}
      <div className="page-header-actions">
        <div className="header-left">
          <h2 className="title">{t('categories.title')}</h2>
          <p className="description">{t('categories.subtitle')}</p>
        </div>

        {canManage && (
          <button className="primary-btn" onClick={handleOpenCreateModal}>
            <Plus size={16} />
            <span>{t('categories.addCategory')}</span>
          </button>
        )}
      </div>

      {/* Alerts */}
      {errorMsg && (
        <div className="alert-banner error">
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
          <button className="close-btn" onClick={() => setErrorMsg(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="alert-banner success">
          <CheckCircle size={18} />
          <span>{successMsg}</span>
          <button className="close-btn" onClick={() => setSuccessMsg(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Filters Bar */}
      <div className="filters-bar">
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder={t('categories.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-select">
          <label>{t('common.status')}:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
          >
            <option value="all">{t('categories.statusAll')}</option>
            <option value="active">{t('categories.statusActive')}</option>
            <option value="inactive">{t('categories.statusInactive')}</option>
          </select>
        </div>

        <button className="refresh-btn" onClick={fetchCategories} title={t('common.refresh')}>
          <RefreshCw size={16} className={loading ? 'spinning' : ''} />
        </button>
      </div>

      {/* Data Table */}
      <div className="table-card">
        {loading ? (
          <div className="loading-state">
            <RefreshCw className="spinner" size={28} />
            <p>{t('categories.loading')}</p>
          </div>
        ) : categories.length === 0 ? (
          <div className="empty-state">
            <Layers size={40} className="empty-icon" />
            <h3>{t('categories.emptyTitle')}</h3>
            <p>{t('categories.emptyDesc')}</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>{t('categories.colName')}</th>
                  <th>{t('categories.colSlug')}</th>
                  <th>{t('categories.colDescription')}</th>
                  <th>{t('categories.colProducts')}</th>
                  <th>{t('categories.colStatus')}</th>
                  <th>{t('categories.colCreated')}</th>
                  {canManage && <th>{t('categories.colActions')}</th>}
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => (
                  <tr key={cat.id}>
                    <td className="font-semibold text-primary">
                      <div className="cat-name-cell">
                        <Layers size={16} className="cat-icon" />
                        <span>{cat.name}</span>
                      </div>
                    </td>
                    <td>
                      <code className="slug-badge">{cat.slug}</code>
                    </td>
                    <td className="text-muted">
                      {cat.description || <span className="italic">{t('common.noDescription')}</span>}
                    </td>
                    <td>
                      <span className="product-count-badge">
                        <Package size={13} />
                        <span>{cat._count?.products ?? 0}</span>
                      </span>
                    </td>
                    <td>
                      <span className={`status-pill ${cat.isActive ? 'active' : 'inactive'}`}>
                        {cat.isActive ? (
                          <>
                            <CheckCircle size={12} />
                            <span>{t('common.active')}</span>
                          </>
                        ) : (
                          <>
                            <XCircle size={12} />
                            <span>{t('common.inactive')}</span>
                          </>
                        )}
                      </span>
                    </td>
                    <td className="text-muted">
                      {new Date(cat.createdAt).toLocaleDateString(
                        lang === 'vi' ? 'vi-VN' : 'en-US'
                      )}
                    </td>
                    {canManage && (
                      <td>
                        <div className="action-buttons">
                          <button
                            className="icon-action-btn edit"
                            onClick={() => handleOpenEditModal(cat)}
                            title={t('categories.editCategory')}
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            className={`icon-action-btn toggle ${cat.isActive ? 'deactivate' : 'activate'}`}
                            onClick={() => handleToggleStatus(cat)}
                            title={
                              cat.isActive
                                ? t('categories.deactivateTooltip')
                                : t('categories.activateTooltip')
                            }
                          >
                            {cat.isActive ? <XCircle size={15} /> : <CheckCircle size={15} />}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Dialog for Create/Edit */}
      {modalOpen && (
        <div className="modal-backdrop">
          <div className="modal-container">
            <div className="modal-header">
              <div>
                <h3>
                  {editingCategory ? t('categories.editCategory') : t('categories.createCategory')}
                </h3>
                <p className="modal-subtitle">{t('categories.modalSubtitle')}</p>
              </div>
              <button className="modal-close" onClick={handleCloseModal}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="modal-form">
              <div className="form-group">
                <label>{t('categories.nameLabel')}</label>
                <input
                  type="text"
                  required
                  placeholder={t('categories.namePlaceholder')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>{t('categories.slugLabel')}</label>
                <input
                  type="text"
                  placeholder={t('categories.slugPlaceholder')}
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                />
                <span className="help-text">{t('categories.slugHelp')}</span>
              </div>

              <div className="form-group">
                <label>{t('categories.descriptionLabel')}</label>
                <textarea
                  rows={3}
                  placeholder={t('categories.descriptionPlaceholder')}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                  />
                  <span>{t('categories.activeLabel')}</span>
                </label>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={handleCloseModal}
                  disabled={isSubmitting}
                >
                  {t('common.cancel')}
                </button>
                <button type="submit" className="submit-btn" disabled={isSubmitting}>
                  {isSubmitting
                    ? t('categories.saving')
                    : editingCategory
                    ? t('common.save')
                    : t('categories.createSubmit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
