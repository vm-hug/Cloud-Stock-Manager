import React from 'react';
import { Link } from 'react-router-dom';
import { Database, Server, Layers, ShieldCheck, Box, Activity, LogIn, ArrowRight } from 'lucide-react';
import { APP_NAME, APP_VERSION } from '../../lib/constants';
import { useAuth } from '../../features/auth/AuthContext';
import '../../App.scss';

export const LandingPage: React.FC = () => {
  const { isAuthenticated, user } = useAuth();

  return (
    <div className="app-container">
      <header className="hero-header">
        <div className="badge-tag">
          <Activity size={14} />
          <span>Phase 2: Authentication & RBAC Deployed</span>
        </div>
        <h1 className="title">{APP_NAME}</h1>
        <p className="subtitle">
          Modular Monolith Enterprise Stock Engine with PostgreSQL 16 Invariants, Redis 7 Caching,
          JWT Token Rotation, Role-Based Access Control, and Audit Logging.
        </p>

        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center', gap: '1rem' }}>
          {isAuthenticated ? (
            <Link
              to="/users"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.5rem',
                borderRadius: '0.75rem',
                background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                color: '#fff',
                fontWeight: 600,
                textDecoration: 'none',
                boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
              }}
            >
              <span>Go to Staff Directory ({user?.role})</span>
              <ArrowRight size={18} />
            </Link>
          ) : (
            <Link
              to="/login"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.5rem',
                borderRadius: '0.75rem',
                background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                color: '#fff',
                fontWeight: 600,
                textDecoration: 'none',
                boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
              }}
            >
              <LogIn size={18} />
              <span>Sign In to Dashboard</span>
            </Link>
          )}
        </div>
      </header>

      <main className="cards-grid">
        <div className="system-card">
          <div className="card-header">
            <div className="icon-wrapper">
              <Database size={22} />
            </div>
            <span className="badge badge--posted">Strict Invariant</span>
          </div>
          <h2 className="card-title">PostgreSQL 16 Database</h2>
          <p className="card-desc">
            Single Source of Truth for inventory balances. Composite key (warehouseId, variantId),
            no quantity in variant, check constraints against negative stock.
          </p>
          <ul className="invariants-list">
            <li>inventory_balances.quantity &gt;= 0</li>
            <li>stock_document_items.quantity &gt; 0</li>
            <li>SELECT ... FOR UPDATE on doc posting</li>
          </ul>
        </div>

        <div className="system-card">
          <div className="card-header">
            <div className="icon-wrapper">
              <Server size={22} />
            </div>
            <span className="badge badge--pending">Cache Layer</span>
          </div>
          <h2 className="card-title">Redis 7 & ioredis</h2>
          <p className="card-desc">
            High-speed transient caching layer. Invalidated strictly post-commit from PostgreSQL
            transactions.
          </p>
          <ul className="invariants-list">
            <li>Strictly cache, never stock authority</li>
            <li>Session rate limiter protection</li>
            <li>Docker container healthchecked via ping</li>
          </ul>
        </div>

        <div className="system-card">
          <div className="card-header">
            <div className="icon-wrapper">
              <Layers size={22} />
            </div>
            <span className="badge badge--draft">Monorepo Ready</span>
          </div>
          <h2 className="card-title">Modular Monolith</h2>
          <p className="card-desc">
            Organized via npm workspaces with shared types, strict layering (Routes &rarr;
            Controller &rarr; Service &rarr; Repository &rarr; Schema).
          </p>
          <ul className="invariants-list">
            <li>apps/api (Express + Prisma + TS)</li>
            <li>apps/web (React + Vite + SCSS)</li>
            <li>packages/shared (Types, DTOs, Enums)</li>
          </ul>
        </div>

        <div className="system-card">
          <div className="card-header">
            <div className="icon-wrapper">
              <ShieldCheck size={22} />
            </div>
            <span className="badge badge--posted">Phase 2 Live</span>
          </div>
          <h2 className="card-title">RBAC & Refresh Tokens</h2>
          <p className="card-desc">
            HttpOnly cookie refresh token rotation, automatic session revocation, token reuse
            detection, and multi-role access control (Admin, Manager, Staff).
          </p>
          <ul className="invariants-list">
            <li>Token rotation & family reuse detection</li>
            <li>Last active Administrator protection</li>
            <li>Immutable security Audit Trail</li>
          </ul>
        </div>

        <div className="system-card">
          <div className="card-header">
            <div className="icon-wrapper">
              <Box size={22} />
            </div>
            <span className="badge badge--posted">Prisma ORM</span>
          </div>
          <h2 className="card-title">Schema & Migration</h2>
          <p className="card-desc">
            Full physical schema mapping: User, RefreshSession, AuditLog, Category, Product,
            ProductVariant, Warehouse, InventoryBalance, StockDocument, StockMovement, ImportJob.
          </p>
          <ul className="invariants-list">
            <li>Decimal(14,2) for exact currency</li>
            <li>Timestamptz for temporal precision</li>
            <li>Idempotent seed script with bcrypt</li>
          </ul>
        </div>
      </main>

      <footer className="footer">
        <p>
          {APP_NAME} &bull; Version {APP_VERSION} &bull; Phase 2 Security & Authentication
        </p>
      </footer>
    </div>
  );
};
