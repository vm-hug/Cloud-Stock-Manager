import React, { useEffect, useState } from 'react';
import { InventoryBalance } from '@cloud-stock/shared';
import { inventoryApi } from '../../features/inventory/inventory.api';
import { AlertTriangle, AlertOctagon, Plus, Search, Package } from 'lucide-react';
import { Link } from 'react-router-dom';
import './LowStockPage.scss';

export const LowStockPage: React.FC = () => {
  const [items, setItems] = useState<InventoryBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadLowStock = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await inventoryApi.getLowStock({ search: search || undefined });
      if (res.success && res.data) {
        setItems(res.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch low stock alerts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadLowStock();
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const outOfStockCount = items.filter((i) => i.quantity === 0).length;
  const lowStockCount = items.filter((i) => i.quantity > 0).length;

  return (
    <div className="low-stock-page">
      <div className="page-header">
        <div className="title-group">
          <h1>
            <AlertTriangle size={24} />
            <span>Low Stock Alerts</span>
          </h1>
          <p>Depleted SKUs and inventory levels at or below their minimum warning threshold.</p>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="filters-card" style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
          <Search size={18} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          <input
            type="text"
            placeholder="Search low stock SKUs or products..."
            style={{ width: '100%', paddingLeft: '2.5rem' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="alert-summary-cards">
        <div className="summary-card">
          <div className="icon-box danger">
            <AlertOctagon size={24} />
          </div>
          <div className="text-box">
            <span className="count">{outOfStockCount}</span>
            <span className="label">Out of Stock SKUs</span>
          </div>
        </div>

        <div className="summary-card">
          <div className="icon-box warning">
            <AlertTriangle size={24} />
          </div>
          <div className="text-box">
            <span className="count">{lowStockCount}</span>
            <span className="label">Low Stock Warnings</span>
          </div>
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Warehouse</th>
              <th>Product</th>
              <th>SKU</th>
              <th>Remaining</th>
              <th>Min Threshold</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>
                  Scanning stock balances...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>
                  🎉 All SKU inventories are currently operating safely above their warning thresholds!
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const isZero = item.quantity === 0;
                return (
                  <tr key={`${item.warehouseId}-${item.variantId}`}>
                    <td>
                      <strong style={{ fontFamily: 'monospace', color: '#a5b4fc' }}>
                        {item.warehouse?.code}
                      </strong>{' '}
                      - {item.warehouse?.name}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Package size={16} color="#94a3b8" />
                        <span>{item.variant?.product?.name}</span>
                      </div>
                    </td>
                    <td style={{ fontFamily: 'monospace' }}>{item.variant?.sku}</td>
                    <td>
                      <strong style={{ color: isZero ? '#f87171' : '#fbbf24' }}>
                        {item.quantity} units
                      </strong>
                    </td>
                    <td style={{ color: '#cbd5e1' }}>{item.minThreshold}</td>
                    <td>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background: isZero
                            ? 'rgba(239, 68, 68, 0.15)'
                            : 'rgba(245, 158, 11, 0.15)',
                          color: isZero ? '#f87171' : '#fbbf24',
                        }}
                      >
                        {isZero ? 'Out of Stock' : 'Low Stock'}
                      </span>
                    </td>
                    <td>
                      <Link
                        to={`/stock-documents/create?type=INBOUND&warehouseId=${item.warehouseId}&variantId=${item.variantId}`}
                        className="btn-reorder"
                      >
                        <Plus size={14} />
                        <span>Restock</span>
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
