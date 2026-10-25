import { Router } from 'express';
import { systemController } from './system.controller';
import { authenticate } from '../../common/middleware/authenticate';
import { requireRoles } from '../../common/middleware/authorize';
import { Role } from '@cloud-stock/shared';

const router = Router();

// GET /api/v1/system/health (ADMIN only)
router.get('/health', authenticate, requireRoles([Role.ADMIN]), systemController.getDetailedHealth);

export const systemRoutes = router;
