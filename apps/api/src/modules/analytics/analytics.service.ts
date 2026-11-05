import {
  Role,
  AnalyticsSummary,
  CategoryDistributionItem,
  WarehouseDistributionItem,
  InventoryValueBreakdown,
  StockTrendItem,
  TopStockedSkuItem,
  LowStockAlertItem,
} from '@cloud-stock/shared';
import { AnalyticsRepository, analyticsRepository } from './analytics.repository';
import { AnalyticsFilterInput, StockTrendsFilterInput, TopStockedFilterInput } from './analytics.schema';
import { cacheManager, CacheManager } from '../../common/cache/cacheManager';
import { ForbiddenError } from '../../common/errors/appError';

export class AnalyticsService {
  constructor(
    private repository: AnalyticsRepository = analyticsRepository,
    private cache: CacheManager = cacheManager
  ) {}

  async getSummary(filter: AnalyticsFilterInput, userRole: Role): Promise<AnalyticsSummary> {
    const cacheKey = this.cache.generateCanonicalKey(
      'analytics',
      `summary:${userRole}`,
      filter as Record<string, unknown>
    );

    const cached = await this.cache.get<AnalyticsSummary>(cacheKey);
    if (cached) {
      return { ...cached, cached: true };
    }

    const summary = await this.repository.getSummary(filter.warehouseId);

    // Enforce role isolation: STAFF cannot view cost / profit valuations
    const result: AnalyticsSummary = {
      ...summary,
      totalInventoryCostValue:
        userRole === Role.STAFF ? null : summary.totalInventoryCostValue,
      cached: false,
    };

    await this.cache.set(cacheKey, result, { ttlSeconds: 60, jitterSeconds: 10 });
    return result;
  }

  async getProductsByCategory(
    filter: AnalyticsFilterInput,
    userRole: Role
  ): Promise<CategoryDistributionItem[]> {
    const cacheKey = this.cache.generateCanonicalKey(
      'analytics',
      `category:${userRole}`,
      filter as Record<string, unknown>
    );

    const cached = await this.cache.get<CategoryDistributionItem[]>(cacheKey);
    if (cached) return cached;

    const items = await this.repository.getProductsByCategory(filter.warehouseId);

    const result = items.map((item) => ({
      ...item,
      costValue: userRole === Role.STAFF ? null : item.costValue,
    }));

    await this.cache.set(cacheKey, result, { ttlSeconds: 60, jitterSeconds: 10 });
    return result;
  }

  async getStockByWarehouse(userRole: Role): Promise<WarehouseDistributionItem[]> {
    const cacheKey = this.cache.generateCanonicalKey('analytics', `warehouse:${userRole}`, {});

    const cached = await this.cache.get<WarehouseDistributionItem[]>(cacheKey);
    if (cached) return cached;

    const items = await this.repository.getStockByWarehouse();

    const result = items.map((item) => ({
      ...item,
      costValue: userRole === Role.STAFF ? null : item.costValue,
    }));

    await this.cache.set(cacheKey, result, { ttlSeconds: 60, jitterSeconds: 10 });
    return result;
  }

  async getInventoryValueBreakdown(userRole: Role): Promise<InventoryValueBreakdown> {
    // STAFF is strictly forbidden from financial valuation breakdowns
    if (userRole === Role.STAFF) {
      throw new ForbiddenError('Staff members are not permitted to view financial inventory valuations.');
    }

    const cacheKey = this.cache.generateCanonicalKey('analytics', `value_breakdown:${userRole}`, {});

    const cached = await this.cache.get<InventoryValueBreakdown>(cacheKey);
    if (cached) return cached;

    const result = await this.repository.getInventoryValueBreakdown();

    await this.cache.set(cacheKey, result, { ttlSeconds: 60, jitterSeconds: 10 });
    return result;
  }

  async getStockTrends(filter: StockTrendsFilterInput): Promise<StockTrendItem[]> {
    const cacheKey = this.cache.generateCanonicalKey(
      'analytics',
      'trends',
      filter as Record<string, unknown>
    );

    const cached = await this.cache.get<StockTrendItem[]>(cacheKey);
    if (cached) return cached;

    const result = await this.repository.getStockTrends(filter.days, filter.warehouseId);

    await this.cache.set(cacheKey, result, { ttlSeconds: 60, jitterSeconds: 10 });
    return result;
  }

  async getTopStockedSkus(filter: TopStockedFilterInput): Promise<TopStockedSkuItem[]> {
    const cacheKey = this.cache.generateCanonicalKey(
      'analytics',
      'top_stocked',
      filter as Record<string, unknown>
    );

    const cached = await this.cache.get<TopStockedSkuItem[]>(cacheKey);
    if (cached) return cached;

    const result = await this.repository.getTopStockedSkus(filter.limit, filter.warehouseId);

    await this.cache.set(cacheKey, result, { ttlSeconds: 60, jitterSeconds: 10 });
    return result;
  }

  async getLowStockAlerts(warehouseId?: string): Promise<LowStockAlertItem[]> {
    const cacheKey = this.cache.generateCanonicalKey(
      'analytics',
      'low_stock',
      warehouseId ? { warehouseId } : {}
    );

    const cached = await this.cache.get<LowStockAlertItem[]>(cacheKey);
    if (cached) return cached;

    const result = await this.repository.getLowStockAlerts(warehouseId);

    await this.cache.set(cacheKey, result, { ttlSeconds: 60, jitterSeconds: 10 });
    return result;
  }
}

export const analyticsService = new AnalyticsService();

