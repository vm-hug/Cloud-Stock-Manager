import React, { useState, useEffect, useCallback } from 'react';
import { Category } from '@cloud-stock/shared';
import { catalogApi } from '../../features/catalog/catalog.api';
import { useAuth } from '../../features/auth/AuthContext';
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
      setErrorMsg('Category name is required');
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
          setSuccessMsg(`Category '${name}' updated successfully.`);
          handleCloseModal();
          fetchCategories();
        } else {
          setErrorMsg(res.error?.message || 'Failed to update category');
        }
      } else {
        const res = await catalogApi.createCategory({
          name: name.trim(),
          slug: slug.trim() || undefined,
          description: description.trim() || null,
          isActive,
        });

        if (res.success) {
          setSuccessMsg(`Category '${name}' created successfully.`);
          handleCloseModal();
          fetchCategories();
        } else {
          setErrorMsg(res.error?.message || 'Failed to create category');
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'An unexpected error occurred');
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
          `Category '${cat.name}' ${nextStatus ? 'activated' : 'deactivated'} successfully.`
        );
        fetchCategories();
      } else {
        setErrorMsg(res.error?.message || 'Failed to toggle category status');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error updating status');
    }
  };

  return (
    <div className="categories-page">
      {/* Top Header */}
      <div className="page-header-actions">
        <div className="header-left">
          <h2 className="title">Categories</h2>
          <p className="description">
            Organize catalog products into structured classification groups with invariant safety
          </p>
        </div>

        {canManage && (
          <button className="primary-btn" onClick={handleOpenCreateModal}>
            <Plus size={16} />
            <span>Add Category</span>
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
            placeholder="Search by category name or slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-select">
          <label>Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>

        <button className="refresh-btn" onClick={fetchCategories} title="Refresh">
          <RefreshCw size={16} className={loading ? 'spinning' : ''} />
        </button>
      </div>

      {/* Data Table */}
      <div className="table-card">
        {loading ? (
          <div className="loading-state">
            <RefreshCw className="spinner" size={28} />
            <p>Loading categories...</p>
          </div>
        ) : categories.length === 0 ? (
          <div className="empty-state">
            <Layers size={40} className="empty-icon" />
            <h3>No categories found</h3>
            <p>Try adjusting your search criteria or create a new category.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Category Name</th>
                  <th>Slug</th>
                  <th>Description</th>
                  <th>Products</th>
                  <th>Status</th>
                  <th>Created At</th>
                  {canManage && <th>Actions</th>}
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
                      {cat.description || <span className="italic">No description</span>}
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
                            <span>Active</span>
                          </>
                        ) : (
                          <>
                            <XCircle size={12} />
                            <span>Inactive</span>
                          </>
                        )}
                      </span>
                    </td>
                    <td className="text-muted">{new Date(cat.createdAt).toLocaleDateString()}</td>
                    {canManage && (
                      <td>
                        <div className="action-buttons">
                          <button
                            className="icon-action-btn edit"
                            onClick={() => handleOpenEditModal(cat)}
                            title="Edit Category"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            className={`icon-action-btn toggle ${cat.isActive ? 'deactivate' : 'activate'}`}
                            onClick={() => handleToggleStatus(cat)}
                            title={cat.isActive ? 'Deactivate Category' : 'Activate Category'}
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
              <h3>{editingCategory ? 'Edit Category' : 'Create New Category'}</h3>
              <button className="modal-close" onClick={handleCloseModal}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="modal-form">
              <div className="form-group">
                <label>Category Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Menswear, Electronics, Industrial..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Custom Slug (Optional)</label>
                <input
                  type="text"
                  placeholder="Leave blank to auto-generate from name"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                />
                <span className="help-text">Unique URL-friendly identifier</span>
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  rows={3}
                  placeholder="Provide an optional description..."
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
                  <span>Active Category (available for products)</span>
                </label>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={handleCloseModal}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button type="submit" className="submit-btn" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : editingCategory ? 'Save Changes' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
