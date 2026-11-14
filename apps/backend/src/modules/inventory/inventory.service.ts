import ExcelJS from 'exceljs';
import { StockDocStatus, StockDocType, AuditAction, Role } from '@cloud-stock/shared';
import { inventoryRepository, InventoryRepository } from './inventory.repository';
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
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../common/errors/appError';
import { auditService } from '../audit/audit.service';
import { prisma } from '../../config/db';

export class InventoryService {
  constructor(private repo: InventoryRepository = inventoryRepository) {}

  // ========================================================
  // WAREHOUSES
  // ========================================================

  async createWarehouse(input: CreateWarehouseInput, actorId: string, ipAddress?: string) {
    const existing = await this.repo.findWarehouseByCode(input.code);
    if (existing) {
      throw new ConflictError(`Warehouse code '${input.code}' already exists.`);
    }

    const warehouse = await this.repo.createWarehouse(input);

    await auditService.recordLog({
      actorId,
      action: AuditAction.CREATE_WAREHOUSE,
      entityType: 'Warehouse',
      entityId: warehouse.id,
      metadata: { code: warehouse.code, name: warehouse.name },
      ipAddress,
    });

    return warehouse;
  }

  async getWarehouses(query: WarehouseQueryInput) {
    return this.repo.findWarehouses(query);
  }

  async getWarehouseById(id: string) {
    const warehouse = await this.repo.findWarehouseById(id);
    if (!warehouse) {
      throw new NotFoundError('Warehouse not found.');
    }
    return warehouse;
  }

  async updateWarehouse(id: string, input: UpdateWarehouseInput, actorId: string, ipAddress?: string) {
    const warehouse = await this.repo.findWarehouseById(id);
    if (!warehouse) {
      throw new NotFoundError('Warehouse not found.');
    }

    if (input.code && input.code !== warehouse.code) {
      const codeExists = await this.repo.findWarehouseByCode(input.code);
      if (codeExists && codeExists.id !== id) {
        throw new ConflictError(`Warehouse code '${input.code}' is already in use.`);
      }
    }

    const updated = await this.repo.updateWarehouse(id, input);

    await auditService.recordLog({
      actorId,
      action: AuditAction.UPDATE_WAREHOUSE,
      entityType: 'Warehouse',
      entityId: updated.id,
      metadata: { changes: input },
      ipAddress,
    });

    return updated;
  }

  async updateWarehouseStatus(id: string, isActive: boolean, actorId: string, ipAddress?: string) {
    const warehouse = await this.repo.findWarehouseById(id);
    if (!warehouse) {
      throw new NotFoundError('Warehouse not found.');
    }

    // Invariant: Cannot deactivate warehouse with positive inventory or pending documents
    if (!isActive) {
      const positiveBalances = await this.repo.countPositiveBalances(id);
      if (positiveBalances > 0) {
        throw new ConflictError(
          `Cannot deactivate warehouse '${warehouse.code}'. It currently contains ${positiveBalances} active inventory SKU balance(s).`
        );
      }

      const pendingDocs = await this.repo.countPendingDocuments(id);
      if (pendingDocs > 0) {
        throw new ConflictError(
          `Cannot deactivate warehouse '${warehouse.code}'. It has ${pendingDocs} pending stock document(s) awaiting approval.`
        );
      }
    }

    const updated = await this.repo.updateWarehouseStatus(id, isActive);

    await auditService.recordLog({
      actorId,
      action: AuditAction.CHANGE_WAREHOUSE_STATUS,
      entityType: 'Warehouse',
      entityId: updated.id,
      metadata: { previousStatus: warehouse.isActive, newStatus: isActive },
      ipAddress,
    });

    return updated;
  }

  // ========================================================
  // INVENTORY BALANCES
  // ========================================================

  async getBalances(query: BalanceQueryInput) {
    return this.repo.findBalances(query);
  }

  async getBalance(warehouseId: string, variantId: string) {
    const balance = await this.repo.findBalance(warehouseId, variantId);
    if (!balance) {
      // If not yet stocked, return balance with 0 quantity
      const [warehouse, variant] = await Promise.all([
        prisma.warehouse.findUnique({ where: { id: warehouseId } }),
        prisma.productVariant.findUnique({
          where: { id: variantId },
          include: { product: true },
        }),
      ]);
      if (!warehouse) throw new NotFoundError('Warehouse not found.');
      if (!variant) throw new NotFoundError('Product variant not found.');

      return {
        warehouseId,
        variantId,
        quantity: 0,
        minThreshold: 5,
        updatedAt: new Date().toISOString(),
        warehouse,
        variant,
        stockStatus: 'OUT_OF_STOCK' as const,
      };
    }

    const stockStatus =
      balance.quantity === 0 ? 'OUT_OF_STOCK' : balance.quantity <= balance.minThreshold ? 'LOW_STOCK' : 'IN_STOCK';

    return {
      ...balance,
      stockStatus,
    };
  }

  async getLowStock(query: LowStockQueryInput) {
    return this.repo.findLowStock(query);
  }

  async updateThreshold(
    warehouseId: string,
    variantId: string,
    input: UpdateThresholdInput,
    actorId: string,
    ipAddress?: string
  ) {
    const updated = await this.repo.updateThreshold(warehouseId, variantId, input.minThreshold);

    await auditService.recordLog({
      actorId,
      action: AuditAction.UPDATE_STOCK_THRESHOLD,
      entityType: 'InventoryBalance',
      entityId: `${warehouseId}:${variantId}`,
      metadata: { warehouseId, variantId, minThreshold: input.minThreshold },
      ipAddress,
    });

    return updated;
  }

  // ========================================================
  // STOCK DOCUMENTS
  // ========================================================

  async createDocument(input: CreateStockDocumentInput, actorId: string, ipAddress?: string) {
    // 1. Verify warehouses exist and are active
    if (input.sourceWarehouseId) {
      const srcWh = await prisma.warehouse.findUnique({ where: { id: input.sourceWarehouseId } });
      if (!srcWh || !srcWh.isActive) {
        throw new BadRequestError('Source warehouse does not exist or is inactive.');
      }
    }
    if (input.destinationWarehouseId) {
      const destWh = await prisma.warehouse.findUnique({ where: { id: input.destinationWarehouseId } });
      if (!destWh || !destWh.isActive) {
        throw new BadRequestError('Destination warehouse does not exist or is inactive.');
      }
    }

    // 2. Verify all variants exist and are active
    const variantIds = input.items.map((i) => i.variantId);
    const variants = await prisma.productVariant.findMany({
      where: {
        id: { in: variantIds },
        isActive: true,
        deletedAt: null,
      },
    });

    if (variants.length !== variantIds.length) {
      throw new BadRequestError('One or more product variants in the document are invalid, inactive, or deleted.');
    }

    const document = await this.repo.createStockDocument(input, actorId);

    await auditService.recordLog({
      actorId,
      action: AuditAction.CREATE_STOCK_DOCUMENT,
      entityType: 'StockDocument',
      entityId: document.id,
      metadata: {
        documentCode: document.documentCode,
        type: document.type,
        itemCount: input.items.length,
      },
      ipAddress,
    });

    return document;
  }

  async updateDraftDocument(
    id: string,
    input: UpdateStockDocumentInput,
    actorId: string,
    actorRole: Role,
    ipAddress?: string
  ) {
    const doc = await this.repo.findDocumentById(id);
    if (!doc) {
      throw new NotFoundError('Stock document not found.');
    }

    if (doc.status !== StockDocStatus.DRAFT) {
      throw new ConflictError(`Cannot edit document in '${doc.status}' state. Only DRAFT documents can be updated.`);
    }

    if (actorRole === Role.STAFF && doc.createdById !== actorId) {
      throw new ForbiddenError('Staff members may only edit their own draft documents.');
    }

    if (input.items && input.items.length > 0) {
      const variantIds = input.items.map((i) => i.variantId);
      const variants = await prisma.productVariant.findMany({
        where: { id: { in: variantIds }, isActive: true, deletedAt: null },
      });
      if (variants.length !== variantIds.length) {
        throw new BadRequestError('One or more variants are invalid or inactive.');
      }
    }

    const updated = await this.repo.updateDraftDocument(id, input);

    await auditService.recordLog({
      actorId,
      action: AuditAction.UPDATE_STOCK_DOCUMENT,
      entityType: 'StockDocument',
      entityId: id,
      metadata: { documentCode: doc.documentCode },
      ipAddress,
    });

    return updated;
  }

  async submitDocument(id: string, actorId: string, actorRole: Role, ipAddress?: string) {
    const doc = await this.repo.findDocumentById(id);
    if (!doc) {
      throw new NotFoundError('Stock document not found.');
    }

    if (doc.status !== StockDocStatus.DRAFT) {
      throw new ConflictError(`Document cannot be submitted. Current status is '${doc.status}', expected 'DRAFT'.`);
    }

    if (actorRole === Role.STAFF && doc.createdById !== actorId) {
      throw new ForbiddenError('Staff members may only submit their own draft documents.');
    }

    if (!doc.items || doc.items.length === 0) {
      throw new BadRequestError('Cannot submit an empty document. At least one SKU item is required.');
    }

    const updated = await this.repo.updateDocumentStatus(id, StockDocStatus.PENDING);

    await auditService.recordLog({
      actorId,
      action: AuditAction.SUBMIT_STOCK_DOCUMENT,
      entityType: 'StockDocument',
      entityId: id,
      metadata: { documentCode: doc.documentCode, newStatus: StockDocStatus.PENDING },
      ipAddress,
    });

    return updated;
  }

  async approveDocument(id: string, approverId: string, approverRole: Role, ipAddress?: string) {
    if (approverRole !== Role.ADMIN && approverRole !== Role.MANAGER) {
      throw new ForbiddenError('Only Administrators and Managers are authorized to approve stock documents.');
    }

    // Wrap with transient conflict retry logic (max 3 retries for deadlocks)
    let retries = 3;
    while (retries > 0) {
      try {
        return await this.repo.approveAndPostDocument({
          documentId: id,
          approverId,
          ipAddress,
        });
      } catch (err: any) {
        // Retry only on PostgreSQL serialization failure (40001) or deadlock (40P01)
        if ((err.code === '40001' || err.code === '40P01') && retries > 1) {
          retries--;
          await new Promise((resolve) => setTimeout(resolve, Math.random() * 50 + 50));
          continue;
        }
        throw err;
      }
    }
  }

  async rejectDocument(id: string, approverId: string, approverRole: Role, reason?: string, ipAddress?: string) {
    if (approverRole !== Role.ADMIN && approverRole !== Role.MANAGER) {
      throw new ForbiddenError('Only Administrators and Managers are authorized to reject stock documents.');
    }

    const doc = await this.repo.findDocumentById(id);
    if (!doc) {
      throw new NotFoundError('Stock document not found.');
    }

    if (doc.status !== StockDocStatus.PENDING) {
      throw new ConflictError(
        `Cannot reject document. Current status is '${doc.status}', expected '${StockDocStatus.PENDING}'.`
      );
    }

    const updated = await this.repo.updateDocumentStatus(id, StockDocStatus.REJECTED, reason);

    await auditService.recordLog({
      actorId: approverId,
      action: AuditAction.REJECT_STOCK_DOCUMENT,
      entityType: 'StockDocument',
      entityId: id,
      metadata: { documentCode: doc.documentCode, reason },
      ipAddress,
    });

    return updated;
  }

  async cancelDocument(id: string, actorId: string, actorRole: Role, ipAddress?: string) {
    const doc = await this.repo.findDocumentById(id);
    if (!doc) {
      throw new NotFoundError('Stock document not found.');
    }

    if (doc.status === StockDocStatus.POSTED) {
      throw new ConflictError('Cannot cancel a POSTED stock document. Historical stock ledger is immutable.');
    }

    if (doc.status === StockDocStatus.REJECTED || doc.status === StockDocStatus.CANCELLED) {
      throw new ConflictError(`Document is already in terminal state '${doc.status}'.`);
    }

    if (actorRole === Role.STAFF && doc.createdById !== actorId) {
      throw new ForbiddenError('Staff members may only cancel their own stock documents.');
    }

    const updated = await this.repo.updateDocumentStatus(id, StockDocStatus.CANCELLED);

    await auditService.recordLog({
      actorId,
      action: AuditAction.CANCEL_STOCK_DOCUMENT,
      entityType: 'StockDocument',
      entityId: id,
      metadata: { documentCode: doc.documentCode, previousStatus: doc.status },
      ipAddress,
    });

    return updated;
  }

  async getDocumentById(id: string) {
    const doc = await this.repo.findDocumentById(id);
    if (!doc) {
      throw new NotFoundError('Stock document not found.');
    }
    return doc;
  }

  async getDocuments(query: StockDocumentQueryInput) {
    return this.repo.findDocuments(query);
  }

  // ========================================================
  // STOCK MOVEMENTS
  // ========================================================

  async getMovements(query: StockMovementQueryInput) {
    return this.repo.findMovements(query);
  }

  // ========================================================
  // EXPORT BALANCES (CSV / XLSX) WITH FORMULA INJECTION DEFENSE
  // ========================================================

  private sanitizeFormula(val: unknown): string {
    if (val === null || val === undefined) return '';
    const str = String(val);
    // Formula injection protection: prefix with single quote if string starts with dangerous characters
    if (/^[=+\-@\t\r]/.test(str)) {
      return `'${str}`;
    }
    return str;
  }

  async exportBalances(query: ExportInventoryQueryInput, actorRole: Role): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
    const balances = await this.repo.findExportBalances({
      warehouseId: query.warehouseId,
      categoryId: query.categoryId,
    });

    const isStaff = actorRole === Role.STAFF;

    // Filter by stock status if requested
    const filteredBalances = balances.filter((b) => {
      let status = 'IN_STOCK';
      if (b.quantity === 0) status = 'OUT_OF_STOCK';
      else if (b.quantity <= b.minThreshold) status = 'LOW_STOCK';

      if (query.stockStatus && status !== query.stockStatus) return false;
      return true;
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Inventory Balances');

    // Define columns
    const columns: Array<{ header: string; key: string; width: number }> = [
      { header: 'Warehouse Code', key: 'warehouseCode', width: 16 },
      { header: 'Warehouse Name', key: 'warehouseName', width: 25 },
      { header: 'Category', key: 'categoryName', width: 20 },
      { header: 'Product Name', key: 'productName', width: 30 },
      { header: 'SKU', key: 'sku', width: 16 },
      { header: 'Variant Name', key: 'variantName', width: 25 },
      { header: 'Quantity', key: 'quantity', width: 12 },
      { header: 'Min Threshold', key: 'minThreshold', width: 14 },
      { header: 'Stock Status', key: 'stockStatus', width: 15 },
    ];

    if (!isStaff) {
      columns.push({ header: 'Selling Price ($)', key: 'sellingPrice', width: 16 });
      columns.push({ header: 'Stock Value ($)', key: 'stockValue', width: 16 });
    }

    worksheet.columns = columns;

    for (const b of filteredBalances) {
      let status = 'In Stock';
      if (b.quantity === 0) status = 'Out of Stock';
      else if (b.quantity <= b.minThreshold) status = 'Low Stock';

      const sellingPrice = Number(b.variant.price);
      const stockValue = b.quantity * sellingPrice;

      const row: Record<string, any> = {
        warehouseCode: this.sanitizeFormula(b.warehouse.code),
        warehouseName: this.sanitizeFormula(b.warehouse.name),
        categoryName: this.sanitizeFormula(b.variant.product.category?.name || 'N/A'),
        productName: this.sanitizeFormula(b.variant.product.name),
        sku: this.sanitizeFormula(b.variant.sku),
        variantName: this.sanitizeFormula(b.variant.name),
        quantity: b.quantity,
        minThreshold: b.minThreshold,
        stockStatus: status,
      };

      if (!isStaff) {
        row.sellingPrice = sellingPrice;
        row.stockValue = stockValue;
      }

      worksheet.addRow(row);
    }

    // Format headers
    worksheet.getRow(1).font = { bold: true };

    const timestamp = new Date().toISOString().slice(0, 10);

    if (query.format === 'xlsx') {
      const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
      return {
        buffer,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        filename: `inventory-balances-${timestamp}.xlsx`,
      };
    } else {
      const csvBuffer = (await workbook.csv.writeBuffer()) as unknown as Buffer;
      return {
        buffer: csvBuffer,
        contentType: 'text/csv; charset=utf-8',
        filename: `inventory-balances-${timestamp}.csv`,
      };
    }
  }
}

export const inventoryService = new InventoryService();
