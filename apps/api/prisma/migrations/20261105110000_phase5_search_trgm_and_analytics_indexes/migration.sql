-- Enable PostgreSQL Trigram Extension for high-performance substring search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN Trigram Indexes on Products & Variants for fast ILIKE and full-text searches
CREATE INDEX IF NOT EXISTS "idx_products_name_trgm" ON "products" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_products_description_trgm" ON "products" USING gin ("description" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_product_variants_sku_trgm" ON "product_variants" USING gin ("sku" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_product_variants_name_trgm" ON "product_variants" USING gin ("name" gin_trgm_ops);

-- B-Tree Performance Indexes for Multi-criteria Filtering & Analytics
CREATE INDEX IF NOT EXISTS "idx_products_created_at" ON "products" ("created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_product_variants_price" ON "product_variants" ("price");
CREATE INDEX IF NOT EXISTS "idx_inventory_balances_qty" ON "inventory_balances" ("quantity");

