-- AlterTable
ALTER TABLE "product_images" ADD COLUMN     "is_primary" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN     "attributes" JSONB DEFAULT '{}';

-- CreateTable
CREATE TABLE "media_deletion_jobs" (
    "id" UUID NOT NULL,
    "public_id" TEXT NOT NULL,
    "product_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "media_deletion_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "media_deletion_jobs_status_idx" ON "media_deletion_jobs"("status");

-- Partial Unique Index: Only at most 1 primary image per product
CREATE UNIQUE INDEX "product_images_product_id_primary_unique" ON "product_images" ("product_id") WHERE ("is_primary" = true);

-- Invariant Check Constraints: Variant prices must be non-negative
ALTER TABLE "product_variants"
  ADD CONSTRAINT "chk_product_variant_price_positive"
  CHECK ("price" >= 0);

ALTER TABLE "product_variants"
  ADD CONSTRAINT "chk_product_variant_cost_price_positive"
  CHECK ("cost_price" IS NULL OR "cost_price" >= 0);
