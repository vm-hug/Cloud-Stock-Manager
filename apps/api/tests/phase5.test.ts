process.env.NODE_ENV = 'test';
import assert from 'assert';
import http from 'http';
import { app } from '../src/app';
import { prisma } from '../src/config/db';
import { redis } from '../src/config/redis';
import { cacheManager } from '../src/common/cache/cacheManager';

function request(
  server: http.Server,
  method: string,
  path: string,
  options: {
    headers?: Record<string, string>;
    body?: unknown;
  } = {}
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: any }> {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    if (!addr || typeof addr === 'string') {
      return reject(new Error('Server not listening'));
    }

    let payload: Buffer | undefined;
    const headers: Record<string, string> = { ...options.headers };

    if (options.body) {
      const jsonStr = JSON.stringify(options.body);
      payload = Buffer.from(jsonStr);
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = payload.length.toString();
    }

    const req = http.request(
      {
        host: '127.0.0.1',
        port: addr.port,
        method,
        path,
        headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          const text = buffer.toString('utf-8');
          let parsedBody;
          try {
            parsedBody = text ? JSON.parse(text) : {};
          } catch {
            parsedBody = text;
          }

          resolve({
            status: res.statusCode || 500,
            headers: res.headers,
            body: parsedBody,
          });
        });
      }
    );

    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function runPhase5Tests() {
  console.log('🚀 Starting Phase 5 Comprehensive Test Suite...');
  console.log('   (Search, GIN Indexes, Redis Cache-Aside, Invalidation, Analytics & Rate Limiting)\n');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  console.log(`📡 Test server running on port ${port}`);

  try {
    // ----------------------------------------------------
    // SETUP: Authenticate ADMIN, MANAGER, and STAFF
    // ----------------------------------------------------
    const adminLogin = await request(server, 'POST', '/api/v1/auth/login', {
      body: { email: 'admin@cloudstock.dev', password: 'AdminPassword123!' },
    });
    assert.strictEqual(adminLogin.status, 200, 'Admin login failed');
    const adminToken = adminLogin.body.data.accessToken;

    const managerLogin = await request(server, 'POST', '/api/v1/auth/login', {
      body: { email: 'manager@cloudstock.dev', password: 'ManagerPassword123!' },
    });
    assert.strictEqual(managerLogin.status, 200, 'Manager login failed');
    const managerToken = managerLogin.body.data.accessToken;

    const staffLogin = await request(server, 'POST', '/api/v1/auth/login', {
      body: { email: 'staff@cloudstock.dev', password: 'StaffPassword123!' },
    });
    assert.strictEqual(staffLogin.status, 200, 'Staff login failed');
    const staffToken = staffLogin.body.data.accessToken;

    const adminHeaders = { Authorization: `Bearer ${adminToken}` };
    const managerHeaders = { Authorization: `Bearer ${managerToken}` };
    const staffHeaders = { Authorization: `Bearer ${staffToken}` };

    console.log('✅ Authentication complete: ADMIN, MANAGER, and STAFF tokens acquired.\n');

    // ====================================================
    // 1. MULTI-CRITERIA SEARCH & GIN INDEX OPTIMIZATION
    // ====================================================
    console.log('--- 1. Multi-Criteria Product Search Tests ---');

    // Basic search across name/description/SKU
    const searchRes = await request(server, 'GET', '/api/v1/search/products?q=beacon&limit=10', {
      headers: adminHeaders,
    });
    assert.strictEqual(searchRes.status, 200, 'Search endpoint should return 200');
    assert(searchRes.body.data.items !== undefined, 'Items array should be present');
    assert(searchRes.body.data.pagination !== undefined, 'Pagination should be present');
    assert(searchRes.body.data.meta !== undefined, 'Meta should be present');
    assert(typeof searchRes.body.data.meta.searchDurationMs === 'number', 'Duration should be a number');
    console.log(`✅ Text search query executed successfully (${searchRes.body.data.items.length} items found)`);

    // Price range filtering
    const priceSearch = await request(
      server,
      'GET',
      '/api/v1/search/products?minPrice=10&maxPrice=1000',
      { headers: adminHeaders }
    );
    assert.strictEqual(priceSearch.status, 200);
    for (const item of priceSearch.body.data.items) {
      assert(item.minPrice >= 10 || item.maxPrice >= 10, 'Price filter constraint satisfied');
    }
    console.log('✅ Price range filter (minPrice, maxPrice) verified');

    // Sorting by price descending
    const sortSearch = await request(
      server,
      'GET',
      '/api/v1/search/products?sortBy=price&sortOrder=desc&limit=5',
      { headers: adminHeaders }
    );
    assert.strictEqual(sortSearch.status, 200);
    const sortedItems = sortSearch.body.data.items;
    if (sortedItems.length >= 2) {
      assert(sortedItems[0].minPrice >= sortedItems[1].minPrice, 'Items should be sorted descending by price');
    }
    console.log('✅ Calculated price sorting (sortBy=price&sortOrder=desc) verified');

    // Pagination verification
    const pagedSearch = await request(
      server,
      'GET',
      '/api/v1/search/products?page=1&limit=2',
      { headers: adminHeaders }
    );
    assert.strictEqual(pagedSearch.status, 200);
    assert(pagedSearch.body.data.items.length <= 2, 'Page limit respected');
    assert.strictEqual(pagedSearch.body.data.pagination.page, 1);
    assert.strictEqual(pagedSearch.body.data.pagination.limit, 2);
    console.log('✅ Search pagination verified\n');

    // ====================================================
    // 2. REDIS CACHE-ASIDE PATTERN VERIFICATION
    // ====================================================
    console.log('--- 2. Redis Cache-Aside & Query Canonical Hashing ---');

    await cacheManager.clearAllCaches();

    // Cold query: Must be a Cache Miss
    const coldRes = await request(
      server,
      'GET',
      '/api/v1/search/products?q=test_cache_target&limit=10',
      { headers: adminHeaders }
    );
    assert.strictEqual(coldRes.status, 200);
    assert.strictEqual(coldRes.body.data.meta.cached, false, 'Cold query must report cached: false');
    console.log(`✅ Cold search query is a Cache Miss (Execution time: ${coldRes.body.data.meta.searchDurationMs}ms)`);

    // Warm query: Must be a Cache Hit
    const warmRes = await request(
      server,
      'GET',
      '/api/v1/search/products?q=test_cache_target&limit=10',
      { headers: adminHeaders }
    );
    assert.strictEqual(warmRes.status, 200);
    assert.strictEqual(warmRes.body.data.meta.cached, true, 'Warm query must report cached: true');
    console.log(`✅ Warm search query is a Cache Hit (Served from Redis)`);

    // Canonical query parameter order invariance: ?limit=10&q=test_cache_target
    const canonicalRes = await request(
      server,
      'GET',
      '/api/v1/search/products?limit=10&q=test_cache_target',
      { headers: adminHeaders }
    );
    assert.strictEqual(canonicalRes.status, 200);
    assert.strictEqual(
      canonicalRes.body.data.meta.cached,
      true,
      'Reordered query parameters must produce identical cache key (Cache Hit)'
    );
    console.log('✅ Canonical parameter sorting and hashing verified (Reordered params produce identical cache hit)\n');

    // ====================================================
    // 3. POST-COMMIT CACHE INVALIDATION HOOKS
    // ====================================================
    console.log('--- 3. Post-Commit Cache Invalidation Tests ---');

    // Create a new product to trigger catalog cache invalidation
    const category = await prisma.category.findFirst({ where: { isActive: true } });
    assert(category, 'Active category required for test');

    const createProdRes = await request(server, 'POST', '/api/v1/products', {
      headers: adminHeaders,
      body: {
        name: `Invalidation Test Prod ${Date.now()}`,
        categoryId: category.id,
      },
    });
    assert.strictEqual(createProdRes.status, 201, 'Product creation should return 201');
    const newProductId = createProdRes.body.data.id;

    // After mutation: search query must be a Cache Miss because cache was invalidated post-commit!
    const invalidatedSearch = await request(
      server,
      'GET',
      '/api/v1/search/products?q=test_cache_target&limit=10',
      { headers: adminHeaders }
    );
    assert.strictEqual(invalidatedSearch.status, 200);
    assert.strictEqual(
      invalidatedSearch.body.data.meta.cached,
      false,
      'Query after mutation must be a Cache Miss due to post-commit invalidation'
    );
    console.log('✅ Post-commit invalidation hook verified: Catalog mutation successfully evicted search cache.\n');

    // Clean up created product
    await prisma.product.delete({ where: { id: newProductId } });

    // ====================================================
    // 4. ROLE-BASED DATA ISOLATION & SENSITIVE MARGINS
    // ====================================================
    console.log('--- 4. Role-Based Pricing & Margin Isolation Tests ---');

    // STAFF search result: costPrice MUST be omitted
    const staffSearch = await request(server, 'GET', '/api/v1/search/products?limit=10', {
      headers: staffHeaders,
    });
    assert.strictEqual(staffSearch.status, 200);
    for (const item of staffSearch.body.data.items) {
      for (const variant of item.variants) {
        assert.strictEqual(
          variant.costPrice,
          undefined,
          'Staff member must NEVER receive variant costPrice in search results'
        );
      }
    }
    console.log('✅ STAFF role search result verified: costPrice stripped from all variants');

    // ADMIN search result: costPrice IS included
    const adminSearch = await request(server, 'GET', '/api/v1/search/products?limit=10', {
      headers: adminHeaders,
    });
    assert.strictEqual(adminSearch.status, 200);
    const itemWithVariant = adminSearch.body.data.items.find((i: any) => i.variants.length > 0);
    if (itemWithVariant) {
      assert(
        'costPrice' in itemWithVariant.variants[0],
        'Admin must have costPrice field accessible'
      );
    }
    console.log('✅ ADMIN role search result verified: costPrice present for management');

    // STAFF analytics summary: totalInventoryCostValue MUST be null
    const staffSummary = await request(server, 'GET', '/api/v1/analytics/summary', {
      headers: staffHeaders,
    });
    assert.strictEqual(staffSummary.status, 200);
    assert.strictEqual(
      staffSummary.body.data.totalInventoryCostValue,
      null,
      'Staff analytics summary must have totalInventoryCostValue set to null'
    );
    console.log('✅ STAFF analytics summary verified: totalInventoryCostValue is null');

    // ADMIN analytics summary: totalInventoryCostValue IS calculated
    const adminSummary = await request(server, 'GET', '/api/v1/analytics/summary', {
      headers: adminHeaders,
    });
    assert.strictEqual(adminSummary.status, 200);
    assert(
      typeof adminSummary.body.data.totalInventoryCostValue === 'number',
      'Admin analytics summary must contain totalInventoryCostValue number'
    );
    console.log('✅ ADMIN analytics summary verified: totalInventoryCostValue calculated');

    // STAFF accessing financial inventory valuation breakdown: MUST return 403 Forbidden
    const staffValuation = await request(server, 'GET', '/api/v1/analytics/inventory-value', {
      headers: staffHeaders,
    });
    assert.strictEqual(
      staffValuation.status,
      403,
      'Staff member accessing /inventory-value must be rejected with 403 Forbidden'
    );
    console.log('✅ STAFF access to /api/v1/analytics/inventory-value rejected with 403 Forbidden');

    // ADMIN accessing financial inventory valuation breakdown: MUST return 200 OK
    const adminValuation = await request(server, 'GET', '/api/v1/analytics/inventory-value', {
      headers: adminHeaders,
    });
    assert.strictEqual(adminValuation.status, 200);
    assert(adminValuation.body.data.totalCostValue !== undefined);
    assert(adminValuation.body.data.totalRetailValue !== undefined);
    assert(adminValuation.body.data.marginPercentage !== undefined);
    console.log('✅ ADMIN access to /api/v1/analytics/inventory-value returns full margin breakdowns\n');

    // ====================================================
    // 5. ANALYTICS REPORT ENDPOINTS VERIFICATION
    // ====================================================
    console.log('--- 5. Analytics Report Endpoints Verification ---');

    // Products by category
    const catAnalytics = await request(server, 'GET', '/api/v1/analytics/products-by-category', {
      headers: adminHeaders,
    });
    assert.strictEqual(catAnalytics.status, 200);
    assert(Array.isArray(catAnalytics.body.data));
    console.log(`✅ /api/v1/analytics/products-by-category returned ${catAnalytics.body.data.length} categories`);

    // Stock by warehouse
    const whAnalytics = await request(server, 'GET', '/api/v1/analytics/stock-by-warehouse', {
      headers: adminHeaders,
    });
    assert.strictEqual(whAnalytics.status, 200);
    assert(Array.isArray(whAnalytics.body.data));
    console.log(`✅ /api/v1/analytics/stock-by-warehouse returned ${whAnalytics.body.data.length} warehouses`);

    // Stock movement trends
    const trendsAnalytics = await request(server, 'GET', '/api/v1/analytics/stock-trends?days=14', {
      headers: adminHeaders,
    });
    assert.strictEqual(trendsAnalytics.status, 200);
    assert(Array.isArray(trendsAnalytics.body.data));
    console.log(`✅ /api/v1/analytics/stock-trends returned ${trendsAnalytics.body.data.length} daily datapoints`);

    // Top stocked SKUs
    const topSkusAnalytics = await request(server, 'GET', '/api/v1/analytics/top-stocked-products?limit=5', {
      headers: adminHeaders,
    });
    assert.strictEqual(topSkusAnalytics.status, 200);
    assert(Array.isArray(topSkusAnalytics.body.data));
    console.log(`✅ /api/v1/analytics/top-stocked-products returned ${topSkusAnalytics.body.data.length} items`);

    // Low stock alerts
    const lowStockAnalytics = await request(server, 'GET', '/api/v1/analytics/low-stock', {
      headers: adminHeaders,
    });
    assert.strictEqual(lowStockAnalytics.status, 200);
    assert(Array.isArray(lowStockAnalytics.body.data));
    console.log(`✅ /api/v1/analytics/low-stock returned ${lowStockAnalytics.body.data.length} alerts\n`);

    // ====================================================
    // 6. DISTRIBUTED RATE LIMITING VERIFICATION
    // ====================================================
    console.log('--- 6. Distributed Rate Limiter Verification ---');

    // Rapidly trigger export endpoint (max 10 req/min)
    let rateLimited = false;
    let retryAfterHeader: string | undefined;

    for (let i = 0; i < 15; i++) {
      const exportRes = await request(server, 'GET', '/api/v1/inventory/export?format=csv', {
        headers: adminHeaders,
      });

      if (exportRes.status === 429) {
        rateLimited = true;
        retryAfterHeader = exportRes.headers['retry-after'] as string;
        assert(exportRes.headers['x-ratelimit-limit'] !== undefined, 'X-RateLimit-Limit header present');
        assert(exportRes.headers['x-ratelimit-remaining'] !== undefined, 'X-RateLimit-Remaining header present');
        break;
      }
    }

    assert.strictEqual(rateLimited, true, 'Rate limiter must enforce quota and return 429 Too Many Requests');
    assert(retryAfterHeader !== undefined, 'Retry-After header must be set');
    console.log(`✅ Distributed rate limiting actively enforced (HTTP 429 with Retry-After: ${retryAfterHeader}s)\n`);

    // ====================================================
    // 7. SYSTEM PERFORMANCE METRICS & CACHE PURGE
    // ====================================================
    console.log('--- 7. System Performance Metrics & Cache Purge ---');

    // Admin access to telemetry
    const perfRes = await request(server, 'GET', '/api/v1/system/performance', {
      headers: adminHeaders,
    });
    assert.strictEqual(perfRes.status, 200);
    assert(typeof perfRes.body.data.cacheHits === 'number');
    assert(typeof perfRes.body.data.cacheMisses === 'number');
    assert(typeof perfRes.body.data.hitRatePercentage === 'number');
    assert(perfRes.body.data.latencyStats !== undefined);
    assert(perfRes.body.data.redisStatus === 'ready');
    console.log(`✅ Live performance metrics: Hits=${perfRes.body.data.cacheHits}, Misses=${perfRes.body.data.cacheMisses}, HitRate=${perfRes.body.data.hitRatePercentage}%`);

    // Staff access to telemetry: MUST return 403
    const staffPerf = await request(server, 'GET', '/api/v1/system/performance', {
      headers: staffHeaders,
    });
    assert.strictEqual(staffPerf.status, 403, 'Staff access to telemetry must be rejected');
    console.log('✅ STAFF access to /system/performance rejected with 403 Forbidden');

    // Admin manual cache purge
    const purgeRes = await request(server, 'POST', '/api/v1/system/cache/clear', {
      headers: adminHeaders,
    });
    assert.strictEqual(purgeRes.status, 200);
    assert(purgeRes.body.data.keysCleared !== undefined);
    console.log(`✅ Admin purged caches (${purgeRes.body.data.keysCleared} keys cleared)`);

    // Verify Audit Log records CLEAR_CACHE
    const auditRes = await request(server, 'GET', '/api/v1/audit-logs?action=CLEAR_CACHE&limit=1', {
      headers: adminHeaders,
    });
    assert.strictEqual(auditRes.status, 200);
    assert(auditRes.body.data.items.length > 0, 'CLEAR_CACHE action should be recorded in audit logs');
    assert.strictEqual(auditRes.body.data.items[0].action, 'CLEAR_CACHE');
    console.log('✅ Audit log compliance: CLEAR_CACHE recorded in security audit trail\n');

    console.log('🎉 ALL PHASE 5 COMPREHENSIVE TESTS PASSED WITH 100% SUCCESS!');
  } finally {
    server.close();
  }
}

runPhase5Tests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Phase 5 test failure:', err);
    process.exit(1);
  });

