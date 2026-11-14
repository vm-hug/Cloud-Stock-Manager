import { api } from '../../lib/api';
import { ApiResponse, PaginatedResponse, UserProfile, Role } from '@cloud-stock/shared';

export interface UserQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: Role;
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const usersApi = {
  getUsers: async (params: UserQueryParams = {}): Promise<ApiResponse<PaginatedResponse<UserProfile>>> => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', params.page.toString());
    if (params.limit) query.set('limit', params.limit.toString());
    if (params.search) query.set('search', params.search);
    if (params.role) query.set('role', params.role);
    if (params.isActive !== undefined) query.set('isActive', params.isActive.toString());
    if (params.sortBy) query.set('sortBy', params.sortBy);
    if (params.sortOrder) query.set('sortOrder', params.sortOrder);

    const queryString = query.toString();
    return api.get<PaginatedResponse<UserProfile>>(`/v1/users${queryString ? `?${queryString}` : ''}`);
  },

  getUserById: async (id: string): Promise<ApiResponse<UserProfile>> => {
    return api.get<UserProfile>(`/v1/users/${id}`);
  },

  createUser: async (data: {
    name: string;
    email: string;
    password: string;
    role: Role;
  }): Promise<ApiResponse<UserProfile>> => {
    return api.post<UserProfile>('/v1/users', data);
  },

  updateUser: async (id: string, data: { name: string }): Promise<ApiResponse<UserProfile>> => {
    return api.patch<UserProfile>(`/v1/users/${id}`, data);
  },

  changeUserRole: async (id: string, role: Role): Promise<ApiResponse<UserProfile>> => {
    return api.patch<UserProfile>(`/v1/users/${id}/role`, { role });
  },

  changeUserStatus: async (id: string, isActive: boolean): Promise<ApiResponse<UserProfile>> => {
    return api.patch<UserProfile>(`/v1/users/${id}/status`, { isActive });
  },

  resetUserPassword: async (id: string, password: string): Promise<ApiResponse<{ message: string }>> => {
    return api.patch<{ message: string }>(`/v1/users/${id}/password`, { password });
  },
};
