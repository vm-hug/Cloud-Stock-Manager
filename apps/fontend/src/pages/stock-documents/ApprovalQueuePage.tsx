import React, { useEffect, useState } from 'react';
import { StockDocument, StockDocStatus, StockDocType } from '@cloud-stock/shared';
import { inventoryApi } from '../../features/inventory/inventory.api';
import { useAuth } from '../../features/auth/AuthContext';
import { useI18n } from '../../features/i18n/I18nContext';
import { Link } from 'react-router-dom';
import { CheckCircle2, XCircle, Clock, Eye } from 'lucide-react';
import './ApprovalQueuePage.scss';

export const ApprovalQueuePage: React.FC = () => {
  const { user } = useAuth();
  const { t, lang } = useI18n();
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('approvals.emptyDesc'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPendingDocs();
  }, []);

  const getTypeLabel = (type: StockDocType) => {
    switch (type) {
      case StockDocType.INBOUND:
        return t('stockDocs.typeInbound');
      case StockDocType.OUTBOUND:
        return t('stockDocs.typeOutbound');
      case StockDocType.TRANSFER:
        return t('stockDocs.typeTransfer');
      case StockDocType.ADJUSTMENT:
        return t('stockDocs.typeAdjustment');
    }
  };

  const handleQuickApprove = async (doc: StockDocument) => {
    if (!window.confirm(t('approvals.confirmApprove', { code: doc.documentCode }))) {
      return;
    }

    try {
      setActionLoading(true);
      setError(null);
      await inventoryApi.approveDocument(doc.id);
      loadPendingDocs();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('approvals.emptyDesc'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleQuickReject = async (doc: StockDocument) => {
    const reason = window.prompt(t('approvals.promptReject', { code: doc.documentCode }));
    if (reason === null) return;

    try {
      setActionLoading(true);
      setError(null);
      await inventoryApi.rejectDocument(doc.id, reason);
      loadPendingDocs();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('approvals.emptyDesc'));
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
            <span>{t('approvals.title')}</span>
          </h1>
          <p>{t('approvals.subtitle')}</p>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>{t('approvals.colCode')}</th>
              <th>{t('approvals.colType')}</th>
              <th>{t('approvals.colRoute')}</th>
              <th>{t('approvals.colLineItems')}</th>
              <th>{t('approvals.colSubmittedBy')}</th>
              <th>{t('approvals.colDate')}</th>
              <th>{t('approvals.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>
                  {t('approvals.loading')}
                </td>
              </tr>
            ) : pendingDocs.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>
                  {t('approvals.emptyDesc')}
                </td>
              </tr>
            ) : (
              pendingDocs.map((doc) => {
                const isCreator = user?.id === doc.createdById;

                return (
                  <tr key={doc.id}>
                    <td>
                      <span className="code-chip">{doc.documentCode}</span>
                    </td>
                    <td>
                      <strong style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
                        {getTypeLabel(doc.type)}
                      </strong>
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
                      {t('stockDocs.skuItemsCount', {
                        count: doc._count?.items ?? doc.items?.length ?? 0,
                      })}
                    </td>
                    <td>{doc.createdBy?.name || t('common.unassigned')}</td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                      {new Date(doc.createdAt).toLocaleDateString(
                        lang === 'vi' ? 'vi-VN' : 'en-US'
                      )}
                    </td>
                    <td>
                      <div className="actions-cell">
                        {isCreator ? (
                          <span className="self-creator-tag">
                            {t('approvals.selfCreatedTag')}
                          </span>
                        ) : (
                          <>
                            <button
                              className="btn-quick-approve"
                              disabled={actionLoading}
                              onClick={() => handleQuickApprove(doc)}
                            >
                              <CheckCircle2 size={14} />
                              <span>{t('approvals.approveBtn')}</span>
                            </button>
                            <button
                              className="btn-quick-reject"
                              disabled={actionLoading}
                              onClick={() => handleQuickReject(doc)}
                            >
                              <XCircle size={14} />
                              <span>{t('approvals.rejectBtn')}</span>
                            </button>
                          </>
                        )}
                        <Link to={`/stock-documents/${doc.id}`} className="btn-view">
                          <Eye size={14} />
                          <span>{t('approvals.reviewBtn')}</span>
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
