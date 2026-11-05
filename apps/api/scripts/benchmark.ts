/**
 * Phase 5 High-Performance Performance Benchmark Script
 * Measures:
 * 1. Product Search: Database query (Cache Miss) vs Redis Cache Hit.
 * 2. Analytics Summary: Database aggregation (Cache Miss) vs Redis Cache Hit.
 * 3. High-Concurrency Stress Test: Throughput (RPS), P50, P95, P99 Latency.
 * 4. Distributed Rate Limiter: Verifies 429 status and Retry-After header.
 */

import http from 'http';
import { createApp } from '../src/app';
import { prisma } from '../src/config/db';
import { redis } from '../src/config/redis';
import { signAccessToken } from '../src/common/utils/jwt';
import { cacheManager } from '../src/common/cache/cacheManager';

interface LatencyMetrics {
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
  rps: number;
  totalRequests: number;
  successCount: number;
}

function calculateMetrics(latencies: number[], totalDurationMs: number): LatencyMetrics {
  const sorted = [...latencies].sort((a, b) => a - b);
  const count = sorted.length;
  const sum = sorted.reduce((a, b) => a + b, 0);

  return {
    min: count > 0 ? Number(sorted[0].toFixed(2)) : 0,
    max: count > 0 ? Number(sorted[count - 1].toFixed(2)) : 0,
    avg: count > 0 ? Number((sum / count).toFixed(2)) : 0,
    p50: count > 0 ? Number(sorted[Math.floor(count * 0.5)].toFixed(2)) : 0,
    p95: count > 0 ? Number(sorted[Math.floor(count * 0.95)].toFixed(2)) : 0,
    p99: count > 0 ? Number(sorted[Math.floor(count * 0.99)].toFixed(2)) : 0,
    rps: totalDurationMs > 0 ? Number(((count / (totalDurationMs / 1000))).toFixed(1)) : 0,
    totalRequests: count,
    successCount: count,
  };
}

async function runBenchmark() {
  console.log('===============================================================');
  console.log('⚡ CLOUD STOCK MANAGEMENT - PHASE 5 PERFORMANCE BENCHMARK SUITE');
  console.log('===============================================================');

  // 1. Start ephemeral HTTP server
  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`📡 Benchmark ephemeral server active at ${baseUrl}`);

  try {
    // Ensure Redis connection is open
    if (redis.status === 'wait') {
      await redis.connect().catch(() => {});
    }
    // 2. Fetch or mock an admin user for authenticated requests
    const adminUser = await prisma.user.findFirst({
      where: { role: 'ADMIN', isActive: true },
    });

    if (!adminUser) {
      throw new Error('Admin user required for benchmark. Run seed first.');
    }

    const token = signAccessToken({
      sub: adminUser.id,
      email: adminUser.email,
      role: adminUser.role as any,
      name: adminUser.name,
      sessionId: '',
    });

    const authHeaders = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    // Helper request function
    async function request(url: string, headers: Record<string, string> = authHeaders): Promise<{ status: number; duration: number; data: any }> {
      const start = performance.now();
      const res = await fetch(`${baseUrl}${url}`, { headers });
      const duration = performance.now() - start;
      const data = await res.json().catch(() => null);
      return { status: res.status, duration, data };
    }

    // -------------------------------------------------------------
    // BENCHMARK 1: Product Search (Cache Miss vs Cache Hit)
    // -------------------------------------------------------------
    console.log('\n--- 1. Advanced Product Search (Postgres vs Redis Cache-Aside) ---');
    await cacheManager.clearAllCaches();

    // Cold query (Cache Miss -> PostgreSQL GIN trigram / index lookup)
    const coldSearch = await request('/api/v1/search/products?q=beacon&limit=20');
    console.log(`• Cold Query (PostgreSQL Search): ${coldSearch.duration.toFixed(2)} ms (Status: ${coldSearch.status}, Cached: ${coldSearch.data?.data?.meta?.cached})`);

    // Warm query (Cache Hit -> Redis)
    const warmSearch = await request('/api/v1/search/products?q=beacon&limit=20');
    console.log(`• Warm Query (Redis Cache Hit):   ${warmSearch.duration.toFixed(2)} ms (Status: ${warmSearch.status}, Cached: ${warmSearch.data?.data?.meta?.cached})`);

    const searchSpeedup = (coldSearch.duration / Math.max(1, warmSearch.duration)).toFixed(1);
    console.log(`🚀 Search Latency Improvement: ${searchSpeedup}x faster with Redis Cache-Aside!`);

    // -------------------------------------------------------------
    // BENCHMARK 2: Analytics Summary (Cache Miss vs Cache Hit)
    // -------------------------------------------------------------
    console.log('\n--- 2. Analytics Summary (Postgres Aggregations vs Redis) ---');
    await cacheManager.clearAllCaches();

    const coldAnalytics = await request('/api/v1/analytics/summary');
    console.log(`• Cold Query (PostgreSQL Aggregation): ${coldAnalytics.duration.toFixed(2)} ms (Cached: ${coldAnalytics.data?.data?.cached})`);

    const warmAnalytics = await request('/api/v1/analytics/summary');
    console.log(`• Warm Query (Redis Cache Hit):        ${warmAnalytics.duration.toFixed(2)} ms (Cached: ${warmAnalytics.data?.data?.cached})`);

    const analyticsSpeedup = (coldAnalytics.duration / Math.max(1, warmAnalytics.duration)).toFixed(1);
    console.log(`🚀 Analytics Latency Improvement: ${analyticsSpeedup}x faster with Redis Cache-Aside!`);

    // -------------------------------------------------------------
    // BENCHMARK 3: High-Concurrency Load Simulation (100 parallel requests)
    // -------------------------------------------------------------
    console.log('\n--- 3. Concurrency Stress Test (100 Concurrent Warm Requests) ---');
    const concurrency = 100;
    const testStart = performance.now();
    const tasks = Array.from({ length: concurrency }, () =>
      request('/api/v1/search/products?q=beacon&limit=20')
    );

    const results = await Promise.all(tasks);
    const totalDuration = performance.now() - testStart;
    const latencies = results.map((r) => r.duration);
    const metrics = calculateMetrics(latencies, totalDuration);

    console.log(`• Total Requests:    ${metrics.totalRequests}`);
    console.log(`• Concurrency:       ${concurrency}`);
    console.log(`• Total Time:        ${totalDuration.toFixed(2)} ms`);
    console.log(`• Throughput (RPS):  ${metrics.rps} req/sec`);
    console.log(`• Min Latency:       ${metrics.min} ms`);
    console.log(`• Avg Latency:       ${metrics.avg} ms`);
    console.log(`• P50 Latency:       ${metrics.p50} ms`);
    console.log(`• P95 Latency:       ${metrics.p95} ms`);
    console.log(`• P99 Latency:       ${metrics.p99} ms`);

    // -------------------------------------------------------------
    // BENCHMARK 4: Distributed Rate Limiter Verification
    // -------------------------------------------------------------
    console.log('\n--- 4. Distributed Rate Limiter Verification ---');
    // Rapidly trigger export endpoint (max 10 req/min)
    let rateLimitTriggered = false;
    let retryAfterHeader = '';

    for (let i = 0; i < 15; i++) {
      const res = await fetch(`${baseUrl}/api/v1/inventory/export?format=csv`, {
        headers: authHeaders,
      });

      if (res.status === 429) {
        rateLimitTriggered = true;
        retryAfterHeader = res.headers.get('Retry-After') || 'N/A';
        console.log(`• Request #${i + 1} blocked by Rate Limiter: Status 429 Too Many Requests, Retry-After: ${retryAfterHeader}s`);
        break;
      }
    }

    if (rateLimitTriggered) {
      console.log('✅ Distributed rate limiting is actively enforcing traffic quotas!');
    } else {
      console.warn('⚠️ Rate limit did not trigger within 15 requests.');
    }

    console.log('\n===============================================================');
    console.log('🎉 BENCHMARK RUN COMPLETED SUCCESSFULLY!');
    console.log('===============================================================\n');
  } finally {
    server.close();
  }
}

runBenchmark()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Benchmark error:', err);
    process.exit(1);
  });
