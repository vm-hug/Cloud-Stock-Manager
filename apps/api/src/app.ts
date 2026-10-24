import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { errorHandler } from './common/middleware/errorHandler';
import { NotFoundError } from './common/errors/appError';

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

  // Healthcheck Endpoint
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

  // Catch-all 404 for undefined routes
  app.use((_req: Request, _res: Response, next: NextFunction) => {
    next(new NotFoundError('The requested endpoint does not exist.'));
  });

  // Global Error Handler
  app.use(errorHandler);

  return app;
}

export const app = createApp();
