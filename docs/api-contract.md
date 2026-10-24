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
- `401 Unauthorized`: Missing, expired, or invalid JWT token.
- `403 Forbidden`: Authenticated user lacks permission/role (RBAC failure).
- `404 Not Found`: Resource or endpoint does not exist.
- `409 Conflict`: Business invariant failure (e.g. duplicate SKU, duplicate code, document already posted).
- `422 Unprocessable Entity`: Business logic preconditions unfulfilled.
- `500 Internal Server Error`: Unhandled exception (sanitized in production).

---

## 3. Endpoints Implemented in Phase 1

### System Healthcheck
- **Method:** `GET`
- **Path:** `/api/health`
- **Auth:** Public
- **URL (local):** `http://localhost:5001/api/health`
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "data": {
      "status": "healthy",
      "timestamp": "2026-10-24T08:00:00.000Z",
      "service": "cloud-stock-api",
      "environment": "development"
    }
  }
  ```

---

## 4. Planned Endpoint Specifications for Subsequent Phases

### Auth Module (`/api/auth`)
- `POST /api/auth/login`: Authenticate with email/password, returns access token + refresh cookie.
- `POST /api/auth/refresh`: Issues fresh access token.
- `POST /api/auth/logout`: Revokes refresh token.
- `GET  /api/auth/me`: Returns current user profile.

### Catalog Module (`/api/catalog`)
- `GET    /api/catalog/categories`: List categories.
- `POST   /api/catalog/categories`: Create category (Admin/Manager).
- `GET    /api/catalog/products`: Paginated product list with search/filters.
- `POST   /api/catalog/products`: Create product with variants (Admin/Manager).
- `GET    /api/catalog/products/:id`: Get product details.
- `PUT    /api/catalog/products/:id`: Update product metadata (Admin/Manager).
- `DELETE /api/catalog/products/:id`: Soft delete product (Admin only).

### Inventory Module (`/api/inventory`)
- `GET  /api/inventory/balances`: Query current warehouse stock balances.
- `GET  /api/inventory/documents`: List stock documents.
- `POST /api/inventory/documents`: Create DRAFT document.
- `POST /api/inventory/documents/:id/submit`: Submit document to PENDING.
- `POST /api/inventory/documents/:id/post`: Approve & POST document (triggers atomic stock updates & movements).
- `POST /api/inventory/documents/:id/cancel`: Cancel document.
