import React, { useEffect, useState } from 'react';
import { StockDocument, StockDocStatus, StockDocType, Role } from '@cloud-stock/shared';
import { inventoryApi } from '../../features/inventory/inventory.api';
import { useAuth } from '../../features/auth/AuthContext';
import { useI18n } from '../../features/i18n/I18nContext';
import { useNotifications } from '../../features/notifications/NotificationContext';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle, XCircle, Send, Ban, AlertCircle } from 'lucide-react';
import './StockDocumentDetailPage.scss';

export const StockDocumentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const { showToast } = useNotifications();
  const [doc, setDoc] = useState<StockDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDocument = async (silent = false) => {
    if (!id) return;
    try {
      if (!silent) setLoading(true);
      const res = await inventoryApi.getDocumentById(id);
      if (res.success && res.data) {
        setDoc(res.data);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('stockDocs.notFound'));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadDocument();
    const onDocChanged = (e: Event) => {
      const custom = e as CustomEvent<{ id?: string }>;
      if (!custom.detail?.id || custom.detail.id === id) {
        loadDocument(true);
      }
    };
    window.addEventListener('cloudstock:stock-document-changed', onDocChanged);
    return () => {
      window.removeEventListener('cloudstock:stock-document-changed', onDocChanged);
    };
  }, [id]);

  if (loading) {
    return (
      <div className="stock-document-detail-page">
        <p>{t('stockDocs.loadingDetail')}</p>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="stock-document-detail-page">
        <p>{t('stockDocs.notFound')}</p>
        <Link to="/stock-documents">{t('stockDocs.backToList')}</Link>
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
    }
  };

  const handleSubmit = async () => {
    try {
      setActionLoading(true);
      setError(null);
      const res = await inventoryApi.submitDocument(doc.id);
      if (!res.success) {
        setError(
          res.error?.message ||
            (lang === 'vi' ? 'Không thể gửi phê duyệt phiếu kho.' : 'Failed to submit voucher.')
        );
        return;
      }
      showToast({
        type: 'info',
        title: lang === 'vi' ? 'Đã gửi yêu cầu phê duyệt' : 'Submitted for Approval',
        message:
          lang === 'vi'
            ? `Phiếu ${doc.documentCode} đã được gửi tới Quản lý kho / Admin để phê duyệt.`
            : `Voucher ${doc.documentCode} has been sent to Manager / Admin for approval.`,
      });
      loadDocument(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('stockDocs.notFound'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!window.confirm(t('stockDocs.confirmApprove', { code: doc.documentCode }))) {
      return;
    }

    try {
      setActionLoading(true);
      setError(null);
      const res = await inventoryApi.approveDocument(doc.id);
      if (!res.success) {
        const rawMsg = res.error?.message || '';
        const stockMatch = rawMsg.match(
          /Insufficient stock for SKU \[([^\]]+)\] at warehouse \[([^\]]+)\]\.\s*Available:\s*(\d+),\s*Requested:\s*(\d+)/i
        );
        const displayMsg = stockMatch
          ? lang === 'vi'
            ? `Chống xuất âm: Không đủ tồn kho cho mã SKU [${stockMatch[1]}] tại kho [${stockMatch[2]}]. Tồn khả dụng: ${stockMatch[3]}, Yêu cầu xuất: ${stockMatch[4]}.`
            : rawMsg
          : rawMsg ||
            (lang === 'vi'
              ? 'Không thể phê duyệt phiếu kho.'
              : 'Failed to approve stock voucher.');
        setError(displayMsg);
        return;
      }
      showToast({
        type: 'success',
        title: lang === 'vi' ? 'Đã phê duyệt & chốt tồn kho' : 'Voucher Approved & Posted',
        message:
          lang === 'vi'
            ? `Phiếu ${doc.documentCode} đã chuyển sang ĐÃ GHI SỔ (POSTED) và cập nhật tồn kho thực tế.`
            : `Voucher ${doc.documentCode} has been POSTED and inventory balances updated.`,
      });
      loadDocument(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('stockDocs.notFound'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    const reason = window.prompt(t('stockDocs.promptRejectReason'));
    if (reason === null) return;

    try {
      setActionLoading(true);
      setError(null);
      const res = await inventoryApi.rejectDocument(doc.id, reason);
      if (!res.success) {
        setError(
          res.error?.message ||
            (lang === 'vi' ? 'Không thể từ chối phiếu kho.' : 'Failed to reject voucher.')
        );
        return;
      }
      showToast({
        type: 'warning',
        title: lang === 'vi' ? 'Đã từ chối chứng từ' : 'Voucher Rejected',
        message:
          lang === 'vi'
            ? `Phiếu ${doc.documentCode} đã chuyển sang trạng thái TỪ CHỐI (REJECTED).`
            : `Voucher ${doc.documentCode} was marked as REJECTED.`,
      });
      loadDocument(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('stockDocs.notFound'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm(t('stockDocs.confirmCancel'))) return;

    try {
      setActionLoading(true);
      setError(null);
      const res = await inventoryApi.cancelDocument(doc.id);
      if (!res.success) {
        setError(
          res.error?.message ||
            (lang === 'vi' ? 'Không thể hủy phiếu kho.' : 'Failed to cancel voucher.')
        );
        return;
      }
      showToast({
        type: 'warning',
        title: lang === 'vi' ? 'Đã hủy chứng từ' : 'Voucher Cancelled',
        message:
          lang === 'vi'
            ? `Phiếu ${doc.documentCode} đã được hủy.`
            : `Voucher ${doc.documentCode} has been cancelled.`,
      });
      loadDocument(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('stockDocs.notFound'));
    } finally {
      setActionLoading(false);
    }
  };

  const allMovements = doc.items?.flatMap((i) => i.stockMovements || []) || [];
  const dateLocale = lang === 'vi' ? 'vi-VN' : 'en-US';

  return (
    <div className="stock-document-detail-page">
      <div className="page-header">
        <div>
          <Link to="/stock-documents" className="back-link">
            <ArrowLeft size={16} />
            <span>{t('stockDocs.backToList')}</span>
          </Link>
          <div className="title-row">
            <h1>{doc.documentCode}</h1>
            <span className={`status-badge ${doc.status.toLowerCase()}`}>
              {getStatusLabel(doc.status)}
            </span>
          </div>
        </div>

        <div className="header-actions">
          {canSubmit && (
            <button className="btn-submit" disabled={actionLoading} onClick={handleSubmit}>
              <Send size={15} />
              <span>{t('stockDocs.submitForApproval')}</span>
            </button>
          )}

          {doc.status === StockDocStatus.PENDING && canApprove && (
            <>
              <button className="btn-approve" disabled={actionLoading} onClick={handleApprove}>
                <CheckCircle size={15} />
                <span>{t('stockDocs.approveAndPost')}</span>
              </button>
              <button className="btn-reject" disabled={actionLoading} onClick={handleReject}>
                <XCircle size={15} />
                <span>{t('stockDocs.rejectBtn')}</span>
              </button>
            </>
          )}

          {doc.status === StockDocStatus.PENDING && isCreator && (
            <span
              style={{
                fontSize: '0.8rem',
                color: 'var(--color-warning-text)',
                background: 'var(--color-warning-bg)',
                padding: '0.45rem 0.75rem',
                borderRadius: '8px',
                fontWeight: 500,
              }}
            >
              {t('stockDocs.selfApprovalNotice')}
            </span>
          )}

          {canCancel && (
            <button className="btn-cancel" disabled={actionLoading} onClick={handleCancel}>
              <Ban size={15} />
              <span>{t('stockDocs.cancelVoucher')}</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div
          className="error-banner"
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontWeight: 600,
          }}
        >
          <AlertCircle size={17} />
          <span>{error}</span>
        </div>
      )}

      <div className="meta-grid">
        <div className="meta-card">
          <span className="meta-label">{t('stockDocs.metaType')}</span>
          <span className="meta-value mono">{getTypeLabel(doc.type)}</span>
        </div>

        <div className="meta-card">
          <span className="meta-label">{t('stockDocs.metaRoute')}</span>
          <span className="meta-value">
            {doc.type === StockDocType.TRANSFER
              ? `${doc.sourceWarehouse?.code} -> ${doc.destinationWarehouse?.code}`
              : doc.type === StockDocType.INBOUND
              ? `${doc.destinationWarehouse?.name} (${doc.destinationWarehouse?.code})`
              : `${doc.sourceWarehouse?.name} (${doc.sourceWarehouse?.code})`}
          </span>
        </div>

        <div className="meta-card">
          <span className="meta-label">{t('stockDocs.metaCreatedBy')}</span>
          <span className="meta-value">{doc.createdBy?.name || t('common.unassigned')}</span>
        </div>

        <div className="meta-card">
          <span className="meta-label">{t('stockDocs.metaCreatedAt')}</span>
          <span className="meta-value">{new Date(doc.createdAt).toLocaleString(dateLocale)}</span>
        </div>

        {doc.approvedBy && (
          <div className="meta-card">
            <span className="meta-label">{t('stockDocs.metaApprovedBy')}</span>
            <span className="meta-value">{doc.approvedBy.name}</span>
          </div>
        )}

        {doc.postedAt && (
          <div className="meta-card">
            <span className="meta-label">{t('stockDocs.metaPostedAt')}</span>
            <span className="meta-value">{new Date(doc.postedAt).toLocaleString(dateLocale)}</span>
          </div>
        )}
      </div>

      {doc.note && (
        <div className="section-card">
          <h3>{t('stockDocs.memoTitle')}</h3>
          <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>{doc.note}</p>
        </div>
      )}

      <div className="section-card">
        <h3>{t('stockDocs.lineItemsTitle', { count: doc.items?.length || 0 })}</h3>
        <table className="items-table">
          <thead>
            <tr>
              <th>{t('productDetail.colSkuCode')}</th>
              <th>{t('stockDocs.colProductVariant')}</th>
              <th>{t('stockDocs.colQuantity')}</th>
              {doc.type === StockDocType.ADJUSTMENT && (
                <th>{t('stockDocs.colAdjustmentDelta')}</th>
              )}
              <th>{t('stockDocs.colUnitPrice')}</th>
            </tr>
          </thead>
          <tbody>
            {doc.items?.map((item) => (
              <tr key={item.id}>
                <td>
                  <span className="code-chip">{item.variant?.sku}</span>
                </td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 600 }}>{item.variant?.product?.name}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                      {item.variant?.name}
                    </span>
                  </div>
                </td>
                <td>
                  <strong>{item.quantity}</strong> {t('common.units')}
                </td>
                {doc.type === StockDocType.ADJUSTMENT && (
                  <td>
                    <span
                      className={`delta-pill ${
                        (item.adjustmentDelta || 0) > 0 ? 'positive' : 'negative'
                      }`}
                    >
                      {(item.adjustmentDelta || 0) > 0
                        ? `+${item.adjustmentDelta}`
                        : item.adjustmentDelta}
                    </span>
                  </td>
                )}
                <td>
                  {item.unitPrice ? `${Number(item.unitPrice).toLocaleString()} VND` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {doc.status === StockDocStatus.POSTED && allMovements.length > 0 && (
        <div className="section-card">
          <h3>{t('stockDocs.committedMovementsTitle')}</h3>
          <table className="movements-table">
            <thead>
              <tr>
                <th>{t('stockDocs.colLedgerWarehouse')}</th>
                <th>{t('stockDocs.colDelta')}</th>
                <th>{t('stockDocs.colQtyBefore')}</th>
                <th>{t('stockDocs.colQtyAfter')}</th>
                <th>{t('stockDocs.colTimestamp')}</th>
              </tr>
            </thead>
            <tbody>
              {allMovements.map((m) => (
                <tr key={m.id}>
                  <td>
                    <span className="code-chip">{m.warehouse?.code || m.warehouseId}</span>
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
                  <td style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                    {new Date(m.createdAt).toLocaleString(dateLocale)}
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
