import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Category, Product } from '@cloud-stock/shared';
import { catalogApi } from '../../features/catalog/catalog.api';
import { useAuth } from '../../features/auth/AuthContext';
import { useI18n } from '../../features/i18n/I18nContext';
import { validateImageFile } from '../../lib/cloudinary';
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
  Tag,
  LayoutList,
  LayoutGrid,
  Upload,
  Star,
  Loader2,
} from 'lucide-react';
import './ProductsPage.scss';

type ViewMode = 'list' | 'grid';

const VIEW_STORAGE_KEY = 'cloud_stock_products_view';
const MAX_PRODUCT_IMAGES = 8;

interface QueuedProductImage {
  localId: string;
  file: File;
  previewUrl: string;
  status: 'pending' | 'uploading' | 'done' | 'error';
  errorMsg?: string;
}

function getInitialViewMode(): ViewMode {
  try {
    const saved = localStorage.getItem(VIEW_STORAGE_KEY);
    if (saved === 'list' || saved === 'grid') {
      return saved;
    }
  } catch {
    // Ignore storage read failure
  }
  return 'list';
}

export const ProductsPage: React.FC = () => {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { t, lang } = useI18n();
  const canManage = role === 'ADMIN' || role === 'MANAGER';

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>(getInitialViewMode);
  const [brokenThumbIds, setBrokenThumbIds] = useState<Record<string, boolean>>({});

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
  const [createdProductId, setCreatedProductId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Multi-image upload queue on Create Product
  const [queuedImages, setQueuedImages] = useState<QueuedProductImage[]>([]);
  const [primaryImageIdx, setPrimaryImageIdx] = useState(0);
  const previewUrlsRef = useRef<string[]>([]);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  // Status & Feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, viewMode);
    } catch {
      // Ignore storage write failure
    }
  }, [viewMode]);

  const clearQueuedImages = useCallback(() => {
    setQueuedImages((prev) => {
      prev.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      previewUrlsRef.current = [];
      return [];
    });
    setPrimaryImageIdx(0);
  }, []);

  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

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
    setCreatedProductId(null);
    setName('');
    setCategoryId(categories.length > 0 ? categories[0].id : '');
    setSlug('');
    setDescription('');
    setIsActive(true);
    clearQueuedImages();
    setErrorMsg(null);
    setModalOpen(true);
  };

  const handleOpenEditModal = (prod: Product) => {
    setEditingProduct(prod);
    setCreatedProductId(null);
    setName(prod.name);
    setCategoryId(prod.categoryId);
    setSlug(prod.slug);
    setDescription(prod.description || '');
    setIsActive(prod.isActive);
    clearQueuedImages();
    setErrorMsg(null);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingProduct(null);
    setCreatedProductId(null);
    clearQueuedImages();
  };

  const handleSelectProductImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const remainingSlots = MAX_PRODUCT_IMAGES - queuedImages.length;
    if (remainingSlots <= 0) {
      setErrorMsg(t('products.imagesSectionTitle'));
      e.target.value = '';
      return;
    }

    const pickedFiles = Array.from(fileList).slice(0, remainingSlots);
    const additions: QueuedProductImage[] = [];
    const validationErrors: string[] = [];

    pickedFiles.forEach((file, idx) => {
      const validationErr = validateImageFile(file);
      if (validationErr) {
        validationErrors.push(`${file.name}: ${validationErr}`);
        return;
      }
      const previewUrl = URL.createObjectURL(file);
      previewUrlsRef.current.push(previewUrl);
      additions.push({
        localId: `${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        previewUrl,
        status: 'pending',
      });
    });

    if (fileList.length > remainingSlots) {
      validationErrors.push(t('products.imagesSectionTitle'));
    }

    if (additions.length > 0) {
      setQueuedImages((prev) => [...prev, ...additions]);
    }
    if (validationErrors.length > 0) {
      setErrorMsg(validationErrors[0]);
    } else {
      setErrorMsg(null);
    }

    e.target.value = '';
  };

  const handleRemoveQueuedImage = (idx: number) => {
    if (isSubmitting) return;
    setQueuedImages((prev) => {
      const target = prev[idx];
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
        previewUrlsRef.current = previewUrlsRef.current.filter((u) => u !== target.previewUrl);
      }
      const next = prev.filter((_, i) => i !== idx);
      setPrimaryImageIdx((currPrimary) => {
        if (next.length === 0) return 0;
        if (idx === currPrimary) return 0;
        if (idx < currPrimary) return currPrimary - 1;
        return Math.min(currPrimary, next.length - 1);
      });
      return next;
    });
  };

  const uploadQueuedImages = async (targetProductId: string): Promise<number> => {
    const itemsToUpload = queuedImages
      .map((item, idx) => ({ item, idx }))
      .filter(({ item }) => item.status !== 'done');

    if (itemsToUpload.length === 0) return 0;

    let failedCount = 0;

    for (const { item, idx } of itemsToUpload) {
      setQueuedImages((prev) =>
        prev.map((curr) =>
          curr.localId === item.localId ? { ...curr, status: 'uploading', errorMsg: undefined } : curr
        )
      );

      try {
        // Request a unique signed publicId per image so multi-image uploads never overwrite each other
        const sigRes = await catalogApi.requestUploadSignature(targetProductId);
        if (!sigRes.success || !sigRes.data) {
          throw new Error(sigRes.error?.message || 'Failed to obtain Cloudinary upload signature');
        }

        const uploaded = await catalogApi.uploadToCloudinary(item.file, sigRes.data);
        const confirmRes = await catalogApi.confirmImage(targetProductId, {
          publicId: uploaded.publicId,
          url: uploaded.url,
          altText: name.trim() || item.file.name,
          sortOrder: idx,
          isPrimary: idx === primaryImageIdx,
        });

        if (!confirmRes.success) {
          throw new Error(confirmRes.error?.message || 'Failed to confirm image metadata');
        }

        setQueuedImages((prev) =>
          prev.map((curr) =>
            curr.localId === item.localId ? { ...curr, status: 'done', errorMsg: undefined } : curr
          )
        );
      } catch (err) {
        failedCount += 1;
        const msg = err instanceof Error ? err.message : 'Upload failed';
        setQueuedImages((prev) =>
          prev.map((curr) =>
            curr.localId === item.localId ? { ...curr, status: 'error', errorMsg: msg } : curr
          )
        );
      }
    }

    return failedCount;
  };

  const handleRetryFailedImages = async () => {
    if (!createdProductId || isSubmitting) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const failedCount = await uploadQueuedImages(createdProductId);
      fetchProducts();
      if (failedCount === 0) {
        const targetId = createdProductId;
        setSuccessMsg(t('products.createdSuccess', { name }));
        handleCloseModal();
        navigate(`/products/${targetId}?tab=variants&action=add-sku`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg(t('products.nameRequiredError'));
      return;
    }
    if (!categoryId) {
      setErrorMsg(t('products.categoryRequiredError'));
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
          setSuccessMsg(t('products.updatedSuccess', { name }));
          handleCloseModal();
          fetchProducts();
        } else {
          setErrorMsg(res.error?.message || t('products.emptyDesc'));
        }
      } else {
        let productId = createdProductId;
        if (!productId) {
          const res = await catalogApi.createProduct({
            name: name.trim(),
            categoryId,
            slug: slug.trim() || undefined,
            description: description.trim() || null,
            isActive,
          });

          if (!res.success || !res.data) {
            setErrorMsg(res.error?.message || t('products.emptyDesc'));
            return;
          }
          productId = res.data.id;
          setCreatedProductId(productId);
        }

        if (queuedImages.length > 0) {
          const failedImages = await uploadQueuedImages(productId);
          fetchProducts();
          if (failedImages > 0) {
            return;
          }
        }

        setSuccessMsg(t('products.createdSuccess', { name }));
        handleCloseModal();
        navigate(`/products/${productId}?tab=variants&action=add-sku`);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t('products.emptyDesc'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSoftDelete = async (prod: Product) => {
    if (!canManage) return;
    if (!window.confirm(t('products.confirmSoftDelete', { name: prod.name }))) {
      return;
    }

    try {
      const res = await catalogApi.softDeleteProduct(prod.id);
      if (res.success) {
        setSuccessMsg(t('products.deletedSuccess', { name: prod.name }));
        fetchProducts();
      } else {
        setErrorMsg(res.error?.message || t('products.emptyDesc'));
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t('products.emptyDesc'));
    }
  };

  const handleRestore = async (prod: Product) => {
    if (!canManage) return;
    try {
      const res = await catalogApi.restoreProduct(prod.id);
      if (res.success) {
        setSuccessMsg(t('products.restoredSuccess', { name: prod.name }));
        fetchProducts();
      } else {
        setErrorMsg(res.error?.message || t('products.emptyDesc'));
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t('products.emptyDesc'));
    }
  };

  const failedImageCount = queuedImages.filter((item) => item.status === 'error').length;

  const renderStatusPill = (prod: Product, isDeleted: boolean) => {
    if (isDeleted) {
      return <span className="status-pill deleted">{t('common.deleted')}</span>;
    }
    if (prod.isActive) {
      return (
        <span className="status-pill active">
          <CheckCircle size={12} /> {t('common.active')}
        </span>
      );
    }
    return (
      <span className="status-pill inactive">
        <XCircle size={12} /> {t('common.inactive')}
      </span>
    );
  };

  const renderProductActions = (prod: Product, isDeleted: boolean) => (
    <div className="action-buttons">
      <button
        className="icon-action-btn view"
        onClick={() => navigate(`/products/${prod.id}`)}
        title={t('products.viewDetails')}
      >
        <ExternalLink size={15} />
      </button>

      {canManage && !isDeleted && (
        <>
          <button
            className="icon-action-btn sku"
            onClick={() => navigate(`/products/${prod.id}?tab=variants&action=add-sku`)}
            title={t('products.addManageSkus')}
          >
            <Tag size={15} />
          </button>
          <button
            className="icon-action-btn edit"
            onClick={() => handleOpenEditModal(prod)}
            title={t('products.editProduct')}
          >
            <Edit2 size={15} />
          </button>
          <button
            className="icon-action-btn delete"
            onClick={() => handleSoftDelete(prod)}
            title={t('common.delete')}
          >
            <Trash2 size={15} />
          </button>
        </>
      )}

      {canManage && isDeleted && (
        <button
          className="icon-action-btn restore"
          onClick={() => handleRestore(prod)}
          title={t('common.restore')}
        >
          <RotateCcw size={15} />
        </button>
      )}
    </div>
  );

  return (
    <div className="products-page">
      {/* Page Header */}
      <div className="page-header-actions">
        <div className="header-left">
          <h2 className="title">{t('products.title')}</h2>
          <p className="description">{t('products.subtitle')}</p>
        </div>

        {canManage && (
          <button className="primary-btn" onClick={handleOpenCreateModal}>
            <Plus size={16} />
            <span>{t('products.createProduct')}</span>
          </button>
        )}
      </div>

      {/* 3-Tier Inventory Architecture Hint Banner */}
      <div className="tier-guide-banner">
        <Layers size={18} />
        <div className="tier-copy">
          <strong>{t('products.tierBannerTitle')}</strong>
          <span>{t('products.tierBannerDesc')}</span>
        </div>
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
            placeholder={t('products.searchPlaceholder')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="filter-select">
          <label>{t('products.colCategory')}:</label>
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPage(1);
            }}
          >
            <option value="">{t('products.allCategories')}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-select">
          <label>{t('common.status')}:</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as 'all' | 'active' | 'inactive' | 'deleted');
              setPage(1);
            }}
          >
            <option value="all">{t('products.statusAll')}</option>
            <option value="active">{t('products.statusActive')}</option>
            <option value="inactive">{t('products.statusInactive')}</option>
            <option value="deleted">{t('products.statusDeleted')}</option>
          </select>
        </div>

        <div className="view-mode-toggle" role="group" aria-label={t('products.listView')}>
          <button
            type="button"
            className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
            aria-pressed={viewMode === 'list'}
            title={t('products.listView')}
          >
            <LayoutList size={16} />
          </button>
          <button
            type="button"
            className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => setViewMode('grid')}
            aria-pressed={viewMode === 'grid'}
            title={t('products.gridView')}
          >
            <LayoutGrid size={16} />
          </button>
        </div>

        <button className="refresh-btn" onClick={fetchProducts} title={t('common.refresh')}>
          <RefreshCw size={16} className={loading ? 'spinning' : ''} />
        </button>
      </div>

      {/* Product Catalog Card (List or Grid) */}
      <div className="table-card">
        {loading ? (
          <div className="loading-state">
            <RefreshCw className="spinner" size={28} />
            <p>{t('common.loading')}</p>
          </div>
        ) : products.length === 0 ? (
          <div className="empty-state">
            <Package size={40} className="empty-icon" />
            <h3>{t('products.emptyTitle')}</h3>
            <p>{t('products.emptyDesc')}</p>
          </div>
        ) : (
          <>
            {viewMode === 'list' ? (
              <div className="table-responsive">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>{t('products.colProduct')}</th>
                      <th>{t('products.colCategory')}</th>
                      <th>{t('products.colVariants')}</th>
                      <th>{t('products.colStatus')}</th>
                      <th>{t('products.colCreated')}</th>
                      <th>{t('products.colActions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((prod) => {
                      const primaryImg = prod.images?.[0];
                      const isDeleted = Boolean(prod.deletedAt);
                      const hasBrokenThumb = brokenThumbIds[prod.id];
                      const skuTotalStock = (prod.variants || []).reduce(
                        (sum, variant) =>
                          sum +
                          (variant.inventoryBalances?.reduce((s, b) => s + b.quantity, 0) ?? 0),
                        0
                      );

                      return (
                        <tr key={prod.id} className={isDeleted ? 'row-deleted' : ''}>
                          <td>
                            <div className="product-cell">
                              <div className="thumb-container">
                                {primaryImg && !hasBrokenThumb ? (
                                  <img
                                    src={primaryImg.url}
                                    alt={primaryImg.altText || prod.name}
                                    className="product-thumb"
                                    onError={() =>
                                      setBrokenThumbIds((prev) => ({ ...prev, [prod.id]: true }))
                                    }
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
                              <span>{prod.category?.name || t('common.unassigned')}</span>
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
                              <span className="variant-count-pill">
                                {t('products.skuCount', { count: prod._count?.variants ?? prod.variants?.length ?? 0 })}
                              </span>
                              <span
                                className={`status-dot-pill ${skuTotalStock > 0 ? 'in-stock' : 'out-of-stock'}`}
                              >
                                <span className="dot" />
                                <span>
                                  {skuTotalStock > 0
                                    ? t('products.totalStockUnits', { count: skuTotalStock })
                                    : t('products.zeroStockLabel')}
                                </span>
                              </span>
                            </div>
                          </td>
                          <td>{renderStatusPill(prod, isDeleted)}</td>
                          <td className="text-muted">
                            {new Date(prod.createdAt).toLocaleDateString(
                              lang === 'vi' ? 'vi-VN' : 'en-US'
                            )}
                          </td>
                          <td>{renderProductActions(prod, isDeleted)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="products-grid">
                {products.map((prod) => {
                  const primaryImg = prod.images?.[0];
                  const isDeleted = Boolean(prod.deletedAt);
                  const hasBrokenThumb = brokenThumbIds[prod.id];
                  const imageCount = prod._count?.images ?? prod.images?.length ?? 0;

                  return (
                    <article
                      key={prod.id}
                      className={`product-grid-card ${isDeleted ? 'card-deleted' : ''}`}
                    >
                      <div
                        className="card-media"
                        onClick={() => navigate(`/products/${prod.id}`)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            navigate(`/products/${prod.id}`);
                          }
                        }}
                      >
                        {primaryImg && !hasBrokenThumb ? (
                          <img
                            src={primaryImg.url}
                            alt={primaryImg.altText || prod.name}
                            className="card-thumb"
                            onError={() =>
                              setBrokenThumbIds((prev) => ({ ...prev, [prod.id]: true }))
                            }
                          />
                        ) : (
                          <div className="card-thumb-placeholder">
                            <ImageIcon size={28} />
                          </div>
                        )}
                        <div className="card-badges-top">
                          {renderStatusPill(prod, isDeleted)}
                          {imageCount > 0 && (
                            <span className="card-media-count">
                              <ImageIcon size={12} />
                              <span>{t('products.mediaCount', { count: imageCount })}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="card-body">
                        <div className="card-category-row">
                          <span className="category-tag">
                            <Layers size={12} />
                            <span>{prod.category?.name || t('common.unassigned')}</span>
                          </span>
                          <span className="variant-count-pill">
                            {t('products.skuCount', { count: prod._count?.variants ?? prod.variants?.length ?? 0 })}
                          </span>
                        </div>

                        <h4
                          className="card-title clickable"
                          onClick={() => navigate(`/products/${prod.id}`)}
                        >
                          {prod.name}
                        </h4>
                        <code className="slug-text">{prod.slug}</code>
                      </div>

                      <div className="card-footer">
                        <span className="card-date">
                          {new Date(prod.createdAt).toLocaleDateString(
                            lang === 'vi' ? 'vi-VN' : 'en-US'
                          )}
                        </span>
                        {renderProductActions(prod, isDeleted)}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {/* Pagination Controls */}
            <div className="pagination-bar">
              <span className="pagination-info">
                {t('common.showingOf', { count: products.length, total: totalProducts })}
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
                  {t('common.pageOf', { page, total: totalPages })}
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
          <div className="modal-container products-modal-container">
            <div className="modal-header">
              <div>
                <h3>
                  {editingProduct ? t('products.editProduct') : t('products.createNewProduct')}
                </h3>
                <p className="modal-subtitle">
                  {editingProduct ? t('products.editSubtitle') : t('products.modalSubtitle')}
                </p>
              </div>
              <button className="modal-close" onClick={handleCloseModal} disabled={isSubmitting}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="modal-form">
              {errorMsg && (
                <div className="alert-banner error">
                  <AlertCircle size={16} />
                  <span>{errorMsg}</span>
                </div>
              )}

              {createdProductId && failedImageCount > 0 && (
                <div className="partial-warning-banner">
                  <div className="warning-copy">
                    <AlertCircle size={18} />
                    <span>{t('products.partialImageWarning', { count: failedImageCount })}</span>
                  </div>
                  <div className="warning-actions">
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={handleRetryFailedImages}
                      disabled={isSubmitting}
                    >
                      <RefreshCw size={14} className={isSubmitting ? 'spinning' : ''} />
                      <span>{t('products.retryFailedImages')}</span>
                    </button>
                    <button
                      type="button"
                      className="cancel-btn"
                      onClick={() => {
                        const targetId = createdProductId;
                        handleCloseModal();
                        navigate(`/products/${targetId}?tab=variants&action=add-sku`);
                      }}
                      disabled={isSubmitting}
                    >
                      <ExternalLink size={14} />
                      <span>{t('products.skipToDetail')}</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label>{t('products.productName')}</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cotton T-Shirt, Cloud Gateway Router..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={Boolean(createdProductId) || isSubmitting}
                />
              </div>

              <div className="form-group">
                <label>{t('products.category')}</label>
                <select
                  required
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  disabled={Boolean(createdProductId) || isSubmitting}
                >
                  <option value="" disabled>
                    {t('products.selectCategory')}
                  </option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.isActive ? '' : `(${t('common.inactive')})`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>{t('products.slugOptional')}</label>
                <input
                  type="text"
                  placeholder={t('products.slugPlaceholder')}
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  disabled={Boolean(createdProductId) || isSubmitting}
                />
              </div>

              <div className="form-group">
                <label>{t('products.description')}</label>
                <textarea
                  rows={3}
                  placeholder={t('products.descriptionPlaceholder')}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={Boolean(createdProductId) || isSubmitting}
                />
              </div>

              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    disabled={Boolean(createdProductId) || isSubmitting}
                  />
                  <span>{t('products.activeProduct')}</span>
                </label>
              </div>

              {!editingProduct && canManage && (
                <div className="multi-image-panel">
                  <div className="multi-image-header">
                    <div className="header-copy">
                      <span className="section-title">{t('products.imagesSectionTitle')}</span>
                      <span className="section-hint">{t('products.imagesSectionHint')}</span>
                    </div>
                    <input
                      ref={imageInputRef}
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden-file-input"
                      onChange={handleSelectProductImages}
                    />
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => imageInputRef.current?.click()}
                      disabled={isSubmitting || queuedImages.length >= MAX_PRODUCT_IMAGES}
                    >
                      <Upload size={14} />
                      <span>
                        {t('products.selectImages')} ({queuedImages.length}/{MAX_PRODUCT_IMAGES})
                      </span>
                    </button>
                  </div>

                  {queuedImages.length > 0 && (
                    <div className="image-queue-grid">
                      {queuedImages.map((img, idx) => {
                        const isPrimary = idx === primaryImageIdx;
                        return (
                          <div
                            key={img.localId}
                            className={`image-queue-card ${isPrimary ? 'is-primary' : ''} status-${img.status}`}
                          >
                            <img src={img.previewUrl} alt={img.file.name} className="queue-thumb" />

                            <button
                              type="button"
                              className={`queue-star-btn ${isPrimary ? 'active' : ''}`}
                              onClick={() => {
                                if (!isSubmitting && img.status !== 'done') {
                                  setPrimaryImageIdx(idx);
                                }
                              }}
                              disabled={isSubmitting || Boolean(createdProductId)}
                              title={isPrimary ? t('products.primaryBadge') : t('products.setPrimary')}
                            >
                              <Star size={13} fill={isPrimary ? 'currentColor' : 'none'} />
                            </button>

                            {img.status !== 'done' && (
                              <button
                                type="button"
                                className="queue-remove-btn"
                                onClick={() => handleRemoveQueuedImage(idx)}
                                disabled={isSubmitting}
                                title={t('common.delete')}
                              >
                                <X size={13} />
                              </button>
                            )}

                            {isPrimary && (
                              <span className="queue-primary-tag">{t('products.primaryBadge')}</span>
                            )}

                            {img.status !== 'pending' && (
                              <div className={`queue-status-overlay status-${img.status}`}>
                                {img.status === 'uploading' && (
                                  <Loader2 size={18} className="spinning" />
                                )}
                                {img.status === 'done' && <CheckCircle size={18} />}
                                {img.status === 'error' && <AlertCircle size={18} />}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="modal-actions">
                {editingProduct && canManage && !editingProduct.deletedAt && (
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => {
                      const targetId = editingProduct.id;
                      handleCloseModal();
                      navigate(`/products/${targetId}?tab=variants&action=add-sku`);
                    }}
                    disabled={isSubmitting}
                  >
                    <Tag size={15} />
                    <span>{t('products.addManageSkus')}</span>
                  </button>
                )}
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={handleCloseModal}
                  disabled={isSubmitting}
                >
                  {t('common.cancel')}
                </button>
                {!(createdProductId && failedImageCount > 0) && (
                  <button type="submit" className="submit-btn" disabled={isSubmitting}>
                    {isSubmitting
                      ? t('common.loading')
                      : editingProduct
                        ? t('common.save')
                        : t('products.createAndSave')}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
