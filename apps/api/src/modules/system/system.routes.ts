import { Router } from 'express';
import { systemController } from './system.controller';
import { authenticate } from '../../common/middleware/authenticate';
import { requireRoles } from '../../common/middleware/authorize';
import { Role } from '@cloud-stock/shared';

const router = Router();

// GET /api/v1/system/health (ADMIN only)
router.get('/health', authenticate, requireRoles([Role.ADMIN]), systemController.getDetailedHealth);

// GET /api/v1/system/performance (ADMIN only)
router.get(
  '/performance',
  authenticate,
  requireRoles([Role.ADMIN]),
  systemController.getPerformanceMetrics
);

// POST /api/v1/system/cache/clear (ADMIN only)
router.post(
  '/cache/clear',
  authenticate,
  requireRoles([Role.ADMIN]),
  systemController.clearCache
);

export const systemRoutes = router;
