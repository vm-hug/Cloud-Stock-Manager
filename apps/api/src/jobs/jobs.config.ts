import IORedis from 'ioredis';
import { env } from '../config/env';

export const QUEUE_NAMES = {
  PRODUCT_IMPORT: 'product-import',
} as const;

export function createRedisConnection(): IORedis {
  return new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times) {
      return Math.min(times * 150, 3000);
    },
  });
}
