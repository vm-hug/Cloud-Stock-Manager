import { Role, ProductSearchResponse } from '@cloud-stock/shared';
import { SearchRepository, searchRepository } from './search.repository';
import { SearchProductsQueryInput } from './search.schema';
import { cacheManager, CacheManager } from '../../common/cache/cacheManager';

export class SearchService {
  constructor(
    private repository: SearchRepository = searchRepository,
    private cache: CacheManager = cacheManager
  ) {}

  async searchProducts(
    query: SearchProductsQueryInput,
    userRole: Role
  ): Promise<ProductSearchResponse> {
    const startTime = Date.now();

    // STAFF cannot view costPrice; include role in cache key to guarantee role isolation
    const cacheKey = this.cache.generateCanonicalKey('search', userRole, query as Record<string, unknown>);

    const cachedResult = await this.cache.get<ProductSearchResponse>(cacheKey);
    if (cachedResult) {
      return {
        ...cachedResult,
        meta: {
          ...cachedResult.meta,
          cached: true,
          searchDurationMs: Date.now() - startTime,
        },
      };
    }

    // Cache Miss -> Query PostgreSQL
    const { items, total } = await this.repository.searchProducts(query);

    // Enforce role-based data isolation
    const processedItems = items.map((item) => {
      if (userRole === Role.STAFF) {
        return {
          ...item,
          variants: item.variants.map((v) => {
            const { costPrice: _, ...rest } = v;
            return rest;
          }),
        };
      }
      return item;
    });

    const response: ProductSearchResponse = {
      items: processedItems,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit) || 1,
      },
      meta: {
        searchDurationMs: Date.now() - startTime,
        cached: false,
        totalMatches: total,
      },
    };

    // Store in Redis with 120s TTL + jitter
    await this.cache.set(cacheKey, response, { ttlSeconds: 120, jitterSeconds: 15 });

    return response;
  }
}

export const searchService = new SearchService();
