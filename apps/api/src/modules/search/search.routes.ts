import { Router } from 'express';
import { searchController } from './search.controller';
import { searchProductsSchema } from './search.schema';
import { authenticate } from '../../common/middleware/authenticate';
import { validateRequest } from '../../common/middleware/validateRequest';
import { searchRateLimiter } from '../../common/middleware/rateLimiter';

const router = Router();

// GET /api/v1/search/products
router.get(
  '/products',
  authenticate,
  searchRateLimiter,
  validateRequest({ query: searchProductsSchema }),
  searchController.searchProducts
);

export const searchRoutes = router;
export default router;

