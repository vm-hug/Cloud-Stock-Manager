import { Request, Response, NextFunction } from 'express';
import { redis } from '../../config/redis';
import { AppError } from '../errors/appError';

export interface RateLimiterOptions {
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
    prefix = 'general',
    message = 'Too many requests. Please try again later.',
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Key by authenticated userId if available, otherwise by IP
    const userIdentifier = (req as any).user?.id || req.ip || req.socket.remoteAddress || 'unknown';
    const key = `csm:v1:rl:${prefix}:${userIdentifier}`;

    try {
      if (redis.status === 'ready') {
        const current = await redis.incr(key);
        if (current === 1) {
          await redis.expire(key, windowSeconds);
        }

        const ttl = await redis.ttl(key);
        const resetSeconds = ttl > 0 ? ttl : windowSeconds;
        const resetTimestamp = Math.floor(Date.now() / 1000) + resetSeconds;

        res.setHeader('X-RateLimit-Limit', maxRequests);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - current));
        res.setHeader('X-RateLimit-Reset', resetTimestamp);

        if (current > maxRequests) {
          res.setHeader('Retry-After', resetSeconds);
          return next(
            new AppError(message, 429, 'RATE_LIMIT_EXCEEDED', {
              retryAfterSeconds: resetSeconds,
              limit: maxRequests,
              windowSeconds,
            })
          );
        }

        return next();
      }
    } catch (err) {
      console.warn('[RateLimiter] Redis fallback to in-memory store:', (err as Error).message);
    }

    // In-memory fallback
    const now = Date.now();
    const entry = memoryStore.get(key);

    if (!entry || now > entry.resetTime) {
      const resetTime = now + windowSeconds * 1000;
      memoryStore.set(key, { count: 1, resetTime });
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', maxRequests - 1);
      res.setHeader('X-RateLimit-Reset', Math.ceil(resetTime / 1000));
      return next();
    }

    entry.count += 1;
    const remainingSeconds = Math.max(1, Math.ceil((entry.resetTime - now) / 1000));
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - entry.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000));

    if (entry.count > maxRequests) {
      res.setHeader('Retry-After', remainingSeconds);
      return next(
        new AppError(message, 429, 'RATE_LIMIT_EXCEEDED', {
          retryAfterSeconds: remainingSeconds,
          limit: maxRequests,
          windowSeconds,
        })
      );
    }

    next();
  };
}

// Preset specialized rate limiters for Phase 5
export const searchRateLimiter = rateLimiter({
  windowSeconds: 60,
  maxRequests: 60,
  prefix: 'search',
  message: 'Search query rate limit exceeded. Please wait a minute before making more requests.',
});

export const analyticsRateLimiter = rateLimiter({
  windowSeconds: 60,
  maxRequests: 30,
  prefix: 'analytics',
  message: 'Analytics query rate limit exceeded. Please wait a minute before requesting more reports.',
});

export const exportRateLimiter = rateLimiter({
  windowSeconds: 60,
  maxRequests: 10,
  prefix: 'export',
  message: 'Data export rate limit exceeded. Maximum 10 exports per minute.',
});
