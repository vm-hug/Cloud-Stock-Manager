import React, { useEffect, useState } from 'react';
import {
  Zap,
  Database,
  Server,
  Activity,
  Trash2,
  RefreshCw,
  Clock,
  CheckCircle,
  Info,
} from 'lucide-react';
import { SystemPerformanceMetrics } from '@cloud-stock/shared';
import { analyticsApi } from '../../features/analytics/analytics.api';
import './PerformancePage.scss';

export const PerformancePage: React.FC = () => {
  const [metrics, setMetrics] = useState<SystemPerformanceMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [purging, setPurging] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchMetrics = async () => {
    try {
      const res = await analyticsApi.getPerformanceMetrics();
      if (res.success && res.data) {
        setMetrics(res.data);
      }
    } catch (err) {
      console.error('Failed to load performance metrics:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 10000); // 10s auto-refresh
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchMetrics();
  };

  const handlePurgeCache = async () => {
    if (!window.confirm('Are you sure you want to purge all Redis application caches? Cold queries will temporarily query PostgreSQL.')) {
      return;
    }

    setPurging(true);
    try {
      const res = await analyticsApi.clearCache();
      if (res.success && res.data) {
        setToastMessage(`Purged ${res.data.keysCleared} cache keys successfully.`);
        fetchMetrics();
      } else {
        setToastMessage(res.error?.message || 'Failed to purge cache.');
      }
    } catch (err: any) {
      setToastMessage(err.message || 'Error executing cache purge.');
    } finally {
      setPurging(false);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  return (
    <div className="performance-container">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="toast-notification">
          <CheckCircle size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="performance-header">
        <div className="header-info">
          <h2>Redis Cache-Aside & Query Telemetry</h2>
          <p>Real-time telemetry measuring cache hit rates, percentile latencies, and distributed rate limiting.</p>
        </div>

        <div className="header-actions">
          <button
            className={`action-btn refresh ${refreshing ? 'loading' : ''}`}
            onClick={handleRefresh}
          >
            <RefreshCw size={16} />
            <span>Refresh</span>
          </button>

          <button
            className={`action-btn purge ${purging ? 'loading' : ''}`}
            onClick={handlePurgeCache}
            disabled={purging}
          >
            <Trash2 size={16} />
            <span>{purging ? 'Purging...' : 'Purge All Caches'}</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner" />
          <p>Measuring latency percentiles and cache telemetry...</p>
        </div>
      ) : (
        <>
          {/* Top Metrics Cards */}
          <div className="telemetry-grid">
            {/* Hit Rate Meter */}
            <div className="telemetry-card highlight-card">
              <div className="card-top">
                <span className="card-label">Cache Hit Ratio</span>
                <Zap size={20} className="icon-gold" />
              </div>
              <div className="hit-rate-display">
                <div className="hit-percentage">{metrics?.hitRatePercentage ?? 0}%</div>
                <div className="hit-ratio-bar">
                  <div
                    className="hit-fill"
                    style={{ width: `${Math.min(100, metrics?.hitRatePercentage ?? 0)}%` }}
                  />
                </div>
              </div>
              <div className="card-sub">
                {metrics?.cacheHits.toLocaleString() ?? 0} hits out of {metrics?.totalCacheRequests.toLocaleString() ?? 0} queries
              </div>
            </div>

            {/* Response Latencies */}
            <div className="telemetry-card">
              <div className="card-top">
                <span className="card-label">Latency Percentiles</span>
                <Clock size={20} className="icon-blue" />
              </div>
              <div className="percentile-stats">
                <div className="stat-item">
                  <span className="p-tag">P50 (Median)</span>
                  <span className="p-val">{metrics?.latencyStats.p50Ms ?? 0} ms</span>
                </div>
                <div className="stat-item">
                  <span className="p-tag">P95</span>
                  <span className="p-val">{metrics?.latencyStats.p95Ms ?? 0} ms</span>
                </div>
                <div className="stat-item">
                  <span className="p-tag">P99</span>
                  <span className="p-val">{metrics?.latencyStats.p99Ms ?? 0} ms</span>
                </div>
                <div className="stat-item">
                  <span className="p-tag">Average</span>
                  <span className="p-val">{metrics?.latencyStats.avgMs ?? 0} ms</span>
                </div>
              </div>
              <div className="card-sub">Based on {metrics?.latencyStats.sampleCount ?? 0} samples</div>
            </div>

            {/* Infrastructure Health */}
            <div className="telemetry-card">
              <div className="card-top">
                <span className="card-label">Infrastructure Probes</span>
                <Server size={20} className="icon-green" />
              </div>
              <div className="infra-status-list">
                <div className="infra-item">
                  <div className="infra-name">
                    <Database size={16} />
                    <span>PostgreSQL 16</span>
                  </div>
                  <span className={`probe-badge ${metrics?.dbLatencyMs !== -1 ? 'up' : 'down'}`}>
                    {metrics?.dbLatencyMs !== -1 ? `${metrics?.dbLatencyMs} ms` : 'Offline'}
                  </span>
                </div>

                <div className="infra-item">
                  <div className="infra-name">
                    <Zap size={16} />
                    <span>Redis 7 Cache</span>
                  </div>
                  <span className={`probe-badge ${metrics?.redisStatus === 'ready' ? 'up' : 'down'}`}>
                    {metrics?.redisStatus === 'ready' ? `${metrics?.redisLatencyMs} ms` : metrics?.redisStatus}
                  </span>
                </div>

                <div className="infra-item">
                  <div className="infra-name">
                    <Activity size={16} />
                    <span>Process Uptime</span>
                  </div>
                  <span className="uptime-tag">{formatUptime(metrics?.uptimeSeconds ?? 0)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Architecture Insights Section */}
          <div className="insights-panel">
            <div className="panel-title">
              <Info size={18} />
              <h3>Cache-Aside & Concurrency Safeguards</h3>
            </div>
            <div className="insights-grid">
              <div className="insight-item">
                <h4>Canonical Query Hashing</h4>
                <p>
                  Every search & filter combination generates a deterministic SHA-256 hash. Reordering query
                  parameters preserves identical cache keys, maximizing cache density.
                </p>
              </div>

              <div className="insight-item">
                <h4>Post-Commit Invalidation</h4>
                <p>
                  Stock document postings and product catalog edits evict cached entries only after PostgreSQL
                  ACID transactions commit, completely avoiding dirty-read anomalies.
                </p>
              </div>

              <div className="insight-item">
                <h4>Role-Based Cache Isolation</h4>
                <p>
                  Staff members and Managers receive distinct cache entries. Sensitive margins and unit cost prices
                  are never primed into keys accessible to staff.
                </p>
              </div>

              <div className="insight-item">
                <h4>Distributed Rate Limiting</h4>
                <p>
                  Redis sliding window counters throttle search (60 req/min), analytics (30 req/min), and data exports
                  (10 req/min), returning standard HTTP 429 Retry-After headers.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
