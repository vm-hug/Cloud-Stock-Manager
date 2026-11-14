import React, { useEffect, useState } from 'react';
import { StockDocument, StockDocType, StockDocStatus, Warehouse } from '@cloud-stock/shared';
import { inventoryApi } from '../../features/inventory/inventory.api';
import { useI18n } from '../../features/i18n/I18nContext';
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
  const { t, lang } = useI18n();
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
        type: (typeFilter as StockDocType) || undefined,
        status: (statusFilter as StockDocStatus) || undefined,
        warehouseId: selectedWh || undefined,
      });

      if (res.success && res.data) {
        setDocuments(res.data);
        if (res.pagination) {
          setTotalPages(res.pagination.totalPages || 1);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('stockDocs.emptyDesc'));
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

  const getStatusLabel = (status: StockDocStatus) => {
    switch (status) {
      case StockDocStatus.DRAFT:
        return t('stockDocs.statusDraft');
      case StockDocStatus.PENDING:
        return t('stockDocs.statusPending');
      case StockDocStatus.POSTED:
        return t('stockDocs.statusPosted');
      case StockDocStatus.REJECTED:
        return t('stockDocs.statusRejected');
      case StockDocStatus.CANCELLED:
        return t('stockDocs.statusCancelled');
      default:
        return status;
    }
  };

  const renderTypeBadge = (type: StockDocType) => {
    switch (type) {
      case StockDocType.INBOUND:
        return (
          <span className="type-badge inbound">
            <ArrowDownLeft size={13} />
            <span>{t('stockDocs.typeInbound')}</span>
          </span>
        );
      case StockDocType.OUTBOUND:
        return (
          <span className="type-badge outbound">
            <ArrowUpRight size={13} />
            <span>{t('stockDocs.typeOutbound')}</span>
          </span>
        );
      case StockDocType.TRANSFER:
        return (
          <span className="type-badge transfer">
            <Repeat size={13} />
            <span>{t('stockDocs.typeTransfer')}</span>
          </span>
        );
      case StockDocType.ADJUSTMENT:
        return (
          <span className="type-badge adjustment">
            <SlidersHorizontal size={13} />
            <span>{t('stockDocs.typeAdjustment')}</span>
          </span>
        );
    }
  };

  return (
    <div className="stock-documents-page">
      <div className="page-header">
        <div className="title-group">
          <h1>{t('stockDocs.title')}</h1>
          <p>{t('stockDocs.subtitle')}</p>
        </div>
        <Link to="/stock-documents/create" className="btn-create">
          <Plus size={18} />
          <span>{t('stockDocs.newDocument')}</span>
        </Link>
      </div>

      <div className="filters-card">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder={t('stockDocs.searchPlaceholder')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="select-group">
          <label>{t('stockDocs.typeLabel')}</label>
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">{t('stockDocs.allTypes')}</option>
            <option value="INBOUND">{t('stockDocs.typeInbound')}</option>
            <option value="OUTBOUND">{t('stockDocs.typeOutbound')}</option>
            <option value="TRANSFER">{t('stockDocs.typeTransfer')}</option>
            <option value="ADJUSTMENT">{t('stockDocs.typeAdjustment')}</option>
          </select>
        </div>

        <div className="select-group">
          <label>{t('stockDocs.statusLabel')}</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">{t('stockDocs.allStatuses')}</option>
            <option value="DRAFT">{t('stockDocs.statusDraft')}</option>
            <option value="PENDING">{t('stockDocs.statusPending')}</option>
            <option value="POSTED">{t('stockDocs.statusPosted')}</option>
            <option value="REJECTED">{t('stockDocs.statusRejected')}</option>
            <option value="CANCELLED">{t('stockDocs.statusCancelled')}</option>
          </select>
        </div>

        <div className="select-group">
          <label>{t('stockDocs.warehouseLabel')}</label>
          <select
            value={selectedWh}
            onChange={(e) => {
              setSelectedWh(e.target.value);
              setPage(1);
            }}
          >
            <option value="">{t('stockDocs.allWarehouses')}</option>
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
              <th>{t('stockDocs.colCode')}</th>
              <th>{t('stockDocs.colType')}</th>
              <th>{t('stockDocs.colStatus')}</th>
              <th>{t('stockDocs.colRoute')}</th>
              <th>{t('stockDocs.colItems')}</th>
              <th>{t('stockDocs.colCreatedBy')}</th>
              <th>{t('stockDocs.colDate')}</th>
              <th>{t('stockDocs.colAction')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>
                  {t('stockDocs.loading')}
                </td>
              </tr>
            ) : documents.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>
                  {t('stockDocs.emptyDesc')}
                </td>
              </tr>
            ) : (
              documents.map((doc) => (
                <tr key={doc.id}>
                  <td>
                    <span className="code-chip">{doc.documentCode}</span>
                  </td>
                  <td>{renderTypeBadge(doc.type)}</td>
                  <td>
                    <span className={`status-badge ${doc.status.toLowerCase()}`}>
                      {getStatusLabel(doc.status)}
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
                    {t('stockDocs.skuItemsCount', {
                      count: doc._count?.items ?? doc.items?.length ?? 0,
                    })}
                  </td>
                  <td style={{ color: 'var(--color-text-secondary)' }}>
                    {doc.createdBy?.name || t('stockDocs.colCreatedBy')}
                  </td>
                  <td style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                    {new Date(doc.createdAt).toLocaleDateString(
                      lang === 'vi' ? 'vi-VN' : 'en-US'
                    )}
                  </td>
                  <td>
                    <Link to={`/stock-documents/${doc.id}`} className="action-btn">
                      <Eye size={14} />
                      <span>{t('stockDocs.viewBtn')}</span>
                    </Link>
                  </td>
                </tr>
              ))
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
