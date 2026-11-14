import React, { useEffect, useState } from 'react';
import { InventoryBalance } from '@cloud-stock/shared';
import { inventoryApi } from '../../features/inventory/inventory.api';
import { useI18n } from '../../features/i18n/I18nContext';
import { AlertTriangle, AlertOctagon, Plus, Search, Package } from 'lucide-react';
import { Link } from 'react-router-dom';
import './LowStockPage.scss';

export const LowStockPage: React.FC = () => {
  const { t } = useI18n();
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('lowStock.emptyDesc'));
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
            <span>{t('lowStock.title')}</span>
          </h1>
          <p>{t('lowStock.subtitle')}</p>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="filters-card" style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '420px' }}>
          <Search
            size={18}
            style={{
              position: 'absolute',
              left: '0.875rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--color-text-muted)',
            }}
          />
          <input
            type="text"
            placeholder={t('lowStock.searchPlaceholder')}
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
            <span className="label">{t('lowStock.outOfStockCard')}</span>
          </div>
        </div>

        <div className="summary-card">
          <div className="icon-box warning">
            <AlertTriangle size={24} />
          </div>
          <div className="text-box">
            <span className="count">{lowStockCount}</span>
            <span className="label">{t('lowStock.lowStockCard')}</span>
          </div>
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>{t('lowStock.colWarehouse')}</th>
              <th>{t('lowStock.colProduct')}</th>
              <th>{t('lowStock.colSku')}</th>
              <th>{t('lowStock.colRemaining')}</th>
              <th>{t('lowStock.colMinThreshold')}</th>
              <th>{t('lowStock.colStatus')}</th>
              <th>{t('lowStock.colAction')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>
                  {t('lowStock.loading')}
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>
                  {t('lowStock.emptyDesc')}
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const isZero = item.quantity === 0;
                return (
                  <tr key={`${item.warehouseId}-${item.variantId}`}>
                    <td>
                      <span className="code-chip">{item.warehouse?.code}</span>{' '}
                      <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                        — {item.warehouse?.name}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Package size={16} color="var(--color-text-muted)" />
                        <span style={{ fontWeight: 600 }}>{item.variant?.product?.name}</span>
                      </div>
                    </td>
                    <td>
                      <span className="code-chip">{item.variant?.sku}</span>
                    </td>
                    <td>
                      <strong
                        style={{
                          color: isZero
                            ? 'var(--color-danger-text)'
                            : 'var(--color-warning-text)',
                        }}
                      >
                        {item.quantity} {t('common.units')}
                      </strong>
                    </td>
                    <td style={{ color: 'var(--color-text-secondary)' }}>{item.minThreshold}</td>
                    <td>
                      <span
                        className={`status-dot-pill ${isZero ? 'out-of-stock' : 'low-stock'}`}
                      >
                        <span className="dot" />
                        <span>{isZero ? t('inventory.outOfStock') : t('inventory.lowStock')}</span>
                      </span>
                    </td>
                    <td>
                      <Link
                        to={`/stock-documents/create?type=INBOUND&warehouseId=${item.warehouseId}&variantId=${item.variantId}`}
                        className="btn-reorder"
                      >
                        <Plus size={14} />
                        <span>{t('lowStock.restockBtn')}</span>
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
