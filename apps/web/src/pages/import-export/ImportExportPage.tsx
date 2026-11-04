import React, { useEffect, useRef, useState } from 'react';
import { ImportJob, Role } from '@cloud-stock/shared';
import { inventoryApi } from '../../features/inventory/inventory.api';
import { useAuth } from '../../features/auth/AuthContext';
import {
  Upload,
  Download,
  FileSpreadsheet,
  RefreshCw,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import './ImportExportPage.scss';

export const ImportExportPage: React.FC = () => {
  const { user } = useAuth();
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
    } catch (err: any) {
      setError(err.message || 'Failed to load background import jobs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
    // Poll active jobs every 3.5 seconds
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
        setError(res.error?.message || 'Upload failed');
      }
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownloadTemplate = async (format: 'csv' | 'xlsx') => {
    try {
      await inventoryApi.downloadImportTemplate(format);
    } catch (err: any) {
      alert(`Download template failed: ${err.message}`);
    }
  };

  const handleExportBalances = async (format: 'csv' | 'xlsx') => {
    try {
      await inventoryApi.downloadExport({ format });
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    }
  };

  const handleDownloadErrorReport = async (jobId: string) => {
    try {
      await inventoryApi.downloadErrorReport(jobId);
    } catch (err: any) {
      alert(`Download error report failed: ${err.message}`);
    }
  };

  return (
    <div className="import-export-page">
      <div className="page-header">
        <div className="title-group">
          <h1>Import / Export Center</h1>
          <p>
            Bulk product catalog onboarding with BullMQ background processing and formula-safe inventory reporting.
          </p>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="grid-sections">
        {/* Bulk Import Section */}
        {canImport && (
          <div className="panel-card">
            <div className="panel-header">
              <h2>
                <Upload size={20} />
                <span>Bulk Product & Variant Import</span>
              </h2>
            </div>
            <p>
              Upload a UTF-8 CSV or Excel spreadsheet containing products and SKU variants. Jobs run in background workers with real-time progress tracking.
            </p>

            <div
              className="upload-dropzone"
              onClick={() => fileInputRef.current?.click()}
            >
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
                  {uploading ? 'Uploading & Enqueuing...' : 'Click to select CSV or XLSX file'}
                </span>
                <span className="dropzone-hint">
                  Supports up to 10MB file size (Maximum 1,000 rows per batch)
                </span>
              </div>
            </div>

            <div className="template-downloads">
              <span>Need the schema format?</span>
              <button type="button" onClick={() => handleDownloadTemplate('csv')}>
                <FileText size={14} />
                <span>Download CSV Template</span>
              </button>
              <button type="button" onClick={() => handleDownloadTemplate('xlsx')}>
                <FileSpreadsheet size={14} />
                <span>Download XLSX Template</span>
              </button>
            </div>
          </div>
        )}

        {/* Inventory Export Section */}
        <div className="panel-card">
          <div className="panel-header">
            <h2>
              <Download size={20} />
              <span>Inventory Balances Export</span>
            </h2>
          </div>
          <p>
            Export live PostgreSQL warehouse inventory quantities and valuation. Automatically sanitized against spreadsheet formula injection attacks.
          </p>

          <div className="export-options-grid">
            <button
              className="btn-export-action"
              onClick={() => handleExportBalances('csv')}
            >
              <FileText size={18} />
              <span>Download Comprehensive CSV Report</span>
            </button>
            <button
              className="btn-export-action"
              onClick={() => handleExportBalances('xlsx')}
            >
              <FileSpreadsheet size={18} />
              <span>Download Formatted Excel Workbook (.xlsx)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Background Jobs Queue Progress Table */}
      {canImport && (
        <div className="jobs-section">
          <div className="section-title">
            <span>Background Import Queue (BullMQ Worker)</span>
            <button className="refresh-btn" onClick={loadJobs} title="Refresh jobs">
              <RefreshCw size={16} />
            </button>
          </div>

          <table className="jobs-table">
            <thead>
              <tr>
                <th>Job ID</th>
                <th>File Name</th>
                <th>Status</th>
                <th>Processing Progress</th>
                <th>Failed Rows</th>
                <th>Submitted By</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>
                    Loading background queue jobs...
                  </td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>
                    No background import jobs initiated yet.
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
                      <td style={{ fontFamily: 'monospace', color: '#94a3b8' }}>
                        {job.id.slice(0, 8)}...
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
                            {job.processedRows} of {job.totalRows} rows ({pct}%)
                          </span>
                        </div>
                      </td>
                      <td>
                        <span
                          style={{
                            color: job.failedRows > 0 ? '#f87171' : '#94a3b8',
                            fontWeight: job.failedRows > 0 ? 700 : 400,
                          }}
                        >
                          {job.failedRows}
                        </span>
                      </td>
                      <td>{job.createdBy?.name || 'User'}</td>
                      <td style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                        {new Date(job.createdAt).toLocaleTimeString()},{' '}
                        {new Date(job.createdAt).toLocaleDateString()}
                      </td>
                      <td>
                        {job.errorReportUrl && (
                          <button
                            className="btn-error-report"
                            onClick={() => handleDownloadErrorReport(job.id)}
                            title="Download error report CSV"
                          >
                            <AlertTriangle size={14} />
                            <span>Errors CSV</span>
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
