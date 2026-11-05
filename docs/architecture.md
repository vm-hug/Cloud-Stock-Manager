# Architecture Overview — Cloud Stock Management

## 1. Architectural Style: Modular Monolith
Cloud Stock Management is built as a **Modular Monolith** deployed as a single unified service while enforcing strict domain separation and boundaries internally.

```
                           +------------------------------+
                           |         Client Web           |
                           |   (React 18 + Vite + SCSS)   |
                           +--------------+---------------+
                                          | HTTP / REST
                                          v
+-----------------------------------------------------------------------------------+
| Node.js / Express API (Modular Monolith)                                          |
|                                                                                   |
|  +--------------------+  +--------------------+  +--------------------+           |
|  |    Auth Module     |  |   Users Module     |  |   Audit Module     |  ...      |
|  | routes, controller |  | routes, controller |  | routes, controller |           |
|  | service, repo, z   |  | service, repo, z   |  | service, repo, z   |           |
|  +---------+----------+  +---------+----------+  +---------+----------+           |
|            |                       |                       |                      |
|            +-----------------------+-----------------------+                      |
|                                    |                                              |
|                                    v                                              |
|                       Prisma ORM Client Layer                                     |
+-------------------+---------------------------------------+-----------------------+
                    |                                       |
                    v                                       v
         +--------------------+                   +--------------------+
         |   PostgreSQL 16    |                   |      Redis 7       |
         |  (Single Source    |                   |   (Cache Layer &   |
         |     of Truth)      |                   |    Future Queue)   |
         +--------------------+                   +--------------------+
```

---

## 2. Directory & Layering Model

### Layered Separation within Backend Modules:
Each backend module in `apps/api/src/modules/<module_name>/` follows a strict 5-layer pattern:
1. **Routes (`<module>.routes.ts`):** Defines URLs, HTTP methods, authentication & RBAC guards, and Zod input validators.
2. **Controller (`<module>.controller.ts`):** Handles HTTP payload parsing and status responses. Never executes direct database operations.
3. **Service (`<module>.service.ts`):** Contains business logic, transaction management, and coordinates repository calls.
4. **Repository (`<module>.repository.ts`):** Direct Prisma ORM data queries. Free from HTTP abstractions.
5. **Schema (`<module>.schema.ts`):** Zod request validation definitions.

---

## 3. Authentication & Session Security Architecture (Phase 2)

```
   Client Browser                        Express API Server                   PostgreSQL 16
        |                                       |                                    |
        |--- 1. POST /login ------------------->|                                    |
        |    (email, password)                  |--- 2. bcrypt verify -------------->|
        |                                       |--- 3. Create Session ------------->|
        |<-- 4. Set HttpOnly Cookie ------------|       (store SHA-256 hash)         |
        |    + Return short-lived Access Token -|                                    |
        |                                       |                                    |
        |--- 5. API Request (Bearer Token) ---->|                                    |
        |                                       |--- 6. Verify JWT & Session ------->|
        |<-- 7. Response Data ------------------|                                    |
        |                                       |                                    |
        |--- 8. POST /refresh (Cookie) -------->|                                    |
        |                                       |--- 9. Rotate Token in Session ---->|
        |<-- 10. Set New Rotated Cookie --------|       (Invalidate old hash)        |
        |    + Return New Access Token ---------|                                    |
```

### Key Security Invariants:
1. **Refresh Token Rotation:** Every refresh operation issues a brand new token and invalidates the previous token hash atomically.
2. **Token Reuse Detection:** If an already-rotated token hash is presented, the system immediately flags a replay attack and revokes the **entire token family**, locking out the attacker.
3. **Storage Security:** Raw refresh tokens are never persisted in PostgreSQL or Redis; only cryptographically strong SHA-256 hashes are recorded.
4. **Immediate Session Invalidation:** When an administrator locks/deactivates an account or resets a user password, all active sessions for that user ID are marked `is_revoked = true` in PostgreSQL, instantly terminating any ongoing access.
5. **Last Administrator Protection:** The system guarantees at the database query layer that the final active `ADMIN` account cannot be deactivated or demoted to a lower role.

---

## 4. Core Database Invariants & Inventory Concurrency Strategy

1. **Physical Balance Isolation:**
   `inventory_balances` table is the sole source of inventory truth with composite primary key `(warehouse_id, variant_id)`. `ProductVariant` deliberately contains no `quantity` column.

2. **Pessimistic Locking & Interactive Transactions:**
   - Document posting (`POSTED` state) executes within a single `prisma.$transaction`.
   - Rows in `inventory_balances` are locked using PostgreSQL `SELECT ... FOR UPDATE` with deterministic ordering (by `variant_id` or `warehouse_id, variant_id`) to eliminate deadlocks.
   - Balance changes are validated against `< 0` and enforced by PostgreSQL `CHECK ("quantity" >= 0)` constraint.

3. **Cache Invalidation:**
   Redis caches are invalidated strictly **after** transaction commit, ensuring zero stale reads or ghost inventory states.

---

## 5. Catalog, Variant & Cloudinary Media Architecture (Phase 3)

```
   Client Browser                        Express API Server                  Cloudinary CDN
        |                                       |                                    |
        |--- 1. POST /images/sign ------------->|                                    |
        |    (Request upload authorization)     |--- 2. Validate product & role      |
        |                                       |--- 3. Generate HMAC SHA-1 sign --->|
        |<-- 4. Return signed parameters -------|       (folder, timestamp, publicId)|
        |                                       |                                    |
        |--- 5. Direct Upload (FormData) ------------------------------------------->|
        |       (file, signature, timestamp, public_id)                              |
        |<-- 6. Asset metadata & secure_url -----------------------------------------|
        |                                       |                                    |
        |--- 7. POST /images/confirm ---------->|                                    |
        |    (publicId, url, altText)           |--- 8. Verify asset & namespace     |
        |                                       |--- 9. Save ProductImage in DB      |
        |<-- 10. Confirmation & Primary Image --|                                    |
```

### Key Catalog & Media Invariants:
1. **Direct Signed Upload Pattern:** Client uploads assets directly to Cloudinary CDN using ephemeral signed authorization from the backend, avoiding heavy binary transit or local filesystem storage on Render instances.
2. **Namespace Isolation:** Uploads are strictly namespaced under `cloud-stock/products/:productId` to prevent asset impersonation or overwrites.
3. **Single Primary Image Invariant:** Each product has at most 1 primary image enforced by a PostgreSQL partial unique index:
   ```sql
   CREATE UNIQUE INDEX "product_images_product_id_primary_unique"
   ON "product_images" ("product_id") WHERE ("is_primary" = true);
   ```
4. **Primary Promotion / Demotion Transactions:** Setting an image as primary or deleting the active primary image uses a Prisma transaction to automatically demote existing primaries or promote the next image in sort order.
5. **No Quantity in Variants:** Invariant preserved from Phase 1 — `product_variants` contains no quantity column. Stock balances reside solely in `inventory_balances`.
6. **SKU Immutability upon Stock Movement:** A variant's SKU identifier cannot be altered once historical `stock_movements` have been recorded, preserving audit trail integrity.
7. **Positive Stock Deletion Protection:** A variant with positive total inventory cannot be soft-deleted or deactivated until stock has been transferred or adjusted to zero.
8. **Soft Delete Preservation:** Soft-deleting a product (`deleted_at = NOW()`) preserves all variants, images, and inventory balances intact so historical warehouse documents remain completely auditable.

---

## 5. Phase 4 Inventory Architecture & Concurrency Control

### 5.1 Source of Truth & Zero In-Variant Quantity Invariant
- PostgreSQL 16 is the sole source of truth for all inventory quantities.
- The `product_variants` table contains **NO quantity column**.
- The `inventory_balances` table is the unique store of physical stock, keyed by composite primary key `(warehouse_id, variant_id)` with database check constraints:
  - `CHECK (quantity >= 0)`
  - `CHECK (min_threshold >= 0)`

### 5.2 Stock Document State Machine
All warehouse transactions follow a finite state machine:
- `DRAFT`: Initial draft created by personnel; line items, warehouses, and notes can be edited. Inventory is **not** affected.
- `PENDING`: Voucher submitted for managerial review. Document is immutable. Inventory is **not** affected.
- `POSTED`: Authorized by an Admin or Manager (`creator_id !== approver_id`). Changes `inventory_balances` and writes immutable `stock_movements`.
- `REJECTED`: Managerial rejection with recorded reason. Terminal state.
- `CANCELLED`: Cancelled by creator or authorized staff before posting. Terminal state.

### 5.3 PostgreSQL Interactive Transactions & Pessimistic Row-Level Locking
Posting vouchers is executed strictly within `prisma.$transaction`:
1. **Document Lock:** `SELECT ... FROM stock_documents WHERE id = $1 FOR UPDATE` asserts `status === 'PENDING'`.
2. **Missing Balance Upsert:** Ensures `inventory_balances` rows exist (`quantity = 0`) before locking to avoid lock misses.
3. **Deadlock Elimination (Stable Lock Ordering):** All touched `(warehouse_id, variant_id)` pairs are ordered by `warehouse_id ASC, variant_id ASC` before issuing parameterized SQL `SELECT ... FOR UPDATE`.
4. **Insufficient Stock Defense:** Outbound and Transfer requests verify `quantityBefore >= requestedQty`. Insufficient balance triggers immediate rollback; negative stock is impossible at both application and database engine level.
5. **Atomic Movement & Audit Logging:** Updates to `inventory_balances`, creation of `stock_movements`, transition of document to `POSTED`, and `audit_logs` commit in a single ACID transaction.

### 5.4 Asynchronous Processing & Queue Reliability (BullMQ & Redis 7)
- Large CSV and XLSX bulk product catalog imports are offloaded to BullMQ (`product-import` queue) backed by Redis 7.
- Redis connection options configure `maxRetriesPerRequest: null` for queue stability.
- Workers run bounded concurrency (2 concurrent jobs), stream and validate rows, check duplicates within file and database, and update `import_jobs` progress in PostgreSQL.
- Generated error reports are written to disk as CSV files downloadable via `/api/v1/imports/:id/errors`.
- Standalone worker runner is provided at `apps/api/src/jobs/workerRunner.ts`.

### 5.5 Formula Injection Protection
When exporting inventory reports to CSV or Excel, any text value starting with spreadsheet formula trigger characters (`=`, `+`, `-`, `@`, `\t`, `\r`) is automatically sanitized by prefixing with a single quote (`'`).

---

## 6. Phase 5 High-Performance Search, Redis Cache-Aside & Telemetry Architecture

### 6.1 PostgreSQL GIN Trigram Index Optimization (`pg_trgm`)
To support instantaneous multi-criteria product searches across thousands of SKUs and product variants without sequential table scans:
- PostgreSQL extension `pg_trgm` is enabled via Prisma migration `20261105110000_phase5_search_trgm_and_analytics_indexes`.
- GIN Trigram indexes (`USING gin (... gin_trgm_ops)`) are deployed on:
  - `products.name`
  - `products.description`
  - `product_variants.sku`
  - `product_variants.name`
- B-Tree composite indexes accelerate price range filtering, product creation sorting, and balance lookups.

### 6.2 Redis Cache-Aside Architecture (`CacheManager`)
All expensive read queries (Search results and Analytics aggregations) implement the Cache-Aside pattern:
1. **Cache Lookup:** When a request arrives, `cacheManager.get(key)` is checked.
2. **Cache Hit:** If found, the pre-serialized JSON payload is returned immediately (sub-12ms response time), offloading 100% of the workload from PostgreSQL.
3. **Cache Miss:** If absent or expired, the query executes against PostgreSQL, and the result is stored in Redis (`cacheManager.set(key, data, { ttlSeconds, jitterSeconds })`).
4. **Canonical Query Key Hashing:** Reordered query parameters (e.g. `?limit=20&q=box` vs `?q=box&limit=20`) are recursively key-sorted and hashed with SHA-256 (`csm:v1:{namespace}:{scope}:{hash}`), ensuring optimal cache density.
5. **Anti-Stampede TTL Jitter:** A randomized variance (+/- 10-15s) is applied to TTL expirations, preventing simultaneous cache stampedes.
6. **Role-Based Cache Isolation:** Unit cost prices (`costPrice`) and financial margins are never primed into cache keys accessible to `STAFF`, strictly preventing privilege leakage across roles.
7. **Graceful Degradation:** If Redis becomes unavailable, queries fall through silently to PostgreSQL with warning telemetry without failing the HTTP request.

### 6.3 Post-Commit Selective Invalidation
- Invalidation hooks are strictly executed **after** database transactions commit (`prisma.$transaction`).
- Key-pattern SCAN eviction (`csm:v1:{namespace}:*`) removes stale catalog and inventory entries without executing `FLUSHALL` or `FLUSHDB`, ensuring BullMQ queues and active user refresh sessions are protected.

### 6.4 Distributed Sliding-Window Rate Limiting
- Redis atomic counters throttle high-cost operations:
  - Product Search: 60 requests/minute per caller.
  - Analytics Reports: 30 requests/minute per caller.
  - CSV/XLSX Bulk Export: 10 requests/minute per caller.
- Excessive traffic receives HTTP `429 Too Many Requests` accompanied by standard `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers.


