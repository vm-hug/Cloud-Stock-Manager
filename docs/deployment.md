# Deployment Guide — Render Cloud Platform
## Cloud Stock Management (Modular Monolith)

This document provides complete instructions for deploying Cloud Stock Management to the **Render** cloud platform.

---

## 1. Cloud Architecture on Render

```
   [ Client Browser ]
           | HTTPS
           v
  +-------------------------------------------------------+
  | Render Web Service (Docker / Node.js 20)              |
  | - apps/api (Express Backend Engine)                   |
  | - Static Frontend Assets (or separate Static Site)    |
  | - Healthcheck: /api/health/live                       |
  +---------------------------+---------------------------+
                              |
               +--------------+--------------+
               | Internal Private Network    |
               v                             v
  +------------------------+    +------------------------+
  | Render PostgreSQL 16   |    | Render Managed Redis 7 |
  | (Primary Datastore)    |    | (Cache & Rate Limit)   |
  +------------------------+    +------------------------+
```

---

## 2. Prerequisites & Render Services Provisioning

1. **Create Managed PostgreSQL Database on Render:**
   - Name: `cloud-stock-postgres`
   - Database: `cloud_stock_db`
   - User: `cloud_stock_user`
   - PostgreSQL Version: `16`
   - Copy the **Internal Database URL** for production use.

2. **Create Managed Redis Instance on Render:**
   - Name: `cloud-stock-redis`
   - Plan: Free or Starter
   - Copy the **Internal Redis URL** (`redis://...`).

3. **Create Web Service for the API:**
   - Repository: `https://github.com/vm-hug/Cloud-Stock-Manager`
   - Branch: `main` (or release branch)
   - Runtime: `Docker` (using the root [Dockerfile](file:///Users/mac/Desktop/cloud-stock-management/Dockerfile))
   - Health Check Path: `/api/health/live`
   - Auto-Deploy: `Yes` (Triggered upon passing GitHub Actions CI)

---

## 3. Required Environment Variables on Render Dashboard

Set the following variables in **Render Dashboard &rarr; Environment**:

| Variable Name | Description | Example / Note |
| :--- | :--- | :--- |
| `NODE_ENV` | Runtime environment | `production` |
| `PORT` | Listening port assigned by Render | `10000` (Render default) |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@dpg-...-a:5432/cloud_stock_db` |
| `REDIS_URL` | Redis connection string | `redis://red-...:6379` |
| `CORS_ORIGIN` | Allowed Frontend URL | `https://your-frontend.onrender.com` |
| `JWT_ACCESS_SECRET` | Secret for Access Token signing | Cryptographically random string (min 32 chars) |
| `JWT_REFRESH_SECRET` | Secret for Refresh Token signing | Cryptographically random string (min 32 chars) |
| `SEED_ADMIN_EMAIL` | Initial Admin Email | `admin@cloudstock.dev` |
| `SEED_ADMIN_PASSWORD` | Initial Admin Password | Strong password (e.g. `AdminPassword123!`) |
| `SEED_MANAGER_EMAIL` | Initial Manager Email | `manager@cloudstock.dev` |
| `SEED_MANAGER_PASSWORD`| Initial Manager Password | Strong password |
| `SEED_STAFF_EMAIL` | Initial Staff Email | `staff@cloudstock.dev` |
| `SEED_STAFF_PASSWORD` | Initial Staff Password | Strong password |

---

## 4. Database Migrations on Production

> **CRITICAL RULE:** Never execute `prisma migrate reset` or `prisma db push` on Render production!

To apply migrations safely without container race conditions:
1. Use Render's **Pre-deploy Command**:
   ```bash
   npm run db:deploy
   ```
   *(`prisma migrate deploy` applies all pending SQL migrations atomically before the new container starts serving traffic).*
2. To seed initial baseline users and warehouse on a clean database:
   Run one-off job or Render Shell command:
   ```bash
   npm run db:seed
   ```
