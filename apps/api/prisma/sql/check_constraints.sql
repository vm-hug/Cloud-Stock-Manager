-- ========================================================
-- Database Check Constraints for Cloud Stock Management
-- Database: PostgreSQL 16
-- Note: These constraints enforce inventory domain invariants
-- at the physical database layer.
-- ========================================================

-- 1. Inventory balances cannot be negative
ALTER TABLE "inventory_balances"
  ADD CONSTRAINT "chk_inventory_balances_quantity_non_negative"
  CHECK ("quantity" >= 0);

-- 2. Min threshold for inventory balance cannot be negative
ALTER TABLE "inventory_balances"
  ADD CONSTRAINT "chk_inventory_balances_min_threshold_non_negative"
  CHECK ("min_threshold" >= 0);

-- 3. Stock document items must have strictly positive quantities (> 0)
ALTER TABLE "stock_document_items"
  ADD CONSTRAINT "chk_stock_document_items_quantity_positive"
  CHECK ("quantity" > 0);

-- 4. Stock movement delta must be non-zero (must represent an actual change)
ALTER TABLE "stock_movements"
  ADD CONSTRAINT "chk_stock_movements_delta_non_zero"
  CHECK ("delta" <> 0);

-- 5. Stock movement quantity before must be non-negative
ALTER TABLE "stock_movements"
  ADD CONSTRAINT "chk_stock_movements_qty_before_non_negative"
  CHECK ("quantity_before" >= 0);

-- 6. Stock movement quantity after must be non-negative
ALTER TABLE "stock_movements"
  ADD CONSTRAINT "chk_stock_movements_qty_after_non_negative"
  CHECK ("quantity_after" >= 0);

-- 7. For TRANSFER documents: source and destination warehouses must both be present and distinct
ALTER TABLE "stock_documents"
  ADD CONSTRAINT "chk_stock_documents_transfer_warehouses"
  CHECK (
    "type" <> 'TRANSFER' OR (
      "source_warehouse_id" IS NOT NULL AND
      "destination_warehouse_id" IS NOT NULL AND
      "source_warehouse_id" <> "destination_warehouse_id"
    )
  );
