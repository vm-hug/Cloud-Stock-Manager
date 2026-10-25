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
