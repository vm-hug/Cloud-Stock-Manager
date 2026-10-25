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

---

## 4. Planned Endpoint Specifications for Subsequent Phases (Catalog & Inventory)

### Catalog Module (`/api/v1/catalog`) - Phase 3
- `GET    /api/v1/catalog/categories`: List categories.
- `POST   /api/v1/catalog/categories`: Create category (Admin/Manager).
- `GET    /api/v1/catalog/products`: Paginated product list with search/filters.
- `POST   /api/v1/catalog/products`: Create product with variants (Admin/Manager).
- `GET    /api/v1/catalog/products/:id`: Get product details.
- `PUT    /api/v1/catalog/products/:id`: Update product metadata (Admin/Manager).
- `DELETE /api/v1/catalog/products/:id`: Soft delete product (Admin only).

### Inventory Module (`/api/v1/inventory`) - Phase 4
- `GET  /api/v1/inventory/balances`: Query current warehouse stock balances.
- `GET  /api/v1/inventory/documents`: List stock documents.
- `POST /api/v1/inventory/documents`: Create DRAFT document.
- `POST /api/v1/inventory/documents/:id/submit`: Submit document to PENDING.
- `POST /api/v1/inventory/documents/:id/post`: Approve & POST document (Pessimistic Locking `SELECT ... FOR UPDATE`).
- `POST /api/v1/inventory/documents/:id/cancel`: Cancel document.
