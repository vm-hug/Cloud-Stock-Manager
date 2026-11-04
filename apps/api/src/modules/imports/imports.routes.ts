import { Router } from 'express';
import multer from 'multer';
import { Role } from '@cloud-stock/shared';
import { authenticate } from '../../common/middleware/authenticate';
import { requireRoles } from '../../common/middleware/authorize';
import { validateRequest } from '../../common/middleware/validateRequest';
import { importsController } from './imports.controller';
import { importQuerySchema } from './imports.schema';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max upload
});

router.use(authenticate);

router.post(
  '/imports/products',
  requireRoles([Role.ADMIN, Role.MANAGER]),
  upload.single('file'),
  importsController.uploadProductImport
);

router.get(
  '/imports',
  requireRoles([Role.ADMIN, Role.MANAGER]),
  validateRequest({ query: importQuerySchema }),
  importsController.getImportJobs
);

router.get(
  '/imports/template',
  requireRoles([Role.ADMIN, Role.MANAGER]),
  importsController.downloadTemplate
);

router.get(
  '/imports/:id',
  requireRoles([Role.ADMIN, Role.MANAGER]),
  importsController.getImportJobById
);

router.get(
  '/imports/:id/errors',
  requireRoles([Role.ADMIN, Role.MANAGER]),
  importsController.downloadErrorReport
);

export default router;
