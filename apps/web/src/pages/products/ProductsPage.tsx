import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Category, Product, Warehouse, StockStatus } from '@cloud-stock/shared';
import { catalogApi } from '../../features/catalog/catalog.api';
import { searchApi } from '../../features/search/search.api';
import { inventoryApi } from '../../features/inventory/inventory.api';
import { useAuth } from '../../features/auth/AuthContext';
import {
  Package,
  Search,
  Plus,
  Edit2,
  Trash2,
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
  Zap,
  SlidersHorizontal,
} from 'lucide-react';
import './ProductsPage.scss';

export const ProductsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { role } = useAuth();
  const canManage = role === 'ADMIN' || role === 'MANAGER';

  // Catalog & Search State
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter Parameters (synced with URL)
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get('q') || '');
  const [selectedCategory, setSelectedCategory] = useState<string>(searchParams.get('categoryId') || '');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>(searchParams.get('warehouseId') || '');
  const [selectedStockStatus, setSelectedStockStatus] = useState<string>(searchParams.get('stockStatus') || '');
  const [minPrice, setMinPrice] = useState<string>(searchParams.get('minPrice') || '');
  const [maxPrice, setMaxPrice] = useState<string>(searchParams.get('maxPrice') || '');
  const [sortBy, setSortBy] = useState<string>(searchParams.get('sortBy') || 'name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>((searchParams.get('sortOrder') as any) || 'asc');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Pagination & Meta
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalMatches, setTotalMatches] = useState(0);
  const [searchDurationMs, setSearchDurationMs] = useState<number | null>(null);
  const [isCached, setIsCached] = useState<boolean>(false);

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

  // Debounce search input by 300ms
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 300);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [searchTerm]);

  // Load categories and warehouses for filter dropdowns
  useEffect(() => {
    async function loadMetadata() {
      try {
        const [catRes, whRes] = await Promise.all([
          catalogApi.getCategories({ limit: 100 }),
          inventoryApi.getWarehouses({ limit: 100 }),
        ]);
        if (catRes.success && catRes.data) setCategories(catRes.data);
        if (whRes.success && whRes.data) setWarehouses(whRes.data.filter((w: Warehouse) => w.isActive));
      } catch {
        // Non-blocking
      }
    }
    loadMetadata();
  }, []);

  // Fetch products via Phase 5 high-performance search API
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);

    // Sync state with URL params
    const newParams: Record<string, string> = {};
    if (debouncedSearch) newParams.q = debouncedSearch;
    if (selectedCategory) newParams.categoryId = selectedCategory;
    if (selectedWarehouse) newParams.warehouseId = selectedWarehouse;
    if (selectedStockStatus) newParams.stockStatus = selectedStockStatus;
    if (minPrice) newParams.minPrice = minPrice;
    if (maxPrice) newParams.maxPrice = maxPrice;
    if (sortBy) newParams.sortBy = sortBy;
    if (sortOrder) newParams.sortOrder = sortOrder;
    if (page > 1) newParams.page = page.toString();
    setSearchParams(newParams, { replace: true });

    try {
      const res = await searchApi.searchProducts({
        q: debouncedSearch.trim() || undefined,
        categoryId: selectedCategory || undefined,
        warehouseId: selectedWarehouse || undefined,
        stockStatus: (selectedStockStatus as StockStatus) || undefined,
        minPrice: minPrice ? Number(minPrice) : undefined,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
        sortBy: sortBy as any,
        sortOrder,
        page,
        limit,
      });

      if (res.success && res.data) {
        setProducts(res.data.items);
        setTotalPages(res.data.pagination.totalPages);
        setTotalMatches(res.data.pagination.total);
        setSearchDurationMs(res.data.meta.searchDurationMs);
        setIsCached(res.data.meta.cached);
      } else {
        setErrorMsg(res.error?.message || 'Failed to search product catalog');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error executing search query');
    } finally {
      setLoading(false);
    }
  }, [
    debouncedSearch,
    selectedCategory,
    selectedWarehouse,
    selectedStockStatus,
    minPrice,
    maxPrice,
    sortBy,
    sortOrder,
    page,
    limit,
    setSearchParams,
  ]);

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

  const handleOpenEditModal = (prod: any) => {
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

  const handleSoftDelete = async (prod: any) => {
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

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
  };

  return (
    <div className="products-page">
      {/* Page Header */}
      <div className="page-header-actions">
        <div className="header-left">
          <h2 className="title">High-Performance Product Search & SKUs</h2>
          <p className="description">
            Accelerated via PostgreSQL GIN trigram indexes and Redis Cache-Aside with multi-criteria filtering
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

      {/* Search Bar & Main Controls */}
      <div className="search-control-container">
        <div className="main-search-row">
          <div className="search-input-wrapper">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Search by product name, slug, description, or SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            {searchTerm && (
              <button className="clear-btn" onClick={() => setSearchTerm('')}>
                <X size={14} />
              </button>
            )}
          </div>

          <div className="select-wrapper">
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setPage(1);
              }}
              className="filter-select"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="select-wrapper">
            <select
              value={selectedWarehouse}
              onChange={(e) => {
                setSelectedWarehouse(e.target.value);
                setPage(1);
              }}
              className="filter-select"
            >
              <option value="">All Warehouses</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.code})
                </option>
              ))}
            </select>
          </div>

          <button
            className={`filter-toggle-btn ${showAdvancedFilters ? 'active' : ''}`}
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            title="Toggle advanced criteria filters"
          >
            <SlidersHorizontal size={16} />
            <span>Filters</span>
          </button>

          <button className="refresh-btn" onClick={fetchProducts} title="Refresh">
            <RefreshCw size={16} className={loading ? 'spinning' : ''} />
          </button>
        </div>

        {/* Collapsible Advanced Criteria Bar */}
        {showAdvancedFilters && (
          <div className="advanced-filter-drawer">
            <div className="filter-item">
              <label>Stock Status</label>
              <select
                value={selectedStockStatus}
                onChange={(e) => {
                  setSelectedStockStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Any Stock Status</option>
                <option value="IN_STOCK">In Stock</option>
                <option value="LOW_STOCK">Low Stock</option>
                <option value="OUT_OF_STOCK">Out of Stock</option>
              </select>
            </div>

            <div className="filter-item">
              <label>Min Price ($)</label>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={minPrice}
                onChange={(e) => {
                  setMinPrice(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <div className="filter-item">
              <label>Max Price ($)</label>
              <input
                type="number"
                min="0"
                placeholder="1000"
                value={maxPrice}
                onChange={(e) => {
                  setMaxPrice(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <div className="filter-item">
              <label>Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setPage(1);
                }}
              >
                <option value="name">Product Name</option>
                <option value="createdAt">Date Created</option>
                <option value="price">Selling Price</option>
                <option value="totalStock">Total Stock</option>
              </select>
            </div>

            <div className="filter-item">
              <label>Order</label>
              <select
                value={sortOrder}
                onChange={(e) => {
                  setSortOrder(e.target.value as any);
                  setPage(1);
                }}
              >
                <option value="asc">Ascending (A-Z, Low-High)</option>
                <option value="desc">Descending (Z-A, High-Low)</option>
              </select>
            </div>

            {(selectedStockStatus || minPrice || maxPrice || sortBy !== 'name') && (
              <button
                className="reset-filters-btn"
                onClick={() => {
                  setSelectedStockStatus('');
                  setMinPrice('');
                  setMaxPrice('');
                  setSortBy('name');
                  setSortOrder('asc');
                  setPage(1);
                }}
              >
                Reset Filters
              </button>
            )}
          </div>
        )}

        {/* Telemetry / Search Performance Badge */}
        {searchDurationMs !== null && (
          <div className="search-meta-badge">
            <Zap size={14} className="zap-icon" />
            <span>
              Found <strong>{totalMatches}</strong> match{totalMatches !== 1 ? 'es' : ''} in{' '}
              <strong>{searchDurationMs} ms</strong>
            </span>
            <span className={`cache-tag ${isCached ? 'cached' : 'miss'}`}>
              {isCached ? 'Redis Cache Hit' : 'PostgreSQL GIN Query'}
            </span>
          </div>
        )}
      </div>

      {/* Product Table Card */}
      <div className="table-card">
        {loading ? (
          <div className="loading-state">
            <RefreshCw className="spinner" size={28} />
            <p>Querying products and live balances...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="empty-state">
            <Package size={40} className="empty-icon" />
            <h3>No matching products</h3>
            <p>Try broadening your query keywords or adjusting the filter criteria above.</p>
          </div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Product & SKU</th>
                    <th>Category</th>
                    <th>Price Range</th>
                    <th>Total Stock</th>
                    <th>Stock Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((prod) => {
                    return (
                      <tr key={prod.id}>
                        <td>
                          <div className="product-cell">
                            <div className="thumb-container">
                              {prod.primaryImageUrl ? (
                                <img
                                  src={prod.primaryImageUrl}
                                  alt={prod.name}
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
                              <div className="slug-row">
                                <code className="slug-text">{prod.slug}</code>
                                <span className="variants-tag">
                                  {prod.variantsCount} SKU{prod.variantsCount !== 1 ? 's' : ''}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="category-tag">
                            <Layers size={13} />
                            <span>{prod.categoryName || 'Unassigned'}</span>
                          </span>
                        </td>
                        <td>
                          <strong>
                            {prod.minPrice === prod.maxPrice
                              ? formatCurrency(prod.minPrice)
                              : `${formatCurrency(prod.minPrice)} – ${formatCurrency(prod.maxPrice)}`}
                          </strong>
                        </td>
                        <td>
                          <strong>{prod.totalStock.toLocaleString()}</strong> units
                        </td>
                        <td>
                          <span className={`status-pill ${prod.stockStatus.toLowerCase()}`}>
                            {prod.stockStatus === 'IN_STOCK' && <CheckCircle size={12} />}
                            {prod.stockStatus === 'LOW_STOCK' && <AlertCircle size={12} />}
                            {prod.stockStatus === 'OUT_OF_STOCK' && <XCircle size={12} />}
                            <span>{prod.stockStatus.replace('_', ' ')}</span>
                          </span>
                        </td>
                        <td>
                          <div className="action-buttons">
                            <button
                              className="icon-action-btn view"
                              onClick={() => navigate(`/products/${prod.id}`)}
                              title="View Product Detail & SKUs"
                            >
                              <ExternalLink size={15} />
                            </button>

                            {canManage && (
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
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Bar */}
            <div className="pagination-bar">
              <span className="page-info">
                Showing Page {page} of {totalPages} ({totalMatches} total products)
              </span>

              <div className="pagination-actions">
                <button
                  className="page-btn"
                  disabled={page <= 1}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                >
                  <ChevronLeft size={16} />
                  <span>Previous</span>
                </button>
                <button
                  className="page-btn"
                  disabled={page >= totalPages}
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                >
                  <span>Next</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Create / Edit Product Modal */}
      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3>{editingProduct ? 'Edit Product' : 'Create New Product'}</h3>
              <button className="close-btn" onClick={handleCloseModal}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveProduct}>
              <div className="modal-body">
                <div className="form-group">
                  <label>
                    Product Name <span className="req">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Wireless Barcode Scanner"
                  />
                </div>

                <div className="form-group">
                  <label>
                    Category <span className="req">*</span>
                  </label>
                  <select
                    required
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                  >
                    <option value="" disabled>
                      Select a category
                    </option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Custom Slug (Optional)</label>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="auto-generated-if-empty"
                  />
                </div>

                <div className="form-group">
                  <label>Description (Optional)</label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Product specifications, features, or notes..."
                  />
                </div>

                <div className="form-group-checkbox">
                  <label>
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                    />
                    <span>Active in Product Catalog</span>
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={handleCloseModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : editingProduct ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
