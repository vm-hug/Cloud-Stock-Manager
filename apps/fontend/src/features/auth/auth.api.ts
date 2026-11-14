import { api } from '../../lib/api';
import { uploadToCloudinaryDirect } from '../../lib/cloudinary';
import {
  ApiResponse,
  AuthResponse,
  CloudinarySignedParams,
  UserProfile,
} from '@cloud-stock/shared';

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

  requestAvatarUploadSignature: async (): Promise<ApiResponse<CloudinarySignedParams>> => {
    return api.post<CloudinarySignedParams>('/v1/auth/me/avatar/sign');
  },

  uploadAvatarToCloudinary: async (
    file: File,
    signedParams: CloudinarySignedParams
  ): Promise<{ publicId: string; url: string }> => {
    return uploadToCloudinaryDirect(file, signedParams);
  },

  confirmAvatar: async (data: {
    publicId: string;
    url: string;
  }): Promise<ApiResponse<UserProfile>> => {
    return api.patch<UserProfile>('/v1/auth/me/avatar', data);
  },

  removeAvatar: async (): Promise<ApiResponse<UserProfile>> => {
    return api.delete<UserProfile>('/v1/auth/me/avatar');
  },
};
