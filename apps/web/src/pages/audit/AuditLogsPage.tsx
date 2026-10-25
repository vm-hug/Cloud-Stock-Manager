import React, { useEffect, useState, useCallback } from 'react';
import { auditApi } from '../../features/audit/audit.api';
import { AuditLogEntry } from '@cloud-stock/shared';
import { formatDate } from '../../lib/utils';
import { History, RefreshCw, X, Code2 } from 'lucide-react';
import './AuditLogsPage.scss';

export const AuditLogsPage: React.FC = () => {
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
            <History size={24} style={{ color: '#818cf8' }} />
            <span>Immutable Security Audit Trail</span>
          </h2>
          <p className="description">
            Complete compliance logging for logins, role mutations, account deactivations, and session revocations.
          </p>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="filters-bar">
        <select
          className="select-filter"
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All Security Events</option>
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
            background: 'transparent',
            border: '1px solid rgba(148,163,184,0.2)',
            borderRadius: '0.375rem',
            color: '#94a3b8',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Logs Table */}
      <div className="table-card">
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor Identity</th>
                <th>Action Event</th>
                <th>Target Entity</th>
                <th>IP Address</th>
                <th>Metadata Payload</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                    {isLoading ? 'Loading security records...' : 'No audit records found.'}
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem', color: '#94a3b8' }}>
                      {formatDate(log.createdAt)}
                    </td>
                    <td>
                      {log.actorName ? (
                        <div>
                          <div style={{ fontWeight: 600 }}>{log.actorName}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{log.actorEmail}</div>
                        </div>
                      ) : (
                        <span style={{ color: '#64748b', fontStyle: 'italic' }}>System / Anonymous</span>
                      )}
                    </td>
                    <td>
                      <span className={`audit-badge ${log.action}`}>{log.action}</span>
                    </td>
                    <td style={{ fontSize: '0.8rem' }}>
                      <span style={{ color: '#818cf8', fontWeight: 600 }}>{log.entityType}</span>:{' '}
                      <span style={{ color: '#94a3b8' }}>{log.entityId}</span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{log.ipAddress || '—'}</td>
                    <td>
                      {log.metadata ? (
                        <div
                          className="metadata-code"
                          title="Click to inspect metadata"
                          onClick={() => setInspectModal(log)}
                        >
                          <Code2 size={12} style={{ display: 'inline', marginRight: 4 }} />
                          {JSON.stringify(log.metadata)}
                        </div>
                      ) : (
                        <span style={{ color: '#64748b' }}>None</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="pagination">
          <span>
            Showing {logs.length} of {total} audit records
          </span>
          <div className="btn-group">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <span style={{ padding: '0.35rem 0.75rem' }}>
              Page {page} of {totalPages}
            </span>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Inspect Metadata JSON */}
      {inspectModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <h3 className="title">Inspect Audit Metadata</h3>
              <button className="close-btn" onClick={() => setInspectModal(null)}>
                <X size={20} />
              </button>
            </div>
            <div style={{ marginBottom: '1rem', fontSize: '0.85rem', color: '#94a3b8' }}>
              <strong>Event:</strong> {inspectModal.action} • <strong>Entity:</strong> {inspectModal.entityType} (
              {inspectModal.entityId})
            </div>
            <pre
              style={{
                background: '#090d16',
                border: '1px solid rgba(148, 163, 184, 0.15)',
                padding: '1rem',
                borderRadius: '0.5rem',
                color: '#4ade80',
                fontSize: '0.8rem',
                overflowX: 'auto',
                maxHeight: '300px',
              }}
            >
              {JSON.stringify(inspectModal.metadata, null, 2)}
            </pre>
            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="cancel-btn"
                style={{ padding: '0.5rem 1rem', borderRadius: '0.375rem', background: '#334155', color: '#fff' }}
                onClick={() => setInspectModal(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
