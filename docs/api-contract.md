# API Contract Specification — Cloud Stock Management

## 1. Response Envelope Standard

All HTTP endpoints return responses structured with the standard ApiResponse envelope:

### Success Response:
```json
{
  "success": true,
  "message": "Optional human-readable confirmation message",
  "data": { ... }
}
```

### Error Response:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE_STRING",
    "message": "Descriptive error message",
    "details": {}
  }
}
```

---

## 2. Standard HTTP Status Codes

- `200 OK`: Request succeeded.
- `201 Created`: Resource successfully created.
- `400 Bad Request`: Validation failure (Zod error details included).
- `401 Unauthorized`: Missing, expired, or invalid JWT token / revoked session.
- `403 Forbidden`: Authenticated user lacks permission/role (RBAC failure).
- `404 Not Found`: Resource or endpoint does not exist.
- `409 Conflict`: Business invariant failure (e.g. duplicate email, user already exists).
- `429 Too Many Requests`: Rate limit threshold exceeded.
- `500 Internal Server Error`: Unhandled server exception (sanitized in production).
- `503 Service Unavailable`: Cloud readiness probe failed (Database unreachable).

---

## 3. Endpoints Implemented in Phase 1 & 2

### 3.1 Cloud Health Probes & Monitoring
- `GET /api/health/live`: Public liveness probe (Express process status).
- `GET /api/health/ready`: Readiness probe (checks PostgreSQL connectivity; returns 503 if unreachable).
- `GET /api/health`: Legacy healthcheck endpoint.
- `GET /api/v1/system/health`: Detailed cloud infrastructure latency and memory metrics (**ADMIN only**).

### 3.2 Authentication Module (`/api/v1/auth`)
- `POST /api/v1/auth/login`: Authenticate with email/password (Rate limited: 10 req/min). Sets `refresh_token` HttpOnly cookie and returns short-lived access token.
- `POST /api/v1/auth/refresh`: Rotate refresh token and issue fresh access token (Rate limited: 20 req/min). Detects reuse attacks and revokes token family.
- `POST /api/v1/auth/logout`: Revokes current refresh session and clears cookie.
- `POST /api/v1/auth/logout-all`: Revokes all active refresh sessions across all devices for the current user (**Authenticated**).
- `GET  /api/v1/auth/me`: Returns current authenticated user profile (**Authenticated**).

### 3.3 User Management Module (`/api/v1/users`)
- `GET   /api/v1/users`: Paginated list of users with search, role, status filtering (**ADMIN, MANAGER**).
- `GET   /api/v1/users/:id`: Get detailed user profile (**ADMIN, MANAGER**).
- `POST  /api/v1/users`: Create personnel account with password complexity validation (**ADMIN only**).
- `PATCH /api/v1/users/:id`: Update user profile name (**ADMIN only**).
- `PATCH /api/v1/users/:id/role`: Change user role. Protects against demoting the last active Administrator (**ADMIN only**).
- `PATCH /api/v1/users/:id/status`: Activate or deactivate user. Revokes all active sessions upon deactivation and protects against deactivating the last active Administrator (**ADMIN only**).
- `PATCH /api/v1/users/:id/password`: Reset user password and revoke all active sessions (**ADMIN only**).

### 3.4 Security Audit Logs Module (`/api/v1/audit-logs`)
- `GET /api/v1/audit-logs`: Immutable query of compliance logs with pagination and action filtering (**ADMIN only**).

### 3.5 Categories Module (`/api/v1/categories`)
- `GET   /api/v1/categories`: Paginated list of product categories with search and active status filter (**ADMIN, MANAGER, STAFF**).
- `GET   /api/v1/categories/:id`: Get category details and product counts (**ADMIN, MANAGER, STAFF**).
- `POST  /api/v1/categories`: Create new product category with slug normalization and conflict detection (**ADMIN, MANAGER**).
- `PATCH /api/v1/categories/:id`: Update category name, slug, description, or status (**ADMIN, MANAGER**).
- `PATCH /api/v1/categories/:id/status`: Toggle category active status. Protected by invariant: cannot deactivate category containing active products (**ADMIN, MANAGER**).

### 3.6 Products Module (`/api/v1/products`)
- `GET    /api/v1/products`: List products with pagination, search, category filter, active/deleted filter, and sorting. Includes primary thumbnail and variant count (**ADMIN, MANAGER, STAFF**).
- `GET    /api/v1/products/:id`: Get comprehensive product details with category, all variants, and media assets (**ADMIN, MANAGER, STAFF**).
- `POST   /api/v1/products`: Create product. Requires an active category (**ADMIN, MANAGER**).
- `PATCH  /api/v1/products/:id`: Update product info and description (**ADMIN, MANAGER**).
- `DELETE /api/v1/products/:id`: Soft delete product (`is_active = false`, `deleted_at = NOW()`). Invariant: All variants, inventory balances, and historical stock movements are preserved (**ADMIN, MANAGER**).
- `PATCH  /api/v1/products/:id/restore`: Restore soft-deleted product. Invariant: Associated category must be active (**ADMIN, MANAGER**).

### 3.7 Product Variants & SKU Module (`/api/v1/products/:productId/variants` & `/api/v1/variants`)
- `GET    /api/v1/products/:productId/variants`: List all SKU variants of a product with price, attributes, and stock balances (**ADMIN, MANAGER, STAFF**).
- `POST   /api/v1/products/:productId/variants`: Create variant SKU. Invariants: SKU must be globally unique; non-negative price; no quantity column in variant (**ADMIN, MANAGER**).
- `GET    /api/v1/variants/:id`: Get variant details by ID (**ADMIN, MANAGER, STAFF**).
- `PATCH  /api/v1/variants/:id`: Update variant price, attributes, or SKU. Invariant: SKU code cannot be changed once stock movements exist (**ADMIN, MANAGER**).
- `DELETE /api/v1/variants/:id`: Soft delete variant SKU. Invariant: Cannot deactivate/delete variant with positive inventory balance (**ADMIN, MANAGER**).
- `PATCH  /api/v1/variants/:id/restore`: Restore soft-deleted variant SKU (**ADMIN, MANAGER**).

### 3.8 Cloudinary Media Management Module (`/api/v1/products/:id/images`)
- `GET    /api/v1/products/:id/images`: List product media assets ordered by primary first, then sortOrder (**ADMIN, MANAGER, STAFF**).
- `POST   /api/v1/products/:id/images/sign`: Generate secure signed upload parameters for direct client upload to Cloudinary CDN. Validates 8 images limit and product namespace (**ADMIN, MANAGER**).
- `POST   /api/v1/products/:id/images/confirm`: Confirm uploaded asset, verify against Cloudinary, and save to PostgreSQL. Enforces Single Primary Image invariant (**ADMIN, MANAGER**).
- `PATCH  /api/v1/products/:id/images/:imageId`: Update image altText or display sortOrder (**ADMIN, MANAGER**).
- `PATCH  /api/v1/products/:id/images/:imageId/primary`: Promote image to primary display. Automatically unsets existing primary image in transaction (**ADMIN, MANAGER**).
- `DELETE /api/v1/products/:id/images/:imageId`: Remove image from database and destroy asset on Cloudinary CDN. Automatically promotes next image to primary if deleted image was primary (**ADMIN, MANAGER**).

---

## 4. Endpoints Implemented in Phase 4 (Warehouse, Inventory & Background Jobs)

### 4.1 Warehouses Module (`/api/v1/warehouses`)
- `GET   /api/v1/warehouses`: List all physical storage facilities with search, pagination, and active status filtering (**ADMIN, MANAGER, STAFF**).
- `GET   /api/v1/warehouses/:id`: Get detailed warehouse profile with balance and movement counts (**ADMIN, MANAGER, STAFF**).
- `POST  /api/v1/warehouses`: Create physical warehouse facility with unique uppercase code (**ADMIN, MANAGER**).
- `PATCH /api/v1/warehouses/:id`: Update warehouse facility code or name (**ADMIN, MANAGER**).
- `PATCH /api/v1/warehouses/:id/status`: Toggle warehouse active status. Invariant: Cannot deactivate facility with positive inventory balances or pending documents (**ADMIN, MANAGER**).

### 4.2 Inventory Balances & Alerts Module (`/api/v1/inventory`)
- `GET   /api/v1/inventory/balances`: Paginated real-time stock balances with search, warehouse filter, category filter, and stockStatus calculation (**ADMIN, MANAGER, STAFF**).
- `GET   /api/v1/inventory/balances/:warehouseId/:variantId`: Query balance for a specific facility and variant SKU (**ADMIN, MANAGER, STAFF**).
- `PATCH /api/v1/inventory/balances/:warehouseId/:variantId/threshold`: Update minimum alert threshold for SKU at facility (**ADMIN, MANAGER**).
- `GET   /api/v1/inventory/low-stock`: Filtered list of depleted items where `quantity <= min_threshold` (**ADMIN, MANAGER, STAFF**).
- `GET   /api/v1/inventory/movements`: Query chronological immutable stock movements ledger (**ADMIN, MANAGER, STAFF**).
- `GET   /api/v1/inventory/export`: Export live inventory balances as CSV or XLSX with formula injection protection (**ADMIN, MANAGER, STAFF**).

### 4.3 Stock Documents Lifecycle Module (`/api/v1/stock-documents`)
- `GET   /api/v1/stock-documents`: Paginated list of stock documents with filters for code, type, status, warehouse, and creator (**ADMIN, MANAGER, STAFF**).
- `GET   /api/v1/stock-documents/:id`: Full details of document, including SKU items and historical stock movements when POSTED (**ADMIN, MANAGER, STAFF**).
- `POST  /api/v1/stock-documents`: Create DRAFT voucher for INBOUND, OUTBOUND, TRANSFER, or ADJUSTMENT (**ADMIN, MANAGER, STAFF**).
- `PATCH /api/v1/stock-documents/:id`: Edit line items or notes of a DRAFT voucher (**ADMIN, MANAGER, STAFF [own draft only]**).
- `POST  /api/v1/stock-documents/:id/submit`: Transition document state from `DRAFT` to `PENDING` (**ADMIN, MANAGER, STAFF [own draft only]**).
- `POST  /api/v1/stock-documents/:id/approve`: Authorize document and transition to `POSTED`. Executes in PostgreSQL Interactive Transaction with `SELECT ... FOR UPDATE` pessimistic locking in stable order `(warehouse_id ASC, variant_id ASC)`. Enforces strict approval policy: `creator !== approver` (**ADMIN, MANAGER**).
- `POST  /api/v1/stock-documents/:id/reject`: Reject voucher from `PENDING` to terminal `REJECTED` state with reason (**ADMIN, MANAGER**).
- `POST  /api/v1/stock-documents/:id/cancel`: Cancel voucher in `DRAFT` or `PENDING` to terminal `CANCELLED` state (**ADMIN, MANAGER, STAFF [own document only]**).

### 4.4 Bulk Catalog Import & Background Processing Module (`/api/v1/imports`)
- `POST  /api/v1/imports/products`: Multipart upload of `.csv` or `.xlsx` catalog spreadsheet. Enqueues background job to BullMQ queue `product-import` and returns `202 Accepted` (**ADMIN, MANAGER**).
- `GET   /api/v1/imports`: List import jobs with status and row counts (**ADMIN, MANAGER**).
- `GET   /api/v1/imports/:id`: Real-time polling endpoint for import job execution progress and failed rows (**ADMIN, MANAGER**).
- `GET   /api/v1/imports/:id/errors`: Download error report CSV containing failed row numbers and validation failure explanations (**ADMIN, MANAGER**).
- `GET   /api/v1/imports/template`: Download sample product catalog CSV or XLSX template (**ADMIN, MANAGER**).

---

## 5. Endpoints Implemented in Phase 5 (Search, Cache-Aside, Analytics & Telemetry)

### 5.1 Advanced Product Search Module (`/api/v1/search`)
- `GET /api/v1/search/products`: High-performance multi-criteria search accelerated by PostgreSQL GIN trigram indexes and Redis Cache-Aside (`csm:v1:search:...`).
  - **Query Params:** `q`, `categoryId`, `warehouseId`, `minPrice`, `maxPrice`, `stockStatus` (`IN_STOCK`, `LOW_STOCK`, `OUT_OF_STOCK`), `isActive`, `createdFrom`, `createdTo`, `sortBy`, `sortOrder`, `page`, `limit`.
  - **Rate Limiting:** 60 requests/minute. Exceeding returns `429 Too Many Requests` with `Retry-After`.
  - **Role Isolation:** Unit cost prices (`costPrice`) are scrubbed for `STAFF` callers.
  - **Access:** **ADMIN, MANAGER, STAFF**.

### 5.2 Executive Analytics & Intelligence Module (`/api/v1/analytics`)
- `GET /api/v1/analytics/summary`: High-level inventory KPI summary (total products, active SKUs, facilities, units in stock, retail value, low stock counts, pending documents). Role isolated: `totalInventoryCostValue` is masked as `null` for `STAFF` (**ADMIN, MANAGER, STAFF**).
- `GET /api/v1/analytics/products-by-category`: Stock volumes, product counts, and valuations aggregated by category (**ADMIN, MANAGER, STAFF**).
- `GET /api/v1/analytics/stock-by-warehouse`: SKU count, total units, and values grouped by facility (**ADMIN, MANAGER, STAFF**).
- `GET /api/v1/analytics/inventory-value`: Deep financial valuation (Cost value, Retail value, Gross margin, Margin %) with category and warehouse breakdowns (**ADMIN, MANAGER only**; `STAFF` gets `403 Forbidden`).
- `GET /api/v1/analytics/stock-trends`: Chronological stock movement flow (Inbound, Outbound, Adjustments, Transfers) grouped by day. Transfers are counted unidirectionally to prevent double-counting (**ADMIN, MANAGER, STAFF**).
- `GET /api/v1/analytics/top-stocked-products`: Top N inventory SKUs by volume with warehouse distribution (**ADMIN, MANAGER, STAFF**).
- `GET /api/v1/analytics/low-stock`: Critical depleted SKU watchlist with deficit calculations (**ADMIN, MANAGER, STAFF**).

### 5.3 System Performance & Cache Telemetry (`/api/v1/system`)
- `GET  /api/v1/system/performance`: Real-time telemetry reporting cache hits, misses, hit rate percentage, Redis/Postgres ping latency, and response latency percentiles (P50, P95, P99) (**ADMIN only**).
- `POST /api/v1/system/cache/clear`: Manually purges application cache keys via SCAN without flushing BullMQ or Session data. Records `CLEAR_CACHE` in security audit trail (**ADMIN only**).


