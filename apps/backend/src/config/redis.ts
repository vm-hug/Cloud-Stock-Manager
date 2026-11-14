import Redis from 'ioredis';
import { env } from './env';

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 5) {
      console.warn('⚠️ Redis connection attempts exceeded limit. Operating without cache.');
      return null;
    }
    return Math.min(times * 100, 3000);
  },
  lazyConnect: true,
});

redis.on('connect', () => {
  console.log('✅ Connected to Redis cache service.');
});

redis.on('error', (err) => {
  console.error('❌ Redis error:', err.message);
});
