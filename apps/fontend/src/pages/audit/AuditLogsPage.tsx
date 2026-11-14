import React, { useEffect, useState, useCallback } from 'react';
import { auditApi } from '../../features/audit/audit.api';
import { useI18n } from '../../features/i18n/I18nContext';
import { AuditLogEntry } from '@cloud-stock/shared';
import { formatDate } from '../../lib/utils';
import { History, RefreshCw, X, Code2 } from 'lucide-react';
import './AuditLogsPage.scss';

export const AuditLogsPage: React.FC = () => {
  const { t } = useI18n();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [inspectModal, setInspectModal] = useState<AuditLogEntry | null>(null);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await auditApi.getAuditLogs({
        page,
        limit: 15,
        action: actionFilter || undefined,
      });

      if (res.success && res.data) {
        setLogs(res.data.items);
        setTotal(res.data.pagination.total);
        setTotalPages(res.data.pagination.totalPages);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setIsLoading(false);
    }
  }, [page, actionFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="audit-page">
      <div className="page-header-actions">
        <div className="header-left">
          <h2 className="title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <History size={24} style={{ color: 'var(--color-accent-text)' }} />
            <span>{t('auditLogs.title')}</span>
          </h2>
          <p className="description">{t('auditLogs.subtitle')}</p>
        </div>
      </div>

      <div className="filters-bar">
        <select
          className="select-filter"
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">{t('auditLogs.allEvents')}</option>
          <option value="LOGIN_SUCCESS">LOGIN_SUCCESS</option>
          <option value="LOGIN_FAILED">LOGIN_FAILED</option>
          <option value="LOGOUT">LOGOUT</option>
          <option value="REFRESH_TOKEN_REVOKED">REFRESH_TOKEN_REVOKED</option>
          <option value="CREATE_USER">CREATE_USER</option>
          <option value="UPDATE_USER">UPDATE_USER</option>
          <option value="CHANGE_USER_ROLE">CHANGE_USER_ROLE</option>
          <option value="ACTIVATE_USER">ACTIVATE_USER</option>
          <option value="DEACTIVATE_USER">DEACTIVATE_USER</option>
          <option value="RESET_USER_PASSWORD">RESET_USER_PASSWORD</option>
        </select>

        <button
          onClick={() => fetchLogs()}
          style={{
            padding: '0.5rem 0.75rem',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '0.5rem',
            color: 'var(--color-text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          <span>{t('common.refresh')}</span>
        </button>
      </div>

      <div className="table-card">
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>{t('auditLogs.colTimestamp')}</th>
                <th>{t('auditLogs.colActor')}</th>
                <th>{t('auditLogs.colAction')}</th>
                <th>{t('auditLogs.colEntity')}</th>
                <th>{t('auditLogs.colIp')}</th>
                <th>{t('auditLogs.colMetadata')}</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}
                  >
                    {isLoading ? t('auditLogs.loading') : t('auditLogs.emptyDesc')}
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td
                      style={{
                        whiteSpace: 'nowrap',
                        fontSize: '0.8rem',
                        color: 'var(--color-text-muted)',
                      }}
                    >
                      {formatDate(log.createdAt)}
                    </td>
                    <td>
                      {log.actorName ? (
                        <div>
                          <div style={{ fontWeight: 600 }}>{log.actorName}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                            {log.actorEmail}
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                          {t('auditLogs.systemAnon')}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`audit-badge ${log.action}`}>{log.action}</span>
                    </td>
                    <td style={{ fontSize: '0.8rem' }}>
                      <span style={{ color: 'var(--color-accent-text)', fontWeight: 600 }}>
                        {log.entityType}
                      </span>
                      :{' '}
                      <span style={{ color: 'var(--color-text-secondary)' }}>{log.entityId}</span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                      {log.ipAddress || '—'}
                    </td>
                    <td>
                      {log.metadata ? (
                        <div
                          className="metadata-code"
                          title={t('auditLogs.inspectTooltip')}
                          onClick={() => setInspectModal(log)}
                        >
                          <Code2 size={12} style={{ display: 'inline', marginRight: 4 }} />
                          {JSON.stringify(log.metadata)}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)' }}>
                          {t('auditLogs.noneMeta')}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="pagination">
          <span>{t('common.showingOf', { count: logs.length, total })}</span>
          <div className="btn-group">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              {t('common.previous')}
            </button>
            <span style={{ padding: '0.35rem 0.75rem' }}>
              {t('common.pageOf', { page, total: totalPages })}
            </span>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              {t('common.next')}
            </button>
          </div>
        </div>
      </div>

      {inspectModal && (
        <div className="modal-overlay" onClick={() => setInspectModal(null)}>
          <div className="modal-card" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="title">{t('auditLogs.inspectTitle')}</h3>
                <p className="modal-subtitle">
                  {inspectModal.action} • {inspectModal.entityType} ({inspectModal.entityId})
                </p>
              </div>
              <button className="close-btn" onClick={() => setInspectModal(null)}>
                <X size={20} />
              </button>
            </div>
            <pre
              style={{
                background: 'var(--color-surface-elevated)',
                border: '1px solid var(--color-border)',
                padding: '1rem',
                borderRadius: '0.75rem',
                color: 'var(--color-text-primary)',
                fontSize: '0.8rem',
                overflowX: 'auto',
                maxHeight: '300px',
              }}
            >
              {JSON.stringify(inspectModal.metadata, null, 2)}
            </pre>
            <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="cancel-btn"
                style={{
                  padding: '0.5rem 1.15rem',
                  borderRadius: '12px',
                  background: 'var(--color-accent)',
                  color: '#fff',
                  fontWeight: 600,
                }}
                onClick={() => setInspectModal(null)}
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
