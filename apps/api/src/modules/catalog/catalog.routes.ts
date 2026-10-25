import { Router } from 'express';
import { Role } from '@cloud-stock/shared';
import { authenticate } from '../../common/middleware/authenticate';
import { requireRoles } from '../../common/middleware/authorize';
import { validateRequest } from '../../common/middleware/validateRequest';
import { catalogController } from './catalog.controller';
import {
  categoryQuerySchema,
  confirmImageSchema,
  createCategorySchema,
  createProductSchema,
  createVariantSchema,
  productQuerySchema,
  updateCategorySchema,
  updateCategoryStatusSchema,
  updateImageSchema,
  updateProductSchema,
  updateVariantSchema,
} from './catalog.schema';

const router = Router();

// ========================================================
// CATEGORIES
// ========================================================

router.get(
  '/categories',
  authenticate,
  requireRoles([Role.ADMIN, Role.MANAGER, Role.STAFF]),
  validateRequest({ query: categoryQuerySchema }),
  catalogController.getCategories
);

router.get(
  '/categories/:id',
  authenticate,
  requireRoles([Role.ADMIN, Role.MANAGER, Role.STAFF]),
  catalogController.getCategoryById
);

router.post(
  '/categories',
  authenticate,
  requireRoles([Role.ADMIN, Role.MANAGER]),
  validateRequest({ body: createCategorySchema }),
  catalogController.createCategory
);

router.patch(
  '/categories/:id',
  authenticate,
  requireRoles([Role.ADMIN, Role.MANAGER]),
  validateRequest({ body: updateCategorySchema }),
  catalogController.updateCategory
);

router.patch(
  '/categories/:id/status',
  authenticate,
  requireRoles([Role.ADMIN, Role.MANAGER]),
  validateRequest({ body: updateCategoryStatusSchema }),
  catalogController.updateCategoryStatus
);

// ========================================================
// PRODUCTS
// ========================================================

router.get(
  '/products',
  authenticate,
  requireRoles([Role.ADMIN, Role.MANAGER, Role.STAFF]),
  validateRequest({ query: productQuerySchema }),
  catalogController.getProducts
);

router.get(
  '/products/:id',
  authenticate,
  requireRoles([Role.ADMIN, Role.MANAGER, Role.STAFF]),
  catalogController.getProductById
);

router.post(
  '/products',
  authenticate,
  requireRoles([Role.ADMIN, Role.MANAGER]),
  validateRequest({ body: createProductSchema }),
  catalogController.createProduct
);

router.patch(
  '/products/:id',
  authenticate,
  requireRoles([Role.ADMIN, Role.MANAGER]),
  validateRequest({ body: updateProductSchema }),
  catalogController.updateProduct
);

router.delete(
  '/products/:id',
  authenticate,
  requireRoles([Role.ADMIN, Role.MANAGER]),
  catalogController.softDeleteProduct
);

router.patch(
  '/products/:id/restore',
  authenticate,
  requireRoles([Role.ADMIN, Role.MANAGER]),
  catalogController.restoreProduct
);

// ========================================================
// PRODUCT VARIANTS / SKU
// ========================================================

router.get(
  '/products/:productId/variants',
  authenticate,
  requireRoles([Role.ADMIN, Role.MANAGER, Role.STAFF]),
  catalogController.getVariantsByProductId
);

router.post(
  '/products/:productId/variants',
  authenticate,
  requireRoles([Role.ADMIN, Role.MANAGER]),
  validateRequest({ body: createVariantSchema }),
  catalogController.createVariant
);

router.get(
  '/variants/:id',
  authenticate,
  requireRoles([Role.ADMIN, Role.MANAGER, Role.STAFF]),
  catalogController.getVariantById
);

router.patch(
  '/variants/:id',
  authenticate,
  requireRoles([Role.ADMIN, Role.MANAGER]),
  validateRequest({ body: updateVariantSchema }),
  catalogController.updateVariant
);

router.delete(
  '/variants/:id',
  authenticate,
  requireRoles([Role.ADMIN, Role.MANAGER]),
  catalogController.softDeleteVariant
);

router.patch(
  '/variants/:id/restore',
  authenticate,
  requireRoles([Role.ADMIN, Role.MANAGER]),
  catalogController.restoreVariant
);

// ========================================================
// PRODUCT IMAGES & CLOUDINARY
// ========================================================

router.get(
  '/products/:id/images',
  authenticate,
  requireRoles([Role.ADMIN, Role.MANAGER, Role.STAFF]),
  catalogController.getImagesByProductId
);

router.post(
  '/products/:id/images/sign',
  authenticate,
  requireRoles([Role.ADMIN, Role.MANAGER]),
  catalogController.generateImageUploadSignature
);

router.post(
  '/products/:id/images/confirm',
  authenticate,
  requireRoles([Role.ADMIN, Role.MANAGER]),
  validateRequest({ body: confirmImageSchema }),
  catalogController.confirmImage
);

router.patch(
  '/products/:id/images/:imageId',
  authenticate,
  requireRoles([Role.ADMIN, Role.MANAGER]),
  validateRequest({ body: updateImageSchema }),
  catalogController.updateImage
);

router.patch(
  '/products/:id/images/:imageId/primary',
  authenticate,
  requireRoles([Role.ADMIN, Role.MANAGER]),
  catalogController.setPrimaryImage
);

router.delete(
  '/products/:id/images/:imageId',
  authenticate,
  requireRoles([Role.ADMIN, Role.MANAGER]),
  catalogController.deleteImage
);

export default router;
