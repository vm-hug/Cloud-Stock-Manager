import { Router } from 'express';
import { authController } from './auth.controller';
import { loginSchema } from './auth.schema';
import { validateRequest } from '../../common/middleware/validateRequest';
import { authenticate } from '../../common/middleware/authenticate';
import { rateLimiter } from '../../common/middleware/rateLimiter';

const router = Router();

// POST /api/v1/auth/login (Rate limited: 10 requests per minute)
router.post(
  '/login',
  rateLimiter({ windowSeconds: 60, maxRequests: 10, prefix: 'login' }),
  validateRequest({ body: loginSchema }),
  authController.login
);

// POST /api/v1/auth/refresh (Rate limited: 20 requests per minute)
router.post(
  '/refresh',
  rateLimiter({ windowSeconds: 60, maxRequests: 20, prefix: 'refresh' }),
  authController.refresh
);

// POST /api/v1/auth/logout
router.post('/logout', authController.logout);

// POST /api/v1/auth/logout-all (Requires authentication)
router.post('/logout-all', authenticate, authController.logoutAll);

// GET /api/v1/auth/me (Requires authentication)
router.get('/me', authenticate, authController.getMe);

export const authRoutes = router;
