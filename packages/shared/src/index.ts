/**
 * Shared constants, enums, and types for Cloud Stock Management
 */

// User & RBAC Roles
export enum Role {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  STAFF = 'STAFF',
}

// Stock Document Types
export enum StockDocType {
  INBOUND = 'INBOUND',
  OUTBOUND = 'OUTBOUND',
  ADJUSTMENT = 'ADJUSTMENT',
  TRANSFER = 'TRANSFER',
}

// Stock Document Statuses
export enum StockDocStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  POSTED = 'POSTED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

// Import Job Statuses
export enum ImportJobStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

// Audit Action Types
export enum AuditAction {
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILED = 'LOGIN_FAILED',
  LOGOUT = 'LOGOUT',
  REFRESH_TOKEN_REVOKED = 'REFRESH_TOKEN_REVOKED',
  CREATE_USER = 'CREATE_USER',
  UPDATE_USER = 'UPDATE_USER',
  CHANGE_USER_ROLE = 'CHANGE_USER_ROLE',
  ACTIVATE_USER = 'ACTIVATE_USER',
  DEACTIVATE_USER = 'DEACTIVATE_USER',
  RESET_USER_PASSWORD = 'RESET_USER_PASSWORD',
}

// Standard API Response Envelope
export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// Pagination Meta
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMeta;
}

// User Profile representation
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Auth Types
export interface AuthResponse {
  accessToken: string;
  expiresIn: number;
  user: UserProfile;
}

// Audit Log Entry
export interface AuditLogEntry {
  id: string;
  actorId: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  createdAt: string;
}

// System Health Status
export interface SystemHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptimeSeconds: number;
  timestamp: string;
  environment: string;
  database: {
    status: 'up' | 'down';
    latencyMs: number;
  };
  redis: {
    status: 'up' | 'down';
    latencyMs: number;
  };
  memory: {
    heapUsedMb: number;
    heapTotalMb: number;
    rssMb: number;
  };
}
