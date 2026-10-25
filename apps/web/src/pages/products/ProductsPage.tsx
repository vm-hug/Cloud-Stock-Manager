import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Category, Product } from '@cloud-stock/shared';
import { catalogApi } from '../../features/catalog/catalog.api';
import { useAuth } from '../../features/auth/AuthContext';
import {
  Package,
  Search,
  Plus,
  Edit2,
  Trash2,
  RotateCcw,
  CheckCircle,
  XCircle,
  AlertCircle,
  ExternalLink,
  Layers,
  ChevronLeft,
  ChevronRight,
  X,
  RefreshCw,
  ImageIcon,
} from 'lucide-react';
import './ProductsPage.scss';

export const ProductsPage: React.FC = () => {
  const navigate = useNavigate();
  const { role } = useAuth();
  const canManage = role === 'ADMIN' || role === 'MANAGER';

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'deleted'>('all');
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Status & Feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Load categories for filter dropdown & create modal
  const fetchCategories = async () => {
    try {
      const res = await catalogApi.getCategories({ limit: 100 });
      if (res.success && res.data) {
        setCategories(res.data);
      }
    } catch {
      // Non-blocking
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      let filterActive: boolean | undefined = undefined;
      let includeDeleted: boolean | undefined = undefined;

      if (statusFilter === 'active') filterActive = true;
      if (statusFilter === 'inactive') filterActive = false;
      if (statusFilter === 'deleted') includeDeleted = true;

      const res = await catalogApi.getProducts({
        page,
        limit,
        search: search.trim() || undefined,
        categoryId: selectedCategory || undefined,
        isActive: filterActive,
        includeDeleted,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      if (res.success && res.data) {
        setProducts(res.data);
        if (res.pagination) {
          setTotalPages(res.pagination.totalPages);
          setTotalProducts(res.pagination.total);
        }
      } else {
        setErrorMsg(res.error?.message || 'Failed to fetch products');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error fetching products');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, selectedCategory, statusFilter]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleOpenCreateModal = () => {
    setEditingProduct(null);
    setName('');
    setCategoryId(categories.length > 0 ? categories[0].id : '');
    setSlug('');
    setDescription('');
    setIsActive(true);
    setErrorMsg(null);
    setModalOpen(true);
  };

  const handleOpenEditModal = (prod: Product) => {
    setEditingProduct(prod);
    setName(prod.name);
    setCategoryId(prod.categoryId);
    setSlug(prod.slug);
    setDescription(prod.description || '');
    setIsActive(prod.isActive);
    setErrorMsg(null);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingProduct(null);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Product name is required');
      return;
    }
    if (!categoryId) {
      setErrorMsg('Please select a valid Category');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      if (editingProduct) {
        const res = await catalogApi.updateProduct(editingProduct.id, {
          name: name.trim(),
          categoryId,
          slug: slug.trim() || undefined,
          description: description.trim() || null,
          isActive,
        });

        if (res.success) {
          setSuccessMsg(`Product '${name}' updated successfully.`);
          handleCloseModal();
          fetchProducts();
        } else {
          setErrorMsg(res.error?.message || 'Failed to update product');
        }
      } else {
        const res = await catalogApi.createProduct({
          name: name.trim(),
          categoryId,
          slug: slug.trim() || undefined,
          description: description.trim() || null,
          isActive,
        });

        if (res.success && res.data) {
          setSuccessMsg(`Product '${name}' created. Opening detail view...`);
          handleCloseModal();
          navigate(`/products/${res.data.id}`);
        } else {
          setErrorMsg(res.error?.message || 'Failed to create product');
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unexpected error saving product');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSoftDelete = async (prod: Product) => {
    if (!canManage) return;
    if (
      !window.confirm(
        `Are you sure you want to soft delete '${prod.name}'? All variants, images, and inventory history will be safely preserved.`
      )
    ) {
      return;
    }

    try {
      const res = await catalogApi.softDeleteProduct(prod.id);
      if (res.success) {
        setSuccessMsg(`Product '${prod.name}' soft deleted successfully.`);
        fetchProducts();
      } else {
        setErrorMsg(res.error?.message || 'Failed to soft delete product');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error deleting product');
    }
  };

  const handleRestore = async (prod: Product) => {
    if (!canManage) return;
    try {
      const res = await catalogApi.restoreProduct(prod.id);
      if (res.success) {
        setSuccessMsg(`Product '${prod.name}' restored successfully.`);
        fetchProducts();
      } else {
        setErrorMsg(res.error?.message || 'Failed to restore product');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error restoring product');
    }
  };

  return (
    <div className="products-page">
      {/* Page Header */}
      <div className="page-header-actions">
        <div className="header-left">
          <h2 className="title">Products & SKUs</h2>
          <p className="description">
            Manage product catalog, multi-SKU variants, and Cloudinary media assets
          </p>
        </div>

        {canManage && (
          <button className="primary-btn" onClick={handleOpenCreateModal}>
            <Plus size={16} />
            <span>Create Product</span>
          </button>
        )}
      </div>

      {/* Notifications */}
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
            placeholder="Search by product name, slug, SKU..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="filter-select">
          <label>Category:</label>
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-select">
          <label>Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as any);
              setPage(1);
            }}
          >
            <option value="all">Active & Inactive</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
            <option value="deleted">Include Deleted</option>
          </select>
        </div>

        <button className="refresh-btn" onClick={fetchProducts} title="Refresh">
          <RefreshCw size={16} className={loading ? 'spinning' : ''} />
        </button>
      </div>

      {/* Product Table Card */}
      <div className="table-card">
        {loading ? (
          <div className="loading-state">
            <RefreshCw className="spinner" size={28} />
            <p>Loading catalog items...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="empty-state">
            <Package size={40} className="empty-icon" />
            <h3>No products found</h3>
            <p>Try refining your filters or create your first product above.</p>
          </div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Variants</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((prod) => {
                    const primaryImg = prod.images?.[0];
                    const isDeleted = Boolean(prod.deletedAt);

                    return (
                      <tr key={prod.id} className={isDeleted ? 'row-deleted' : ''}>
                        <td>
                          <div className="product-cell">
                            <div className="thumb-container">
                              {primaryImg ? (
                                <img
                                  src={primaryImg.url}
                                  alt={primaryImg.altText || prod.name}
                                  className="product-thumb"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div className="thumb-placeholder">
                                  <ImageIcon size={18} />
                                </div>
                              )}
                            </div>
                            <div className="product-meta">
                              <span
                                className="product-name clickable"
                                onClick={() => navigate(`/products/${prod.id}`)}
                              >
                                {prod.name}
                              </span>
                              <code className="slug-text">{prod.slug}</code>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="category-tag">
                            <Layers size={13} />
                            <span>{prod.category?.name || 'Unassigned'}</span>
                          </span>
                        </td>
                        <td>
                          <span className="variant-count-pill">
                            {prod._count?.variants ?? 0} SKU(s)
                          </span>
                        </td>
                        <td>
                          {isDeleted ? (
                            <span className="status-pill deleted">Soft Deleted</span>
                          ) : prod.isActive ? (
                            <span className="status-pill active">
                              <CheckCircle size={12} /> Active
                            </span>
                          ) : (
                            <span className="status-pill inactive">
                              <XCircle size={12} /> Inactive
                            </span>
                          )}
                        </td>
                        <td className="text-muted">
                          {new Date(prod.createdAt).toLocaleDateString()}
                        </td>
                        <td>
                          <div className="action-buttons">
                            <button
                              className="icon-action-btn view"
                              onClick={() => navigate(`/products/${prod.id}`)}
                              title="View Detail & Manage SKUs"
                            >
                              <ExternalLink size={15} />
                            </button>

                            {canManage && !isDeleted && (
                              <>
                                <button
                                  className="icon-action-btn edit"
                                  onClick={() => handleOpenEditModal(prod)}
                                  title="Edit Product Info"
                                >
                                  <Edit2 size={15} />
                                </button>
                                <button
                                  className="icon-action-btn delete"
                                  onClick={() => handleSoftDelete(prod)}
                                  title="Soft Delete Product"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </>
                            )}

                            {canManage && isDeleted && (
                              <button
                                className="icon-action-btn restore"
                                onClick={() => handleRestore(prod)}
                                title="Restore Product"
                              >
                                <RotateCcw size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="pagination-bar">
              <span className="pagination-info">
                Showing {products.length} of {totalProducts} products
              </span>
              <div className="pagination-nav">
                <button
                  className="page-btn"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="page-current">
                  Page {page} of {totalPages}
                </span>
                <button
                  className="page-btn"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="modal-backdrop">
          <div className="modal-container">
            <div className="modal-header">
              <h3>{editingProduct ? 'Edit Product' : 'Create New Product'}</h3>
              <button className="modal-close" onClick={handleCloseModal}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="modal-form">
              <div className="form-group">
                <label>Product Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cotton T-Shirt, Cloud Gateway Router..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Category *</label>
                <select
                  required
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  <option value="" disabled>
                    -- Select Category --
                  </option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.isActive ? '' : '(Inactive)'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Slug Identifier (Optional)</label>
                <input
                  type="text"
                  placeholder="Leave blank to auto-generate"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  rows={3}
                  placeholder="Product specifications and features..."
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
                  <span>Active Product</span>
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
                  {isSubmitting ? 'Saving...' : editingProduct ? 'Save Changes' : 'Create & Add SKUs'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
