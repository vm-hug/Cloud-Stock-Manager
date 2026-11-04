/**
 * Centralized HTTP Client for Cloud Stock Management
 * Single source of truth for frontend network requests
 */

import { ApiResponse } from '@cloud-stock/shared';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

let inMemoryAccessToken: string | null = null;
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

function addRefreshSubscriber(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public getAccessToken(): string | null {
    return inMemoryAccessToken;
  }

  public setAccessToken(token: string | null): void {
    inMemoryAccessToken = token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}, retryCount = 0): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const headers = new Headers(options.headers || {});

    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    // Attach in-memory JWT Access Token
    if (inMemoryAccessToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${inMemoryAccessToken}`);
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include', // Automatically send & receive HttpOnly cookies
      });

      // Handle 401 Unauthorized with automatic refresh token rotation
      if (
        response.status === 401 &&
        retryCount === 0 &&
        !endpoint.includes('/auth/login') &&
        !endpoint.includes('/auth/refresh')
      ) {
        if (!isRefreshing) {
          isRefreshing = true;
          try {
            const refreshRes = await fetch(`${this.baseUrl}/v1/auth/refresh`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
            });

            if (refreshRes.ok) {
              const refreshData = await refreshRes.json();
              const newToken = refreshData?.data?.accessToken;
              if (newToken) {
                this.setAccessToken(newToken);
                isRefreshing = false;
                onRefreshed(newToken);
                // Retry the original request with new token
                return this.request<T>(endpoint, options, retryCount + 1);
              }
            }
          } catch {
            // Refresh failed
          } finally {
            isRefreshing = false;
          }

          // If refresh failed, reset token and propagate 401
          this.setAccessToken(null);
        } else {
          // If already refreshing, wait for the token
          return new Promise<ApiResponse<T>>((resolve) => {
            addRefreshSubscriber(() => {
              resolve(this.request<T>(endpoint, options, retryCount + 1));
            });
          });
        }
      }

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        return {
          success: false,
          error: {
            code: data?.error?.code || `HTTP_${response.status}`,
            message: data?.error?.message || response.statusText || 'Request failed',
            details: data?.error?.details,
          },
        };
      }

      return data as ApiResponse<T>;
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Unknown network error',
        },
      };
    }
  }

  public get<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  public post<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  public put<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  public patch<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  public delete<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

export const api = new ApiClient(API_BASE_URL);
