import React, { useEffect, useState } from 'react';
import { StockDocument, StockDocStatus, StockDocType, Role } from '@cloud-stock/shared';
import { inventoryApi } from '../../features/inventory/inventory.api';
import { useAuth } from '../../features/auth/AuthContext';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Send,
  Ban,
} from 'lucide-react';
import './StockDocumentDetailPage.scss';

export const StockDocumentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [doc, setDoc] = useState<StockDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDocument = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const res = await inventoryApi.getDocumentById(id);
      if (res.success && res.data) {
        setDoc(res.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load document');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocument();
  }, [id]);

  if (loading) {
    return <div className="stock-document-detail-page"><p>Loading document details...</p></div>;
  }

  if (!doc) {
    return (
      <div className="stock-document-detail-page">
        <p>Document not found.</p>
        <Link to="/stock-documents">Back to Documents</Link>
      </div>
    );
  }

  const isCreator = user?.id === doc.createdById;
  const isAdminOrManager = user?.role === Role.ADMIN || user?.role === Role.MANAGER;
  const canApprove = isAdminOrManager && !isCreator; // Enforcing strict creator != approver invariant
  const canSubmit = doc.status === StockDocStatus.DRAFT && (isCreator || isAdminOrManager);
  const canCancel =
    (doc.status === StockDocStatus.DRAFT || doc.status === StockDocStatus.PENDING) &&
    (isCreator || isAdminOrManager);

  const handleSubmit = async () => {
    try {
      setActionLoading(true);
      setError(null);
      await inventoryApi.submitDocument(doc.id);
      loadDocument();
    } catch (err: any) {
      setError(err.message || 'Failed to submit document');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!window.confirm(`Are you sure you want to APPROVE and POST document ${doc.documentCode}? This will immediately update warehouse inventory balances.`)) {
      return;
    }

    try {
      setActionLoading(true);
      setError(null);
      await inventoryApi.approveDocument(doc.id);
      loadDocument();
    } catch (err: any) {
      setError(err.message || 'Approval failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    const reason = window.prompt('Enter reason for rejecting this document:');
    if (reason === null) return; // user cancelled prompt

    try {
      setActionLoading(true);
      setError(null);
      await inventoryApi.rejectDocument(doc.id, reason);
      loadDocument();
    } catch (err: any) {
      setError(err.message || 'Rejection failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel this document?')) return;

    try {
      setActionLoading(true);
      setError(null);
      await inventoryApi.cancelDocument(doc.id);
      loadDocument();
    } catch (err: any) {
      setError(err.message || 'Cancel failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Collect all stock movements if posted
  const allMovements = doc.items?.flatMap((i) => i.stockMovements || []) || [];

  return (
    <div className="stock-document-detail-page">
      <div className="page-header">
        <div>
          <Link to="/stock-documents" className="back-link">
            <ArrowLeft size={16} />
            <span>Back to Documents</span>
          </Link>
          <div className="title-row">
            <h1>{doc.documentCode}</h1>
            <span className={`status-badge ${doc.status.toLowerCase()}`}>{doc.status}</span>
          </div>
        </div>

        <div className="header-actions">
          {canSubmit && (
            <button className="btn-submit" disabled={actionLoading} onClick={handleSubmit}>
              <Send size={15} />
              <span>Submit for Approval</span>
            </button>
          )}

          {doc.status === StockDocStatus.PENDING && canApprove && (
            <>
              <button className="btn-approve" disabled={actionLoading} onClick={handleApprove}>
                <CheckCircle size={15} />
                <span>Approve & Post</span>
              </button>
              <button className="btn-reject" disabled={actionLoading} onClick={handleReject}>
                <XCircle size={15} />
                <span>Reject</span>
              </button>
            </>
          )}

          {canCancel && (
            <button className="btn-cancel" disabled={actionLoading} onClick={handleCancel}>
              <Ban size={15} />
              <span>Cancel Voucher</span>
            </button>
          )}
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="meta-grid">
        <div className="meta-card">
          <span className="meta-label">Operation Type</span>
          <span className="meta-value mono">{doc.type}</span>
        </div>

        <div className="meta-card">
          <span className="meta-label">Route / Warehouse</span>
          <span className="meta-value">
            {doc.type === StockDocType.TRANSFER ? (
              `${doc.sourceWarehouse?.code} -> ${doc.destinationWarehouse?.code}`
            ) : doc.type === StockDocType.INBOUND ? (
              `To: ${doc.destinationWarehouse?.name} (${doc.destinationWarehouse?.code})`
            ) : (
              `From: ${doc.sourceWarehouse?.name} (${doc.sourceWarehouse?.code})`
            )}
          </span>
        </div>

        <div className="meta-card">
          <span className="meta-label">Created By</span>
          <span className="meta-value">{doc.createdBy?.name || 'User'}</span>
        </div>

        <div className="meta-card">
          <span className="meta-label">Created Date</span>
          <span className="meta-value">{new Date(doc.createdAt).toLocaleString()}</span>
        </div>

        {doc.approvedBy && (
          <div className="meta-card">
            <span className="meta-label">Approved By</span>
            <span className="meta-value">{doc.approvedBy.name}</span>
          </div>
        )}

        {doc.postedAt && (
          <div className="meta-card">
            <span className="meta-label">Posted Timestamp</span>
            <span className="meta-value">{new Date(doc.postedAt).toLocaleString()}</span>
          </div>
        )}
      </div>

      {doc.note && (
        <div className="section-card">
          <h3>Document Memo & Justification</h3>
          <p style={{ color: '#cbd5e1', margin: 0 }}>{doc.note}</p>
        </div>
      )}

      <div className="section-card">
        <h3>Document Line Items ({doc.items?.length || 0})</h3>
        <table className="items-table">
          <thead>
            <tr>
              <th>SKU Code</th>
              <th>Product & Variant</th>
              <th>Quantity</th>
              {doc.type === StockDocType.ADJUSTMENT && <th>Adjustment Delta</th>}
              <th>Unit Price</th>
            </tr>
          </thead>
          <tbody>
            {doc.items?.map((item) => (
              <tr key={item.id}>
                <td>
                  <strong style={{ fontFamily: 'monospace', color: '#a5b4fc' }}>
                    {item.variant?.sku}
                  </strong>
                </td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 600 }}>{item.variant?.product?.name}</span>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                      {item.variant?.name}
                    </span>
                  </div>
                </td>
                <td>
                  <strong>{item.quantity}</strong> units
                </td>
                {doc.type === StockDocType.ADJUSTMENT && (
                  <td>
                    <span
                      className={`delta-pill ${
                        (item.adjustmentDelta || 0) > 0 ? 'positive' : 'negative'
                      }`}
                    >
                      {(item.adjustmentDelta || 0) > 0 ? `+${item.adjustmentDelta}` : item.adjustmentDelta}
                    </span>
                  </td>
                )}
                <td>{item.unitPrice ? `$${Number(item.unitPrice).toFixed(2)}` : 'N/A'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* When POSTED, show generated stock movements */}
      {doc.status === StockDocStatus.POSTED && allMovements.length > 0 && (
        <div className="section-card">
          <h3>Committed Stock Movements (Immutable Ledger)</h3>
          <table className="movements-table">
            <thead>
              <tr>
                <th>Warehouse</th>
                <th>Delta</th>
                <th>Qty Before</th>
                <th>Qty After</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {allMovements.map((m) => (
                <tr key={m.id}>
                  <td>
                    <strong style={{ fontFamily: 'monospace' }}>
                      {m.warehouse?.code || m.warehouseId}
                    </strong>
                  </td>
                  <td>
                    <span className={`delta-pill ${m.delta > 0 ? 'positive' : 'negative'}`}>
                      {m.delta > 0 ? `+${m.delta}` : m.delta}
                    </span>
                  </td>
                  <td>{m.quantityBefore}</td>
                  <td>
                    <strong>{m.quantityAfter}</strong>
                  </td>
                  <td style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                    {new Date(m.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
