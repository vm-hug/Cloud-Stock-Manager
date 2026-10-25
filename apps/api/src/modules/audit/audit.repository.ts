import { prisma } from '../../config/db';
import { Prisma } from '@prisma/client';
import { AuditLogQueryInput } from './audit.schema';

export class AuditRepository {
  async createLog(data: {
    actorId?: string | null;
    action: string;
    entityType: string;
    entityId: string;
    metadata?: Record<string, unknown> | null;
    ipAddress?: string | null;
  }) {
    return prisma.auditLog.create({
      data: {
        actorId: data.actorId,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        metadata: data.metadata as Prisma.InputJsonValue,
        ipAddress: data.ipAddress,
      },
    });
  }

  async findLogs(query: AuditLogQueryInput) {
    const { page, limit, action, userId, entityType, startDate, endDate } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {};

    if (action) {
      where.action = action;
    }
    if (userId) {
      where.actorId = userId;
    }
    if (entityType) {
      where.entityType = entityType;
    }
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      items: items.map((log) => ({
        id: log.id,
        actorId: log.actorId,
        actorName: log.actor?.name || null,
        actorEmail: log.actor?.email || null,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        metadata: log.metadata as Record<string, unknown> | null,
        ipAddress: log.ipAddress,
        createdAt: log.createdAt.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }
}

export const auditRepository = new AuditRepository();
