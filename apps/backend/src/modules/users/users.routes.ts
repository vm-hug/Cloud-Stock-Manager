import { Router } from 'express';
import { usersController } from './users.controller';
import {
  createUserSchema,
  updateUserSchema,
  changeUserRoleSchema,
  changeUserStatusSchema,
  resetUserPasswordSchema,
  userQuerySchema,
} from './users.schema';
import { authenticate } from '../../common/middleware/authenticate';
import { requireRoles } from '../../common/middleware/authorize';
import { validateRequest } from '../../common/middleware/validateRequest';
import { Role } from '@cloud-stock/shared';

const router = Router();

// Apply authentication to all user management routes
router.use(authenticate);

// GET /api/v1/users (ADMIN & MANAGER)
router.get(
  '/',
  requireRoles([Role.ADMIN, Role.MANAGER]),
  validateRequest({ query: userQuerySchema }),
  usersController.getUsers
);

// GET /api/v1/users/:id (ADMIN & MANAGER)
router.get('/:id', requireRoles([Role.ADMIN, Role.MANAGER]), usersController.getUserById);

// POST /api/v1/users (ADMIN only)
router.post(
  '/',
  requireRoles([Role.ADMIN]),
  validateRequest({ body: createUserSchema }),
  usersController.createUser
);

// PATCH /api/v1/users/:id (ADMIN only)
router.patch(
  '/:id',
  requireRoles([Role.ADMIN]),
  validateRequest({ body: updateUserSchema }),
  usersController.updateUser
);

// PATCH /api/v1/users/:id/role (ADMIN only)
router.patch(
  '/:id/role',
  requireRoles([Role.ADMIN]),
  validateRequest({ body: changeUserRoleSchema }),
  usersController.changeUserRole
);

// PATCH /api/v1/users/:id/status (ADMIN only)
router.patch(
  '/:id/status',
  requireRoles([Role.ADMIN]),
  validateRequest({ body: changeUserStatusSchema }),
  usersController.changeUserStatus
);

// PATCH /api/v1/users/:id/password (ADMIN only)
router.patch(
  '/:id/password',
  requireRoles([Role.ADMIN]),
  validateRequest({ body: resetUserPasswordSchema }),
  usersController.resetUserPassword
);

export const usersRoutes = router;
