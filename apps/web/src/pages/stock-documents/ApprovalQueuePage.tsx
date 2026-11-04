import React, { useEffect, useState } from 'react';
import { StockDocument, StockDocStatus, StockDocType } from '@cloud-stock/shared';
import { inventoryApi } from '../../features/inventory/inventory.api';
import { useAuth } from '../../features/auth/AuthContext';
import { Link } from 'react-router-dom';
import { CheckCircle2, XCircle, Clock, Eye } from 'lucide-react';
import './ApprovalQueuePage.scss';

export const ApprovalQueuePage: React.FC = () => {
  const { user } = useAuth();
  const [pendingDocs, setPendingDocs] = useState<StockDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPendingDocs = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await inventoryApi.getDocuments({
        status: StockDocStatus.PENDING,
        limit: 50,
      });
      if (res.success && res.data) {
        setPendingDocs(res.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load approval queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPendingDocs();
  }, []);

  const handleQuickApprove = async (doc: StockDocument) => {
    if (
      !window.confirm(
        `Confirm approval for document ${doc.documentCode}? This will immediately update inventory balances in PostgreSQL.`
      )
    ) {
      return;
    }

    try {
      setActionLoading(true);
      setError(null);
      await inventoryApi.approveDocument(doc.id);
      loadPendingDocs();
    } catch (err: any) {
      setError(err.message || 'Approval failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleQuickReject = async (doc: StockDocument) => {
    const reason = window.prompt(`Enter reason for rejecting voucher ${doc.documentCode}:`);
    if (reason === null) return;

    try {
      setActionLoading(true);
      setError(null);
      await inventoryApi.rejectDocument(doc.id, reason);
      loadPendingDocs();
    } catch (err: any) {
      setError(err.message || 'Rejection failed');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="approval-queue-page">
      <div className="page-header">
        <div className="title-group">
          <h1>
            <Clock size={24} />
            <span>Document Approval Queue</span>
          </h1>
          <p>
            Vouchers submitted by warehouse personnel awaiting authorization before posting to the inventory ledger.
          </p>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Document Code</th>
              <th>Type</th>
              <th>Route</th>
              <th>Line Items</th>
              <th>Submitted By</th>
              <th>Submission Date</th>
              <th>Review Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>
                  Loading approval queue...
                </td>
              </tr>
            ) : pendingDocs.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>
                  ✨ All caught up! No stock documents are currently pending approval.
                </td>
              </tr>
            ) : (
              pendingDocs.map((doc) => {
                const isCreator = user?.id === doc.createdById;

                return (
                  <tr key={doc.id}>
                    <td>
                      <span className="doc-code">{doc.documentCode}</span>
                    </td>
                    <td>
                      <strong style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>{doc.type}</strong>
                    </td>
                    <td>
                      {doc.type === StockDocType.TRANSFER ? (
                        <span>
                          {doc.sourceWarehouse?.code} &rarr; {doc.destinationWarehouse?.code}
                        </span>
                      ) : doc.type === StockDocType.INBOUND ? (
                        <span>&rarr; {doc.destinationWarehouse?.code}</span>
                      ) : (
                        <span>{doc.sourceWarehouse?.code} &rarr;</span>
                      )}
                    </td>
                    <td>
                      <strong>{doc._count?.items ?? doc.items?.length ?? 0}</strong> SKU(s)
                    </td>
                    <td>{doc.createdBy?.name || 'Staff Member'}</td>
                    <td style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </td>
                    <td>
                      <div className="actions-cell">
                        {isCreator ? (
                          <span className="self-creator-tag">
                            (Self-created voucher)
                          </span>
                        ) : (
                          <>
                            <button
                              className="btn-quick-approve"
                              disabled={actionLoading}
                              onClick={() => handleQuickApprove(doc)}
                            >
                              <CheckCircle2 size={14} />
                              <span>Approve</span>
                            </button>
                            <button
                              className="btn-quick-reject"
                              disabled={actionLoading}
                              onClick={() => handleQuickReject(doc)}
                            >
                              <XCircle size={14} />
                              <span>Reject</span>
                            </button>
                          </>
                        )}
                        <Link to={`/stock-documents/${doc.id}`} className="btn-view">
                          <Eye size={14} />
                          <span>Review</span>
                        </Link>
                      </div>
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
