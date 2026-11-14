import { app } from './app';
import { env } from './config/env';
import { prisma } from './config/db';
import { redis } from './config/redis';

async function bootstrap() {
  try {
    // 1. Verify Prisma Database connectivity
    await prisma.$connect();
    console.log('✅ Connected to PostgreSQL via Prisma ORM.');

    // 2. Connect to Redis (optional check)
    try {
      await redis.connect();
    } catch {
      console.warn('⚠️ Could not connect to Redis at startup. Will retry automatically.');
    }

    // 3. Start HTTP Server
    const server = app.listen(env.PORT, () => {
      console.log(`🚀 Cloud Stock API server running on port ${env.PORT} in [${env.NODE_ENV}] mode.`);
      console.log(`📡 Healthcheck available at: http://localhost:${env.PORT}/api/health`);
    });

    // 4. Handle Graceful Shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

      server.close(async () => {
        console.log('🔒 HTTP server closed.');

        try {
          await prisma.$disconnect();
          console.log('🔌 Disconnected from PostgreSQL.');
        } catch (err) {
          console.error('Error disconnecting Prisma:', err);
        }

        try {
          redis.disconnect();
          console.log('🔌 Disconnected from Redis.');
        } catch (err) {
          console.error('Error disconnecting Redis:', err);
        }

        process.exit(0);
      });

      // Force exit if not closed within 10s
      setTimeout(() => {
        console.error('⚠️ Forcefully terminating after timeout.');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    console.error('❌ Failed to start application server:', error);
    process.exit(1);
  }
}

bootstrap();
