import React, { useEffect, useState } from 'react';
import { StockDocument, StockDocType, Warehouse } from '@cloud-stock/shared';
import { inventoryApi } from '../../features/inventory/inventory.api';
import { Link } from 'react-router-dom';
import {
  Plus,
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  Repeat,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Eye,
} from 'lucide-react';
import './StockDocumentsPage.scss';

export const StockDocumentsPage: React.FC = () => {
  const [documents, setDocuments] = useState<StockDocument[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedWh, setSelectedWh] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    inventoryApi.getWarehouses().then((res) => {
      if (res.success && res.data) setWarehouses(res.data);
    });
  }, []);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await inventoryApi.getDocuments({
        page,
        limit: 15,
        documentCode: search || undefined,
        type: (typeFilter as any) || undefined,
        status: (statusFilter as any) || undefined,
        warehouseId: selectedWh || undefined,
      });

      if (res.success && res.data) {
        setDocuments(res.data);
        if (res.pagination) {
          setTotalPages(res.pagination.totalPages || 1);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load stock documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadDocuments();
    }, 250);
    return () => clearTimeout(timer);
  }, [page, search, typeFilter, statusFilter, selectedWh]);

  const renderTypeBadge = (type: StockDocType) => {
    switch (type) {
      case StockDocType.INBOUND:
        return (
          <span className="type-badge inbound">
            <ArrowDownLeft size={13} />
            <span>INBOUND</span>
          </span>
        );
      case StockDocType.OUTBOUND:
        return (
          <span className="type-badge outbound">
            <ArrowUpRight size={13} />
            <span>OUTBOUND</span>
          </span>
        );
      case StockDocType.TRANSFER:
        return (
          <span className="type-badge transfer">
            <Repeat size={13} />
            <span>TRANSFER</span>
          </span>
        );
      case StockDocType.ADJUSTMENT:
        return (
          <span className="type-badge adjustment">
            <SlidersHorizontal size={13} />
            <span>ADJUSTMENT</span>
          </span>
        );
    }
  };

  return (
    <div className="stock-documents-page">
      <div className="page-header">
        <div className="title-group">
          <h1>Stock Documents</h1>
          <p>Create, track, and review inbound, outbound, transfer, and adjustment vouchers.</p>
        </div>
        <Link to="/stock-documents/create" className="btn-create">
          <Plus size={18} />
          <span>New Document</span>
        </Link>
      </div>

      <div className="filters-card">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search by document code..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="select-group">
          <label>Type:</label>
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Types</option>
            <option value="INBOUND">Inbound</option>
            <option value="OUTBOUND">Outbound</option>
            <option value="TRANSFER">Transfer</option>
            <option value="ADJUSTMENT">Adjustment</option>
          </select>
        </div>

        <div className="select-group">
          <label>Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="PENDING">Pending</option>
            <option value="POSTED">Posted</option>
            <option value="REJECTED">Rejected</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
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
                {wh.code}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Document Code</th>
              <th>Type</th>
              <th>Status</th>
              <th>Route / Warehouse</th>
              <th>Items</th>
              <th>Created By</th>
              <th>Date</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>
                  Loading stock documents...
                </td>
              </tr>
            ) : documents.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>
                  No stock documents found. Click "New Document" to create a draft.
                </td>
              </tr>
            ) : (
              documents.map((doc) => (
                <tr key={doc.id}>
                  <td>
                    <span className="doc-code">{doc.documentCode}</span>
                  </td>
                  <td>{renderTypeBadge(doc.type)}</td>
                  <td>
                    <span className={`status-badge ${doc.status.toLowerCase()}`}>
                      {doc.status}
                    </span>
                  </td>
                  <td>
                    {doc.type === StockDocType.TRANSFER ? (
                      <div className="wh-route">
                        <strong>{doc.sourceWarehouse?.code}</strong> &rarr;{' '}
                        <strong>{doc.destinationWarehouse?.code}</strong>
                      </div>
                    ) : doc.type === StockDocType.INBOUND ? (
                      <div className="wh-route">
                        &rarr; <strong>{doc.destinationWarehouse?.code}</strong>
                      </div>
                    ) : (
                      <div className="wh-route">
                        <strong>{doc.sourceWarehouse?.code}</strong> &rarr;
                      </div>
                    )}
                  </td>
                  <td>
                    <strong>{doc._count?.items ?? doc.items?.length ?? 0}</strong> SKU(s)
                  </td>
                  <td style={{ color: '#cbd5e1' }}>{doc.createdBy?.name || 'User'}</td>
                  <td style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </td>
                  <td>
                    <Link to={`/stock-documents/${doc.id}`} className="action-btn">
                      <Eye size={14} />
                      <span>View</span>
                    </Link>
                  </td>
                </tr>
              ))
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
