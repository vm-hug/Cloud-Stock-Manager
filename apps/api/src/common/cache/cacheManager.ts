import crypto from 'crypto';
import { redis } from '../../config/redis';
import { metricsTracker } from '../metrics/metricsTracker';

export interface CacheOptions {
  ttlSeconds?: number;
  jitterSeconds?: number;
}

export class CacheManager {
  private readonly defaultPrefix = 'csm:v1';

  private async ensureConnected(): Promise<boolean> {
    if ((redis.status as string) === 'ready') return true;
    if (redis.status === 'wait') {
      try {
        await redis.connect();
        return (redis.status as string) === 'ready';
      } catch {
        return false;
      }
    }
    return false;
  }

  /**
   * Generates a canonical, deterministic hash for any query or params object.
   * Object keys are sorted recursively so { a: 1, b: 2 } === { b: 2, a: 1 }.
   */
  generateCanonicalKey(namespace: string, scope: string, params: Record<string, unknown> = {}): string {
    const sortedParams: Record<string, unknown> = {};
    const sortedKeys = Object.keys(params).sort();

    for (const key of sortedKeys) {
      const val = params[key];
      if (val !== undefined && val !== null && val !== '') {
        sortedParams[key] = val;
      }
    }

    const jsonStr = JSON.stringify(sortedParams);
    const hash = crypto.createHash('sha256').update(jsonStr).digest('hex').substring(0, 16);

    return `${this.defaultPrefix}:${namespace}:${scope}:${hash}`;
  }

  /**
   * Retrieve cached value by key.
   * Gracefully returns null if Redis is offline or throws.
   */
  async get<T>(key: string): Promise<T | null> {
    const startTime = Date.now();
    try {
      if (!(await this.ensureConnected())) {
        metricsTracker.recordMiss();
        return null;
      }

      const raw = await redis.get(key);
      const latency = Date.now() - startTime;
      metricsTracker.recordLatency(latency);

      if (raw !== null) {
        metricsTracker.recordHit();
        return JSON.parse(raw) as T;
      }

      metricsTracker.recordMiss();
      return null;
    } catch (err) {
      metricsTracker.recordMiss();
      metricsTracker.recordRedisError();
      console.warn(`[CacheManager] Failed to get key "${key}":`, (err as Error).message);
      return null;
    }
  }

  /**
   * Store value into cache with TTL and random jitter.
   */
  async set(key: string, value: unknown, options: CacheOptions = {}): Promise<void> {
    try {
      if (!(await this.ensureConnected())) return;

      const baseTtl = options.ttlSeconds ?? 120;
      const jitterRange = options.jitterSeconds ?? Math.max(5, Math.floor(baseTtl * 0.1));
      const jitter = Math.floor(Math.random() * (jitterRange * 2 + 1)) - jitterRange;
      const effectiveTtl = Math.max(5, baseTtl + jitter);

      const serialized = JSON.stringify(value);
      await redis.set(key, serialized, 'EX', effectiveTtl);
    } catch (err) {
      metricsTracker.recordRedisError();
      console.warn(`[CacheManager] Failed to set key "${key}":`, (err as Error).message);
    }
  }

  /**
   * Delete keys matching a pattern using SCAN.
   * INVARIANT: Never uses FLUSHALL or FLUSHDB to protect BullMQ and Session keys.
   */
  async deletePattern(pattern: string): Promise<number> {
    try {
      if (!(await this.ensureConnected())) return 0;

      let cursor = '0';
      let deletedCount = 0;

      do {
        const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;

        if (keys.length > 0) {
          const count = await redis.del(...keys);
          deletedCount += count;
        }
      } while (cursor !== '0');

      return deletedCount;
    } catch (err) {
      metricsTracker.recordRedisError();
      console.warn(`[CacheManager] Failed to delete pattern "${pattern}":`, (err as Error).message);
      return 0;
    }
  }

  /**
   * Delete single key directly.
   */
  async deleteKey(key: string): Promise<void> {
    try {
      if (!(await this.ensureConnected())) return;
      await redis.del(key);
    } catch (err) {
      metricsTracker.recordRedisError();
      console.warn(`[CacheManager] Failed to delete key "${key}":`, (err as Error).message);
    }
  }

  // Domain-specific invalidation helpers (called POST-COMMIT)
  async invalidateSearch(): Promise<void> {
    await this.deletePattern(`${this.defaultPrefix}:search:*`);
  }

  async invalidateAnalytics(): Promise<void> {
    await this.deletePattern(`${this.defaultPrefix}:analytics:*`);
  }

  async invalidateCatalog(): Promise<void> {
    await Promise.all([
      this.deletePattern(`${this.defaultPrefix}:catalog:*`),
      this.invalidateSearch(),
      this.invalidateAnalytics(),
    ]);
  }

  async invalidateInventory(): Promise<void> {
    await Promise.all([
      this.deletePattern(`${this.defaultPrefix}:inventory:*`),
      this.invalidateSearch(),
      this.invalidateAnalytics(),
    ]);
  }

  async clearAllCaches(): Promise<number> {
    let total = 0;
    total += await this.deletePattern(`${this.defaultPrefix}:search:*`);
    total += await this.deletePattern(`${this.defaultPrefix}:analytics:*`);
    total += await this.deletePattern(`${this.defaultPrefix}:catalog:*`);
    total += await this.deletePattern(`${this.defaultPrefix}:inventory:*`);
    return total;
  }
}

export const cacheManager = new CacheManager();
