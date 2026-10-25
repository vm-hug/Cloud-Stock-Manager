import { Prisma, PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../../config/db';
import {
  CategoryQueryInput,
  CreateCategoryInput,
  UpdateCategoryInput,
  ProductQueryInput,
  CreateProductInput,
  UpdateProductInput,
  CreateVariantInput,
  UpdateVariantInput,
  ConfirmImageInput,
  UpdateImageInput,
} from './catalog.schema';

export class CatalogRepository {
  constructor(private prisma: PrismaClient = defaultPrisma) {}

  // ========================================================
  // CATEGORIES
  // ========================================================

  async findCategories(query: CategoryQueryInput) {
    const { page, limit, search, isActive } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.CategoryWhereInput = {};

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.category.count({ where }),
      this.prisma.category.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: { products: true },
          },
        },
      }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async findCategoryById(id: string) {
    return this.prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });
  }

  async findCategoryBySlug(slug: string) {
    return this.prisma.category.findUnique({
      where: { slug },
    });
  }

  async createCategory(data: CreateCategoryInput & { slug: string }) {
    return this.prisma.category.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        isActive: data.isActive ?? true,
      },
    });
  }

  async updateCategory(id: string, data: UpdateCategoryInput) {
    return this.prisma.category.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.slug !== undefined && { slug: data.slug }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
  }

  async countActiveProductsInCategory(categoryId: string): Promise<number> {
    return this.prisma.product.count({
      where: {
        categoryId,
        isActive: true,
        deletedAt: null,
      },
    });
  }

  // ========================================================
  // PRODUCTS
  // ========================================================

  async findProducts(query: ProductQueryInput) {
    const { page, limit, search, categoryId, isActive, includeDeleted, sortBy, sortOrder } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {};

    if (!includeDeleted) {
      where.deletedAt = null;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        {
          variants: {
            some: {
              sku: { contains: search, mode: 'insensitive' },
            },
          },
        },
      ];
    }

    const orderBy: Prisma.ProductOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    const [total, items] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          category: {
            select: { id: true, name: true, slug: true, isActive: true },
          },
          images: {
            orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
            take: 1, // Primary thumbnail
          },
          _count: {
            select: {
              variants: true,
              images: true,
            },
          },
        },
      }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async findProductById(id: string) {
    return this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        images: {
          orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
        },
        variants: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
          include: {
            inventoryBalances: {
              select: {
                warehouseId: true,
                quantity: true,
              },
            },
          },
        },
      },
    });
  }

  async findProductBySlug(slug: string) {
    return this.prisma.product.findUnique({
      where: { slug },
    });
  }

  async createProduct(data: CreateProductInput & { slug: string }) {
    return this.prisma.product.create({
      data: {
        name: data.name,
        slug: data.slug,
        categoryId: data.categoryId,
        description: data.description,
        isActive: data.isActive ?? true,
      },
      include: {
        category: true,
      },
    });
  }

  async updateProduct(id: string, data: UpdateProductInput) {
    return this.prisma.product.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.slug !== undefined && { slug: data.slug }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
      include: {
        category: true,
        images: {
          orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
        },
        variants: true,
      },
    });
  }

  async softDeleteProduct(id: string) {
    return this.prisma.product.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });
  }

  async restoreProduct(id: string) {
    return this.prisma.product.update({
      where: { id },
      data: {
        isActive: true,
        deletedAt: null,
      },
      include: {
        category: true,
      },
    });
  }

  // ========================================================
  // PRODUCT VARIANTS / SKU
  // ========================================================

  async findVariantsByProductId(productId: string) {
    return this.prisma.productVariant.findMany({
      where: {
        productId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
      include: {
        inventoryBalances: {
          select: {
            warehouseId: true,
            quantity: true,
          },
        },
      },
    });
  }

  async findVariantById(id: string) {
    return this.prisma.productVariant.findUnique({
      where: { id },
      include: {
        product: {
          select: { id: true, name: true, slug: true, deletedAt: true },
        },
        inventoryBalances: true,
      },
    });
  }

  async findVariantBySku(sku: string) {
    return this.prisma.productVariant.findUnique({
      where: { sku },
    });
  }

  async createVariant(productId: string, data: CreateVariantInput) {
    return this.prisma.productVariant.create({
      data: {
        productId,
        sku: data.sku,
        name: data.name,
        price: data.price,
        costPrice: data.costPrice ?? null,
        attributes: data.attributes || {},
        isActive: data.isActive ?? true,
      },
    });
  }

  async updateVariant(id: string, data: UpdateVariantInput) {
    return this.prisma.productVariant.update({
      where: { id },
      data: {
        ...(data.sku !== undefined && { sku: data.sku }),
        ...(data.name !== undefined && { name: data.name }),
        ...(data.price !== undefined && { price: data.price }),
        ...(data.costPrice !== undefined && { costPrice: data.costPrice }),
        ...(data.attributes !== undefined && { attributes: data.attributes }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
  }

  async softDeleteVariant(id: string) {
    return this.prisma.productVariant.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });
  }

  async restoreVariant(id: string) {
    return this.prisma.productVariant.update({
      where: { id },
      data: {
        isActive: true,
        deletedAt: null,
      },
    });
  }

  async hasStockMovements(variantId: string): Promise<boolean> {
    const count = await this.prisma.stockMovement.count({
      where: { variantId },
    });
    return count > 0;
  }

  async getVariantInventoryBalanceSum(variantId: string): Promise<number> {
    const balances = await this.prisma.inventoryBalance.findMany({
      where: { variantId },
      select: { quantity: true },
    });
    return balances.reduce((sum, b) => sum + b.quantity, 0);
  }

  // ========================================================
  // PRODUCT IMAGES
  // ========================================================

  async findImagesByProductId(productId: string) {
    return this.prisma.productImage.findMany({
      where: { productId },
      orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findImageById(id: string) {
    return this.prisma.productImage.findUnique({
      where: { id },
    });
  }

  async countImagesByProductId(productId: string): Promise<number> {
    return this.prisma.productImage.count({
      where: { productId },
    });
  }

  async createImage(productId: string, data: ConfirmImageInput) {
    return this.prisma.$transaction(async (tx) => {
      const existingCount = await tx.productImage.count({
        where: { productId },
      });

      // If it's the first image or explicitly set to primary, make it primary
      const makePrimary = data.isPrimary || existingCount === 0;

      if (makePrimary) {
        // Demote any existing primary image for this product
        await tx.productImage.updateMany({
          where: { productId, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      return tx.productImage.create({
        data: {
          productId,
          publicId: data.publicId,
          url: data.url,
          altText: data.altText,
          sortOrder: data.sortOrder ?? existingCount,
          isPrimary: makePrimary,
        },
      });
    });
  }

  async updateImage(id: string, data: UpdateImageInput) {
    return this.prisma.productImage.update({
      where: { id },
      data: {
        ...(data.altText !== undefined && { altText: data.altText }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      },
    });
  }

  async setPrimaryImage(productId: string, imageId: string) {
    return this.prisma.$transaction(async (tx) => {
      // Unset all existing primary images for this product
      await tx.productImage.updateMany({
        where: { productId, isPrimary: true },
        data: { isPrimary: false },
      });

      // Set target image as primary
      return tx.productImage.update({
        where: { id: imageId },
        data: { isPrimary: true },
      });
    });
  }

  async deleteImage(productId: string, imageId: string) {
    return this.prisma.$transaction(async (tx) => {
      const target = await tx.productImage.findUnique({
        where: { id: imageId },
      });

      if (!target) return null;

      // Delete from database
      await tx.productImage.delete({
        where: { id: imageId },
      });

      // If the deleted image was primary, promote the next image with lowest sortOrder
      if (target.isPrimary) {
        const nextImage = await tx.productImage.findFirst({
          where: { productId },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        });

        if (nextImage) {
          await tx.productImage.update({
            where: { id: nextImage.id },
            data: { isPrimary: true },
          });
        }
      }

      return target;
    });
  }

  async recordDeletionJob(publicId: string, productId?: string) {
    return this.prisma.mediaDeletionJob.create({
      data: {
        publicId,
        productId,
        status: 'PENDING',
      },
    });
  }

  async updateDeletionJob(id: string, status: 'COMPLETED' | 'FAILED', error?: string) {
    return this.prisma.mediaDeletionJob.update({
      where: { id },
      data: {
        status,
        error,
        retryCount: { increment: 1 },
      },
    });
  }
}

export const catalogRepository = new CatalogRepository();
