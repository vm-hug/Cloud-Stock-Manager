import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Product, ProductVariant, ProductImage } from '@cloud-stock/shared';
import { catalogApi } from '../../features/catalog/catalog.api';
import { useAuth } from '../../features/auth/AuthContext';
import { useI18n } from '../../features/i18n/I18nContext';
import {
  ArrowLeft,
  Package,
  Layers,
  Plus,
  Edit2,
  Trash2,
  RotateCcw,
  CheckCircle,
  Star,
  UploadCloud,
  ImageIcon,
  AlertCircle,
  X,
  RefreshCw,
  Tag,
  Boxes,
} from 'lucide-react';
import './ProductDetailPage.scss';

export const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { role } = useAuth();
  const { t, lang } = useI18n();
  const canManage = role === 'ADMIN' || role === 'MANAGER';
  const autoOpenHandledRef = useRef(false);

  const [product, setProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'variants' | 'images'>(() =>
    searchParams.get('tab') === 'images' ? 'images' : 'variants'
  );

  // Variant Modal State
  const [variantModalOpen, setVariantModalOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);
  const [sku, setSku] = useState('');
  const [variantName, setVariantName] = useState('');
  const [price, setPrice] = useState<number | string>('');
  const [costPrice, setCostPrice] = useState<number | string>('');
  const [attrKey, setAttrKey] = useState('');
  const [attrVal, setAttrVal] = useState('');
  const [attributes, setAttributes] = useState<Record<string, string>>({});
  const [variantActive, setVariantActive] = useState(true);

  // Cloudinary Upload State
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [altText, setAltText] = useState('');
  const [makePrimary, setMakePrimary] = useState(false);

  // Notifications
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchProductData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const [prodRes, varRes, imgRes] = await Promise.all([
        catalogApi.getProductById(id),
        catalogApi.getVariants(id),
        catalogApi.getImages(id),
      ]);

      if (prodRes.success && prodRes.data) {
        setProduct(prodRes.data);
      } else {
        setErrorMsg(prodRes.error?.message || 'Product not found');
      }

      if (varRes.success && varRes.data) {
        setVariants(varRes.data);
      }

      if (imgRes.success && imgRes.data) {
        setImages(imgRes.data);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error loading product details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProductData();
  }, [fetchProductData]);

  // Variant Actions
  const handleOpenCreateVariantModal = useCallback(() => {
    setEditingVariant(null);
    setSku('');
    setVariantName('');
    setPrice('');
    setCostPrice('');
    setAttributes({});
    setAttrKey('');
    setAttrVal('');
    setVariantActive(true);
    setErrorMsg(null);
    setVariantModalOpen(true);
  }, []);

  useEffect(() => {
    if (
      !autoOpenHandledRef.current &&
      !loading &&
      product &&
      !product.deletedAt &&
      canManage &&
      searchParams.get('action') === 'add-sku'
    ) {
      autoOpenHandledRef.current = true;
      setActiveTab('variants');
      handleOpenCreateVariantModal();
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('action');
      setSearchParams(nextParams, { replace: true });
    }
  }, [loading, product, canManage, searchParams, setSearchParams, handleOpenCreateVariantModal]);

  const handleOpenEditVariantModal = (v: ProductVariant) => {
    setEditingVariant(v);
    setSku(v.sku);
    setVariantName(v.name);
    setPrice(v.price.toString());
    setCostPrice(v.costPrice !== null && v.costPrice !== undefined ? v.costPrice.toString() : '');
    setAttributes((v.attributes as Record<string, string>) || {});
    setVariantActive(v.isActive);
    setErrorMsg(null);
    setVariantModalOpen(true);
  };

  const handleAddAttribute = () => {
    if (attrKey.trim() && attrVal.trim()) {
      setAttributes((prev) => ({
        ...prev,
        [attrKey.trim()]: attrVal.trim(),
      }));
      setAttrKey('');
      setAttrVal('');
    }
  };

  const handleRemoveAttribute = (key: string) => {
    setAttributes((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  };

  const handleSaveVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    if (!sku.trim()) {
      setErrorMsg('SKU identifier is required');
      return;
    }
    if (!variantName.trim()) {
      setErrorMsg('Variant name is required');
      return;
    }
    if (Number(price) < 0 || isNaN(Number(price))) {
      setErrorMsg('Selling price must be a valid non-negative number');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      if (editingVariant) {
        const res = await catalogApi.updateVariant(editingVariant.id, {
          sku: sku.trim().toUpperCase(),
          name: variantName.trim(),
          price: Number(price),
          costPrice: costPrice !== '' ? Number(costPrice) : null,
          attributes,
          isActive: variantActive,
        });

        if (res.success) {
          setSuccessMsg(`Variant SKU '${sku}' updated successfully.`);
          setVariantModalOpen(false);
          fetchProductData();
        } else {
          setErrorMsg(res.error?.message || 'Failed to update variant');
        }
      } else {
        const res = await catalogApi.createVariant(id, {
          sku: sku.trim().toUpperCase(),
          name: variantName.trim(),
          price: Number(price),
          costPrice: costPrice !== '' ? Number(costPrice) : null,
          attributes,
          isActive: variantActive,
        });

        if (res.success) {
          setSuccessMsg(`Variant SKU '${sku}' created successfully.`);
          setVariantModalOpen(false);
          fetchProductData();
        } else {
          setErrorMsg(res.error?.message || 'Failed to create variant');
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error saving variant');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteVariant = async (v: ProductVariant) => {
    if (!canManage) return;
    if (!window.confirm(t('productDetail.confirmDeleteVariant', { sku: v.sku }))) return;

    try {
      const res = await catalogApi.softDeleteVariant(v.id);
      if (res.success) {
        setSuccessMsg(`SKU '${v.sku}' soft deleted successfully.`);
        fetchProductData();
      } else {
        setErrorMsg(res.error?.message || 'Failed to delete variant');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error deleting variant');
    }
  };

  const handleRestoreVariant = async (v: ProductVariant) => {
    if (!canManage) return;
    try {
      const res = await catalogApi.restoreVariant(v.id);
      if (res.success) {
        setSuccessMsg(`SKU '${v.sku}' restored successfully.`);
        fetchProductData();
      } else {
        setErrorMsg(res.error?.message || 'Failed to restore variant');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error restoring variant');
    }
  };

  // Cloudinary Direct Signed Upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        setErrorMsg('Only JPEG, PNG, and WebP images are supported');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setErrorMsg('Image size cannot exceed 5MB limit');
        return;
      }
      setSelectedFile(file);
      setErrorMsg(null);
    }
  };

  const handleUploadImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !selectedFile) return;

    setUploading(true);
    setUploadProgress('Requesting secure signed parameters from backend...');
    setErrorMsg(null);

    try {
      // 1. Request signature from backend
      const signRes = await catalogApi.requestUploadSignature(id);
      if (!signRes.success || !signRes.data) {
        throw new Error(signRes.error?.message || 'Failed to generate upload signature');
      }

      setUploadProgress('Uploading asset directly to Cloudinary CDN...');

      // 2. Direct upload from browser to Cloudinary
      const uploadResult = await catalogApi.uploadToCloudinary(selectedFile, signRes.data);

      setUploadProgress('Confirming and registering image in database...');

      // 3. Confirm image with backend
      const confirmRes = await catalogApi.confirmImage(id, {
        publicId: uploadResult.publicId,
        url: uploadResult.url,
        altText: altText.trim() || null,
        isPrimary: makePrimary,
      });

      if (confirmRes.success) {
        setSuccessMsg('Product image uploaded and verified successfully via Cloudinary CDN.');
        setSelectedFile(null);
        setAltText('');
        setMakePrimary(false);
        fetchProductData();
      } else {
        setErrorMsg(confirmRes.error?.message || 'Failed to confirm image registration');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Cloudinary upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const handleSetPrimaryImage = async (imgId: string) => {
    if (!id || !canManage) return;
    try {
      const res = await catalogApi.setPrimaryImage(id, imgId);
      if (res.success) {
        setSuccessMsg('Primary display image updated successfully.');
        fetchProductData();
      } else {
        setErrorMsg(res.error?.message || 'Failed to set primary image');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error setting primary image');
    }
  };

  const handleDeleteImage = async (imgId: string) => {
    if (!id || !canManage) return;
    if (!window.confirm('Are you sure you want to delete this image from Cloudinary and database?')) {
      return;
    }

    try {
      const res = await catalogApi.deleteImage(id, imgId);
      if (res.success) {
        setSuccessMsg('Image deleted from Cloudinary CDN and database.');
        fetchProductData();
      } else {
        setErrorMsg(res.error?.message || 'Failed to delete image');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error deleting image');
    }
  };

  if (loading) {
    return (
      <div className="product-detail-page loading">
        <RefreshCw className="spinner" size={32} />
        <p>{t('productDetail.loadingSpecs')}</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="product-detail-page empty">
        <Package size={48} />
        <h2>{t('productDetail.notFoundTitle')}</h2>
        <button className="primary-btn" onClick={() => navigate('/products')}>
          <ArrowLeft size={16} /> {t('productDetail.backToProducts')}
        </button>
      </div>
    );
  }

  return (
    <div className="product-detail-page">
      {/* Top Navigation & Breadcrumb */}
      <div className="detail-top-nav">
        <button className="back-btn" onClick={() => navigate('/products')}>
          <ArrowLeft size={16} />
          <span>{t('productDetail.backToProducts')}</span>
        </button>

        {canManage && !product.deletedAt && (
          <button
            className="primary-btn"
            onClick={() => {
              setActiveTab('variants');
              handleOpenCreateVariantModal();
            }}
          >
            <Plus size={16} />
            <span>{t('productDetail.addVariantSku')}</span>
          </button>
        )}
      </div>

      {/* Product Hero Banner */}
      <div className="product-hero-card">
        <div className="hero-content">
          <div className="category-row">
            <span className="category-pill">
              <Layers size={13} />
              <span>{product.category?.name || 'Unassigned'}</span>
            </span>
            {product.deletedAt ? (
              <span className="status-badge deleted">{t('common.deleted')}</span>
            ) : product.isActive ? (
              <span className="status-badge active">{t('common.active')}</span>
            ) : (
              <span className="status-badge inactive">{t('common.inactive')}</span>
            )}
          </div>

          <h1 className="product-title">{product.name}</h1>
          <div className="slug-info">
            <span>Slug:</span> <code>{product.slug}</code>
          </div>

          {product.description && <p className="product-desc">{product.description}</p>}

          <div className="metadata-row">
            <span>
              {t('common.created')}:{' '}
              {new Date(product.createdAt).toLocaleDateString(
                lang === 'vi' ? 'vi-VN' : 'en-US'
              )}
            </span>
            <span>•</span>
            <span>
              {t('productDetail.totalSkus')}: {variants.length}
            </span>
            <span>•</span>
            <span>
              {t('productDetail.mediaAssets')}: {images.length} / 8
            </span>
          </div>
        </div>
      </div>

      {/* 3-Tier Flow Reminder */}
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

      {/* Tabs Navigation */}
      <div className="tabs-header">
        <button
          className={`tab-btn ${activeTab === 'variants' ? 'active' : ''}`}
          onClick={() => setActiveTab('variants')}
        >
          <Boxes size={18} />
          <span>
            {t('productDetail.tabVariants')} ({variants.length})
          </span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'images' ? 'active' : ''}`}
          onClick={() => setActiveTab('images')}
        >
          <ImageIcon size={18} />
          <span>
            {t('productDetail.tabMedia')} ({images.length})
          </span>
        </button>
      </div>

      {/* Tab 1: Product Variants */}
      {activeTab === 'variants' && (
        <div className="tab-pane variants-tab">
          <div className="pane-header">
            <div>
              <h3>{t('productDetail.variantsTitle')}</h3>
              <p>{t('productDetail.variantsSubtitle')}</p>
            </div>
            {canManage && !product.deletedAt && (
              <button className="primary-btn" onClick={handleOpenCreateVariantModal}>
                <Plus size={16} />
                <span>{t('productDetail.addVariantSku')}</span>
              </button>
            )}
          </div>

          <div className="table-card">
            {variants.length === 0 ? (
              <div className="empty-state">
                <Tag size={40} className="empty-icon" />
                <h3>{t('productDetail.noVariantsTitle')}</h3>
                <p>{t('productDetail.noVariantsDesc')}</p>
                {canManage && !product.deletedAt && (
                  <button className="primary-btn" onClick={handleOpenCreateVariantModal}>
                    <Plus size={16} />
                    <span>{t('productDetail.addFirstSku')}</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="table-responsive">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>{t('productDetail.colSkuCode')}</th>
                      <th>{t('productDetail.colVariantName')}</th>
                      <th>{t('productDetail.colSellingPrice')}</th>
                      <th>{t('productDetail.colCostPrice')}</th>
                      <th>{t('productDetail.colAttributes')}</th>
                      <th>{t('productDetail.colTotalStock')}</th>
                      <th>{t('productDetail.colStatus')}</th>
                      <th>{t('productDetail.colActions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map((v) => {
                      const totalStock =
                        v.inventoryBalances?.reduce((sum, b) => sum + b.quantity, 0) ?? 0;
                      const isDeleted = Boolean(v.deletedAt);

                      return (
                        <tr key={v.id} className={isDeleted ? 'row-deleted' : ''}>
                          <td>
                            <code className="sku-badge">{v.sku}</code>
                          </td>
                          <td className="font-semibold text-primary">{v.name}</td>
                          <td className="text-primary font-semibold">
                            {Number(v.price).toLocaleString()} VND
                          </td>
                          <td className="text-muted">
                            {v.costPrice !== null && v.costPrice !== undefined
                              ? `${Number(v.costPrice).toLocaleString()} VND`
                              : '—'}
                          </td>
                          <td>
                            <div className="attr-chips">
                              {v.attributes &&
                              Object.keys(v.attributes as Record<string, string>).length > 0 ? (
                                Object.entries(v.attributes as Record<string, string>).map(
                                  ([k, val]) => (
                                    <span key={k} className="attr-chip">
                                      <strong>{k}:</strong> {val}
                                    </span>
                                  )
                                )
                              ) : (
                                <span className="text-muted italic">
                                  {t('productDetail.noAttributes')}
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <span
                              className={`stock-indicator ${totalStock > 0 ? 'in-stock' : 'out-of-stock'}`}
                            >
                              {t('productDetail.stockUnits', { count: totalStock })}
                            </span>
                          </td>
                          <td>
                            <span className={`status-pill ${v.isActive ? 'active' : 'inactive'}`}>
                              {v.isActive ? t('common.active') : t('common.inactive')}
                            </span>
                          </td>
                          <td>
                            <div className="action-buttons">
                              {!isDeleted && v.isActive && (
                                <Link
                                  to={`/stock-documents/create?type=INBOUND&variantId=${v.id}`}
                                  className="icon-action-btn"
                                  title={t('products.quickInbound')}
                                  style={{
                                    width: 'auto',
                                    padding: '0 0.55rem',
                                    gap: '0.25rem',
                                    textDecoration: 'none',
                                    color: 'var(--color-accent-text)',
                                    borderColor: 'rgba(var(--color-accent-rgb), 0.25)',
                                    background: 'var(--color-accent-tint)',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                  }}
                                >
                                  <Plus size={13} />
                                  <span>{t('productDetail.inboundAction')}</span>
                                </Link>
                              )}
                              {canManage &&
                                (!isDeleted ? (
                                  <>
                                    <button
                                      className="icon-action-btn edit"
                                      onClick={() => handleOpenEditVariantModal(v)}
                                      title={t('common.edit')}
                                    >
                                      <Edit2 size={15} />
                                    </button>
                                    <button
                                      className="icon-action-btn delete"
                                      onClick={() => handleDeleteVariant(v)}
                                      title={t('common.delete')}
                                    >
                                      <Trash2 size={15} />
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    className="icon-action-btn restore"
                                    onClick={() => handleRestoreVariant(v)}
                                    title={t('common.restore')}
                                  >
                                    <RotateCcw size={15} />
                                  </button>
                                ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Cloudinary Media Gallery */}
      {activeTab === 'images' && (
        <div className="tab-pane media-tab">
          <div className="pane-header">
            <div>
              <h3>{t('productDetail.mediaTitle')}</h3>
              <p>{t('productDetail.mediaSubtitle')}</p>
            </div>
          </div>

          {/* Upload Form Box */}
          {canManage && !product.deletedAt && (
            <div className="upload-box-card">
              <h4>{t('productDetail.mediaTitle')}</h4>
              <p className="upload-sub">{t('productDetail.mediaSubtitle')}</p>

              <form onSubmit={handleUploadImage} className="upload-form">
                <div className="upload-inputs-row">
                  <div className="file-input-wrapper">
                    <input
                      type="file"
                      id="product-file-upload"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleFileChange}
                    />
                    <label htmlFor="product-file-upload" className="file-label">
                      <UploadCloud size={20} />
                      <span>
                        {selectedFile ? selectedFile.name : t('productDetail.chooseImageBtn')}
                      </span>
                    </label>
                  </div>

                  <input
                    type="text"
                    className="alt-input"
                    placeholder={t('productDetail.altTextPlaceholder')}
                    value={altText}
                    onChange={(e) => setAltText(e.target.value)}
                  />

                  <label className="primary-checkbox-label">
                    <input
                      type="checkbox"
                      checked={makePrimary}
                      onChange={(e) => setMakePrimary(e.target.checked)}
                    />
                    <span>{t('productDetail.setPrimaryCheckbox')}</span>
                  </label>

                  <button
                    type="submit"
                    className="primary-btn upload-action-btn"
                    disabled={!selectedFile || uploading}
                  >
                    <UploadCloud size={16} />
                    <span>
                      {uploading ? t('productDetail.uploadingBtn') : t('productDetail.uploadCdnBtn')}
                    </span>
                  </button>
                </div>

                {uploadProgress && (
                  <div className="upload-progress-info">
                    <RefreshCw size={14} className="spinning" />
                    <span>{uploadProgress}</span>
                  </div>
                )}
              </form>
            </div>
          )}

          {/* Media Grid */}
          <div className="media-grid">
            {images.length === 0 ? (
              <div className="empty-state full-width">
                <ImageIcon size={48} className="empty-icon" />
                <h3>{t('productDetail.noImagesTitle')}</h3>
                <p>{t('productDetail.noImagesDesc')}</p>
              </div>
            ) : (
              images.map((img) => (
                <div key={img.id} className={`media-card ${img.isPrimary ? 'is-primary' : ''}`}>
                  <div className="img-frame">
                    <img src={img.url} alt={img.altText || product.name} />
                    {img.isPrimary && (
                      <span className="primary-pill">
                        <Star size={12} fill="currentColor" /> {t('products.primaryBadge')}
                      </span>
                    )}
                  </div>

                  <div className="card-body">
                    <div className="alt-text-row">
                      <span className="alt-label">{img.altText || t('common.noDescription')}</span>
                    </div>
                    <code className="public-id-snippet" title={img.publicId}>
                      {img.publicId}
                    </code>

                    {canManage && (
                      <div className="card-actions">
                        {!img.isPrimary && (
                          <button
                            className="set-primary-btn"
                            onClick={() => handleSetPrimaryImage(img.id)}
                            title={t('products.setPrimary')}
                          >
                            <Star size={14} />
                            <span>{t('products.setPrimary')}</span>
                          </button>
                        )}
                        <button
                          className="delete-img-btn"
                          onClick={() => handleDeleteImage(img.id)}
                          title={t('common.delete')}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Modal: Create / Edit Variant */}
      {variantModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-container">
            <div className="modal-header">
              <div>
                <h3>
                  {editingVariant
                    ? `${t('productDetail.editSku')} (${editingVariant.sku})`
                    : t('productDetail.addNewSku')}
                </h3>
                <p className="modal-subtitle">{t('productDetail.skuModalSubtitle')}</p>
              </div>
              <button className="modal-close" onClick={() => setVariantModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveVariant} className="modal-form">
              <div className="form-group">
                <label>{t('products.skuCode')}</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. TSHIRT-BLK-XL"
                  value={sku}
                  onChange={(e) => setSku(e.target.value.toUpperCase())}
                />
                <span className="help-text">{t('productDetail.skuHelperText')}</span>
              </div>

              <div className="form-group">
                <label>{t('products.variantName')}</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Black / XL"
                  value={variantName}
                  onChange={(e) => setVariantName(e.target.value)}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>{t('products.sellingPrice')}</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    placeholder="e.g. 299000"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>{t('products.costPrice')}</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="e.g. 150000"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                  />
                </div>
              </div>

              {/* Dynamic Attributes Section */}
              <div className="form-group">
                <label>{t('productDetail.attributesLabel')}</label>
                <div className="attr-input-row">
                  <input
                    type="text"
                    placeholder={t('productDetail.attrKeyPlaceholder')}
                    value={attrKey}
                    onChange={(e) => setAttrKey(e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder={t('productDetail.attrValPlaceholder')}
                    value={attrVal}
                    onChange={(e) => setAttrVal(e.target.value)}
                  />
                  <button type="button" className="add-attr-btn" onClick={handleAddAttribute}>
                    {t('productDetail.addAttrBtn')}
                  </button>
                </div>

                <div className="attributes-preview">
                  {Object.entries(attributes).map(([k, val]) => (
                    <span key={k} className="attr-pill">
                      <span>{k}: {val}</span>
                      <button type="button" onClick={() => handleRemoveAttribute(k)}>
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={variantActive}
                    onChange={(e) => setVariantActive(e.target.checked)}
                  />
                  <span>{t('productDetail.activeVariantLabel')}</span>
                </label>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setVariantModalOpen(false)}
                  disabled={isSubmitting}
                >
                  {t('common.cancel')}
                </button>
                <button type="submit" className="submit-btn" disabled={isSubmitting}>
                  {isSubmitting
                    ? t('common.loading')
                    : editingVariant
                      ? t('common.save')
                      : t('productDetail.createSkuBtn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
