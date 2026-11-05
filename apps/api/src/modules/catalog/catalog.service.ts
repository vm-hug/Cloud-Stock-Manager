import { AuditAction } from '@cloud-stock/shared';
import { BadRequestError, ConflictError, NotFoundError } from '../../common/errors/appError';
import { slugify } from '../../common/utils/slugify';
import {
  deleteCloudinaryAsset,
  generateSignedUploadParams,
  verifyCloudinaryResource,
} from '../../config/cloudinary';
import { auditService } from '../audit/audit.service';
import { cacheManager } from '../../common/cache/cacheManager';
import { catalogRepository, CatalogRepository } from './catalog.repository';
import {
  CategoryQueryInput,
  ConfirmImageInput,
  CreateCategoryInput,
  CreateProductInput,
  CreateVariantInput,
  ProductQueryInput,
  UpdateCategoryInput,
  UpdateImageInput,
  UpdateProductInput,
  UpdateVariantInput,
} from './catalog.schema';

export class CatalogService {
  constructor(private repo: CatalogRepository = catalogRepository) {}

  // ========================================================
  // CATEGORIES
  // ========================================================

  async getCategories(query: CategoryQueryInput) {
    return this.repo.findCategories(query);
  }

  async getCategoryById(id: string) {
    const category = await this.repo.findCategoryById(id);
    if (!category) {
      throw new NotFoundError('Category not found');
    }
    return category;
  }

  async createCategory(
    input: CreateCategoryInput,
    actorId?: string | null,
    ipAddress?: string | null
  ) {
    let slug = input.slug ? slugify(input.slug) : slugify(input.name);
    if (!slug) slug = `cat-${Date.now()}`;

    // Verify slug uniqueness
    const existing = await this.repo.findCategoryBySlug(slug);
    if (existing) {
      throw new ConflictError(`Category with slug '${slug}' already exists`);
    }

    const category = await this.repo.createCategory({
      ...input,
      slug,
    });

    await auditService.recordLog({
      actorId,
      action: AuditAction.CREATE_CATEGORY,
      entityType: 'Category',
      entityId: category.id,
      metadata: { name: category.name, slug: category.slug },
      ipAddress,
    });

    await cacheManager.invalidateCatalog();

    return category;
  }

  async updateCategory(
    id: string,
    input: UpdateCategoryInput,
    actorId?: string | null,
    ipAddress?: string | null
  ) {
    const category = await this.getCategoryById(id);

    let slug = input.slug !== undefined ? slugify(input.slug) : undefined;
    if (slug && slug !== category.slug) {
      const existing = await this.repo.findCategoryBySlug(slug);
      if (existing && existing.id !== id) {
        throw new ConflictError(`Category with slug '${slug}' already exists`);
      }
    }

    const updated = await this.repo.updateCategory(id, {
      ...input,
      ...(slug !== undefined && { slug }),
    });

    await auditService.recordLog({
      actorId,
      action: AuditAction.UPDATE_CATEGORY,
      entityType: 'Category',
      entityId: updated.id,
      metadata: { changes: input },
      ipAddress,
    });

    await cacheManager.invalidateCatalog();

    return updated;
  }

  async updateCategoryStatus(
    id: string,
    isActive: boolean,
    actorId?: string | null,
    ipAddress?: string | null
  ) {
    const category = await this.getCategoryById(id);

    // Business Invariant: Disallow deactivating category that contains active products
    if (!isActive) {
      const activeProductsCount = await this.repo.countActiveProductsInCategory(id);
      if (activeProductsCount > 0) {
        throw new ConflictError(
          `Cannot deactivate category '${category.name}' because it contains ${activeProductsCount} active product(s). Deactivate or reassign them first.`
        );
      }
    }

    const updated = await this.repo.updateCategory(id, { isActive });

    await auditService.recordLog({
      actorId,
      action: AuditAction.CHANGE_CATEGORY_STATUS,
      entityType: 'Category',
      entityId: updated.id,
      metadata: { previousStatus: category.isActive, newStatus: isActive },
      ipAddress,
    });

    await cacheManager.invalidateCatalog();

    return updated;
  }

  // ========================================================
  // PRODUCTS
  // ========================================================

  async getProducts(query: ProductQueryInput) {
    return this.repo.findProducts(query);
  }

  async getProductById(id: string) {
    const product = await this.repo.findProductById(id);
    if (!product) {
      throw new NotFoundError('Product not found');
    }
    return product;
  }

  async createProduct(
    input: CreateProductInput,
    actorId?: string | null,
    ipAddress?: string | null
  ) {
    // Verify category exists and is active
    const category = await this.repo.findCategoryById(input.categoryId);
    if (!category) {
      throw new NotFoundError('Category not found');
    }
    if (!category.isActive) {
      throw new BadRequestError(`Cannot assign product to inactive category '${category.name}'`);
    }

    let slug = input.slug ? slugify(input.slug) : slugify(input.name);
    if (!slug) slug = `prod-${Date.now()}`;

    // Verify slug uniqueness
    const existingSlug = await this.repo.findProductBySlug(slug);
    if (existingSlug) {
      slug = `${slug}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    const product = await this.repo.createProduct({
      ...input,
      slug,
    });

    await auditService.recordLog({
      actorId,
      action: AuditAction.CREATE_PRODUCT,
      entityType: 'Product',
      entityId: product.id,
      metadata: { name: product.name, slug: product.slug, categoryId: product.categoryId },
      ipAddress,
    });

    await cacheManager.invalidateCatalog();

    return product;
  }

  async updateProduct(
    id: string,
    input: UpdateProductInput,
    actorId?: string | null,
    ipAddress?: string | null
  ) {
    const product = await this.getProductById(id);

    if (input.categoryId && input.categoryId !== product.categoryId) {
      const category = await this.repo.findCategoryById(input.categoryId);
      if (!category) {
        throw new NotFoundError('Category not found');
      }
      if (!category.isActive) {
        throw new BadRequestError(`Cannot move product to inactive category '${category.name}'`);
      }
    }

    let slug = input.slug !== undefined ? slugify(input.slug) : undefined;
    if (slug && slug !== product.slug) {
      const existing = await this.repo.findProductBySlug(slug);
      if (existing && existing.id !== id) {
        throw new ConflictError(`Product with slug '${slug}' already exists`);
      }
    }

    const updated = await this.repo.updateProduct(id, {
      ...input,
      ...(slug !== undefined && { slug }),
    });

    await auditService.recordLog({
      actorId,
      action: AuditAction.UPDATE_PRODUCT,
      entityType: 'Product',
      entityId: updated.id,
      metadata: { changes: input },
      ipAddress,
    });

    await cacheManager.invalidateCatalog();

    return updated;
  }

  async softDeleteProduct(id: string, actorId?: string | null, ipAddress?: string | null) {
    const product = await this.getProductById(id);
    if (product.deletedAt) {
      throw new BadRequestError('Product is already deleted');
    }

    const deleted = await this.repo.softDeleteProduct(id);

    await auditService.recordLog({
      actorId,
      action: AuditAction.DELETE_PRODUCT,
      entityType: 'Product',
      entityId: deleted.id,
      metadata: { name: product.name, deletedAt: deleted.deletedAt },
      ipAddress,
    });

    await cacheManager.invalidateCatalog();

    return deleted;
  }

  async restoreProduct(id: string, actorId?: string | null, ipAddress?: string | null) {
    const product = await this.getProductById(id);
    if (!product.deletedAt) {
      throw new BadRequestError('Product is not deleted');
    }

    // Verify category is still active before restoring
    const category = await this.repo.findCategoryById(product.categoryId);
    if (!category || !category.isActive) {
      throw new BadRequestError('Cannot restore product because its category is inactive or missing');
    }

    const restored = await this.repo.restoreProduct(id);

    await auditService.recordLog({
      actorId,
      action: AuditAction.RESTORE_PRODUCT,
      entityType: 'Product',
      entityId: restored.id,
      metadata: { name: product.name },
      ipAddress,
    });

    await cacheManager.invalidateCatalog();

    return restored;
  }

  // ========================================================
  // PRODUCT VARIANTS / SKU
  // ========================================================

  async getVariantsByProductId(productId: string) {
    await this.getProductById(productId);
    return this.repo.findVariantsByProductId(productId);
  }

  async getVariantById(id: string) {
    const variant = await this.repo.findVariantById(id);
    if (!variant) {
      throw new NotFoundError('Variant not found');
    }
    return variant;
  }

  async createVariant(
    productId: string,
    input: CreateVariantInput,
    actorId?: string | null,
    ipAddress?: string | null
  ) {
    const product = await this.getProductById(productId);
    if (product.deletedAt) {
      throw new BadRequestError('Cannot create variant for a deleted product');
    }

    // Normalize SKU
    const normalizedSku = input.sku.trim().toUpperCase();

    // Invariant: SKU must be globally unique
    const existing = await this.repo.findVariantBySku(normalizedSku);
    if (existing) {
      throw new ConflictError(`Variant with SKU '${normalizedSku}' already exists`);
    }

    const variant = await this.repo.createVariant(productId, {
      ...input,
      sku: normalizedSku,
    });

    await auditService.recordLog({
      actorId,
      action: AuditAction.CREATE_VARIANT,
      entityType: 'ProductVariant',
      entityId: variant.id,
      metadata: {
        productId,
        sku: variant.sku,
        name: variant.name,
        price: variant.price.toString(),
      },
      ipAddress,
    });

    await cacheManager.invalidateCatalog();

    return variant;
  }

  async updateVariant(
    id: string,
    input: UpdateVariantInput,
    actorId?: string | null,
    ipAddress?: string | null
  ) {
    const variant = await this.getVariantById(id);

    let normalizedSku = input.sku ? input.sku.trim().toUpperCase() : undefined;

    // Invariant: If SKU is changing, check whether stock movements already exist
    if (normalizedSku && normalizedSku !== variant.sku) {
      const hasMovements = await this.repo.hasStockMovements(id);
      if (hasMovements) {
        throw new ConflictError(
          `Cannot modify SKU '${variant.sku}' because stock movements have already been recorded for this variant.`
        );
      }

      const existingSku = await this.repo.findVariantBySku(normalizedSku);
      if (existingSku && existingSku.id !== id) {
        throw new ConflictError(`Variant with SKU '${normalizedSku}' already exists`);
      }
    }

    const updated = await this.repo.updateVariant(id, {
      ...input,
      ...(normalizedSku !== undefined && { sku: normalizedSku }),
    });

    await auditService.recordLog({
      actorId,
      action: AuditAction.UPDATE_VARIANT,
      entityType: 'ProductVariant',
      entityId: updated.id,
      metadata: { changes: input },
      ipAddress,
    });

    await cacheManager.invalidateCatalog();

    return updated;
  }

  async softDeleteVariant(id: string, actorId?: string | null, ipAddress?: string | null) {
    const variant = await this.getVariantById(id);
    if (variant.deletedAt) {
      throw new BadRequestError('Variant is already deleted');
    }

    // Invariant: Cannot deactivate/delete variant with positive inventory balance
    const totalInventory = await this.repo.getVariantInventoryBalanceSum(id);
    if (totalInventory > 0) {
      throw new ConflictError(
        `Cannot deactivate SKU '${variant.sku}' because there is positive stock (${totalInventory} units) in inventory.`
      );
    }

    const deleted = await this.repo.softDeleteVariant(id);

    await auditService.recordLog({
      actorId,
      action: AuditAction.DELETE_VARIANT,
      entityType: 'ProductVariant',
      entityId: deleted.id,
      metadata: { sku: variant.sku },
      ipAddress,
    });

    await cacheManager.invalidateCatalog();

    return deleted;
  }

  async restoreVariant(id: string, actorId?: string | null, ipAddress?: string | null) {
    const variant = await this.getVariantById(id);
    if (!variant.deletedAt) {
      throw new BadRequestError('Variant is not deleted');
    }

    const restored = await this.repo.restoreVariant(id);

    await auditService.recordLog({
      actorId,
      action: AuditAction.RESTORE_VARIANT,
      entityType: 'ProductVariant',
      entityId: restored.id,
      metadata: { sku: variant.sku },
      ipAddress,
    });

    await cacheManager.invalidateCatalog();

    return restored;
  }

  // ========================================================
  // PRODUCT IMAGES & CLOUDINARY
  // ========================================================

  async getImagesByProductId(productId: string) {
    await this.getProductById(productId);
    return this.repo.findImagesByProductId(productId);
  }

  async generateImageUploadSignature(productId: string) {
    const product = await this.getProductById(productId);
    if (product.deletedAt) {
      throw new BadRequestError('Cannot upload images for a deleted product');
    }

    const count = await this.repo.countImagesByProductId(productId);
    if (count >= 8) {
      throw new BadRequestError('Maximum limit of 8 images per product reached');
    }

    const folder = `cloud-stock/products/${productId}`;
    const publicId = `${folder}/img_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

    return generateSignedUploadParams(folder, publicId);
  }

  async confirmImage(
    productId: string,
    input: ConfirmImageInput,
    actorId?: string | null,
    ipAddress?: string | null
  ) {
    const product = await this.getProductById(productId);
    if (product.deletedAt) {
      throw new BadRequestError('Cannot add images to a deleted product');
    }

    const count = await this.repo.countImagesByProductId(productId);
    if (count >= 8) {
      throw new BadRequestError('Maximum limit of 8 images per product reached');
    }

    // Security validation: Verify publicId namespace belongs to this product
    const expectedPrefix = `cloud-stock/products/${productId}`;
    if (!input.publicId.includes(productId)) {
      throw new BadRequestError('Image publicId does not belong to this product namespace');
    }

    // Security verification: verify image asset on Cloudinary
    const isValid = await verifyCloudinaryResource(input.publicId);
    if (!isValid) {
      throw new BadRequestError('Image verification failed on Cloudinary CDN');
    }

    const image = await this.repo.createImage(productId, input);

    await auditService.recordLog({
      actorId,
      action: AuditAction.UPLOAD_PRODUCT_IMAGE,
      entityType: 'ProductImage',
      entityId: image.id,
      metadata: {
        productId,
        publicId: image.publicId,
        url: image.url,
        isPrimary: image.isPrimary,
      },
      ipAddress,
    });

    await cacheManager.invalidateCatalog();

    return image;
  }

  async updateImage(
    productId: string,
    imageId: string,
    input: UpdateImageInput,
    actorId?: string | null,
    ipAddress?: string | null
  ) {
    const image = await this.repo.findImageById(imageId);
    if (!image || image.productId !== productId) {
      throw new NotFoundError('Product image not found');
    }

    const updated = await this.repo.updateImage(imageId, input);

    await auditService.recordLog({
      actorId,
      action: 'UPDATE_PRODUCT_IMAGE',
      entityType: 'ProductImage',
      entityId: imageId,
      metadata: { changes: input },
      ipAddress,
    });

    await cacheManager.invalidateCatalog();

    return updated;
  }

  async setPrimaryImage(
    productId: string,
    imageId: string,
    actorId?: string | null,
    ipAddress?: string | null
  ) {
    const image = await this.repo.findImageById(imageId);
    if (!image || image.productId !== productId) {
      throw new NotFoundError('Product image not found');
    }

    const updated = await this.repo.setPrimaryImage(productId, imageId);

    await auditService.recordLog({
      actorId,
      action: AuditAction.SET_PRIMARY_IMAGE,
      entityType: 'ProductImage',
      entityId: imageId,
      metadata: { productId, publicId: updated.publicId },
      ipAddress,
    });

    await cacheManager.invalidateCatalog();

    return updated;
  }

  async deleteImage(
    productId: string,
    imageId: string,
    actorId?: string | null,
    ipAddress?: string | null
  ) {
    const image = await this.repo.findImageById(imageId);
    if (!image || image.productId !== productId) {
      throw new NotFoundError('Product image not found');
    }

    // 1. Delete from PostgreSQL in a transaction and promote another image if needed
    const deleted = await this.repo.deleteImage(productId, imageId);
    if (!deleted) {
      throw new NotFoundError('Image not found');
    }

    // 2. Record deletion job for guaranteed cleanup tracking
    const job = await this.repo.recordDeletionJob(image.publicId, productId);

    // 3. Destroy asset on Cloudinary CDN
    const destroyed = await deleteCloudinaryAsset(image.publicId);
    if (destroyed) {
      await this.repo.updateDeletionJob(job.id, 'COMPLETED');
    } else {
      await this.repo.updateDeletionJob(job.id, 'FAILED', 'Cloudinary destroy returned non-ok');
    }

    await auditService.recordLog({
      actorId,
      action: AuditAction.DELETE_PRODUCT_IMAGE,
      entityType: 'ProductImage',
      entityId: imageId,
      metadata: { productId, publicId: image.publicId },
      ipAddress,
    });

    await cacheManager.invalidateCatalog();

    return { message: 'Image deleted successfully' };
  }
}

export const catalogService = new CatalogService();
