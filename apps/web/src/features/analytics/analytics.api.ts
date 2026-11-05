import { api } from '../../lib/api';
import {
  AnalyticsSummary,
  CategoryDistributionItem,
  WarehouseDistributionItem,
  InventoryValueBreakdown,
  StockTrendItem,
  TopStockedSkuItem,
  LowStockAlertItem,
  SystemPerformanceMetrics,
  ApiResponse,
} from '@cloud-stock/shared';

export const analyticsApi = {
  getSummary: async (warehouseId?: string): Promise<ApiResponse<AnalyticsSummary>> => {
    const url = warehouseId
      ? `/v1/analytics/summary?warehouseId=${encodeURIComponent(warehouseId)}`
      : '/v1/analytics/summary';
    return api.get<AnalyticsSummary>(url);
  },

  getProductsByCategory: async (
    warehouseId?: string
  ): Promise<ApiResponse<CategoryDistributionItem[]>> => {
    const url = warehouseId
      ? `/v1/analytics/products-by-category?warehouseId=${encodeURIComponent(warehouseId)}`
      : '/v1/analytics/products-by-category';
    return api.get<CategoryDistributionItem[]>(url);
  },

  getStockByWarehouse: async (): Promise<ApiResponse<WarehouseDistributionItem[]>> => {
    return api.get<WarehouseDistributionItem[]>('/v1/analytics/stock-by-warehouse');
  },

  getInventoryValueBreakdown: async (): Promise<ApiResponse<InventoryValueBreakdown>> => {
    return api.get<InventoryValueBreakdown>('/v1/analytics/inventory-value');
  },

  getStockTrends: async (
    days: number = 30,
    warehouseId?: string
  ): Promise<ApiResponse<StockTrendItem[]>> => {
    const params = new URLSearchParams({ days: days.toString() });
    if (warehouseId) params.set('warehouseId', warehouseId);
    return api.get<StockTrendItem[]>(`/v1/analytics/stock-trends?${params.toString()}`);
  },

  getTopStockedSkus: async (
    limit: number = 10,
    warehouseId?: string
  ): Promise<ApiResponse<TopStockedSkuItem[]>> => {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (warehouseId) params.set('warehouseId', warehouseId);
    return api.get<TopStockedSkuItem[]>(`/v1/analytics/top-stocked-products?${params.toString()}`);
  },

  getLowStockAlerts: async (warehouseId?: string): Promise<ApiResponse<LowStockAlertItem[]>> => {
    const url = warehouseId
      ? `/v1/analytics/low-stock?warehouseId=${encodeURIComponent(warehouseId)}`
      : '/v1/analytics/low-stock';
    return api.get<LowStockAlertItem[]>(url);
  },

  getPerformanceMetrics: async (): Promise<ApiResponse<SystemPerformanceMetrics>> => {
    return api.get<SystemPerformanceMetrics>('/v1/system/performance');
  },

  clearCache: async (): Promise<ApiResponse<{ keysCleared: number }>> => {
    return api.post<{ keysCleared: number }>('/v1/system/cache/clear');
  },
};

