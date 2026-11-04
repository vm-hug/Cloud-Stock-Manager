import { Prisma, StockDocType, StockDocStatus } from '@prisma/client';
import { prisma } from '../../config/db';
import {
  BalanceQueryInput,
  CreateStockDocumentInput,
  CreateWarehouseInput,
  LowStockQueryInput,
  StockDocumentQueryInput,
  StockMovementQueryInput,
  UpdateStockDocumentInput,
  UpdateWarehouseInput,
  WarehouseQueryInput,
} from './inventory.schema';
import { ConflictError, NotFoundError } from '../../common/errors/appError';
import { auditService } from '../audit/audit.service';
import { AuditAction } from '@cloud-stock/shared';

export interface LockedBalance {
  warehouse_id: string;
  variant_id: string;
  quantity: number;
  min_threshold: number;
}

export class InventoryRepository {
  // ========================================================
  // WAREHOUSES
  // ========================================================

  async createWarehouse(data: CreateWarehouseInput) {
    return prisma.warehouse.create({
      data: {
        code: data.code,
        name: data.name,
        isActive: true,
      },
    });
  }

  async findWarehouseById(id: string) {
    return prisma.warehouse.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            inventoryBalances: true,
            stockMovements: true,
            sourceDocuments: true,
            destinationDocuments: true,
          },
        },
      },
    });
  }

  async findWarehouseByCode(code: string) {
    return prisma.warehouse.findUnique({
      where: { code },
    });
  }

  async findWarehouses(query: WarehouseQueryInput) {
    const { search, isActive, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.WarehouseWhereInput = {};
    if (isActive !== undefined) {
      where.isActive = isActive;
    }
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.warehouse.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              inventoryBalances: true,
              stockMovements: true,
            },
          },
        },
      }),
      prisma.warehouse.count({ where }),
    ]);

    return { items, total };
  }

  async updateWarehouse(id: string, data: UpdateWarehouseInput) {
    return prisma.warehouse.update({
      where: { id },
      data,
    });
  }

  async updateWarehouseStatus(id: string, isActive: boolean) {
    return prisma.warehouse.update({
      where: { id },
      data: { isActive },
    });
  }

  async countPositiveBalances(warehouseId: string): Promise<number> {
    return prisma.inventoryBalance.count({
      where: {
        warehouseId,
        quantity: { gt: 0 },
      },
    });
  }

  async countPendingDocuments(warehouseId: string): Promise<number> {
    return prisma.stockDocument.count({
      where: {
        status: StockDocStatus.PENDING,
        OR: [{ sourceWarehouseId: warehouseId }, { destinationWarehouseId: warehouseId }],
      },
    });
  }

  // ========================================================
  // INVENTORY BALANCES
  // ========================================================

  async findBalances(query: BalanceQueryInput) {
    const { warehouseId, categoryId, search, stockStatus, page, limit } = query;
    const skip = (page - 1) * limit;

    const variantWhere: Prisma.ProductVariantWhereInput = {
      deletedAt: null,
    };
    if (categoryId) {
      variantWhere.product = { categoryId, deletedAt: null };
    }
    if (search) {
      variantWhere.OR = [
        { sku: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { product: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const where: Prisma.InventoryBalanceWhereInput = {
      variant: variantWhere,
    };

    if (warehouseId) {
      where.warehouseId = warehouseId;
    }
    if (stockStatus === 'OUT_OF_STOCK') {
      where.quantity = 0;
    }

    const [items, total] = await Promise.all([
      prisma.inventoryBalance.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ warehouse: { code: 'asc' } }, { variant: { sku: 'asc' } }],
        include: {
          warehouse: true,
          variant: {
            include: {
              product: {
                include: {
                  category: true,
                  images: {
                    where: { isPrimary: true },
                    take: 1,
                  },
                },
              },
            },
          },
        },
      }),
      prisma.inventoryBalance.count({ where }),
    ]);

    // Client-side mapping for stockStatus calculation if not already filtered
    const mappedItems = items.map((item) => {
      let status: 'OUT_OF_STOCK' | 'LOW_STOCK' | 'IN_STOCK';
      if (item.quantity === 0) {
        status = 'OUT_OF_STOCK';
      } else if (item.quantity <= item.minThreshold) {
        status = 'LOW_STOCK';
      } else {
        status = 'IN_STOCK';
      }
      return {
        ...item,
        stockStatus: status,
      };
    });

    // If stockStatus filter was 'LOW_STOCK' or 'IN_STOCK', apply filter
    if (stockStatus === 'LOW_STOCK') {
      const filtered = mappedItems.filter((i) => i.stockStatus === 'LOW_STOCK');
      return { items: filtered, total: filtered.length };
    }
    if (stockStatus === 'IN_STOCK') {
      const filtered = mappedItems.filter((i) => i.stockStatus === 'IN_STOCK');
      return { items: filtered, total: filtered.length };
    }

    return { items: mappedItems, total };
  }

  async findLowStock(query: LowStockQueryInput) {
    const { warehouseId, search, page, limit } = query;
    const offset = (page - 1) * limit;

    // Direct SQL query enforcing PostgreSQL invariant chk_inventory_balances_quantity_non_negative
    // and quantity <= min_threshold
    const searchFilter = search ? `%${search}%` : null;

    const countResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM inventory_balances ib
      JOIN warehouses w ON ib.warehouse_id = w.id
      JOIN product_variants pv ON ib.variant_id = pv.id
      JOIN products p ON pv.product_id = p.id
      WHERE ib.quantity <= ib.min_threshold
        AND pv.deleted_at IS NULL
        AND (${warehouseId}::uuid IS NULL OR ib.warehouse_id = ${warehouseId}::uuid)
        AND (${searchFilter}::text IS NULL OR (
          pv.sku ILIKE ${searchFilter} OR
          pv.name ILIKE ${searchFilter} OR
          p.name ILIKE ${searchFilter}
        ))
    `;
    const total = Number(countResult[0]?.count || 0);

    const rows = await prisma.inventoryBalance.findMany({
      where: {
        warehouseId: warehouseId || undefined,
        variant: {
          deletedAt: null,
          OR: search
            ? [
                { sku: { contains: search, mode: 'insensitive' } },
                { name: { contains: search, mode: 'insensitive' } },
                { product: { name: { contains: search, mode: 'insensitive' } } },
              ]
            : undefined,
        },
      },
      include: {
        warehouse: true,
        variant: {
          include: {
            product: {
              include: {
                category: true,
                images: { where: { isPrimary: true }, take: 1 },
              },
            },
          },
        },
      },
      orderBy: [{ quantity: 'asc' }, { updatedAt: 'desc' }],
    });

    // Filter strictly quantity <= minThreshold
    const lowStockItems = rows
      .filter((r) => r.quantity <= r.minThreshold)
      .slice(offset, offset + limit)
      .map((item) => ({
        ...item,
        stockStatus: item.quantity === 0 ? ('OUT_OF_STOCK' as const) : ('LOW_STOCK' as const),
      }));

    return { items: lowStockItems, total };
  }

  async findBalance(warehouseId: string, variantId: string) {
    return prisma.inventoryBalance.findUnique({
      where: {
        warehouseId_variantId: {
          warehouseId,
          variantId,
        },
      },
      include: {
        warehouse: true,
        variant: {
          include: {
            product: true,
          },
        },
      },
    });
  }

  async updateThreshold(warehouseId: string, variantId: string, minThreshold: number) {
    return prisma.inventoryBalance.upsert({
      where: {
        warehouseId_variantId: {
          warehouseId,
          variantId,
        },
      },
      update: {
        minThreshold,
      },
      create: {
        warehouseId,
        variantId,
        quantity: 0,
        minThreshold,
      },
    });
  }

  // ========================================================
  // STOCK DOCUMENTS
  // ========================================================

  async generateDocumentCode(type: StockDocType): Promise<string> {
    const prefixMap: Record<StockDocType, string> = {
      INBOUND: 'INB',
      OUTBOUND: 'OUT',
      ADJUSTMENT: 'ADJ',
      TRANSFER: 'TRF',
    };
    const prefix = prefixMap[type] || 'DOC';
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000).toString();

    let code = `${prefix}-${dateStr}-${randomSuffix}`;
    let exists = await prisma.stockDocument.findUnique({ where: { documentCode: code } });
    let counter = 1;
    while (exists) {
      code = `${prefix}-${dateStr}-${randomSuffix}-${counter}`;
      exists = await prisma.stockDocument.findUnique({ where: { documentCode: code } });
      counter++;
    }
    return code;
  }

  async createStockDocument(data: CreateStockDocumentInput, createdById: string) {
    const documentCode = await this.generateDocumentCode(data.type);

    return prisma.stockDocument.create({
      data: {
        documentCode,
        type: data.type,
        status: StockDocStatus.DRAFT,
        sourceWarehouseId: data.sourceWarehouseId || null,
        destinationWarehouseId: data.destinationWarehouseId || null,
        note: data.note || null,
        createdById,
        items: {
          create: data.items.map((item) => ({
            variantId: item.variantId,
            quantity: item.quantity,
            adjustmentDelta: item.adjustmentDelta ?? null,
            unitPrice: item.unitPrice !== undefined ? new Prisma.Decimal(item.unitPrice) : null,
          })),
        },
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, role: true },
        },
        sourceWarehouse: true,
        destinationWarehouse: true,
        items: {
          include: {
            variant: {
              include: { product: true },
            },
          },
        },
      },
    });
  }

  async updateDraftDocument(id: string, data: UpdateStockDocumentInput) {
    return prisma.$transaction(async (tx) => {
      if (data.items) {
        // Remove existing items and recreate
        await tx.stockDocumentItem.deleteMany({
          where: { documentId: id },
        });

        await tx.stockDocumentItem.createMany({
          data: data.items.map((item) => ({
            documentId: id,
            variantId: item.variantId,
            quantity: item.quantity,
            adjustmentDelta: item.adjustmentDelta ?? null,
            unitPrice: item.unitPrice !== undefined ? new Prisma.Decimal(item.unitPrice) : null,
          })),
        });
      }

      return tx.stockDocument.update({
        where: { id },
        data: {
          sourceWarehouseId: data.sourceWarehouseId !== undefined ? data.sourceWarehouseId : undefined,
          destinationWarehouseId:
            data.destinationWarehouseId !== undefined ? data.destinationWarehouseId : undefined,
          note: data.note !== undefined ? data.note : undefined,
        },
        include: {
          createdBy: { select: { id: true, name: true, email: true, role: true } },
          sourceWarehouse: true,
          destinationWarehouse: true,
          items: {
            include: {
              variant: {
                include: { product: true },
              },
            },
          },
        },
      });
    });
  }

  async findDocumentById(id: string) {
    return prisma.stockDocument.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true, email: true, role: true } },
        approvedBy: { select: { id: true, name: true, email: true, role: true } },
        sourceWarehouse: true,
        destinationWarehouse: true,
        items: {
          include: {
            variant: {
              include: {
                product: {
                  include: {
                    images: { where: { isPrimary: true }, take: 1 },
                  },
                },
              },
            },
            stockMovements: {
              include: {
                warehouse: true,
              },
            },
          },
        },
      },
    });
  }

  async findDocuments(query: StockDocumentQueryInput) {
    const { documentCode, type, status, warehouseId, createdById, startDate, endDate, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.StockDocumentWhereInput = {};
    if (documentCode) {
      where.documentCode = { contains: documentCode, mode: 'insensitive' };
    }
    if (type) {
      where.type = type;
    }
    if (status) {
      where.status = status;
    }
    if (createdById) {
      where.createdById = createdById;
    }
    if (warehouseId) {
      where.OR = [{ sourceWarehouseId: warehouseId }, { destinationWarehouseId: warehouseId }];
    }
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [items, total] = await Promise.all([
      prisma.stockDocument.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: { select: { id: true, name: true, email: true, role: true } },
          approvedBy: { select: { id: true, name: true, email: true, role: true } },
          sourceWarehouse: true,
          destinationWarehouse: true,
          _count: {
            select: { items: true },
          },
        },
      }),
      prisma.stockDocument.count({ where }),
    ]);

    return { items, total };
  }

  async updateDocumentStatus(id: string, status: StockDocStatus, note?: string) {
    return prisma.stockDocument.update({
      where: { id },
      data: {
        status,
        note: note ? note : undefined,
      },
    });
  }

  // ========================================================
  // POSTGRESQL ACID TRANSACTION & PESSIMISTIC LOCKING (POSTED)
  // ========================================================

  async approveAndPostDocument(params: {
    documentId: string;
    approverId: string;
    ipAddress?: string;
  }) {
    const { documentId, approverId, ipAddress } = params;

    return prisma.$transaction(
      async (tx) => {
        // 1. Lock document with SELECT ... FOR UPDATE
        const lockedDocs = await tx.$queryRaw<
          Array<{
            id: string;
            document_code: string;
            type: StockDocType;
            status: StockDocStatus;
            source_warehouse_id: string | null;
            destination_warehouse_id: string | null;
            created_by: string;
          }>
        >`
          SELECT id, document_code, type, status, source_warehouse_id, destination_warehouse_id, created_by
          FROM stock_documents
          WHERE id = ${documentId}::uuid
          FOR UPDATE
        `;

        if (!lockedDocs.length) {
          throw new NotFoundError('Stock document not found.');
        }

        const doc = lockedDocs[0];

        // 2. Validate document is in PENDING state
        if (doc.status !== StockDocStatus.PENDING) {
          throw new ConflictError(
            `Document cannot be approved. Current status is ${doc.status}, expected ${StockDocStatus.PENDING}.`
          );
        }

        // 3. Approval policy check: Approver cannot be creator (Phase 4 strict invariant)
        if (doc.created_by === approverId) {
          throw new ConflictError('Approval policy violation: The creator cannot approve their own document.');
        }

        // 4. Fetch document items
        const items = await tx.stockDocumentItem.findMany({
          where: { documentId: doc.id },
          include: {
            variant: true,
          },
        });

        if (!items.length) {
          throw new ConflictError('Document has no items to process.');
        }

        // 5. Verify Warehouses active status
        if (doc.source_warehouse_id) {
          const srcWh = await tx.warehouse.findUnique({
            where: { id: doc.source_warehouse_id },
          });
          if (!srcWh || !srcWh.isActive) {
            throw new ConflictError('Source warehouse is invalid or inactive.');
          }
        }

        if (doc.destination_warehouse_id) {
          const destWh = await tx.warehouse.findUnique({
            where: { id: doc.destination_warehouse_id },
          });
          if (!destWh || !destWh.isActive) {
            throw new ConflictError('Destination warehouse is invalid or inactive.');
          }
        }

        // 6. Verify all variants are active and not deleted
        for (const item of items) {
          if (!item.variant || !item.variant.isActive || item.variant.deletedAt !== null) {
            throw new ConflictError(`Variant ${item.variantId} is inactive or deleted.`);
          }
        }

        // 7. Collect all (warehouse_id, variant_id) pairs to lock
        const pairsToLock: Array<{ warehouseId: string; variantId: string }> = [];

        for (const item of items) {
          if (doc.type === StockDocType.INBOUND) {
            pairsToLock.push({
              warehouseId: doc.destination_warehouse_id!,
              variantId: item.variantId,
            });
          } else if (doc.type === StockDocType.OUTBOUND || doc.type === StockDocType.ADJUSTMENT) {
            pairsToLock.push({
              warehouseId: doc.source_warehouse_id!,
              variantId: item.variantId,
            });
          } else if (doc.type === StockDocType.TRANSFER) {
            pairsToLock.push({
              warehouseId: doc.source_warehouse_id!,
              variantId: item.variantId,
            });
            pairsToLock.push({
              warehouseId: doc.destination_warehouse_id!,
              variantId: item.variantId,
            });
          }
        }

        // 8. Ensure initial balance records exist (upsert 0 if missing)
        // Deduplicate pairs first
        const uniquePairsMap = new Map<string, { warehouseId: string; variantId: string }>();
        for (const p of pairsToLock) {
          uniquePairsMap.set(`${p.warehouseId}:${p.variantId}`, p);
        }
        const uniquePairs = Array.from(uniquePairsMap.values());

        for (const p of uniquePairs) {
          await tx.$executeRaw`
            INSERT INTO inventory_balances (warehouse_id, variant_id, quantity, min_threshold, updated_at)
            VALUES (${p.warehouseId}::uuid, ${p.variantId}::uuid, 0, 5, NOW())
            ON CONFLICT (warehouse_id, variant_id) DO NOTHING
          `;
        }

        // 9. Stable Locking Order: sort by warehouseId ASC, then variantId ASC
        // This completely eliminates deadlocks for concurrent multi-item/transfer transactions!
        uniquePairs.sort((a, b) => {
          if (a.warehouseId === b.warehouseId) {
            return a.variantId.localeCompare(b.variantId);
          }
          return a.warehouseId.localeCompare(b.warehouseId);
        });

        // 10. Lock inventory balances using SELECT ... FOR UPDATE in stable order
        const balanceCache = new Map<string, LockedBalance>();
        for (const p of uniquePairs) {
          const locked = await tx.$queryRaw<LockedBalance[]>`
            SELECT warehouse_id, variant_id, quantity, min_threshold
            FROM inventory_balances
            WHERE warehouse_id = ${p.warehouseId}::uuid AND variant_id = ${p.variantId}::uuid
            FOR UPDATE
          `;
          if (locked.length > 0) {
            balanceCache.set(`${p.warehouseId}:${p.variantId}`, locked[0]);
          }
        }

        // 11. Calculate balance deltas and prepare updates & movements
        const now = new Date();
        const movementsToCreate: Array<{
          documentItemId: string;
          warehouseId: string;
          variantId: string;
          delta: number;
          quantityBefore: number;
          quantityAfter: number;
        }> = [];

        for (const item of items) {
          if (doc.type === StockDocType.INBOUND) {
            const destWhId = doc.destination_warehouse_id!;
            const balanceKey = `${destWhId}:${item.variantId}`;
            const balance = balanceCache.get(balanceKey)!;

            const qtyBefore = balance.quantity;
            const delta = item.quantity;
            const qtyAfter = qtyBefore + delta;

            balance.quantity = qtyAfter; // update cached state for any subsequent items

            movementsToCreate.push({
              documentItemId: item.id,
              warehouseId: destWhId,
              variantId: item.variantId,
              delta,
              quantityBefore: qtyBefore,
              quantityAfter: qtyAfter,
            });
          } else if (doc.type === StockDocType.OUTBOUND) {
            const srcWhId = doc.source_warehouse_id!;
            const balanceKey = `${srcWhId}:${item.variantId}`;
            const balance = balanceCache.get(balanceKey)!;

            const qtyBefore = balance.quantity;
            if (qtyBefore < item.quantity) {
              throw new ConflictError(
                `Insufficient stock for SKU ${item.variant.sku} at warehouse. Available: ${qtyBefore}, Requested: ${item.quantity}.`
              );
            }

            const delta = -item.quantity;
            const qtyAfter = qtyBefore + delta;
            balance.quantity = qtyAfter;

            movementsToCreate.push({
              documentItemId: item.id,
              warehouseId: srcWhId,
              variantId: item.variantId,
              delta,
              quantityBefore: qtyBefore,
              quantityAfter: qtyAfter,
            });
          } else if (doc.type === StockDocType.ADJUSTMENT) {
            const srcWhId = doc.source_warehouse_id!;
            const balanceKey = `${srcWhId}:${item.variantId}`;
            const balance = balanceCache.get(balanceKey)!;

            if (item.adjustmentDelta === null || item.adjustmentDelta === 0) {
              throw new ConflictError(`Adjustment delta for SKU ${item.variant.sku} must be non-zero.`);
            }

            const qtyBefore = balance.quantity;
            const delta = item.adjustmentDelta;
            const qtyAfter = qtyBefore + delta;

            if (qtyAfter < 0) {
              throw new ConflictError(
                `Adjustment for SKU ${item.variant.sku} results in negative inventory (${qtyAfter}). Rejected.`
              );
            }

            balance.quantity = qtyAfter;

            movementsToCreate.push({
              documentItemId: item.id,
              warehouseId: srcWhId,
              variantId: item.variantId,
              delta,
              quantityBefore: qtyBefore,
              quantityAfter: qtyAfter,
            });
          } else if (doc.type === StockDocType.TRANSFER) {
            const srcWhId = doc.source_warehouse_id!;
            const destWhId = doc.destination_warehouse_id!;

            const srcKey = `${srcWhId}:${item.variantId}`;
            const destKey = `${destWhId}:${item.variantId}`;

            const srcBalance = balanceCache.get(srcKey)!;
            const destBalance = balanceCache.get(destKey)!;

            const srcBefore = srcBalance.quantity;
            if (srcBefore < item.quantity) {
              throw new ConflictError(
                `Insufficient stock for transfer of SKU ${item.variant.sku} at source warehouse. Available: ${srcBefore}, Requested: ${item.quantity}.`
              );
            }

            const srcDelta = -item.quantity;
            const srcAfter = srcBefore + srcDelta;
            srcBalance.quantity = srcAfter;

            const destBefore = destBalance.quantity;
            const destDelta = item.quantity;
            const destAfter = destBefore + destDelta;
            destBalance.quantity = destAfter;

            // Two movements created atomically for TRANSFER
            movementsToCreate.push({
              documentItemId: item.id,
              warehouseId: srcWhId,
              variantId: item.variantId,
              delta: srcDelta,
              quantityBefore: srcBefore,
              quantityAfter: srcAfter,
            });
            movementsToCreate.push({
              documentItemId: item.id,
              warehouseId: destWhId,
              variantId: item.variantId,
              delta: destDelta,
              quantityBefore: destBefore,
              quantityAfter: destAfter,
            });
          }
        }

        // 12. Update balances in database
        for (const [key, balance] of balanceCache.entries()) {
          const [whId, varId] = key.split(':');
          await tx.inventoryBalance.update({
            where: {
              warehouseId_variantId: {
                warehouseId: whId,
                variantId: varId,
              },
            },
            data: {
              quantity: balance.quantity,
              updatedAt: now,
            },
          });
        }

        // 13. Create StockMovement records
        for (const m of movementsToCreate) {
          await tx.stockMovement.create({
            data: {
              documentItemId: m.documentItemId,
              warehouseId: m.warehouseId,
              variantId: m.variantId,
              delta: m.delta,
              quantityBefore: m.quantityBefore,
              quantityAfter: m.quantityAfter,
              createdAt: now,
            },
          });
        }

        // 14. Update document status to POSTED
        const updatedDoc = await tx.stockDocument.update({
          where: { id: doc.id },
          data: {
            status: StockDocStatus.POSTED,
            approvedById: approverId,
            approvedAt: now,
            postedAt: now,
          },
          include: {
            createdBy: { select: { id: true, name: true, email: true, role: true } },
            approvedBy: { select: { id: true, name: true, email: true, role: true } },
            sourceWarehouse: true,
            destinationWarehouse: true,
            items: {
              include: {
                variant: true,
                stockMovements: true,
              },
            },
          },
        });

        // 15. Record AuditLog in the SAME transaction for strict atomicity
        let auditAction = AuditAction.APPROVE_STOCK_DOCUMENT;
        if (doc.type === StockDocType.INBOUND) auditAction = AuditAction.POST_INBOUND;
        else if (doc.type === StockDocType.OUTBOUND) auditAction = AuditAction.POST_OUTBOUND;
        else if (doc.type === StockDocType.ADJUSTMENT) auditAction = AuditAction.POST_ADJUSTMENT;
        else if (doc.type === StockDocType.TRANSFER) auditAction = AuditAction.POST_TRANSFER;

        await auditService.recordLog(
          {
            actorId: approverId,
            action: auditAction,
            entityType: 'StockDocument',
            entityId: doc.id,
            metadata: {
              documentCode: doc.document_code,
              type: doc.type,
              status: StockDocStatus.POSTED,
              movementsCount: movementsToCreate.length,
            },
            ipAddress,
          },
          tx
        );

        return updatedDoc;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 15000,
      }
    );
  }

  // ========================================================
  // STOCK MOVEMENTS
  // ========================================================

  async findMovements(query: StockMovementQueryInput) {
    const { warehouseId, variantId, documentId, startDate, endDate, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.StockMovementWhereInput = {};
    if (warehouseId) {
      where.warehouseId = warehouseId;
    }
    if (variantId) {
      where.variantId = variantId;
    }
    if (documentId) {
      where.documentItem = {
        documentId,
      };
    }
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [items, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          warehouse: true,
          variant: {
            include: {
              product: true,
            },
          },
          documentItem: {
            include: {
              document: {
                select: {
                  id: true,
                  documentCode: true,
                  type: true,
                  status: true,
                  createdById: true,
                  approvedById: true,
                  createdBy: { select: { name: true, email: true } },
                  approvedBy: { select: { name: true, email: true } },
                },
              },
            },
          },
        },
      }),
      prisma.stockMovement.count({ where }),
    ]);

    return { items, total };
  }

  // ========================================================
  // EXPORT BALANCES
  // ========================================================

  async findExportBalances(params: { warehouseId?: string; categoryId?: string }) {
    const { warehouseId, categoryId } = params;

    const variantWhere: Prisma.ProductVariantWhereInput = {
      deletedAt: null,
    };
    if (categoryId) {
      variantWhere.product = { categoryId, deletedAt: null };
    }

    const where: Prisma.InventoryBalanceWhereInput = {
      variant: variantWhere,
    };
    if (warehouseId) {
      where.warehouseId = warehouseId;
    }

    return prisma.inventoryBalance.findMany({
      where,
      orderBy: [{ warehouse: { code: 'asc' } }, { variant: { sku: 'asc' } }],
      include: {
        warehouse: true,
        variant: {
          include: {
            product: {
              include: {
                category: true,
              },
            },
          },
        },
      },
    });
  }
}

export const inventoryRepository = new InventoryRepository();
