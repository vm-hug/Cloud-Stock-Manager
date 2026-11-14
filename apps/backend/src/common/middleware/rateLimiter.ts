import { Request, Response, NextFunction } from 'express';
import { redis } from '../../config/redis';
import { AppError } from '../errors/appError';

interface RateLimiterOptions {
  windowSeconds: number;
  maxRequests: number;
  prefix?: string;
  message?: string;
}

// Fallback in-memory map if Redis is temporarily unreachable
const memoryStore = new Map<string, { count: number; resetTime: number }>();

export function rateLimiter(options: RateLimiterOptions) {
  const {
    windowSeconds,
    maxRequests,
    prefix = 'rl',
    message = 'Too many requests. Please try again later.',
  } = options;

  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown-ip';
    const key = `ratelimit:${prefix}:${ip}`;

    try {
      // Try Redis atomic counter first
      if (redis.status === 'ready') {
        const current = await redis.incr(key);
        if (current === 1) {
          await redis.expire(key, windowSeconds);
        }

        if (current > maxRequests) {
          const ttl = await redis.ttl(key);
          return next(
            new AppError(message, 429, 'RATE_LIMIT_EXCEEDED', {
              retryAfterSeconds: ttl > 0 ? ttl : windowSeconds,
            })
          );
        }

        return next();
      }
    } catch (err) {
      // Gracefully fall back to in-memory store
      console.warn('Redis rate-limiter fallback to memory:', (err as Error).message);
    }

    // In-memory fallback
    const now = Date.now();
    const entry = memoryStore.get(key);

    if (!entry || now > entry.resetTime) {
      memoryStore.set(key, { count: 1, resetTime: now + windowSeconds * 1000 });
      return next();
    }

    entry.count += 1;
    if (entry.count > maxRequests) {
      const remainingSeconds = Math.ceil((entry.resetTime - now) / 1000);
      return next(
        new AppError(message, 429, 'RATE_LIMIT_EXCEEDED', {
          retryAfterSeconds: remainingSeconds,
        })
      );
    }

    next();
  };
}
