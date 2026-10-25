import { api } from '../../lib/api';
import { ApiResponse, SystemHealthStatus } from '@cloud-stock/shared';

export const systemApi = {
  getHealth: async (): Promise<ApiResponse<SystemHealthStatus>> => {
    return api.get<SystemHealthStatus>('/v1/system/health');
  },
};
