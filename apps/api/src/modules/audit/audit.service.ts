import { auditRepository, AuditRepository } from './audit.repository';
import { AuditLogQueryInput } from './audit.schema';

export class AuditService {
  constructor(private repo: AuditRepository = auditRepository) {}

  async recordLog(params: {
    actorId?: string | null;
    action: string;
    entityType: string;
    entityId: string;
    metadata?: Record<string, unknown> | null;
    ipAddress?: string | null;
  }) {
    // Sanitize metadata to never store passwords or secrets
    let sanitizedMetadata = params.metadata;
    if (sanitizedMetadata) {
      sanitizedMetadata = { ...sanitizedMetadata };
      const sensitiveKeys = ['password', 'passwordHash', 'token', 'secret', 'refreshToken'];
      for (const key of Object.keys(sanitizedMetadata)) {
        if (sensitiveKeys.some((s) => key.toLowerCase().includes(s.toLowerCase()))) {
          sanitizedMetadata[key] = '[REDACTED]';
        }
      }
    }

    try {
      return await this.repo.createLog({
        ...params,
        metadata: sanitizedMetadata,
      });
    } catch (err) {
      console.error('Failed to write audit log:', (err as Error).message);
    }
  }

  async getAuditLogs(query: AuditLogQueryInput) {
    return this.repo.findLogs(query);
  }
}

export const auditService = new AuditService();
