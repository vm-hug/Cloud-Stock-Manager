/**
 * Centralized HTTP Client for Cloud Stock Management
 * Single source of truth for frontend network requests
 */

import { ApiResponse } from '@cloud-stock/shared';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
const TAB_ACCESS_TOKEN_KEY = 'cs_tab_access_token';
const TAB_REFRESH_TOKEN_KEY = 'cs_tab_refresh_token';

let inMemoryAccessToken: string | null = null;
let inMemoryRefreshToken: string | null = null;
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

function addRefreshSubscriber(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

export interface GlobalToastEventDetail {
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  durationMs?: number;
}

export function emitGlobalToast(detail: GlobalToastEventDetail): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<GlobalToastEventDetail>('cloudstock:toast', { detail }));
  }
}

export function localizeBackendErrorMessage(rawMessage: string): string {
  const lang =
    typeof window !== 'undefined' ? localStorage.getItem('cloud_stock_lang') || 'vi' : 'vi';
  if (lang !== 'vi') return rawMessage;

  // Insufficient stock: "Insufficient stock for SKU [KC-K2-RED-RGB] at warehouse [WH-XUANPHU]. Available: 5, Requested: 8."
  const insuffMatch = rawMessage.match(
    /Insufficient stock for SKU \[([^\]]+)\] at warehouse \[([^\]]+)\]\.\s*Available:\s*(\d+),\s*Requested:\s*(\d+)/i
  );
  if (insuffMatch) {
    const [, sku, wh, avail, req] = insuffMatch;
    return `Không đủ tồn kho cho mã SKU [${sku}] tại kho [${wh}]. Tồn khả dụng: ${avail}, Yêu cầu xuất: ${req}.`;
  }

  if (/Invalid email or password/i.test(rawMessage)) {
    return 'Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.';
  }

  if (/creator cannot approve their own/i.test(rawMessage)) {
    return 'Người tạo phiếu không được phép tự phê duyệt phiếu của chính mình.';
  }

  if (/Missing or malformed Authorization header/i.test(rawMessage)) {
    return 'Phiên đăng nhập đã hết hạn hoặc thiếu xác thực. Vui lòng đăng nhập lại.';
  }

  if (/Duplicate SKU\/variant is not allowed/i.test(rawMessage)) {
    return 'Không được phép chọn trùng mã SKU trên nhiều dòng trong cùng một phiếu kho.';
  }

  return rawMessage;
}

/**
 * Centralized HTTP client wrapping `fetch` with in-memory JWT attachment,
 * HttpOnly cookie credentials, and concurrent 401 refresh-token rotation.
 */
class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Returns the configured API base URL.
   *
   * @returns Base URL string (e.g., `http://localhost:5001/api`)
   */
  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public getSocketOrigin(): string {
    return this.baseUrl.replace(/\/api\/?$/, '');
  }

  /**
   * Returns the current in-memory JWT access token, if any.
   *
   * @returns Access token string or `null`
   */
  public getAccessToken(): string | null {
    if (inMemoryAccessToken) return inMemoryAccessToken;
    try {
      const saved = sessionStorage.getItem(TAB_ACCESS_TOKEN_KEY);
      if (saved) {
        inMemoryAccessToken = saved;
        return saved;
      }
    } catch {
      // Ignore storage read errors
    }
    return null;
  }

  /**
   * Updates the in-memory JWT access token used for `Authorization` headers
   * and syncs it with `sessionStorage` for the current browser tab.
   *
   * @param token - New access token or `null` to clear authentication state
   */
  public setAccessToken(token: string | null): void {
    inMemoryAccessToken = token;
    try {
      if (token) {
        sessionStorage.setItem(TAB_ACCESS_TOKEN_KEY, token);
      } else {
        sessionStorage.removeItem(TAB_ACCESS_TOKEN_KEY);
      }
    } catch {
      // Ignore storage write errors
    }
  }

  /**
   * Returns the current tab-scoped refresh token from memory or `sessionStorage`.
   *
   * @returns Refresh token string or `null`
   */
  public getRefreshToken(): string | null {
    if (inMemoryRefreshToken) return inMemoryRefreshToken;
    try {
      const saved = sessionStorage.getItem(TAB_REFRESH_TOKEN_KEY);
      if (saved) {
        inMemoryRefreshToken = saved;
        return saved;
      }
    } catch {
      // Ignore storage read errors
    }
    return null;
  }

  /**
   * Updates the tab-scoped refresh token in memory and `sessionStorage`.
   *
   * @param token - New refresh token or `null` to clear
   */
  public setRefreshToken(token: string | null): void {
    inMemoryRefreshToken = token;
    try {
      if (token) {
        sessionStorage.setItem(TAB_REFRESH_TOKEN_KEY, token);
      } else {
        sessionStorage.removeItem(TAB_REFRESH_TOKEN_KEY);
      }
    } catch {
      // Ignore storage write errors
    }
  }

  /**
   * Executes an HTTP request with automatic `401 Unauthorized` token refresh retry.
   *
   * @typeParam T - Expected `data` payload type in `ApiResponse<T>`
   * @param endpoint - Relative API endpoint path
   * @param options - Standard `fetch` request options
   * @param retryCount - Internal retry counter to prevent infinite refresh loops
   * @returns Normalized `ApiResponse<T>` envelope
   */
  private async request<T>(endpoint: string, options: RequestInit = {}, retryCount = 0): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const headers = new Headers(options.headers || {});

    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    const currentToken = this.getAccessToken();
    if (currentToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${currentToken}`);
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include',
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
            const tabRefresh = this.getRefreshToken();
            const refreshRes = await fetch(`${this.baseUrl}/v1/auth/refresh`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: tabRefresh ? JSON.stringify({ refreshToken: tabRefresh }) : undefined,
            });

            if (refreshRes.ok) {
              const refreshData = await refreshRes.json();
              const newToken = refreshData?.data?.accessToken;
              const newRefresh = refreshData?.data?.refreshToken;
              if (newToken) {
                this.setAccessToken(newToken);
                if (newRefresh) {
                  this.setRefreshToken(newRefresh);
                }
                isRefreshing = false;
                onRefreshed(newToken);
                const retryHeaders = new Headers(options.headers || {});
                retryHeaders.set('Authorization', `Bearer ${newToken}`);
                return this.request<T>(
                  endpoint,
                  { ...options, headers: retryHeaders },
                  retryCount + 1
                );
              }
            }
          } catch {
            // Refresh failed
          } finally {
            isRefreshing = false;
          }

          this.setAccessToken(null);
          this.setRefreshToken(null);
        } else {
          return new Promise<ApiResponse<T>>((resolve) => {
            addRefreshSubscriber((freshToken) => {
              const retryHeaders = new Headers(options.headers || {});
              retryHeaders.set('Authorization', `Bearer ${freshToken}`);
              resolve(
                this.request<T>(endpoint, { ...options, headers: retryHeaders }, retryCount + 1)
              );
            });
          });
        }
      }

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const rawErrMsg =
          data?.error?.message ||
          (typeof data?.message === 'string' ? data.message : '') ||
          response.statusText ||
          'Request failed';
        const localizedMsg = localizeBackendErrorMessage(rawErrMsg);

        const method = (options.method || 'GET').toUpperCase();
        const isSilentAuthProbe =
          endpoint.includes('/auth/refresh') || endpoint.includes('/auth/logout');

        if (method !== 'GET' && !isSilentAuthProbe) {
          emitGlobalToast({
            type: 'error',
            message: localizedMsg,
            durationMs: 3000,
          });
        }

        return {
          success: false,
          error: {
            code:
              data?.error?.code ||
              (typeof data?.error === 'string' ? data.error : `HTTP_${response.status}`),
            message: localizedMsg,
            details: data?.error?.details,
          },
        };
      }

      return data as ApiResponse<T>;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown network error';
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: msg,
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

  public patch<T>(
    endpoint: string,
    body?: unknown,
    options?: RequestInit
  ): Promise<ApiResponse<T>> {
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
