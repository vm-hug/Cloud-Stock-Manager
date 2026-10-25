import React, { useEffect, useState, useCallback } from 'react';
import { systemApi } from '../../features/system/system.api';
import { SystemHealthStatus } from '@cloud-stock/shared';
import { Database, Server, Cpu, Clock, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import './SystemHealthPage.scss';

export const SystemHealthPage: React.FC = () => {
  const [health, setHealth] = useState<SystemHealthStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchHealth = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await systemApi.getHealth();
      if (res.success && res.data) {
        setHealth(res.data);
      }
    } catch (err) {
      console.error('Failed to query cloud health:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${d > 0 ? `${d}d ` : ''}${h}h ${m}m ${s}s`;
  };

  return (
    <div className="system-health-page">
      <div className="page-header-actions">
        <div className="header-left">
          <h2 className="title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {health?.status === 'healthy' ? (
              <CheckCircle2 size={24} style={{ color: '#4ade80' }} />
            ) : (
              <AlertTriangle size={24} style={{ color: '#fbbf24' }} />
            )}
            <span>Live Cloud Infrastructure Monitor</span>
          </h2>
          <p className="description">
            Real-time latency, process memory, PostgreSQL 16 connectivity and Redis 7 cache probe status.
          </p>
        </div>

        <button
          className="primary-btn"
          style={{ background: '#334155' }}
          onClick={fetchHealth}
          disabled={isLoading}
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          <span>{isLoading ? 'Pinging Cloud...' : 'Refresh Metrics'}</span>
        </button>
      </div>

      {health && (
        <div className="metrics-grid">
          {/* PostgreSQL Metric */}
          <div className="metric-card">
            <div className="card-top">
              <div className="icon-box db">
                <Database size={22} />
              </div>
              <span className={`badge ${health.database.status === 'up' ? 'badge--posted' : 'badge--rejected'}`}>
                {health.database.status.toUpperCase()}
              </span>
            </div>
            <h3 className="card-title">PostgreSQL 16 Database</h3>
            <p className="card-desc">Primary transactional datastore & inventory balance authority</p>
            <div className="metric-stat">
              <span>{health.database.latencyMs >= 0 ? health.database.latencyMs : '—'}</span>
              <span className="unit">ms ping latency</span>
            </div>
          </div>

          {/* Redis Metric */}
          <div className="metric-card">
            <div className="card-top">
              <div className="icon-box redis">
                <Server size={22} />
              </div>
              <span className={`badge ${health.redis.status === 'up' ? 'badge--posted' : 'badge--rejected'}`}>
                {health.redis.status.toUpperCase()}
              </span>
            </div>
            <h3 className="card-title">Redis 7 Distributed Cache</h3>
            <p className="card-desc">In-memory caching layer & session rate limiting</p>
            <div className="metric-stat">
              <span>{health.redis.latencyMs >= 0 ? health.redis.latencyMs : '—'}</span>
              <span className="unit">ms ping latency</span>
            </div>
          </div>

          {/* Node.js Heap Metric */}
          <div className="metric-card">
            <div className="card-top">
              <div className="icon-box memory">
                <Cpu size={22} />
              </div>
              <span className="badge badge--pending">MEMORY</span>
            </div>
            <h3 className="card-title">Node.js Heap Memory</h3>
            <p className="card-desc">RSS: {health.memory.rssMb} MB • Total: {health.memory.heapTotalMb} MB</p>
            <div className="metric-stat">
              <span>{health.memory.heapUsedMb}</span>
              <span className="unit">MB allocated</span>
            </div>
          </div>

          {/* Uptime Metric */}
          <div className="metric-card">
            <div className="card-top">
              <div className="icon-box uptime">
                <Clock size={22} />
              </div>
              <span className="badge badge--draft">ONLINE</span>
            </div>
            <h3 className="card-title">Express API Process Uptime</h3>
            <p className="card-desc">Environment: [{health.environment}]</p>
            <div className="metric-stat" style={{ fontSize: '1.25rem' }}>
              <span>{formatUptime(health.uptimeSeconds)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
