import { Request, Response, NextFunction } from 'express';
import { importsService, ImportsService } from './imports.service';
import { ImportQueryInput } from './imports.schema';
import { Role } from '@cloud-stock/shared';

export class ImportsController {
  constructor(private service: ImportsService = importsService) {}

  uploadProductImport = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const file = req.file;
      const actorId = req.user!.id;
      const ipAddress = req.ip;

      const job = await this.service.createProductImport(file!, actorId, ipAddress);

      res.status(202).json({
        success: true,
        message: 'Product catalog import job queued for background processing.',
        data: job,
      });
    } catch (err) {
      next(err);
    }
  };

  getImportJobs = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query as unknown as ImportQueryInput;
      const actorId = req.user!.id;
      const actorRole = req.user!.role as Role;

      const { items, total } = await this.service.getImportJobs(query, actorId, actorRole);

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

  getImportJobById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const actorId = req.user!.id;
      const actorRole = req.user!.role as Role;

      const job = await this.service.getImportJobById(id, actorId, actorRole);

      res.status(200).json({
        success: true,
        data: job,
      });
    } catch (err) {
      next(err);
    }
  };

  downloadErrorReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const actorId = req.user!.id;
      const actorRole = req.user!.role as Role;

      const filePath = await this.service.getErrorReportFile(id, actorId, actorRole);

      res.download(filePath, `import-errors-${id}.csv`);
    } catch (err) {
      next(err);
    }
  };

  downloadTemplate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const format = (req.query.format as string) === 'xlsx' ? 'xlsx' : 'csv';
      const { buffer, contentType, filename } = await this.service.generateSampleTemplate(format);

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(buffer);
    } catch (err) {
      next(err);
    }
  };
}

export const importsController = new ImportsController();

