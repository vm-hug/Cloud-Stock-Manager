import { Worker, Job } from 'bullmq';
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { prisma } from '../config/db';
import { createRedisConnection, QUEUE_NAMES } from './jobs.config';
import { ProductImportJobData } from './import.queue';
import { ImportJobStatus, Prisma } from '@prisma/client';
import { AuditAction } from '@cloud-stock/shared';
import { auditService } from '../modules/audit/audit.service';
import { cacheManager } from '../common/cache/cacheManager';

interface RowError {
  rowNumber: number;
  sku: string;
  reason: string;
}

export function createImportWorker(): Worker<ProductImportJobData> {
  const connection = createRedisConnection();

  const worker = new Worker<ProductImportJobData>(
    QUEUE_NAMES.PRODUCT_IMPORT,
    async (job: Job<ProductImportJobData>) => {
      const { importJobId, filePath, originalFilename, actorId } = job.data;
      console.log(`[ImportWorker] Starting import job ${importJobId} (${originalFilename})...`);

      // 1. Mark job as RUNNING in PostgreSQL
      await prisma.importJob.update({
        where: { id: importJobId },
        data: {
          status: ImportJobStatus.RUNNING,
          queueJobId: job.id,
        },
      });

      const errors: RowError[] = [];
      let processedCount = 0;
      let failedCount = 0;

      try {
        if (!fs.existsSync(filePath)) {
          throw new Error(`Import file not found on disk: ${filePath}`);
        }

        const workbook = new ExcelJS.Workbook();
        const ext = path.extname(originalFilename).toLowerCase();

        if (ext === '.csv') {
          await workbook.csv.readFile(filePath);
        } else {
          await workbook.xlsx.readFile(filePath);
        }

        const worksheet = workbook.worksheets[0];
        if (!worksheet) {
          throw new Error('Workbook contains no readable sheets.');
        }

        // Map headers
        const headerRow = worksheet.getRow(1);
        const headerMap: Record<string, number> = {};

        headerRow.eachCell((cell, colNumber) => {
          const val = cell.value ? String(cell.value).trim().toLowerCase().replace(/[^a-z0-9]/g, '') : '';
          headerMap[val] = colNumber;
        });

        const getCol = (...names: string[]): number | undefined => {
          for (const name of names) {
            const clean = name.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (headerMap[clean] !== undefined) return headerMap[clean];
          }
          return undefined;
        };

        const colProductName = getCol('productName', 'product_name', 'product');
        const colCategorySlug = getCol('categorySlug', 'category_slug', 'category');
        const colSku = getCol('sku', 'variant_sku', 'code');
        const colVariantName = getCol('variantName', 'variant_name', 'variant');
        const colPrice = getCol('sellingPrice', 'selling_price', 'price');
        const colCostPrice = getCol('costPrice', 'cost_price');
        const colAttributes = getCol('attributes');
        const colIsActive = getCol('isActive', 'is_active', 'active');

        if (!colProductName || !colCategorySlug || !colSku || !colVariantName || !colPrice) {
          throw new Error(
            'Missing required column headers. Expected: productName, categorySlug, sku, variantName, sellingPrice.'
          );
        }

        const rowCount = worksheet.rowCount;
        const totalRows = Math.max(0, rowCount - 1); // Exclude header row

        await prisma.importJob.update({
          where: { id: importJobId },
          data: { totalRows },
        });

        // Set to track duplicate SKUs within the import file
        const seenSkusInFile = new Set<string>();

        // Pre-fetch all categories for rapid lookup
        const categories = await prisma.category.findMany({
          select: { id: true, slug: true, isActive: true },
        });
        const categoryMap = new Map(categories.map((c) => [c.slug.toLowerCase(), c]));

        // Process rows in batches or sequentially
        for (let r = 2; r <= rowCount; r++) {
          const row = worksheet.getRow(r);
          const rawProductName = row.getCell(colProductName).value;
          const rawCategorySlug = row.getCell(colCategorySlug).value;
          const rawSku = row.getCell(colSku).value;
          const rawVariantName = row.getCell(colVariantName).value;
          const rawPrice = row.getCell(colPrice).value;
          const rawCostPrice = colCostPrice ? row.getCell(colCostPrice).value : null;
          const rawAttributes = colAttributes ? row.getCell(colAttributes).value : null;
          const rawIsActive = colIsActive ? row.getCell(colIsActive).value : null;

          // Skip completely empty trailing rows
          if (!rawProductName && !rawCategorySlug && !rawSku && !rawPrice) {
            continue;
          }

          const productName = rawProductName ? String(rawProductName).trim() : '';
          const categorySlug = rawCategorySlug ? String(rawCategorySlug).trim().toLowerCase() : '';
          const sku = rawSku ? String(rawSku).trim().toUpperCase() : '';
          const variantName = rawVariantName ? String(rawVariantName).trim() : '';
          const priceNum = rawPrice !== null && rawPrice !== undefined ? Number(rawPrice) : NaN;
          const costPriceNum =
            rawCostPrice !== null && rawCostPrice !== undefined && rawCostPrice !== ''
              ? Number(rawCostPrice)
              : null;

          let isActive = true;
          if (rawIsActive !== null && rawIsActive !== undefined) {
            const actStr = String(rawIsActive).toLowerCase();
            isActive = actStr === 'true' || actStr === '1' || actStr === 'yes';
          }

          let attributesJson: Record<string, any> = {};
          if (rawAttributes) {
            try {
              attributesJson = typeof rawAttributes === 'object' ? rawAttributes : JSON.parse(String(rawAttributes));
            } catch {
              attributesJson = {};
            }
          }

          // Row Validations
          if (!productName) {
            errors.push({ rowNumber: r, sku: sku || 'N/A', reason: 'Product name cannot be empty.' });
            failedCount++;
            continue;
          }

          if (!sku) {
            errors.push({ rowNumber: r, sku: 'N/A', reason: 'SKU cannot be empty.' });
            failedCount++;
            continue;
          }

          if (seenSkusInFile.has(sku)) {
            errors.push({ rowNumber: r, sku, reason: `Duplicate SKU '${sku}' found within the import file.` });
            failedCount++;
            continue;
          }
          seenSkusInFile.add(sku);

          if (isNaN(priceNum) || priceNum < 0) {
            errors.push({ rowNumber: r, sku, reason: 'Selling price must be a valid non-negative number.' });
            failedCount++;
            continue;
          }

          if (costPriceNum !== null && (isNaN(costPriceNum) || costPriceNum < 0)) {
            errors.push({ rowNumber: r, sku, reason: 'Cost price must be a valid non-negative number if provided.' });
            failedCount++;
            continue;
          }

          const category = categoryMap.get(categorySlug);
          if (!category) {
            errors.push({
              rowNumber: r,
              sku,
              reason: `Category with slug '${categorySlug}' does not exist in the database.`,
            });
            failedCount++;
            continue;
          }

          // Check if SKU already exists in PostgreSQL
          const existingSku = await prisma.productVariant.findUnique({
            where: { sku },
          });

          if (existingSku) {
            errors.push({
              rowNumber: r,
              sku,
              reason: `SKU '${sku}' already exists in the system database.`,
            });
            failedCount++;
            continue;
          }

          // Safe creation within a mini-transaction per row
          try {
            await prisma.$transaction(async (tx) => {
              // Slug for product
              const productSlug = productName
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '');

              // Upsert product by slug or create
              let product = await tx.product.findUnique({ where: { slug: productSlug } });
              if (!product) {
                product = await tx.product.create({
                  data: {
                    categoryId: category.id,
                    name: productName,
                    slug: productSlug,
                    isActive: true,
                  },
                });
              }

              // Create Variant SKU (NO quantity column!)
              await tx.productVariant.create({
                data: {
                  productId: product.id,
                  sku,
                  name: variantName || productName,
                  price: new Prisma.Decimal(priceNum),
                  costPrice: costPriceNum !== null ? new Prisma.Decimal(costPriceNum) : null,
                  attributes: attributesJson,
                  isActive,
                },
              });
            });

            processedCount++;
          } catch (rowErr: any) {
            errors.push({
              rowNumber: r,
              sku,
              reason: `Database insert failed: ${rowErr.message}`,
            });
            failedCount++;
          }

          // Update progress every 20 rows
          if (r % 20 === 0) {
            await prisma.importJob.update({
              where: { id: importJobId },
              data: {
                processedRows: processedCount,
                failedRows: failedCount,
              },
            });
          }
        }

        // Generate error report if there are errors
        let errorReportUrl: string | null = null;
        if (errors.length > 0) {
          const errorsDir = path.resolve(process.cwd(), 'uploads/imports/errors');
          fs.mkdirSync(errorsDir, { recursive: true });
          const errorFileName = `errors-${importJobId}.csv`;
          const errorFilePath = path.join(errorsDir, errorFileName);

          const errWorkbook = new ExcelJS.Workbook();
          const errSheet = errWorkbook.addWorksheet('Import Errors');
          errSheet.columns = [
            { header: 'Row Number', key: 'rowNumber', width: 14 },
            { header: 'SKU', key: 'sku', width: 20 },
            { header: 'Failure Reason', key: 'reason', width: 50 },
          ];

          for (const err of errors) {
            errSheet.addRow({
              rowNumber: err.rowNumber,
              sku: err.sku,
              reason: err.reason,
            });
          }
          await errWorkbook.csv.writeFile(errorFilePath);
          errorReportUrl = `/api/v1/imports/${importJobId}/errors`;
        }

        const finalStatus =
          processedCount === 0 && failedCount > 0 ? ImportJobStatus.FAILED : ImportJobStatus.COMPLETED;

        await prisma.importJob.update({
          where: { id: importJobId },
          data: {
            status: finalStatus,
            processedRows: processedCount,
            failedRows: failedCount,
            errorReportUrl,
            finishedAt: new Date(),
          },
        });

        await auditService.recordLog({
          actorId,
          action: finalStatus === ImportJobStatus.COMPLETED ? AuditAction.COMPLETE_IMPORT_JOB : AuditAction.FAIL_IMPORT_JOB,
          entityType: 'ImportJob',
          entityId: importJobId,
          metadata: {
            filename: originalFilename,
            processedCount,
            failedCount,
            status: finalStatus,
          },
        });

        if (processedCount > 0) {
          await cacheManager.invalidateCatalog();
        }

        console.log(
          `[ImportWorker] Job ${importJobId} finished with status ${finalStatus}. Processed: ${processedCount}, Failed: ${failedCount}.`
        );
      } catch (fatalErr: any) {
        console.error(`[ImportWorker] Fatal error during import job ${importJobId}:`, fatalErr);

        await prisma.importJob.update({
          where: { id: importJobId },
          data: {
            status: ImportJobStatus.FAILED,
            finishedAt: new Date(),
          },
        });

        await auditService.recordLog({
          actorId,
          action: AuditAction.FAIL_IMPORT_JOB,
          entityType: 'ImportJob',
          entityId: importJobId,
          metadata: { error: fatalErr.message },
        });

        throw fatalErr;
      }
    },
    {
      connection,
      concurrency: 2,
    }
  );

  worker.on('failed', (job, err) => {
    console.error(`[ImportWorker] Job ${job?.id} failed with error: ${err.message}`);
  });

  return worker;
}
