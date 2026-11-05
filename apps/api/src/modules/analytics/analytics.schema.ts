import { z } from 'zod';

export const analyticsFilterSchema = z.object({
  warehouseId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export const stockTrendsFilterSchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(30),
  warehouseId: z.string().uuid().optional(),
});

export const topStockedFilterSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
  warehouseId: z.string().uuid().optional(),
});

export type AnalyticsFilterInput = z.infer<typeof analyticsFilterSchema>;
export type StockTrendsFilterInput = z.infer<typeof stockTrendsFilterSchema>;
export type TopStockedFilterInput = z.infer<typeof topStockedFilterSchema>;

