import { z } from 'zod';
import { StockDocType, StockDocStatus } from '@cloud-stock/shared';

// ========================================================
// WAREHOUSE SCHEMAS
// ========================================================

export const createWarehouseSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, 'Warehouse code must be at least 2 characters')
    .max(20, 'Warehouse code cannot exceed 20 characters')
    .regex(/^[A-Za-z0-9_-]+$/, 'Warehouse code may only contain alphanumeric characters, hyphens, and underscores')
    .transform((val) => val.toUpperCase()),
  name: z.string().trim().min(2, 'Warehouse name must be at least 2 characters').max(100),
});

export const updateWarehouseSchema = z.object({
  name: z.string().trim().min(2, 'Warehouse name must be at least 2 characters').max(100).optional(),
  code: z
    .string()
    .trim()
    .min(2)
    .max(20)
    .regex(/^[A-Za-z0-9_-]+$/)
    .transform((val) => val.toUpperCase())
    .optional(),
});

export const updateWarehouseStatusSchema = z.object({
  isActive: z.boolean(),
});

export const warehouseQuerySchema = z.object({
  search: z.string().trim().optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ========================================================
// INVENTORY BALANCE SCHEMAS
// ========================================================

export const balanceQuerySchema = z.object({
  warehouseId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  search: z.string().trim().optional(),
  stockStatus: z.enum(['OUT_OF_STOCK', 'LOW_STOCK', 'IN_STOCK']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const lowStockQuerySchema = z.object({
  warehouseId: z.string().uuid().optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const updateThresholdSchema = z.object({
  minThreshold: z.number().int().min(0, 'Minimum threshold cannot be negative'),
});

// ========================================================
// STOCK DOCUMENT SCHEMAS
// ========================================================

export const stockDocumentItemInputSchema = z.object({
  variantId: z.string().uuid('Invalid variant ID'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  adjustmentDelta: z.number().int().optional(),
  unitPrice: z.number().min(0, 'Unit price cannot be negative').optional(),
});

export const createStockDocumentSchema = z
  .object({
    type: z.nativeEnum(StockDocType),
    sourceWarehouseId: z.string().uuid().optional().nullable(),
    destinationWarehouseId: z.string().uuid().optional().nullable(),
    note: z.string().trim().max(500).optional().nullable(),
    items: z.array(stockDocumentItemInputSchema).min(1, 'At least one item is required in the document'),
  })
  .superRefine((data, ctx) => {
    // 1. Warehouse requirements by type
    if (data.type === StockDocType.INBOUND) {
      if (!data.destinationWarehouseId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['destinationWarehouseId'],
          message: 'Destination warehouse is required for INBOUND documents',
        });
      }
    } else if (data.type === StockDocType.OUTBOUND) {
      if (!data.sourceWarehouseId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['sourceWarehouseId'],
          message: 'Source warehouse is required for OUTBOUND documents',
        });
      }
    } else if (data.type === StockDocType.ADJUSTMENT) {
      if (!data.sourceWarehouseId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['sourceWarehouseId'],
          message: 'Warehouse (source warehouse) is required for ADJUSTMENT documents',
        });
      }
    } else if (data.type === StockDocType.TRANSFER) {
      if (!data.sourceWarehouseId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['sourceWarehouseId'],
          message: 'Source warehouse is required for TRANSFER documents',
        });
      }
      if (!data.destinationWarehouseId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['destinationWarehouseId'],
          message: 'Destination warehouse is required for TRANSFER documents',
        });
      }
      if (
        data.sourceWarehouseId &&
        data.destinationWarehouseId &&
        data.sourceWarehouseId === data.destinationWarehouseId
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['destinationWarehouseId'],
          message: 'Source and destination warehouses must be distinct for TRANSFER documents',
        });
      }
    }

    // 2. Adjustment delta check
    if (data.type === StockDocType.ADJUSTMENT) {
      data.items.forEach((item, index) => {
        if (item.adjustmentDelta === undefined || item.adjustmentDelta === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['items', index, 'adjustmentDelta'],
            message: 'Adjustment delta is required and must be non-zero for ADJUSTMENT documents',
          });
        }
      });
    }

    // 3. Unique variantId per document check
    const variantIds = new Set<string>();
    data.items.forEach((item, index) => {
      if (variantIds.has(item.variantId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['items', index, 'variantId'],
          message: 'Duplicate SKU/variant is not allowed in the same document',
        });
      }
      variantIds.add(item.variantId);
    });
  });

export const updateStockDocumentSchema = z
  .object({
    sourceWarehouseId: z.string().uuid().optional().nullable(),
    destinationWarehouseId: z.string().uuid().optional().nullable(),
    note: z.string().trim().max(500).optional().nullable(),
    items: z.array(stockDocumentItemInputSchema).min(1).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.items) {
      const variantIds = new Set<string>();
      data.items.forEach((item, index) => {
        if (variantIds.has(item.variantId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['items', index, 'variantId'],
            message: 'Duplicate SKU/variant is not allowed in the same document',
          });
        }
        variantIds.add(item.variantId);
      });
    }
  });

export const rejectStockDocumentSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const stockDocumentQuerySchema = z.object({
  documentCode: z.string().trim().optional(),
  type: z.nativeEnum(StockDocType).optional(),
  status: z.nativeEnum(StockDocStatus).optional(),
  warehouseId: z.string().uuid().optional(),
  createdById: z.string().uuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ========================================================
// STOCK MOVEMENTS SCHEMAS
// ========================================================

export const stockMovementQuerySchema = z.object({
  warehouseId: z.string().uuid().optional(),
  variantId: z.string().uuid().optional(),
  documentId: z.string().uuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ========================================================
// EXPORT SCHEMAS
// ========================================================

export const exportInventoryQuerySchema = z.object({
  format: z.enum(['csv', 'xlsx']).default('csv'),
  warehouseId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  stockStatus: z.enum(['OUT_OF_STOCK', 'LOW_STOCK', 'IN_STOCK']).optional(),
});

export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;
export type UpdateWarehouseInput = z.infer<typeof updateWarehouseSchema>;
export type WarehouseQueryInput = z.infer<typeof warehouseQuerySchema>;
export type BalanceQueryInput = z.infer<typeof balanceQuerySchema>;
export type LowStockQueryInput = z.infer<typeof lowStockQuerySchema>;
export type UpdateThresholdInput = z.infer<typeof updateThresholdSchema>;
export type CreateStockDocumentInput = z.infer<typeof createStockDocumentSchema>;
export type UpdateStockDocumentInput = z.infer<typeof updateStockDocumentSchema>;
export type StockDocumentQueryInput = z.infer<typeof stockDocumentQuerySchema>;
export type StockMovementQueryInput = z.infer<typeof stockMovementQuerySchema>;
export type ExportInventoryQueryInput = z.infer<typeof exportInventoryQuerySchema>;

