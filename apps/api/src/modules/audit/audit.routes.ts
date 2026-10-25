import { Router } from 'express';
import { auditController } from './audit.controller';
import { auditLogQuerySchema } from './audit.schema';
import { authenticate } from '../../common/middleware/authenticate';
import { requireRoles } from '../../common/middleware/authorize';
import { validateRequest } from '../../common/middleware/validateRequest';
import { Role } from '@cloud-stock/shared';

const router = Router();

// GET /api/v1/audit-logs (ADMIN only)
router.get(
  '/',
  authenticate,
  requireRoles([Role.ADMIN]),
  validateRequest({ query: auditLogQuerySchema }),
  auditController.getAuditLogs
);

export const auditRoutes = router;
