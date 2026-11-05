import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/db';
import { redis } from '../../config/redis';
import { env } from '../../config/env';
import { SystemHealthStatus, SystemPerformanceMetrics, AuditAction } from '@cloud-stock/shared';
import { metricsTracker } from '../../common/metrics/metricsTracker';
import { cacheManager } from '../../common/cache/cacheManager';
import { auditService } from '../audit/audit.service';

export class SystemController {
  /**
   * Public Liveness probe (Kubernetes / Render check)
   */
  getLive = (_req: Request, res: Response): void => {
    res.status(200).json({
      success: true,
      data: {
        status: 'alive',
        timestamp: new Date().toISOString(),
      },
    });
  };

  /**
   * Readiness probe: Verifies critical dependencies (PostgreSQL)
   */
  getReady = async (_req: Request, res: Response): Promise<void> => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.status(200).json({
        success: true,
        data: {
          status: 'ready',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Database is currently unreachable',
        },
      });
    }
  };

  /**
   * Detailed infrastructure status (ADMIN only)
   */
  getDetailedHealth = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      let dbStatus: 'up' | 'down' = 'down';
      let dbLatency = -1;
      try {
        const start = performance.now();
        await prisma.$queryRaw`SELECT 1`;
        dbLatency = Math.round(performance.now() - start);
        dbStatus = 'up';
      } catch {
        dbStatus = 'down';
      }

      let redisStatus: 'up' | 'down' = 'down';
      let redisLatency = -1;
      try {
        const start = performance.now();
        const pong = await redis.ping();
        if (pong === 'PONG') {
          redisLatency = Math.round(performance.now() - start);
          redisStatus = 'up';
        }
      } catch {
        redisStatus = 'down';
      }

      const memory = process.memoryUsage();
      const heapUsedMb = Math.round((memory.heapUsed / 1024 / 1024) * 100) / 100;
      const heapTotalMb = Math.round((memory.heapTotal / 1024 / 1024) * 100) / 100;
      const rssMb = Math.round((memory.rss / 1024 / 1024) * 100) / 100;

      const overallStatus =
        dbStatus === 'up' && redisStatus === 'up'
          ? 'healthy'
          : dbStatus === 'up'
            ? 'degraded'
            : 'unhealthy';

      const data: SystemHealthStatus = {
        status: overallStatus,
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        environment: env.NODE_ENV,
        database: {
          status: dbStatus,
          latencyMs: dbLatency,
        },
        redis: {
          status: redisStatus,
          latencyMs: redisLatency,
        },
        memory: {
          heapUsedMb,
          heapTotalMb,
          rssMb,
        },
      };

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Performance & Cache Telemetry (ADMIN only)
   */
  getPerformanceMetrics = async (
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      let dbLatencyMs = -1;
      try {
        const start = performance.now();
        await prisma.$queryRaw`SELECT 1`;
        dbLatencyMs = Math.round(performance.now() - start);
      } catch {
        dbLatencyMs = -1;
      }

      let redisLatencyMs = -1;
      try {
        const start = performance.now();
        await redis.ping();
        redisLatencyMs = Math.round(performance.now() - start);
      } catch {
        redisLatencyMs = -1;
      }

      const rawMetrics = metricsTracker.getMetrics();
      const redisStatus =
        redis.status === 'ready'
          ? 'ready'
          : redis.status === 'connecting'
            ? 'connecting'
            : redis.status === 'reconnecting'
              ? 'reconnecting'
              : 'offline';

      const data: SystemPerformanceMetrics = {
        cacheHits: rawMetrics.cacheHits,
        cacheMisses: rawMetrics.cacheMisses,
        totalCacheRequests: rawMetrics.totalCacheRequests,
        hitRatePercentage: rawMetrics.hitRatePercentage,
        redisErrors: rawMetrics.redisErrors,
        redisStatus,
        dbLatencyMs,
        redisLatencyMs,
        latencyStats: rawMetrics.latencyStats,
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: rawMetrics.timestamp,
      };

      res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Manually purge all application caches (ADMIN only)
   */
  clearCache = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const keysCleared = await cacheManager.clearAllCaches();

      await auditService.recordLog({
        actorId: req.user?.id || null,
        action: AuditAction.CLEAR_CACHE,
        entityType: 'SYSTEM_CACHE',
        entityId: 'ALL',
        metadata: { keysCleared },
        ipAddress: req.ip || req.socket.remoteAddress,
      });

      res.status(200).json({
        success: true,
        message: `Successfully purged ${keysCleared} cache keys.`,
        data: { keysCleared },
      });
    } catch (err) {
      next(err);
    }
  };
}

export const systemController = new SystemController();
