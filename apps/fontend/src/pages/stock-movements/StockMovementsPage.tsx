import React, { useEffect, useState } from 'react';
import { StockMovement, Warehouse } from '@cloud-stock/shared';
import { inventoryApi } from '../../features/inventory/inventory.api';
import { useI18n } from '../../features/i18n/I18nContext';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './StockMovementsPage.scss';

export const StockMovementsPage: React.FC = () => {
  const { t, lang } = useI18n();
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedWh, setSelectedWh] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    inventoryApi.getWarehouses().then((res) => {
      if (res.success && res.data) setWarehouses(res.data);
    });
  }, []);

  const loadMovements = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await inventoryApi.getMovements({
        page,
        limit: 20,
        warehouseId: selectedWh || undefined,
      });

      if (res.success && res.data) {
        setMovements(res.data);
        if (res.pagination) {
          setTotalPages(res.pagination.totalPages || 1);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('movements.emptyDesc'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMovements();
  }, [page, selectedWh]);

  const dateLocale = lang === 'vi' ? 'vi-VN' : 'en-US';

  return (
    <div className="stock-movements-page">
      <div className="page-header">
        <div className="title-group">
          <h1>{t('movements.title')}</h1>
          <p>{t('movements.subtitle')}</p>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="filters-card">
        <div className="select-group">
          <label>{t('movements.warehouseLabel')}</label>
          <select
            value={selectedWh}
            onChange={(e) => {
              setSelectedWh(e.target.value);
              setPage(1);
            }}
          >
            <option value="">{t('movements.allWarehouses')}</option>
            {warehouses.map((wh) => (
              <option key={wh.id} value={wh.id}>
                {wh.code} - {wh.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>{t('movements.colTimestamp')}</th>
              <th>{t('movements.colVoucher')}</th>
              <th>{t('movements.colFacility')}</th>
              <th>{t('movements.colSkuProduct')}</th>
              <th>{t('movements.colDelta')}</th>
              <th>{t('movements.colBefore')}</th>
              <th>{t('movements.colAfter')}</th>
              <th>{t('movements.colAuthorizedBy')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>
                  {t('movements.loading')}
                </td>
              </tr>
            ) : movements.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>
                  {t('movements.emptyDesc')}
                </td>
              </tr>
            ) : (
              movements.map((m) => {
                const docCode = m.documentItem?.document?.documentCode;
                const docId = m.documentItem?.document?.id;
                const approver = m.documentItem?.document?.approvedBy?.name;

                return (
                  <tr key={m.id}>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                      {new Date(m.createdAt).toLocaleString(dateLocale)}
                    </td>
                    <td>
                      {docId ? (
                        <Link to={`/stock-documents/${docId}`} className="doc-link">
                          {docCode}
                        </Link>
                      ) : (
                        docCode || '—'
                      )}
                    </td>
                    <td>
                      <span className="code-chip">{m.warehouse?.code}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <span className="code-chip">{m.variant?.sku}</span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                          {m.variant?.product?.name}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={`delta-badge ${m.delta > 0 ? 'positive' : 'negative'}`}>
                        {m.delta > 0 ? `+${m.delta}` : m.delta}
                      </span>
                    </td>
                    <td>{m.quantityBefore}</td>
                    <td>
                      <strong>{m.quantityAfter}</strong>
                    </td>
                    <td style={{ color: 'var(--color-text-secondary)' }}>
                      {approver || t('movements.systemActor')}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <span>{t('common.pageOf', { page, total: totalPages })}</span>
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
  );
};
