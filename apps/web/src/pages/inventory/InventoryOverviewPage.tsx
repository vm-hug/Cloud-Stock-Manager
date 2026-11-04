import React, { useEffect, useState } from 'react';
import { InventoryBalance, Warehouse, Role } from '@cloud-stock/shared';
import { inventoryApi } from '../../features/inventory/inventory.api';
import { useAuth } from '../../features/auth/AuthContext';
import {
  Search,
  Download,
  Package,
  Edit2,
  ChevronLeft,
  ChevronRight,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import './InventoryOverviewPage.scss';

export const InventoryOverviewPage: React.FC = () => {
  const { user } = useAuth();
  const [balances, setBalances] = useState<InventoryBalance[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedWh, setSelectedWh] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Edit Threshold Modal
  const [thresholdModal, setThresholdModal] = useState<{
    open: boolean;
    item: InventoryBalance | null;
    value: number;
  }>({ open: false, item: null, value: 5 });

  const canEdit = user?.role === Role.ADMIN || user?.role === Role.MANAGER;

  useEffect(() => {
    // Load warehouses for filter dropdown
    inventoryApi.getWarehouses({ isActive: true }).then((res) => {
      if (res.success && res.data) {
        setWarehouses(res.data);
      }
    });
  }, []);

  const loadBalances = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await inventoryApi.getBalances({
        page,
        limit: 15,
        warehouseId: selectedWh || undefined,
        search: search || undefined,
        stockStatus: (selectedStatus as any) || undefined,
      });

      if (res.success && res.data) {
        setBalances(res.data);
        if (res.pagination) {
          setTotalPages(res.pagination.totalPages || 1);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load inventory balances');
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
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
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
    } catch (err: any) {
      alert(`Failed to update threshold: ${err.message}`);
    }
  };

  return (
    <div className="inventory-overview-page">
      <div className="page-header">
        <div className="title-group">
          <h1>Inventory Balances</h1>
          <p>Real-time PostgreSQL stock quantities, alert thresholds, and multi-warehouse balances.</p>
        </div>
        <div className="export-actions">
          <button className="btn-export" onClick={() => handleExport('csv')}>
            <Download size={16} />
            <span>Export CSV</span>
          </button>
          <button className="btn-export" onClick={() => handleExport('xlsx')}>
            <FileSpreadsheet size={16} />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      <div className="filters-card">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search by SKU, variant, or product..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="select-group">
          <label>Warehouse:</label>
          <select
            value={selectedWh}
            onChange={(e) => {
              setSelectedWh(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Warehouses</option>
            {warehouses.map((wh) => (
              <option key={wh.id} value={wh.id}>
                {wh.code} - {wh.name}
              </option>
            ))}
          </select>
        </div>

        <div className="select-group">
          <label>Status:</label>
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Statuses</option>
            <option value="IN_STOCK">In Stock</option>
            <option value="LOW_STOCK">Low Stock</option>
            <option value="OUT_OF_STOCK">Out of Stock</option>
          </select>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Warehouse</th>
              <th>Product</th>
              <th>SKU & Variant</th>
              <th>Current Quantity</th>
              <th>Min Threshold</th>
              <th>Status</th>
              <th>Last Updated</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>
                  Loading balance records...
                </td>
              </tr>
            ) : balances.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>
                  No inventory balances found matching the filter criteria.
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
                  ? 'Out of Stock'
                  : isLowStock
                  ? 'Low Stock'
                  : 'In Stock';

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
                          <img src={primaryImg} alt={item.variant?.product?.name} className="thumb" />
                        ) : (
                          <div className="thumb-placeholder">
                            <Package size={18} />
                          </div>
                        )}
                        <div className="p-details">
                          <span className="p-name">{item.variant?.product?.name}</span>
                          <span className="p-cat">{item.variant?.product?.category?.name || 'Category'}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="sku-cell">
                        <span className="sku-code">{item.variant?.sku}</span>
                        <span className="variant-title">{item.variant?.name}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`qty-badge ${statusClass}`}>
                        {item.quantity} units
                      </span>
                    </td>
                    <td>
                      <div className="threshold-cell">
                        <span>{item.minThreshold}</span>
                        {canEdit && (
                          <button
                            title="Edit Minimum Alert Threshold"
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
                      <span className={`status-badge ${statusClass}`}>{statusLabel}</span>
                    </td>
                    <td style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                      {new Date(item.updatedAt).toLocaleDateString()}
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
          Page {page} of {totalPages}
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

      {/* Threshold Modal */}
      {thresholdModal.open && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Set Alert Threshold</h2>
              <button
                onClick={() => setThresholdModal({ open: false, item: null, value: 5 })}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveThreshold}>
              <p style={{ color: '#cbd5e1', fontSize: '0.875rem', marginBottom: '1rem' }}>
                Set the minimum stock alert threshold for SKU{' '}
                <strong>{thresholdModal.item?.variant?.sku}</strong> at{' '}
                <strong>{thresholdModal.item?.warehouse?.name}</strong>.
              </p>
              <div className="form-group">
                <label>Minimum Threshold (units)</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={thresholdModal.value}
                  onChange={(e) =>
                    setThresholdModal({
                      ...thresholdModal,
                      value: parseInt(e.target.value) || 0,
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
                  Cancel
                </button>
                <button type="submit" className="btn-save">
                  Save Threshold
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
