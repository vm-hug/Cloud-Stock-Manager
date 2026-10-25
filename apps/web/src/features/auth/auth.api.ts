import { api } from '../../lib/api';
import { ApiResponse, AuthResponse, UserProfile } from '@cloud-stock/shared';

export const authApi = {
  login: async (email: string, passwordPlain: string): Promise<ApiResponse<AuthResponse>> => {
    const res = await api.post<AuthResponse>('/v1/auth/login', {
      email,
      password: passwordPlain,
    });
    if (res.success && res.data?.accessToken) {
      api.setAccessToken(res.data.accessToken);
    }
    return res;
  },

  refresh: async (): Promise<ApiResponse<AuthResponse>> => {
    const res = await api.post<AuthResponse>('/v1/auth/refresh');
    if (res.success && res.data?.accessToken) {
      api.setAccessToken(res.data.accessToken);
    }
    return res;
  },

  logout: async (): Promise<ApiResponse<void>> => {
    const res = await api.post<void>('/v1/auth/logout');
    api.setAccessToken(null);
    return res;
  },

  logoutAll: async (): Promise<ApiResponse<void>> => {
    const res = await api.post<void>('/v1/auth/logout-all');
    api.setAccessToken(null);
    return res;
  },

  getMe: async (): Promise<ApiResponse<UserProfile>> => {
    return api.get<UserProfile>('/v1/auth/me');
  },
};
