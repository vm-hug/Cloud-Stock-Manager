import { api } from '../../lib/api';
import { ApiResponse, PaginatedResponse, AuditLogEntry } from '@cloud-stock/shared';

export interface AuditQueryParams {
  page?: number;
  limit?: number;
  action?: string;
  userId?: string;
  entityType?: string;
  startDate?: string;
  endDate?: string;
}

export const auditApi = {
  getAuditLogs: async (params: AuditQueryParams = {}): Promise<ApiResponse<PaginatedResponse<AuditLogEntry>>> => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', params.page.toString());
    if (params.limit) query.set('limit', params.limit.toString());
    if (params.action) query.set('action', params.action);
    if (params.userId) query.set('userId', params.userId);
    if (params.entityType) query.set('entityType', params.entityType);
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);

    const queryString = query.toString();
    return api.get<PaginatedResponse<AuditLogEntry>>(`/v1/audit-logs${queryString ? `?${queryString}` : ''}`);
  },
};
