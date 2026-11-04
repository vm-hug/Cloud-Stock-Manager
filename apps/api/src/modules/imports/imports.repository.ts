import { Prisma, ImportJobStatus } from '@prisma/client';
import { prisma } from '../../config/db';
import { ImportQueryInput } from './imports.schema';

export class ImportsRepository {
  async createJob(data: { createdById: string; originalFilename: string }) {
    return prisma.importJob.create({
      data: {
        createdById: data.createdById,
        originalFilename: data.originalFilename,
        status: ImportJobStatus.PENDING,
      },
    });
  }

  async findJobById(id: string) {
    return prisma.importJob.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  async findJobs(query: ImportQueryInput, actorId?: string, isStaff: boolean = false) {
    const { status, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ImportJobWhereInput = {};
    if (status) {
      where.status = status;
    }
    // If staff, only show their own jobs
    if (isStaff && actorId) {
      where.createdById = actorId;
    }

    const [items, total] = await Promise.all([
      prisma.importJob.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      prisma.importJob.count({ where }),
    ]);

    return { items, total };
  }
}

export const importsRepository = new ImportsRepository();
