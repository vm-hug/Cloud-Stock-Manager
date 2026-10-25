import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { errorHandler } from './common/middleware/errorHandler';
import { NotFoundError } from './common/errors/appError';
import { authRoutes } from './modules/auth/auth.routes';
import { usersRoutes } from './modules/users/users.routes';
import { auditRoutes } from './modules/audit/audit.routes';
import { systemRoutes } from './modules/system/system.routes';
import { systemController } from './modules/system/system.controller';
import catalogRoutes from './modules/catalog/catalog.routes';

export function createApp(): Application {
  const app = express();

  // Security Middleware
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    })
  );

  // Parsing Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Cloud Health Probes (Render / Kubernetes)
  app.get('/api/health/live', systemController.getLive);
  app.get('/api/health/ready', systemController.getReady);

  // Legacy/Basic Healthcheck Endpoint (Phase 1 compatibility)
  app.get('/api/health', (_req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'cloud-stock-api',
        environment: env.NODE_ENV,
      },
    });
  });

  // API v1 Modules (Modular Monolith)
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/users', usersRoutes);
  app.use('/api/v1/audit-logs', auditRoutes);
  app.use('/api/v1/system', systemRoutes);
  app.use('/api/v1', catalogRoutes);

  // Catch-all 404 for undefined routes
  app.use((_req: Request, _res: Response, next: NextFunction) => {
    next(new NotFoundError('The requested endpoint does not exist.'));
  });

  // Global Error Handler
  app.use(errorHandler);

  return app;
}

export const app = createApp();
