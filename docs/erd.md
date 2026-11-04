# Entity Relationship Diagram (ERD) — Cloud Stock Management

## 1. Visual Schema Diagram

```mermaid
erDiagram
    users ||--o{ refresh_sessions : "maintains"
    users ||--o{ audit_logs : "creates"
    users ||--o{ stock_documents : "creates / approves"
    users ||--o{ import_jobs : "triggers"

    categories ||--o{ products : "contains"
    products ||--o{ product_images : "has"
    products ||--o{ product_variants : "has"
    products ||--o{ media_deletion_jobs : "cleans"

    warehouses ||--o{ inventory_balances : "holds"
    warehouses ||--o{ stock_documents : "source / dest"
    warehouses ||--o{ stock_movements : "records"

    product_variants ||--o{ inventory_balances : "stocked_in"
    product_variants ||--o{ stock_document_items : "referenced_in"
    product_variants ||--o{ stock_movements : "moved"

    stock_documents ||--o{ stock_document_items : "contains"
    stock_document_items ||--o{ stock_movements : "generates"

    users {
        uuid id PK
        varchar name
        varchar email UK
        varchar password_hash
        role_enum role
        boolean is_active
        timestamptz last_login_at
        timestamptz created_at
        timestamptz updated_at
    }

    refresh_sessions {
        uuid id PK
        uuid user_id FK
        varchar token_hash UK
        uuid family
        boolean is_revoked
        timestamptz revoked_at
        timestamptz expires_at
        timestamptz created_at
        timestamptz last_used_at
        varchar ip_address
        varchar user_agent
    }

    categories {
        uuid id PK
        varchar name
        varchar slug UK
        text description
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }

    products {
        uuid id PK
        uuid category_id FK
        varchar name
        varchar slug UK
        text description
        boolean is_active
        timestamptz deleted_at
        timestamptz created_at
        timestamptz updated_at
    }

    product_images {
        uuid id PK
        uuid product_id FK
        text url
        text public_id
        text alt_text
        integer sort_order
        boolean is_primary "PARTIAL UNIQUE (product_id WHERE is_primary=true)"
        timestamptz created_at
    }

    product_variants {
        uuid id PK
        uuid product_id FK
        varchar sku UK
        varchar name
        numeric price "CHECK >= 0"
        numeric cost_price "CHECK IS NULL OR >= 0"
        jsonb attributes
        boolean is_active
        timestamptz deleted_at
        timestamptz created_at
        timestamptz updated_at
    }

    media_deletion_jobs {
        uuid id PK
        text public_id
        uuid product_id FK
        varchar status
        integer retry_count
        text error
        timestamptz created_at
        timestamptz updated_at
    }

    warehouses {
        uuid id PK
        varchar code UK
        varchar name
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }

    inventory_balances {
        uuid warehouse_id PK,FK
        uuid variant_id PK,FK
        integer quantity "CHECK >= 0"
        integer min_threshold "CHECK >= 0"
        timestamptz updated_at
    }

    stock_documents {
        uuid id PK
        varchar document_code UK
        stock_doc_type_enum type
        stock_doc_status_enum status
        uuid source_warehouse_id FK
        uuid destination_warehouse_id FK
        text note
        uuid created_by FK
        uuid approved_by FK
        timestamptz approved_at
        timestamptz posted_at
        timestamptz created_at
        timestamptz updated_at
    }

    stock_document_items {
        uuid id PK
        uuid document_id FK
        uuid variant_id FK
        integer quantity "CHECK > 0"
        integer adjustment_delta "CHECK IS NULL OR <> 0"
        numeric unit_price
    }

    stock_movements {
        uuid id PK
        uuid document_item_id FK
        uuid warehouse_id FK
        uuid variant_id FK
        integer delta "CHECK <> 0"
        integer quantity_before "CHECK >= 0"
        integer quantity_after "CHECK >= 0"
        timestamptz created_at
    }

    audit_logs {
        uuid id PK
        uuid actor_id FK
        varchar action
        varchar entity_type
        varchar entity_id
        jsonb metadata
        varchar ip_address
        timestamptz created_at
    }

    import_jobs {
        uuid id PK
        uuid created_by FK
        import_job_status_enum status
        varchar original_filename
        integer total_rows
        integer processed_rows
        integer failed_rows
        varchar error_report_url
        varchar queue_job_id
        timestamptz created_at
        timestamptz finished_at
    }
```

---

## 2. Table Summary & Invariant Enforcements

| Table Name | Primary Key | Critical Constraints |
| :--- | :--- | :--- |
| `users` | `id` (UUID) | `email` UNIQUE |
| `refresh_sessions` | `id` (UUID) | `token_hash` UNIQUE, index on `family` |
| `categories` | `id` (UUID) | `slug` UNIQUE |
| `products` | `id` (UUID) | `slug` UNIQUE, Soft delete via `deleted_at` |
| `product_images` | `id` (UUID) | PARTIAL UNIQUE `(product_id WHERE is_primary=true)` |
| `product_variants` | `id` (UUID) | `sku` UNIQUE, `CHECK (price >= 0)`, `CHECK (cost_price IS NULL OR cost_price >= 0)`, **NO quantity column** |
| `media_deletion_jobs` | `id` (UUID) | Index on `status` |
| `warehouses` | `id` (UUID) | `code` UNIQUE |
| `inventory_balances` | `(warehouse_id, variant_id)` | `CHECK ("quantity" >= 0)`, `CHECK ("min_threshold" >= 0)` |
| `stock_documents` | `id` (UUID) | `document_code` UNIQUE, `CHECK (TRANSFER rule)` |
| `stock_document_items` | `id` (UUID) | UNIQUE `(document_id, variant_id)`, `CHECK ("quantity" > 0)` |
| `stock_movements` | `id` (UUID) | UNIQUE `(document_item_id, warehouse_id)`, `CHECK ("delta" <> 0)`, non-negative balances |
| `audit_logs` | `id` (UUID) | Indexes on `(entity_type, entity_id)`, `actor_id`, `created_at` |
| `import_jobs` | `id` (UUID) | Indexes on `created_by`, `status`, `created_at` |

