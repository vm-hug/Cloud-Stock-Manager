import { Request, Response, NextFunction } from 'express';
import { auditService, AuditService } from './audit.service';
import { AuditLogQueryInput } from './audit.schema';

export class AuditController {
  constructor(private service: AuditService = auditService) {}

  getAuditLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as unknown as AuditLogQueryInput;
      const result = await this.service.getAuditLogs(query);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const auditController = new AuditController();
