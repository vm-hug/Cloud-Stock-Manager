-- AlterTable
ALTER TABLE "stock_document_items" ADD COLUMN "adjustment_delta" INTEGER;

-- Check Constraint: adjustment_delta must be non-zero if present
ALTER TABLE "stock_document_items"
  ADD CONSTRAINT "chk_stock_document_items_adj_delta_non_zero"
  CHECK ("adjustment_delta" IS NULL OR "adjustment_delta" <> 0);

