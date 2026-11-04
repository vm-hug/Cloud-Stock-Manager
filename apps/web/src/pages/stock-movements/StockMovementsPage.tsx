import React, { useEffect, useState } from 'react';
import { StockMovement, Warehouse } from '@cloud-stock/shared';
import { inventoryApi } from '../../features/inventory/inventory.api';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './StockMovementsPage.scss';

export const StockMovementsPage: React.FC = () => {
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
    } catch (err: any) {
      setError(err.message || 'Failed to load stock movements');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMovements();
  }, [page, selectedWh]);

  return (
    <div className="stock-movements-page">
      <div className="page-header">
        <div className="title-group">
          <h1>Stock Movement Ledger</h1>
          <p>
            Immutable chronological audit card of all physical stock movements, balance changes, and posting vouchers.
          </p>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="filters-card">
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
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Voucher Code</th>
              <th>Facility</th>
              <th>SKU & Product</th>
              <th>Delta</th>
              <th>Qty Before</th>
              <th>Qty After</th>
              <th>Authorized By</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>
                  Loading movements ledger...
                </td>
              </tr>
            ) : movements.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>
                  No stock movements recorded yet. Movements are generated when stock documents are POSTED.
                </td>
              </tr>
            ) : (
              movements.map((m) => {
                const docCode = m.documentItem?.document?.documentCode;
                const docId = m.documentItem?.document?.id;
                const approver = m.documentItem?.document?.approvedBy?.name;

                return (
                  <tr key={m.id}>
                    <td style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                      {new Date(m.createdAt).toLocaleString()}
                    </td>
                    <td>
                      {docId ? (
                        <Link to={`/stock-documents/${docId}`} className="doc-link">
                          {docCode}
                        </Link>
                      ) : (
                        docCode || 'N/A'
                      )}
                    </td>
                    <td>
                      <span style={{ fontFamily: 'monospace', color: '#cbd5e1' }}>
                        {m.warehouse?.code}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontFamily: 'monospace', color: '#a5b4fc', fontWeight: 600 }}>
                          {m.variant?.sku}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
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
                    <td style={{ color: '#cbd5e1' }}>{approver || 'System'}</td>
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
    </div>
  );
};
