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

  // Phase 3 Catalog Audit Actions
  CREATE_CATEGORY = 'CREATE_CATEGORY',
  UPDATE_CATEGORY = 'UPDATE_CATEGORY',
  CHANGE_CATEGORY_STATUS = 'CHANGE_CATEGORY_STATUS',
  CREATE_PRODUCT = 'CREATE_PRODUCT',
  UPDATE_PRODUCT = 'UPDATE_PRODUCT',
  DELETE_PRODUCT = 'DELETE_PRODUCT',
  RESTORE_PRODUCT = 'RESTORE_PRODUCT',
  CREATE_VARIANT = 'CREATE_VARIANT',
  UPDATE_VARIANT = 'UPDATE_VARIANT',
  DELETE_VARIANT = 'DELETE_VARIANT',
  RESTORE_VARIANT = 'RESTORE_VARIANT',
  UPLOAD_PRODUCT_IMAGE = 'UPLOAD_PRODUCT_IMAGE',
  SET_PRIMARY_IMAGE = 'SET_PRIMARY_IMAGE',
  DELETE_PRODUCT_IMAGE = 'DELETE_PRODUCT_IMAGE',
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

// ========================================================
// Phase 3 Catalog & Media Domain Types
// ========================================================

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    products: number;
  };
}

export interface ProductImage {
  id: string;
  productId: string;
  url: string;
  publicId: string;
  altText: string | null;
  sortOrder: number;
  isPrimary: boolean;
  createdAt: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  name: string;
  price: string | number;
  costPrice?: string | number | null;
  attributes?: Record<string, string> | null;
  isActive: boolean;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  inventoryBalances?: Array<{
    warehouseId: string;
    quantity: number;
  }>;
}

export interface Product {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  category?: Category;
  images?: ProductImage[];
  variants?: ProductVariant[];
  _count?: {
    variants: number;
    images?: number;
  };
}

export interface CloudinarySignedParams {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
  publicId: string;
}

// --------------------------------------------------------
// DOMAIN DATA TRANSFER OBJECTS (DTOs)
// --------------------------------------------------------

export interface CategoryDto {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductImageDto {
  id: string;
  productId: string;
  url: string;
  publicId: string;
  altText?: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface ProductVariantDto {
  id: string;
  productId: string;
  sku: string;
  name: string;
  price: number;
  costPrice?: number | null;
  isActive: boolean;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductDto {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  description?: string | null;
  isActive: boolean;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  category?: CategoryDto;
  images?: ProductImageDto[];
  variants?: ProductVariantDto[];
}

export interface WarehouseDto {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryBalanceDto {
  warehouseId: string;
  variantId: string;
  quantity: number;
  minThreshold: number;
  updatedAt: string;
  warehouse?: WarehouseDto;
  variant?: ProductVariantDto;
}

export interface StockDocumentItemDto {
  id: string;
  documentId: string;
  variantId: string;
  quantity: number;
  unitPrice?: number | null;
  variant?: ProductVariantDto;
}

export interface StockDocumentDto {
  id: string;
  documentCode: string;
  type: StockDocType;
  status: StockDocStatus;
  sourceWarehouseId?: string | null;
  destinationWarehouseId?: string | null;
  note?: string | null;
  createdById: string;
  approvedById?: string | null;
  approvedAt?: string | null;
  postedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  items?: StockDocumentItemDto[];
  sourceWarehouse?: WarehouseDto;
  destinationWarehouse?: WarehouseDto;
}

export interface StockMovementDto {
  id: string;
  documentItemId: string;
  warehouseId: string;
  variantId: string;
  delta: number;
  quantityBefore: number;
  quantityAfter: number;
  createdAt: string;
  warehouse?: WarehouseDto;
  variant?: ProductVariantDto;
}
