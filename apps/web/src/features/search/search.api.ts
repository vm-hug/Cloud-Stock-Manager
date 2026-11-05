import { api } from '../../lib/api';
import { SearchProductsQuery, ProductSearchResponse, ApiResponse } from '@cloud-stock/shared';

export const searchApi = {
  searchProducts: async (
    query: SearchProductsQuery = {}
  ): Promise<ApiResponse<ProductSearchResponse>> => {
    const params = new URLSearchParams();

    if (query.q) params.set('q', query.q);
    if (query.categoryId) params.set('categoryId', query.categoryId);
    if (query.warehouseId) params.set('warehouseId', query.warehouseId);
    if (query.minPrice !== undefined && query.minPrice !== null)
      params.set('minPrice', query.minPrice.toString());
    if (query.maxPrice !== undefined && query.maxPrice !== null)
      params.set('maxPrice', query.maxPrice.toString());
    if (query.stockStatus) params.set('stockStatus', query.stockStatus);
    if (query.isActive !== undefined) params.set('isActive', query.isActive.toString());
    if (query.createdFrom) params.set('createdFrom', query.createdFrom);
    if (query.createdTo) params.set('createdTo', query.createdTo);
    if (query.sortBy) params.set('sortBy', query.sortBy);
    if (query.sortOrder) params.set('sortOrder', query.sortOrder);
    if (query.page) params.set('page', query.page.toString());
    if (query.limit) params.set('limit', query.limit.toString());

    const queryString = params.toString();
    const endpoint = `/v1/search/products${queryString ? `?${queryString}` : ''}`;

    return api.get<ProductSearchResponse>(endpoint);
  },
};
