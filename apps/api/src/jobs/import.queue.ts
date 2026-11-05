import { Queue } from 'bullmq';
import { createRedisConnection, QUEUE_NAMES } from './jobs.config';

export interface ProductImportJobData {
  importJobId: string;
  filePath: string;
  originalFilename: string;
  actorId: string;
}

let importQueue: Queue<ProductImportJobData> | null = null;

export function getProductImportQueue(): Queue<ProductImportJobData> {
  if (!importQueue) {
    const connection = createRedisConnection();
    importQueue = new Queue<ProductImportJobData>(QUEUE_NAMES.PRODUCT_IMPORT, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 100 },
      },
    });
  }
  return importQueue;
}

export async function enqueueProductImport(data: ProductImportJobData) {
  const queue = getProductImportQueue();
  const job = await queue.add('process-import', data, {
    jobId: data.importJobId, // Stable job ID matching the database record
  });
  return job;
}

