import { Router } from 'express';
import { Role } from '@cloud-stock/shared';
import { authenticate } from '../../common/middleware/authenticate';
import { requireRoles } from '../../common/middleware/authorize';
import { validateRequest } from '../../common/middleware/validateRequest';
import { exportRateLimiter } from '../../common/middleware/rateLimiter';
import { inventoryController } from './inventory.controller';
import {
  balanceQuerySchema,
  createStockDocumentSchema,
  createWarehouseSchema,
  exportInventoryQuerySchema,
  lowStockQuerySchema,
  rejectStockDocumentSchema,
  stockDocumentQuerySchema,
  stockMovementQuerySchema,
  updateStockDocumentSchema,
  updateThresholdSchema,
  updateWarehouseSchema,
  updateWarehouseStatusSchema,
  warehouseQuerySchema,
} from './inventory.schema';

const router = Router();

// All inventory endpoints require authentication
router.use(authenticate);

// ========================================================
// WAREHOUSES
// ========================================================

router.get(
  '/warehouses',
  requireRoles([Role.ADMIN, Role.MANAGER, Role.STAFF]),
  validateRequest({ query: warehouseQuerySchema }),
  inventoryController.getWarehouses
);

router.get(
  '/warehouses/:id',
  requireRoles([Role.ADMIN, Role.MANAGER, Role.STAFF]),
  inventoryController.getWarehouseById
);

router.post(
  '/warehouses',
  requireRoles([Role.ADMIN, Role.MANAGER]),
  validateRequest({ body: createWarehouseSchema }),
  inventoryController.createWarehouse
);

router.patch(
  '/warehouses/:id',
  requireRoles([Role.ADMIN, Role.MANAGER]),
  validateRequest({ body: updateWarehouseSchema }),
  inventoryController.updateWarehouse
);

router.patch(
  '/warehouses/:id/status',
  requireRoles([Role.ADMIN, Role.MANAGER]),
  validateRequest({ body: updateWarehouseStatusSchema }),
  inventoryController.updateWarehouseStatus
);

// ========================================================
// INVENTORY BALANCES & ALERTS
// ========================================================

router.get(
  '/inventory/balances',
  requireRoles([Role.ADMIN, Role.MANAGER, Role.STAFF]),
  validateRequest({ query: balanceQuerySchema }),
  inventoryController.getBalances
);

router.get(
  '/inventory/balances/:warehouseId/:variantId',
  requireRoles([Role.ADMIN, Role.MANAGER, Role.STAFF]),
  inventoryController.getBalance
);

router.patch(
  '/inventory/balances/:warehouseId/:variantId/threshold',
  requireRoles([Role.ADMIN, Role.MANAGER]),
  validateRequest({ body: updateThresholdSchema }),
  inventoryController.updateThreshold
);

router.get(
  '/inventory/low-stock',
  requireRoles([Role.ADMIN, Role.MANAGER, Role.STAFF]),
  validateRequest({ query: lowStockQuerySchema }),
  inventoryController.getLowStock
);

// ========================================================
// STOCK MOVEMENTS & STOCK CARD
// ========================================================

router.get(
  '/inventory/movements',
  requireRoles([Role.ADMIN, Role.MANAGER, Role.STAFF]),
  validateRequest({ query: stockMovementQuerySchema }),
  inventoryController.getMovements
);

// ========================================================
// INVENTORY EXPORT (CSV / XLSX)
// ========================================================

router.get(
  '/inventory/export',
  requireRoles([Role.ADMIN, Role.MANAGER, Role.STAFF]),
  exportRateLimiter,
  validateRequest({ query: exportInventoryQuerySchema }),
  inventoryController.exportBalances
);

// ========================================================
// STOCK DOCUMENTS LIFECYCLE
// ========================================================

router.get(
  '/stock-documents',
  requireRoles([Role.ADMIN, Role.MANAGER, Role.STAFF]),
  validateRequest({ query: stockDocumentQuerySchema }),
  inventoryController.getDocuments
);

router.get(
  '/stock-documents/:id',
  requireRoles([Role.ADMIN, Role.MANAGER, Role.STAFF]),
  inventoryController.getDocumentById
);

router.post(
  '/stock-documents',
  requireRoles([Role.ADMIN, Role.MANAGER, Role.STAFF]),
  validateRequest({ body: createStockDocumentSchema }),
  inventoryController.createDocument
);

router.patch(
  '/stock-documents/:id',
  requireRoles([Role.ADMIN, Role.MANAGER, Role.STAFF]),
  validateRequest({ body: updateStockDocumentSchema }),
  inventoryController.updateDraftDocument
);

router.post(
  '/stock-documents/:id/submit',
  requireRoles([Role.ADMIN, Role.MANAGER, Role.STAFF]),
  inventoryController.submitDocument
);

router.post(
  '/stock-documents/:id/approve',
  requireRoles([Role.ADMIN, Role.MANAGER]),
  inventoryController.approveDocument
);

router.post(
  '/stock-documents/:id/reject',
  requireRoles([Role.ADMIN, Role.MANAGER]),
  validateRequest({ body: rejectStockDocumentSchema }),
  inventoryController.rejectDocument
);

router.post(
  '/stock-documents/:id/cancel',
  requireRoles([Role.ADMIN, Role.MANAGER, Role.STAFF]),
  inventoryController.cancelDocument
);

export default router;

