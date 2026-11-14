import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import { importsRepository, ImportsRepository } from './imports.repository';
import { enqueueProductImport } from '../../jobs/import.queue';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../common/errors/appError';
import { auditService } from '../audit/audit.service';
import { AuditAction, Role } from '@cloud-stock/shared';
import { ImportQueryInput } from './imports.schema';

export class ImportsService {
  constructor(private repo: ImportsRepository = importsRepository) {}

  async createProductImport(
    file: Express.Multer.File,
    actorId: string,
    ipAddress?: string
  ) {
    if (!file) {
      throw new BadRequestError('No import file uploaded. Please upload a .csv or .xlsx file.');
    }

    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.csv' && ext !== '.xlsx') {
      throw new BadRequestError('Invalid file type. Only .csv and .xlsx files are supported.');
    }

    // Ensure uploads directory exists
    const uploadsDir = path.resolve(process.cwd(), 'uploads/imports');
    fs.mkdirSync(uploadsDir, { recursive: true });

    // Store file with unique timestamp
    const uniqueFilename = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const destinationPath = path.join(uploadsDir, uniqueFilename);
    fs.writeFileSync(destinationPath, file.buffer);

    // Create DB record
    const job = await this.repo.createJob({
      createdById: actorId,
      originalFilename: file.originalname,
    });

    // Enqueue to BullMQ
    try {
      await enqueueProductImport({
        importJobId: job.id,
        filePath: destinationPath,
        originalFilename: file.originalname,
        actorId,
      });
    } catch (queueErr: any) {
      console.error('Failed to enqueue BullMQ import job:', queueErr.message);
      // Even if redis enqueue fails, the record is in DB
    }

    await auditService.recordLog({
      actorId,
      action: AuditAction.CREATE_IMPORT_JOB,
      entityType: 'ImportJob',
      entityId: job.id,
      metadata: { originalFilename: file.originalname, sizeBytes: file.size },
      ipAddress,
    });

    return job;
  }

  async getImportJobs(query: ImportQueryInput, actorId: string, actorRole: Role) {
    const isStaff = actorRole === Role.STAFF;
    return this.repo.findJobs(query, actorId, isStaff);
  }

  async getImportJobById(id: string, actorId: string, actorRole: Role) {
    const job = await this.repo.findJobById(id);
    if (!job) {
      throw new NotFoundError('Import job not found.');
    }

    if (actorRole === Role.STAFF && job.createdById !== actorId) {
      throw new ForbiddenError('Staff members may only inspect their own import jobs.');
    }

    return job;
  }

  async getErrorReportFile(id: string, actorId: string, actorRole: Role): Promise<string> {
    const job = await this.getImportJobById(id, actorId, actorRole);

    const errorFilePath = path.resolve(process.cwd(), 'uploads/imports/errors', `errors-${job.id}.csv`);
    if (!fs.existsSync(errorFilePath)) {
      throw new NotFoundError('Error report file does not exist for this import job.');
    }

    return errorFilePath;
  }

  async generateSampleTemplate(format: 'csv' | 'xlsx'): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Product Catalog Template');

    worksheet.columns = [
      { header: 'productName', key: 'productName', width: 28 },
      { header: 'categorySlug', key: 'categorySlug', width: 20 },
      { header: 'sku', key: 'sku', width: 18 },
      { header: 'variantName', key: 'variantName', width: 24 },
      { header: 'sellingPrice', key: 'sellingPrice', width: 14 },
      { header: 'costPrice', key: 'costPrice', width: 14 },
      { header: 'attributes', key: 'attributes', width: 25 },
      { header: 'isActive', key: 'isActive', width: 10 },
    ];

    worksheet.addRow({
      productName: 'Industrial IoT Beacon',
      categorySlug: 'electronics',
      sku: 'IOT-BCN-01',
      variantName: 'Beacon Bluetooth Standard',
      sellingPrice: 45.0,
      costPrice: 28.0,
      attributes: '{"range": "50m", "battery": "CR2477"}',
      isActive: true,
    });

    worksheet.addRow({
      productName: 'Industrial IoT Beacon',
      categorySlug: 'electronics',
      sku: 'IOT-BCN-02',
      variantName: 'Beacon Long Range (IP67)',
      sellingPrice: 75.0,
      costPrice: 48.0,
      attributes: '{"range": "200m", "battery": "D-Cell"}',
      isActive: true,
    });

    worksheet.getRow(1).font = { bold: true };

    if (format === 'xlsx') {
      const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
      return {
        buffer,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        filename: 'product-catalog-import-template.xlsx',
      };
    } else {
      const buffer = (await workbook.csv.writeBuffer()) as unknown as Buffer;
      return {
        buffer,
        contentType: 'text/csv; charset=utf-8',
        filename: 'product-catalog-import-template.csv',
      };
    }
  }
}

export const importsService = new ImportsService();
