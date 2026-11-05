import { Request, Response, NextFunction } from 'express';
import { analyticsService, AnalyticsService } from './analytics.service';
import { AnalyticsFilterInput, StockTrendsFilterInput, TopStockedFilterInput } from './analytics.schema';
import { Role } from '@cloud-stock/shared';

export class AnalyticsController {
  constructor(private service: AnalyticsService = analyticsService) {}

  getSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filter = req.query as unknown as AnalyticsFilterInput;
      const userRole = (req.user?.role as Role) || Role.STAFF;
      const data = await this.service.getSummary(filter, userRole);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  getProductsByCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filter = req.query as unknown as AnalyticsFilterInput;
      const userRole = (req.user?.role as Role) || Role.STAFF;
      const data = await this.service.getProductsByCategory(filter, userRole);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  getStockByWarehouse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userRole = (req.user?.role as Role) || Role.STAFF;
      const data = await this.service.getStockByWarehouse(userRole);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  getInventoryValueBreakdown = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userRole = (req.user?.role as Role) || Role.STAFF;
      const data = await this.service.getInventoryValueBreakdown(userRole);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  getStockTrends = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filter = req.query as unknown as StockTrendsFilterInput;
      const data = await this.service.getStockTrends(filter);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  getTopStockedSkus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filter = req.query as unknown as TopStockedFilterInput;
      const data = await this.service.getTopStockedSkus(filter);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  getLowStockAlerts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const warehouseId = req.query.warehouseId as string | undefined;
      const data = await this.service.getLowStockAlerts(warehouseId);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };
}

export const analyticsController = new AnalyticsController();

