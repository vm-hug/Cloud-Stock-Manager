import { z } from 'zod';
import { ImportJobStatus } from '@cloud-stock/shared';

export const importQuerySchema = z.object({
  status: z.nativeEnum(ImportJobStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ImportQueryInput = z.infer<typeof importQuerySchema>;

