import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config();

import { createImportWorker } from './import.worker';

console.log('🚀 Initializing Cloud Stock BullMQ Background Worker...');

const worker = createImportWorker();

console.log('✅ BullMQ Worker started and listening for import jobs on Redis queue.');

const gracefulShutdown = async (signal: string) => {
  console.log(`\n🛑 Received ${signal}. Closing BullMQ Worker gracefully...`);
  try {
    await worker.close();
    console.log('✅ Worker closed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error during worker shutdown:', err);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
