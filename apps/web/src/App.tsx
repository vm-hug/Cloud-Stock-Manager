import React from 'react';
import { Database, Server, Layers, ShieldCheck, Box, Activity } from 'lucide-react';
import { APP_NAME, APP_VERSION } from './lib/constants';
import './App.scss';

export const App: React.FC = () => {
  return (
    <div className="app-container">
      <header className="hero-header">
        <div className="badge-tag">
          <Activity size={14} />
          <span>Phase 1 Architecture Initialized</span>
        </div>
        <h1 className="title">{APP_NAME}</h1>
        <p className="subtitle">
          Modular Monolith Enterprise Stock Engine with PostgreSQL 16 Invariants, Redis 7 Caching,
          Prisma ORM, and npm Workspaces.
        </p>
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
            <li>Prepared for BullMQ asynchronous jobs</li>
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
            <span className="badge badge--posted">AGENTS.md</span>
          </div>
          <h2 className="card-title">Single Agent Standard</h2>
          <p className="card-desc">
            One single, authoritative AGENTS.md at root. Zero duplicates, strict coding guidelines,
            and 25 inventory domain invariants.
          </p>
          <ul className="invariants-list">
            <li>No plaintext password in database or seed</li>
            <li>Zod validation on all API endpoints</li>
            <li>Role-Based Access Control (Admin, Manager, Staff)</li>
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
            Full physical schema mapping: User, AuditLog, Category, Product, ProductVariant,
            Warehouse, InventoryBalance, StockDocument, StockMovement, ImportJob.
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
          {APP_NAME} &bull; Version {APP_VERSION} &bull; Phase 1 Infrastructure
        </p>
      </footer>
    </div>
  );
};

export default App;
