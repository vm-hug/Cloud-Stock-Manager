import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../../config/db';
import {
  AnalyticsSummary,
  CategoryDistributionItem,
  WarehouseDistributionItem,
  InventoryValueBreakdown,
  StockTrendItem,
  TopStockedSkuItem,
  LowStockAlertItem,
} from '@cloud-stock/shared';

export class AnalyticsRepository {
  constructor(private prisma: PrismaClient = defaultPrisma) {}

  async getSummary(warehouseId?: string): Promise<AnalyticsSummary> {
    const [
      totalProducts,
      totalVariants,
      totalWarehouses,
      pendingDocumentsCount,
      balances,
      variantsWithoutCost,
    ] = await Promise.all([
      this.prisma.product.count({
        where: { isActive: true, deletedAt: null },
      }),
      this.prisma.productVariant.count({
        where: { isActive: true, deletedAt: null, product: { deletedAt: null } },
      }),
      this.prisma.warehouse.count({
        where: { isActive: true },
      }),
      this.prisma.stockDocument.count({
        where: { status: 'PENDING' },
      }),
      this.prisma.inventoryBalance.findMany({
        where: {
          ...(warehouseId ? { warehouseId } : {}),
          warehouse: { isActive: true },
          variant: { deletedAt: null, isActive: true },
        },
        include: {
          variant: {
            select: {
              id: true,
              price: true,
              costPrice: true,
            },
          },
        },
      }),
      this.prisma.productVariant.count({
        where: {
          deletedAt: null,
          isActive: true,
          costPrice: null,
        },
      }),
    ]);

    let totalStock = 0;
    let totalRetailValue = 0;
    let totalCostValue = 0;

    const variantStockMap = new Map<string, { totalQty: number; minThreshold: number }>();

    for (const b of balances) {
      totalStock += b.quantity;
      const price = Number(b.variant.price);
      totalRetailValue += b.quantity * price;

      if (b.variant.costPrice !== null) {
        totalCostValue += b.quantity * Number(b.variant.costPrice);
      }

      const existing = variantStockMap.get(b.variantId) || { totalQty: 0, minThreshold: b.minThreshold };
      existing.totalQty += b.quantity;
      variantStockMap.set(b.variantId, existing);
    }

    let lowStockCount = 0;
    let outOfStockCount = 0;

    for (const [, data] of variantStockMap.entries()) {
      if (data.totalQty === 0) {
        outOfStockCount++;
      } else if (data.totalQty <= data.minThreshold) {
        lowStockCount++;
      }
    }

    return {
      totalProducts,
      totalVariants,
      totalWarehouses,
      totalStock,
      totalInventoryCostValue: Number(totalCostValue.toFixed(2)),
      totalRetailValue: Number(totalRetailValue.toFixed(2)),
      nullCostPriceCount: variantsWithoutCost,
      lowStockCount,
      outOfStockCount,
      pendingDocumentsCount,
      calculatedAt: new Date().toISOString(),
    };
  }

  async getProductsByCategory(warehouseId?: string): Promise<CategoryDistributionItem[]> {
    const categories = await this.prisma.category.findMany({
      where: { isActive: true },
      include: {
        products: {
          where: { deletedAt: null, isActive: true },
          include: {
            variants: {
              where: { deletedAt: null, isActive: true },
              include: {
                inventoryBalances: {
                  where: {
                    ...(warehouseId ? { warehouseId } : {}),
                    warehouse: { isActive: true },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return categories.map((cat) => {
      let productCount = cat.products.length;
      let variantCount = 0;
      let totalStock = 0;
      let costValue = 0;
      let retailValue = 0;

      for (const prod of cat.products) {
        variantCount += prod.variants.length;
        for (const variant of prod.variants) {
          const varQty = variant.inventoryBalances.reduce((sum, b) => sum + b.quantity, 0);
          totalStock += varQty;
          retailValue += varQty * Number(variant.price);
          if (variant.costPrice !== null) {
            costValue += varQty * Number(variant.costPrice);
          }
        }
      }

      return {
        categoryId: cat.id,
        categoryName: cat.name,
        productCount,
        variantCount,
        totalStock,
        costValue: Number(costValue.toFixed(2)),
        retailValue: Number(retailValue.toFixed(2)),
      };
    });
  }

  async getStockByWarehouse(): Promise<WarehouseDistributionItem[]> {
    const warehouses = await this.prisma.warehouse.findMany({
      where: { isActive: true },
      include: {
        inventoryBalances: {
          where: {
            variant: { deletedAt: null, isActive: true },
          },
          include: {
            variant: {
              select: {
                price: true,
                costPrice: true,
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return warehouses.map((wh) => {
      let totalStock = 0;
      let costValue = 0;
      let retailValue = 0;

      for (const b of wh.inventoryBalances) {
        totalStock += b.quantity;
        retailValue += b.quantity * Number(b.variant.price);
        if (b.variant.costPrice !== null) {
          costValue += b.quantity * Number(b.variant.costPrice);
        }
      }

      return {
        warehouseId: wh.id,
        warehouseCode: wh.code,
        warehouseName: wh.name,
        skuCount: wh.inventoryBalances.length,
        totalStock,
        costValue: Number(costValue.toFixed(2)),
        retailValue: Number(retailValue.toFixed(2)),
      };
    });
  }

  async getInventoryValueBreakdown(): Promise<InventoryValueBreakdown> {
    const [categories, warehouses] = await Promise.all([
      this.getProductsByCategory(),
      this.getStockByWarehouse(),
    ]);

    let totalCostValue = 0;
    let totalRetailValue = 0;

    const breakdownByCategory = categories.map((c) => {
      const cCost = c.costValue || 0;
      totalCostValue += cCost;
      totalRetailValue += c.retailValue;
      const margin = c.retailValue - cCost;
      const marginPct = c.retailValue > 0 ? (margin / c.retailValue) * 100 : 0;

      return {
        categoryId: c.categoryId,
        categoryName: c.categoryName,
        costValue: cCost,
        retailValue: c.retailValue,
        marginPercentage: Number(marginPct.toFixed(1)),
      };
    });

    const breakdownByWarehouse = warehouses.map((w) => ({
      warehouseId: w.warehouseId,
      warehouseName: w.warehouseName,
      costValue: w.costValue || 0,
      retailValue: w.retailValue,
    }));

    const potentialGrossMargin = totalRetailValue - totalCostValue;
    const marginPercentage =
      totalRetailValue > 0 ? Number(((potentialGrossMargin / totalRetailValue) * 100).toFixed(1)) : 0;

    return {
      totalCostValue: Number(totalCostValue.toFixed(2)),
      totalRetailValue: Number(totalRetailValue.toFixed(2)),
      potentialGrossMargin: Number(potentialGrossMargin.toFixed(2)),
      marginPercentage,
      breakdownByCategory,
      breakdownByWarehouse,
    };
  }

  async getStockTrends(days: number = 30, warehouseId?: string): Promise<StockTrendItem[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const movements = await this.prisma.stockMovement.findMany({
      where: {
        createdAt: { gte: startDate },
        ...(warehouseId ? { warehouseId } : {}),
      },
      include: {
        documentItem: {
          include: {
            document: {
              select: {
                type: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group by Date string: YYYY-MM-DD
    const dateMap = new Map<string, StockTrendItem>();

    // Initialize all days in the range to 0
    for (let i = 0; i <= days; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const dateKey = d.toISOString().split('T')[0];
      dateMap.set(dateKey, {
        date: dateKey,
        inboundQty: 0,
        outboundQty: 0,
        adjustmentQty: 0,
        transferQty: 0,
      });
    }

    for (const m of movements) {
      const dateKey = m.createdAt.toISOString().split('T')[0];
      let entry = dateMap.get(dateKey);
      if (!entry) {
        entry = {
          date: dateKey,
          inboundQty: 0,
          outboundQty: 0,
          adjustmentQty: 0,
          transferQty: 0,
        };
        dateMap.set(dateKey, entry);
      }

      const docType = m.documentItem.document.type;
      if (docType === 'INBOUND') {
        entry.inboundQty += m.delta;
      } else if (docType === 'OUTBOUND') {
        entry.outboundQty += Math.abs(m.delta);
      } else if (docType === 'ADJUSTMENT') {
        entry.adjustmentQty += m.delta;
      } else if (docType === 'TRANSFER') {
        // Count positive leg only to avoid double-counting transfer pairs
        if (m.delta > 0) {
          entry.transferQty += m.delta;
        }
      }
    }

    return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  async getTopStockedSkus(limit: number = 10, warehouseId?: string): Promise<TopStockedSkuItem[]> {
    const balances = await this.prisma.inventoryBalance.findMany({
      where: {
        ...(warehouseId ? { warehouseId } : {}),
        warehouse: { isActive: true },
        variant: { deletedAt: null, isActive: true },
      },
      include: {
        warehouse: {
          select: { id: true, name: true },
        },
        variant: {
          include: {
            product: {
              include: {
                category: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    const skuMap = new Map<string, TopStockedSkuItem>();

    for (const b of balances) {
      let entry = skuMap.get(b.variantId);
      if (!entry) {
        entry = {
          variantId: b.variantId,
          sku: b.variant.sku,
          variantName: b.variant.name,
          productName: b.variant.product.name,
          categoryName: b.variant.product.category.name,
          price: Number(b.variant.price),
          totalStock: 0,
          warehouseBreakdown: [],
        };
        skuMap.set(b.variantId, entry);
      }

      entry.totalStock += b.quantity;
      entry.warehouseBreakdown.push({
        warehouseId: b.warehouseId,
        warehouseName: b.warehouse.name,
        quantity: b.quantity,
      });
    }

    return Array.from(skuMap.values())
      .sort((a, b) => b.totalStock - a.totalStock)
      .slice(0, limit);
  }

  async getLowStockAlerts(warehouseId?: string): Promise<LowStockAlertItem[]> {
    const balances = await this.prisma.inventoryBalance.findMany({
      where: {
        ...(warehouseId ? { warehouseId } : {}),
        warehouse: { isActive: true },
        variant: { deletedAt: null, isActive: true },
      },
      include: {
        warehouse: { select: { id: true, name: true } },
        variant: {
          include: {
            product: {
              include: {
                category: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    const skuMap = new Map<string, LowStockAlertItem>();

    for (const b of balances) {
      let entry = skuMap.get(b.variantId);
      if (!entry) {
        entry = {
          variantId: b.variantId,
          sku: b.variant.sku,
          variantName: b.variant.name,
          productName: b.variant.product.name,
          categoryName: b.variant.product.category.name,
          totalStock: 0,
          minThreshold: b.minThreshold,
          deficit: 0,
          alertLevel: 'WARNING',
          warehouses: [],
        };
        skuMap.set(b.variantId, entry);
      }

      entry.totalStock += b.quantity;
      entry.warehouses.push({
        warehouseId: b.warehouseId,
        warehouseName: b.warehouse.name,
        quantity: b.quantity,
        minThreshold: b.minThreshold,
      });
    }

    const lowStockList: LowStockAlertItem[] = [];

    for (const item of skuMap.values()) {
      if (item.totalStock <= item.minThreshold) {
        item.deficit = Math.max(0, item.minThreshold - item.totalStock);
        if (item.totalStock === 0) {
          item.alertLevel = 'OUT_OF_STOCK';
        } else if (item.totalStock <= Math.floor(item.minThreshold / 2)) {
          item.alertLevel = 'CRITICAL';
        } else {
          item.alertLevel = 'WARNING';
        }
        lowStockList.push(item);
      }
    }

    return lowStockList.sort((a, b) => {
      // Sort by alert severity: OUT_OF_STOCK first, then CRITICAL, then WARNING
      const severity = { OUT_OF_STOCK: 0, CRITICAL: 1, WARNING: 2 };
      if (severity[a.alertLevel] !== severity[b.alertLevel]) {
        return severity[a.alertLevel] - severity[b.alertLevel];
      }
      return b.deficit - a.deficit;
    });
  }
}

export const analyticsRepository = new AnalyticsRepository();
