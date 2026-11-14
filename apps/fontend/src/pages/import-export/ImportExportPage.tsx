import React, { useEffect, useRef, useState } from 'react';
import { ImportJob, Role } from '@cloud-stock/shared';
import { inventoryApi } from '../../features/inventory/inventory.api';
import { useAuth } from '../../features/auth/AuthContext';
import { useI18n } from '../../features/i18n/I18nContext';
import {
  Upload,
  Download,
  FileSpreadsheet,
  RefreshCw,
  AlertTriangle,
  FileText,
  Layers,
} from 'lucide-react';
import './ImportExportPage.scss';

export const ImportExportPage: React.FC = () => {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canImport = user?.role === Role.ADMIN || user?.role === Role.MANAGER;

  const loadJobs = async () => {
    try {
      setError(null);
      const res = await inventoryApi.getImportJobs();
      if (res.success && res.data) {
        setJobs(res.data);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('importExport.emptyJobs'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
    const interval = setInterval(() => {
      loadJobs();
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setError(null);
      const res = await inventoryApi.uploadImport(file);
      if (res.success) {
        loadJobs();
      } else {
        setError(res.error?.message || t('importExport.emptyJobs'));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('importExport.emptyJobs'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownloadTemplate = async (format: 'csv' | 'xlsx') => {
    try {
      await inventoryApi.downloadImportTemplate(format);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('importExport.emptyJobs'));
    }
  };

  const handleExportBalances = async (format: 'csv' | 'xlsx') => {
    try {
      await inventoryApi.downloadExport({ format });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('importExport.emptyJobs'));
    }
  };

  const handleDownloadErrorReport = async (jobId: string) => {
    try {
      await inventoryApi.downloadErrorReport(jobId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('importExport.emptyJobs'));
    }
  };

  const dateLocale = lang === 'vi' ? 'vi-VN' : 'en-US';

  return (
    <div className="import-export-page">
      <div className="page-header">
        <div className="title-group">
          <h1>{t('importExport.title')}</h1>
          <p>{t('importExport.subtitle')}</p>
        </div>
      </div>

      {/* Prominent 3-Tier Invariant Banner (No Quantity Column on CSV Import) */}
      <div className="tier-guide-banner">
        <Layers size={18} />
        <div className="tier-copy">
          <strong>{t('importExport.schemaNoteTitle')}</strong>
          <span>{t('importExport.schemaNoteDesc')}</span>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="grid-sections">
        {canImport && (
          <div className="panel-card">
            <div className="panel-header">
              <h2>
                <Upload size={20} />
                <span>{t('importExport.importPanelTitle')}</span>
              </h2>
            </div>
            <p>{t('importExport.importPanelDesc')}</p>

            <div className="upload-dropzone" onClick={() => fileInputRef.current?.click()}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                onChange={handleFileSelect}
                disabled={uploading}
              />
              <div className="dropzone-content">
                <Upload size={32} />
                <span className="dropzone-text">
                  {uploading ? t('importExport.uploadingText') : t('importExport.dropzoneText')}
                </span>
                <span className="dropzone-hint">{t('importExport.dropzoneHint')}</span>
              </div>
            </div>

            <div className="template-downloads">
              <span>{t('importExport.needTemplate')}</span>
              <button type="button" onClick={() => handleDownloadTemplate('csv')}>
                <FileText size={14} />
                <span>{t('importExport.downloadCsvTemplate')}</span>
              </button>
              <button type="button" onClick={() => handleDownloadTemplate('xlsx')}>
                <FileSpreadsheet size={14} />
                <span>{t('importExport.downloadXlsxTemplate')}</span>
              </button>
            </div>
          </div>
        )}

        <div className="panel-card">
          <div className="panel-header">
            <h2>
              <Download size={20} />
              <span>{t('importExport.exportPanelTitle')}</span>
            </h2>
          </div>
          <p>{t('importExport.exportPanelDesc')}</p>

          <div className="export-options-grid">
            <button
              className="btn-export-action"
              onClick={() => handleExportBalances('csv')}
            >
              <FileText size={18} />
              <span>{t('importExport.downloadCsvExport')}</span>
            </button>
            <button
              className="btn-export-action"
              onClick={() => handleExportBalances('xlsx')}
            >
              <FileSpreadsheet size={18} />
              <span>{t('importExport.downloadXlsxExport')}</span>
            </button>
          </div>
        </div>
      </div>

      {canImport && (
        <div className="jobs-section">
          <div className="section-title">
            <span>{t('importExport.queueTitle')}</span>
            <button
              className="refresh-btn"
              onClick={loadJobs}
              title={t('common.refresh')}
            >
              <RefreshCw size={16} />
            </button>
          </div>

          <table className="jobs-table">
            <thead>
              <tr>
                <th>{t('importExport.colJobId')}</th>
                <th>{t('importExport.colFileName')}</th>
                <th>{t('importExport.colStatus')}</th>
                <th>{t('importExport.colProgress')}</th>
                <th>{t('importExport.colFailedRows')}</th>
                <th>{t('importExport.colSubmittedBy')}</th>
                <th>{t('importExport.colDate')}</th>
                <th>{t('importExport.colAction')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>
                    {t('importExport.loadingJobs')}
                  </td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>
                    {t('importExport.emptyJobs')}
                  </td>
                </tr>
              ) : (
                jobs.map((job) => {
                  const pct =
                    job.totalRows > 0
                      ? Math.min(
                          100,
                          Math.round(
                            ((job.processedRows + job.failedRows) / job.totalRows) * 100
                          )
                        )
                      : job.status === 'COMPLETED'
                      ? 100
                      : 0;

                  return (
                    <tr key={job.id}>
                      <td>
                        <span className="code-chip">{job.id.slice(0, 8)}...</span>
                      </td>
                      <td>
                        <strong>{job.originalFilename}</strong>
                      </td>
                      <td>
                        <span className={`job-status-pill ${job.status.toLowerCase()}`}>
                          {job.status}
                        </span>
                      </td>
                      <td>
                        <div className="progress-bar-container">
                          <div className="bar-bg">
                            <div
                              className={`bar-fill ${job.status.toLowerCase()}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="bar-text">
                            {t('importExport.rowsProgress', {
                              processed: job.processedRows,
                              total: job.totalRows,
                              pct,
                            })}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span
                          style={{
                            color:
                              job.failedRows > 0
                                ? 'var(--color-danger-text)'
                                : 'var(--color-text-muted)',
                            fontWeight: job.failedRows > 0 ? 700 : 400,
                          }}
                        >
                          {job.failedRows}
                        </span>
                      </td>
                      <td>{job.createdBy?.name || t('common.unassigned')}</td>
                      <td style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                        {new Date(job.createdAt).toLocaleTimeString(dateLocale)},{' '}
                        {new Date(job.createdAt).toLocaleDateString(dateLocale)}
                      </td>
                      <td>
                        {job.errorReportUrl && (
                          <button
                            className="btn-error-report"
                            onClick={() => handleDownloadErrorReport(job.id)}
                            title={t('importExport.errorsCsvBtn')}
                          >
                            <AlertTriangle size={14} />
                            <span>{t('importExport.errorsCsvBtn')}</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
