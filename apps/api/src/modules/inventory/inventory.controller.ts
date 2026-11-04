import { Request, Response, NextFunction } from 'express';
import { inventoryService, InventoryService } from './inventory.service';
import {
  BalanceQueryInput,
  CreateStockDocumentInput,
  CreateWarehouseInput,
  ExportInventoryQueryInput,
  LowStockQueryInput,
  StockDocumentQueryInput,
  StockMovementQueryInput,
  UpdateStockDocumentInput,
  UpdateThresholdInput,
  UpdateWarehouseInput,
  WarehouseQueryInput,
} from './inventory.schema';
import { Role } from '@cloud-stock/shared';

export class InventoryController {
  constructor(private service: InventoryService = inventoryService) {}

  // ========================================================
  // WAREHOUSES
  // ========================================================

  createWarehouse = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = req.body as CreateWarehouseInput;
      const actorId = req.user!.id;
      const ipAddress = req.ip;

      const warehouse = await this.service.createWarehouse(input, actorId, ipAddress);
      res.status(201).json({
        success: true,
        message: 'Warehouse created successfully.',
        data: warehouse,
      });
    } catch (err) {
      next(err);
    }
  };

  getWarehouses = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query as unknown as WarehouseQueryInput;
      const { items, total } = await this.service.getWarehouses(query);

      res.status(200).json({
        success: true,
        data: items,
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        },
      });
    } catch (err) {
      next(err);
    }
  };

  getWarehouseById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const warehouse = await this.service.getWarehouseById(id);
      res.status(200).json({
        success: true,
        data: warehouse,
      });
    } catch (err) {
      next(err);
    }
  };

  updateWarehouse = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const input = req.body as UpdateWarehouseInput;
      const actorId = req.user!.id;
      const ipAddress = req.ip;

      const warehouse = await this.service.updateWarehouse(id, input, actorId, ipAddress);
      res.status(200).json({
        success: true,
        message: 'Warehouse updated successfully.',
        data: warehouse,
      });
    } catch (err) {
      next(err);
    }
  };

  updateWarehouseStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { isActive } = req.body as { isActive: boolean };
      const actorId = req.user!.id;
      const ipAddress = req.ip;

      const warehouse = await this.service.updateWarehouseStatus(id, isActive, actorId, ipAddress);
      res.status(200).json({
        success: true,
        message: `Warehouse ${isActive ? 'activated' : 'deactivated'} successfully.`,
        data: warehouse,
      });
    } catch (err) {
      next(err);
    }
  };

  // ========================================================
  // INVENTORY BALANCES
  // ========================================================

  getBalances = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query as unknown as BalanceQueryInput;
      const { items, total } = await this.service.getBalances(query);

      res.status(200).json({
        success: true,
        data: items,
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        },
      });
    } catch (err) {
      next(err);
    }
  };

  getBalance = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { warehouseId, variantId } = req.params;
      const balance = await this.service.getBalance(warehouseId, variantId);

      res.status(200).json({
        success: true,
        data: balance,
      });
    } catch (err) {
      next(err);
    }
  };

  getLowStock = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query as unknown as LowStockQueryInput;
      const { items, total } = await this.service.getLowStock(query);

      res.status(200).json({
        success: true,
        data: items,
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        },
      });
    } catch (err) {
      next(err);
    }
  };

  updateThreshold = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { warehouseId, variantId } = req.params;
      const input = req.body as UpdateThresholdInput;
      const actorId = req.user!.id;
      const ipAddress = req.ip;

      const balance = await this.service.updateThreshold(warehouseId, variantId, input, actorId, ipAddress);
      res.status(200).json({
        success: true,
        message: 'Minimum stock alert threshold updated.',
        data: balance,
      });
    } catch (err) {
      next(err);
    }
  };

  // ========================================================
  // STOCK DOCUMENTS
  // ========================================================

  createDocument = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = req.body as CreateStockDocumentInput;
      const actorId = req.user!.id;
      const ipAddress = req.ip;

      const document = await this.service.createDocument(input, actorId, ipAddress);
      res.status(201).json({
        success: true,
        message: 'Stock document draft created successfully.',
        data: document,
      });
    } catch (err) {
      next(err);
    }
  };

  getDocuments = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query as unknown as StockDocumentQueryInput;
      const { items, total } = await this.service.getDocuments(query);

      res.status(200).json({
        success: true,
        data: items,
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        },
      });
    } catch (err) {
      next(err);
    }
  };

  getDocumentById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const document = await this.service.getDocumentById(id);

      res.status(200).json({
        success: true,
        data: document,
      });
    } catch (err) {
      next(err);
    }
  };

  updateDraftDocument = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const input = req.body as UpdateStockDocumentInput;
      const actorId = req.user!.id;
      const actorRole = req.user!.role as Role;
      const ipAddress = req.ip;

      const document = await this.service.updateDraftDocument(id, input, actorId, actorRole, ipAddress);
      res.status(200).json({
        success: true,
        message: 'Stock document draft updated successfully.',
        data: document,
      });
    } catch (err) {
      next(err);
    }
  };

  submitDocument = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const actorId = req.user!.id;
      const actorRole = req.user!.role as Role;
      const ipAddress = req.ip;

      const document = await this.service.submitDocument(id, actorId, actorRole, ipAddress);
      res.status(200).json({
        success: true,
        message: 'Stock document submitted for approval.',
        data: document,
      });
    } catch (err) {
      next(err);
    }
  };

  approveDocument = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const approverId = req.user!.id;
      const approverRole = req.user!.role as Role;
      const ipAddress = req.ip;

      const document = await this.service.approveDocument(id, approverId, approverRole, ipAddress);
      res.status(200).json({
        success: true,
        message: 'Stock document approved and posted to inventory balances.',
        data: document,
      });
    } catch (err) {
      next(err);
    }
  };

  rejectDocument = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { reason } = req.body as { reason?: string };
      const approverId = req.user!.id;
      const approverRole = req.user!.role as Role;
      const ipAddress = req.ip;

      const document = await this.service.rejectDocument(id, approverId, approverRole, reason, ipAddress);
      res.status(200).json({
        success: true,
        message: 'Stock document rejected.',
        data: document,
      });
    } catch (err) {
      next(err);
    }
  };

  cancelDocument = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const actorId = req.user!.id;
      const actorRole = req.user!.role as Role;
      const ipAddress = req.ip;

      const document = await this.service.cancelDocument(id, actorId, actorRole, ipAddress);
      res.status(200).json({
        success: true,
        message: 'Stock document cancelled.',
        data: document,
      });
    } catch (err) {
      next(err);
    }
  };

  // ========================================================
  // STOCK MOVEMENTS
  // ========================================================

  getMovements = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query as unknown as StockMovementQueryInput;
      const { items, total } = await this.service.getMovements(query);

      res.status(200).json({
        success: true,
        data: items,
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        },
      });
    } catch (err) {
      next(err);
    }
  };

  // ========================================================
  // EXPORT
  // ========================================================

  exportBalances = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query as unknown as ExportInventoryQueryInput;
      const actorRole = req.user!.role as Role;

      const { buffer, contentType, filename } = await this.service.exportBalances(query, actorRole);

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(buffer);
    } catch (err) {
      next(err);
    }
  };
}

export const inventoryController = new InventoryController();
