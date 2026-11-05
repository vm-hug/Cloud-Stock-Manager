import { Router } from 'express';
import { analyticsController } from './analytics.controller';
import {
  analyticsFilterSchema,
  stockTrendsFilterSchema,
  topStockedFilterSchema,
} from './analytics.schema';
import { authenticate } from '../../common/middleware/authenticate';
import { requireRoles } from '../../common/middleware/authorize';
import { validateRequest } from '../../common/middleware/validateRequest';
import { analyticsRateLimiter } from '../../common/middleware/rateLimiter';
import { Role } from '@cloud-stock/shared';

const router = Router();

// Base path: /api/v1/analytics

// GET /api/v1/analytics/summary
router.get(
  '/summary',
  authenticate,
  analyticsRateLimiter,
  validateRequest({ query: analyticsFilterSchema }),
  analyticsController.getSummary
);

// GET /api/v1/analytics/products-by-category
router.get(
  '/products-by-category',
  authenticate,
  analyticsRateLimiter,
  validateRequest({ query: analyticsFilterSchema }),
  analyticsController.getProductsByCategory
);

// GET /api/v1/analytics/stock-by-warehouse
router.get(
  '/stock-by-warehouse',
  authenticate,
  analyticsRateLimiter,
  analyticsController.getStockByWarehouse
);

// GET /api/v1/analytics/inventory-value (ADMIN and MANAGER only)
router.get(
  '/inventory-value',
  authenticate,
  requireRoles([Role.ADMIN, Role.MANAGER]),
  analyticsRateLimiter,
  analyticsController.getInventoryValueBreakdown
);

// GET /api/v1/analytics/stock-trends
router.get(
  '/stock-trends',
  authenticate,
  analyticsRateLimiter,
  validateRequest({ query: stockTrendsFilterSchema }),
  analyticsController.getStockTrends
);

// GET /api/v1/analytics/top-stocked-products
router.get(
  '/top-stocked-products',
  authenticate,
  analyticsRateLimiter,
  validateRequest({ query: topStockedFilterSchema }),
  analyticsController.getTopStockedSkus
);

// GET /api/v1/analytics/low-stock
router.get(
  '/low-stock',
  authenticate,
  analyticsRateLimiter,
  analyticsController.getLowStockAlerts
);

export const analyticsRoutes = router;
export default router;
