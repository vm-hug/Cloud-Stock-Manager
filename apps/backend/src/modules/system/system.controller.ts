import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/db';
import { redis } from '../../config/redis';
import { env } from '../../config/env';
import { SystemHealthStatus } from '@cloud-stock/shared';

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
      // 1. Measure DB ping latency
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

      // 2. Measure Redis ping latency
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

      // 3. Memory statistics
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
}

export const systemController = new SystemController();
