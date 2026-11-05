import { Prisma, PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../../config/db';
import { SearchProductsQueryInput } from './search.schema';
import { ProductSearchItem, ProductSearchVariantItem, StockStatus } from '@cloud-stock/shared';

export class SearchRepository {
  constructor(private prisma: PrismaClient = defaultPrisma) {}

  async searchProducts(query: SearchProductsQueryInput): Promise<{
    items: ProductSearchItem[];
    total: number;
  }> {
    const {
      q,
      categoryId,
      warehouseId,
      minPrice,
      maxPrice,
      stockStatus,
      isActive,
      createdFrom,
      createdTo,
      sortBy,
      sortOrder,
      page,
      limit,
    } = query;

    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
    };

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (createdFrom || createdTo) {
      where.createdAt = {};
      if (createdFrom) where.createdAt.gte = new Date(createdFrom);
      if (createdTo) where.createdAt.lte = new Date(createdTo);
    }

    // Text search query across Product name, slug, description, and Variant sku & name
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { slug: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        {
          variants: {
            some: {
              deletedAt: null,
              OR: [
                { sku: { contains: q, mode: 'insensitive' } },
                { name: { contains: q, mode: 'insensitive' } },
              ],
            },
          },
        },
      ];
    }

    // Price range filtering at Variant level
    if (minPrice !== undefined || maxPrice !== undefined) {
      const priceFilter: Prisma.DecimalFilter = {};
      if (minPrice !== undefined) priceFilter.gte = new Prisma.Decimal(minPrice);
      if (maxPrice !== undefined) priceFilter.lte = new Prisma.Decimal(maxPrice);

      where.variants = {
        some: {
          deletedAt: null,
          price: priceFilter,
        },
      };
    }

    // Fetch matched products with relations needed for stock calculations
    const rawProducts = await this.prisma.product.findMany({
      where,
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
        images: {
          orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
          take: 1,
        },
        variants: {
          where: { deletedAt: null },
          include: {
            inventoryBalances: {
              where: warehouseId ? { warehouseId } : undefined,
              select: {
                warehouseId: true,
                quantity: true,
                minThreshold: true,
              },
            },
          },
        },
      },
      orderBy:
        sortBy === 'createdAt'
          ? { createdAt: sortOrder }
          : sortBy === 'name'
          ? { name: sortOrder }
          : undefined,
    });

    // Transform products and compute dynamic stock & pricing metrics
    let transformedItems: ProductSearchItem[] = rawProducts.map((prod) => {
      let productTotalStock = 0;
      let minProdPrice = Number.MAX_VALUE;
      let maxProdPrice = 0;

      const variantItems: ProductSearchVariantItem[] = prod.variants.map((v) => {
        const numPrice = Number(v.price);
        if (numPrice < minProdPrice) minProdPrice = numPrice;
        if (numPrice > maxProdPrice) maxProdPrice = numPrice;

        const variantStock = v.inventoryBalances.reduce((sum, b) => sum + b.quantity, 0);
        const minThreshold = v.inventoryBalances.length > 0 ? v.inventoryBalances[0].minThreshold : 5;

        productTotalStock += variantStock;

        let vStockStatus: StockStatus = 'IN_STOCK';
        if (variantStock === 0) {
          vStockStatus = 'OUT_OF_STOCK';
        } else if (variantStock <= minThreshold) {
          vStockStatus = 'LOW_STOCK';
        }

        return {
          id: v.id,
          sku: v.sku,
          name: v.name,
          price: numPrice,
          costPrice: v.costPrice !== null ? Number(v.costPrice) : null,
          stockQuantity: variantStock,
          stockStatus: vStockStatus,
          attributes: (v.attributes as Record<string, string>) || null,
        };
      });

      if (minProdPrice === Number.MAX_VALUE) minProdPrice = 0;

      let prodStockStatus: StockStatus = 'IN_STOCK';
      if (productTotalStock === 0) {
        prodStockStatus = 'OUT_OF_STOCK';
      } else if (variantItems.some((v) => v.stockStatus === 'LOW_STOCK')) {
        prodStockStatus = 'LOW_STOCK';
      }

      return {
        id: prod.id,
        name: prod.name,
        slug: prod.slug,
        description: prod.description,
        categoryId: prod.categoryId,
        categoryName: prod.category.name,
        isActive: prod.isActive,
        createdAt: prod.createdAt.toISOString(),
        primaryImageUrl: prod.images.length > 0 ? prod.images[0].url : null,
        minPrice: minProdPrice,
        maxPrice: maxProdPrice,
        totalStock: productTotalStock,
        stockStatus: prodStockStatus,
        variantsCount: prod.variants.length,
        variants: variantItems,
      };
    });

    // In-memory filter for dynamic stock status if provided
    if (stockStatus) {
      transformedItems = transformedItems.filter((item) => item.stockStatus === stockStatus);
    }

    // Dynamic sorting for calculated fields: price or totalStock
    if (sortBy === 'price') {
      transformedItems.sort((a, b) =>
        sortOrder === 'asc' ? a.minPrice - b.minPrice : b.minPrice - a.minPrice
      );
    } else if (sortBy === 'totalStock') {
      transformedItems.sort((a, b) =>
        sortOrder === 'asc' ? a.totalStock - b.totalStock : b.totalStock - a.totalStock
      );
    }

    const total = transformedItems.length;
    const startIndex = (page - 1) * limit;
    const paginatedItems = transformedItems.slice(startIndex, startIndex + limit);

    return {
      items: paginatedItems,
      total,
    };
  }
}

export const searchRepository = new SearchRepository();

