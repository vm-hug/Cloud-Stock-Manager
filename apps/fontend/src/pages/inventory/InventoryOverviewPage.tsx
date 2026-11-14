import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  InventoryBalance,
  Warehouse,
  Role,
  StockDocType,
  ProductVariant,
} from '@cloud-stock/shared';
import { inventoryApi } from '../../features/inventory/inventory.api';
import { catalogApi } from '../../features/catalog/catalog.api';
import { useAuth } from '../../features/auth/AuthContext';
import { useI18n } from '../../features/i18n/I18nContext';
import {
  Search,
  Download,
  Package,
  Edit2,
  ChevronLeft,
  ChevronRight,
  X,
  FileSpreadsheet,
  Plus,
  Layers,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  ArrowUpRight,
} from 'lucide-react';
import './InventoryOverviewPage.scss';

interface VariantOption extends ProductVariant {
  productName: string;
}

export const InventoryOverviewPage: React.FC = () => {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const [balances, setBalances] = useState<InventoryBalance[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [variantOptions, setVariantOptions] = useState<VariantOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState('');
  const [selectedWh, setSelectedWh] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<{
    message: string;
    docId?: string;
  } | null>(null);

  // KPI metrics across the selected warehouse (or all warehouses)
  const [kpi, setKpi] = useState({
    totalSkus: 0,
    totalUnits: 0,
    lowStock: 0,
    outOfStock: 0,
    inStock: 0,
  });

  // Edit Threshold Modal
  const [thresholdModal, setThresholdModal] = useState<{
    open: boolean;
    item: InventoryBalance | null;
    value: number;
  }>({ open: false, item: null, value: 5 });

  // Quick Inbound Voucher Modal (always creates a real StockDocument)
  const [inboundModal, setInboundModal] = useState<{
    open: boolean;
    warehouseId: string;
    variantId: string;
    quantity: number;
    note: string;
  }>({
    open: false,
    warehouseId: '',
    variantId: '',
    quantity: 10,
    note: '',
  });
  const [submittingInbound, setSubmittingInbound] = useState(false);
  const [inboundError, setInboundError] = useState<string | null>(null);

  const canEditThreshold = user?.role === Role.ADMIN || user?.role === Role.MANAGER;

  useEffect(() => {
    inventoryApi.getWarehouses({ isActive: true }).then((res) => {
      if (res.success && res.data) {
        setWarehouses(res.data);
      }
    });

    catalogApi.getProducts({ limit: 200, isActive: true }).then((res) => {
      if (res.success && res.data) {
        const opts: VariantOption[] = [];
        res.data.forEach((prod) => {
          if (prod.variants && prod.variants.length > 0) {
            prod.variants.forEach((v) => {
              if (v.isActive) {
                opts.push({
                  ...v,
                  productName: prod.name,
                });
              }
            });
          }
        });
        setVariantOptions(opts);
      }
    });
  }, []);

  const loadKpiSummary = async () => {
    try {
      const res = await inventoryApi.getBalances({
        page: 1,
        limit: 500,
        warehouseId: selectedWh || undefined,
      });
      if (res.success && res.data) {
        const rows = res.data;
        let units = 0;
        let low = 0;
        let zero = 0;
        let ok = 0;
        rows.forEach((r) => {
          units += r.quantity;
          if (r.quantity === 0) zero += 1;
          else if (r.quantity <= r.minThreshold) low += 1;
          else ok += 1;
        });
        const totalRows = res.pagination?.total ?? rows.length;
        const fallbackSkus = !selectedWh && totalRows === 0 ? variantOptions.length : totalRows;
        const fallbackZero = !selectedWh && totalRows === 0 ? variantOptions.length : zero;
        setKpi({
          totalSkus: fallbackSkus,
          totalUnits: units,
          lowStock: low,
          outOfStock: fallbackZero,
          inStock: ok,
        });
      }
    } catch {
      // Summary strip degrades silently if query fails
    }
  };

  useEffect(() => {
    loadKpiSummary();
  }, [selectedWh, variantOptions.length]);

  const loadBalances = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await inventoryApi.getBalances({
        page,
        limit: 15,
        warehouseId: selectedWh || undefined,
        search: search || undefined,
        stockStatus: (selectedStatus as 'OUT_OF_STOCK' | 'LOW_STOCK' | 'IN_STOCK') || undefined,
      });

      if (res.success && res.data) {
        setBalances(res.data);
        if (res.pagination) {
          setTotalPages(res.pagination.totalPages || 1);
          setTotalItems(res.pagination.total ?? res.data.length);
        } else {
          setTotalItems(res.data.length);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('inventory.emptyDesc'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadBalances();
    }, 250);
    return () => clearTimeout(timer);
  }, [page, search, selectedWh, selectedStatus]);

  const handleExport = async (format: 'csv' | 'xlsx') => {
    try {
      await inventoryApi.downloadExport({
        format,
        warehouseId: selectedWh || undefined,
        stockStatus: selectedStatus || undefined,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('inventory.savingError'));
    }
  };

  const handleSaveThreshold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!thresholdModal.item) return;

    try {
      await inventoryApi.updateThreshold(
        thresholdModal.item.warehouseId,
        thresholdModal.item.variantId,
        thresholdModal.value
      );
      setThresholdModal({ open: false, item: null, value: 5 });
      loadBalances();
      loadKpiSummary();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('inventory.savingError'));
    }
  };

  const openQuickInboundModal = (warehouseId?: string, variantId?: string) => {
    setInboundError(null);
    setInboundModal({
      open: true,
      warehouseId: warehouseId || selectedWh || warehouses[0]?.id || '',
      variantId: variantId || variantOptions[0]?.id || '',
      quantity: 20,
      note: '',
    });
  };

  const handleSubmitQuickInbound = async (autoSubmit: boolean) => {
    if (!inboundModal.warehouseId || !inboundModal.variantId || inboundModal.quantity < 1) {
      setInboundError(t('inventory.savingError'));
      return;
    }

    try {
      setSubmittingInbound(true);
      setInboundError(null);
      const createRes = await inventoryApi.createDocument({
        type: StockDocType.INBOUND,
        destinationWarehouseId: inboundModal.warehouseId,
        note: inboundModal.note.trim() || undefined,
        items: [
          {
            variantId: inboundModal.variantId,
            quantity: inboundModal.quantity,
          },
        ],
      });

      if (createRes.success && createRes.data) {
        const doc = createRes.data;
        if (autoSubmit) {
          await inventoryApi.submitDocument(doc.id);
          setActionSuccess({
            message: t('inventory.quickInboundSuccessPending', { code: doc.documentCode }),
            docId: doc.id,
          });
        } else {
          setActionSuccess({
            message: t('inventory.quickInboundSuccessDraft', { code: doc.documentCode }),
            docId: doc.id,
          });
        }
        setInboundModal({
          open: false,
          warehouseId: '',
          variantId: '',
          quantity: 10,
          note: '',
        });
      }
    } catch (err: unknown) {
      setInboundError(err instanceof Error ? err.message : t('inventory.savingError'));
    } finally {
      setSubmittingInbound(false);
    }
  };

  return (
    <div className="inventory-overview-page">
      <div className="page-header">
        <div className="title-group">
          <h1>{t('inventory.title')}</h1>
          <p>{t('inventory.subtitle')}</p>
        </div>
        <div className="export-actions">
          <button className="btn-export" onClick={() => handleExport('csv')}>
            <Download size={16} />
            <span>{t('inventory.exportCsv')}</span>
          </button>
          <button className="btn-export" onClick={() => handleExport('xlsx')}>
            <FileSpreadsheet size={16} />
            <span>{t('inventory.exportExcel')}</span>
          </button>
          <button className="btn-quick-header" onClick={() => openQuickInboundModal()}>
            <Plus size={16} />
            <span>{t('inventory.newInboundBtn')}</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Strip */}
      <div className="kpi-strip">
        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">{t('inventory.kpiTotalSkus')}</span>
            <span className="kpi-icon">
              <Layers size={17} />
            </span>
          </div>
          <div className="kpi-value">{kpi.totalSkus.toLocaleString()}</div>
          <div className="kpi-sub">{t('inventory.kpiLiveHint')}</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">{t('inventory.kpiTotalUnits')}</span>
            <span className="kpi-icon success">
              <CheckCircle2 size={17} />
            </span>
          </div>
          <div className="kpi-value">{kpi.totalUnits.toLocaleString()}</div>
          <div className="kpi-sub">{t('common.units')}</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">{t('inventory.kpiLowStock')}</span>
            <span className="kpi-icon warning">
              <AlertTriangle size={17} />
            </span>
          </div>
          <div className="kpi-value warning">{kpi.lowStock}</div>
          <div className="kpi-sub">{t('inventory.kpiNeedsRestock')}</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">{t('inventory.kpiOutOfStock')}</span>
            <span className="kpi-icon danger">
              <AlertOctagon size={17} />
            </span>
          </div>
          <div className="kpi-value danger">{kpi.outOfStock}</div>
          <div className="kpi-sub">{t('inventory.kpiZeroHint')}</div>
        </div>
      </div>

      <div className="filters-card">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder={t('inventory.searchPlaceholder')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="select-group">
          <label>{t('inventory.warehouseLabel')}</label>
          <select
            value={selectedWh}
            onChange={(e) => {
              setSelectedWh(e.target.value);
              setPage(1);
            }}
          >
            <option value="">{t('inventory.allWarehouses')}</option>
            {warehouses.map((wh) => (
              <option key={wh.id} value={wh.id}>
                {wh.code} - {wh.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {actionSuccess && (
        <div className="success-banner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <span>{actionSuccess.message}</span>
          {actionSuccess.docId && (
            <Link
              to={`/stock-documents/${actionSuccess.docId}`}
              className="btn-quick-inbound"
              style={{ textDecoration: 'none' }}
            >
              <span>{t('inventory.openVoucher')}</span>
              <ArrowUpRight size={14} />
            </Link>
          )}
        </div>
      )}

      <div className="table-container">
        <div className="table-header-toolbar">
          <div className="toolbar-heading">
            <h2>{t('inventory.title')}</h2>
            <p>{t('inventory.subtitle')}</p>
          </div>
          <div className="segmented-tabs">
            <button
              type="button"
              className={selectedStatus === '' ? 'active' : ''}
              onClick={() => {
                setSelectedStatus('');
                setPage(1);
              }}
            >
              {t('inventory.allStatuses')} ({kpi.totalSkus})
            </button>
            <button
              type="button"
              className={selectedStatus === 'IN_STOCK' ? 'active' : ''}
              onClick={() => {
                setSelectedStatus('IN_STOCK');
                setPage(1);
              }}
            >
              {t('inventory.inStock')} ({kpi.inStock})
            </button>
            <button
              type="button"
              className={selectedStatus === 'LOW_STOCK' ? 'active' : ''}
              onClick={() => {
                setSelectedStatus('LOW_STOCK');
                setPage(1);
              }}
            >
              {t('inventory.lowStock')} ({kpi.lowStock})
            </button>
            <button
              type="button"
              className={selectedStatus === 'OUT_OF_STOCK' ? 'active' : ''}
              onClick={() => {
                setSelectedStatus('OUT_OF_STOCK');
                setPage(1);
              }}
            >
              {t('inventory.outOfStock')} ({kpi.outOfStock})
            </button>
          </div>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t('inventory.colWarehouse')}</th>
                <th>{t('inventory.colProduct')}</th>
                <th>{t('inventory.colSkuVariant')}</th>
                <th>{t('inventory.colQuantity')}</th>
                <th>{t('inventory.colMinThreshold')}</th>
                <th>{t('inventory.colStatus')}</th>
                <th>{t('inventory.colUpdated')}</th>
                <th>{t('inventory.colAction')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem' }}>
                    {t('inventory.loading')}
                  </td>
                </tr>
              ) : balances.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem' }}>
                    {t('inventory.emptyDesc')}
                  </td>
                </tr>
              ) : (
                balances.map((item) => {
                  const isOutOfStock = item.quantity === 0;
                  const isLowStock = item.quantity > 0 && item.quantity <= item.minThreshold;
                  const statusClass = isOutOfStock
                    ? 'out-of-stock'
                    : isLowStock
                    ? 'low-stock'
                    : 'in-stock';
                  const statusLabel = isOutOfStock
                    ? t('inventory.outOfStock')
                    : isLowStock
                    ? t('inventory.lowStock')
                    : t('inventory.inStock');

                  const primaryImg = item.variant?.product?.images?.[0]?.url;

                  return (
                    <tr key={`${item.warehouseId}-${item.variantId}`}>
                      <td>
                        <div className="wh-cell">
                          <span className="wh-code">{item.warehouse?.code}</span>
                          <span className="wh-name">{item.warehouse?.name}</span>
                        </div>
                      </td>
                      <td>
                        <div className="product-cell">
                          {primaryImg ? (
                            <img
                              src={primaryImg}
                              alt={item.variant?.product?.name}
                              className="thumb"
                            />
                          ) : (
                            <div className="thumb-placeholder">
                              <Package size={18} />
                            </div>
                          )}
                          <div className="p-details">
                            <span className="p-name">{item.variant?.product?.name}</span>
                            <span className="p-cat">
                              {item.variant?.product?.category?.name || t('common.unassigned')}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="sku-cell">
                          <span className="code-chip">{item.variant?.sku}</span>
                          <span className="variant-title">{item.variant?.name}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`qty-badge ${statusClass}`}>
                          {item.quantity} {t('common.units')}
                        </span>
                      </td>
                      <td>
                        <div className="threshold-cell">
                          <span>{item.minThreshold}</span>
                          {canEditThreshold && (
                            <button
                              type="button"
                              title={t('inventory.editThresholdTooltip')}
                              onClick={() =>
                                setThresholdModal({
                                  open: true,
                                  item,
                                  value: item.minThreshold,
                                })
                              }
                            >
                              <Edit2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={`status-dot-pill ${statusClass}`}>
                          <span className="dot" />
                          <span>{statusLabel}</span>
                        </span>
                      </td>
                      <td style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                        {new Date(item.updatedAt).toLocaleDateString(
                          lang === 'vi' ? 'vi-VN' : 'en-US'
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-quick-inbound"
                          onClick={() =>
                            openQuickInboundModal(item.warehouseId, item.variantId)
                          }
                        >
                          {t('inventory.addInboundAction')}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="pagination">
          <span>
            {t('common.showingOf', {
              count: balances.length,
              total: totalItems,
            })}
          </span>
          <div className="pagination-controls">
            <span>
              {t('common.pageOf', { page, total: totalPages })}
            </span>
            <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              <ChevronLeft size={16} />
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Threshold Modal */}
      {thresholdModal.open && (
        <div className="modal-overlay" onClick={() => setThresholdModal({ open: false, item: null, value: 5 })}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>{t('inventory.thresholdModalTitle')}</h3>
                <p className="modal-subtitle">{t('inventory.thresholdModalSubtitle')}</p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setThresholdModal({ open: false, item: null, value: 5 })}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveThreshold}>
              <p
                style={{
                  color: 'var(--color-text-secondary)',
                  fontSize: '0.86rem',
                  marginBottom: '1rem',
                }}
              >
                {t('inventory.thresholdModalPrompt', {
                  sku: thresholdModal.item?.variant?.sku || '',
                  warehouse: thresholdModal.item?.warehouse?.name || '',
                })}
              </p>
              <div className="form-field">
                <label>{t('inventory.thresholdLabel')}</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={thresholdModal.value}
                  onChange={(e) =>
                    setThresholdModal({
                      ...thresholdModal,
                      value: parseInt(e.target.value, 10) || 0,
                    })
                  }
                />
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setThresholdModal({ open: false, item: null, value: 5 })}
                >
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn-confirm">
                  {t('inventory.saveThresholdBtn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Inbound Voucher Modal (Clean UI + Strictly adheres to StockDocument Invariant) */}
      {inboundModal.open && (
        <div
          className="modal-overlay"
          onClick={() => setInboundModal({ ...inboundModal, open: false })}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>{t('inventory.quickInboundTitle')}</h3>
                <p className="modal-subtitle">{t('inventory.quickInboundSubtitle')}</p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setInboundModal({ ...inboundModal, open: false })}
              >
                <X size={20} />
              </button>
            </div>

            {inboundError && <div className="error-banner" style={{ marginBottom: '0.85rem' }}>{inboundError}</div>}

            <div className="form-field">
              <label>{t('inventory.selectSkuLabel')}</label>
              <select
                value={inboundModal.variantId}
                onChange={(e) => setInboundModal({ ...inboundModal, variantId: e.target.value })}
              >
                <option value="">{t('inventory.selectSkuPlaceholder')}</option>
                {variantOptions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.sku} — {v.productName} ({v.name})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label>{t('inventory.selectWarehouseLabel')}</label>
              <select
                value={inboundModal.warehouseId}
                onChange={(e) => setInboundModal({ ...inboundModal, warehouseId: e.target.value })}
              >
                <option value="">{t('inventory.selectWarehousePlaceholder')}</option>
                {warehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.code} — {wh.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="quick-inbound-grid">
              <div className="form-field">
                <label>{t('inventory.inboundQtyLabel')}</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={inboundModal.quantity}
                  onChange={(e) =>
                    setInboundModal({
                      ...inboundModal,
                      quantity: Math.max(1, parseInt(e.target.value, 10) || 1),
                    })
                  }
                />
              </div>

              <div className="form-field">
                <label>{t('inventory.referenceNoteLabel')}</label>
                <input
                  type="text"
                  placeholder={t('inventory.referenceNotePlaceholder')}
                  value={inboundModal.note}
                  onChange={(e) => setInboundModal({ ...inboundModal, note: e.target.value })}
                />
              </div>
            </div>

            <div className="modal-hint">{t('stockDocs.selfApprovalNotice')}</div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-cancel"
                disabled={submittingInbound}
                onClick={() => setInboundModal({ ...inboundModal, open: false })}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn-cancel"
                disabled={submittingInbound || !inboundModal.variantId || !inboundModal.warehouseId}
                onClick={() => handleSubmitQuickInbound(false)}
              >
                {t('inventory.saveDraftBtn')}
              </button>
              <button
                type="button"
                className="btn-confirm"
                disabled={submittingInbound || !inboundModal.variantId || !inboundModal.warehouseId}
                onClick={() => handleSubmitQuickInbound(true)}
              >
                {submittingInbound
                  ? t('inventory.submittingInbound')
                  : t('inventory.submitForApprovalBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
