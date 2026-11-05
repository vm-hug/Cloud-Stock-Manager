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

  // Phase 4 Warehouse, Inventory, Documents & Import Audit Actions
  CREATE_WAREHOUSE = 'CREATE_WAREHOUSE',
  UPDATE_WAREHOUSE = 'UPDATE_WAREHOUSE',
  CHANGE_WAREHOUSE_STATUS = 'CHANGE_WAREHOUSE_STATUS',
  UPDATE_STOCK_THRESHOLD = 'UPDATE_STOCK_THRESHOLD',
  CREATE_STOCK_DOCUMENT = 'CREATE_STOCK_DOCUMENT',
  UPDATE_STOCK_DOCUMENT = 'UPDATE_STOCK_DOCUMENT',
  SUBMIT_STOCK_DOCUMENT = 'SUBMIT_STOCK_DOCUMENT',
  APPROVE_STOCK_DOCUMENT = 'APPROVE_STOCK_DOCUMENT',
  REJECT_STOCK_DOCUMENT = 'REJECT_STOCK_DOCUMENT',
  CANCEL_STOCK_DOCUMENT = 'CANCEL_STOCK_DOCUMENT',
  POST_INBOUND = 'POST_INBOUND',
  POST_OUTBOUND = 'POST_OUTBOUND',
  POST_ADJUSTMENT = 'POST_ADJUSTMENT',
  POST_TRANSFER = 'POST_TRANSFER',
  CREATE_IMPORT_JOB = 'CREATE_IMPORT_JOB',
  COMPLETE_IMPORT_JOB = 'COMPLETE_IMPORT_JOB',
  FAIL_IMPORT_JOB = 'FAIL_IMPORT_JOB',

  // Phase 5 Cache & Performance Audit Actions
  CLEAR_CACHE = 'CLEAR_CACHE',
  RUN_BENCHMARK = 'RUN_BENCHMARK',
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
  product?: Product;
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

// ========================================================
// Phase 4 Warehouse & Inventory Management Domain Types
// ========================================================

export type StockStatus = 'OUT_OF_STOCK' | 'LOW_STOCK' | 'IN_STOCK';

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    inventoryBalances?: number;
    stockMovements?: number;
    sourceDocuments?: number;
    destinationDocuments?: number;
  };
}

export interface InventoryBalance {
  warehouseId: string;
  variantId: string;
  quantity: number;
  minThreshold: number;
  updatedAt: string;
  warehouse?: Warehouse;
  variant?: ProductVariant;
  stockStatus?: StockStatus;
}

export interface StockDocumentItem {
  id: string;
  documentId: string;
  variantId: string;
  quantity: number;
  adjustmentDelta?: number | null;
  unitPrice?: string | number | null;
  variant?: ProductVariant;
  stockMovements?: StockMovement[];
}

export interface StockDocument {
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
  createdBy?: UserProfile;
  approvedBy?: UserProfile | null;
  sourceWarehouse?: Warehouse | null;
  destinationWarehouse?: Warehouse | null;
  items?: StockDocumentItem[];
  _count?: {
    items?: number;
  };
}

export interface StockMovement {
  id: string;
  documentItemId: string;
  warehouseId: string;
  variantId: string;
  delta: number;
  quantityBefore: number;
  quantityAfter: number;
  createdAt: string;
  warehouse?: Warehouse;
  variant?: ProductVariant;
  documentItem?: {
    id: string;
    documentId: string;
    document?: {
      id: string;
      documentCode: string;
      type: StockDocType;
      status: StockDocStatus;
      createdById: string;
      approvedById?: string | null;
      createdBy?: { name: string; email: string };
      approvedBy?: { name: string; email: string } | null;
    };
  };
}

export interface ImportJob {
  id: string;
  createdById: string;
  status: ImportJobStatus;
  originalFilename: string;
  totalRows: number;
  processedRows: number;
  failedRows: number;
  errorReportUrl?: string | null;
  queueJobId?: string | null;
  createdAt: string;
  finishedAt?: string | null;
  createdBy?: {
    id: string;
    name: string;
    email: string;
  };
}

// ========================================================
// Phase 5 Search, Analytics, Performance & Cache Types
// ========================================================

export interface SearchProductsQuery {
  q?: string;
  categoryId?: string;
  warehouseId?: string;
  minPrice?: number;
  maxPrice?: number;
  stockStatus?: StockStatus;
  isActive?: boolean;
  createdFrom?: string;
  createdTo?: string;
  sortBy?: 'name' | 'createdAt' | 'price' | 'totalStock';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface ProductSearchVariantItem {
  id: string;
  sku: string;
  name: string;
  price: number;
  costPrice?: number | null; // Scrubbed / omitted for STAFF
  stockQuantity: number;
  stockStatus: StockStatus;
  attributes?: Record<string, string> | null;
}

export interface ProductSearchItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  categoryId: string;
  categoryName: string;
  isActive: boolean;
  createdAt: string;
  primaryImageUrl: string | null;
  minPrice: number;
  maxPrice: number;
  totalStock: number;
  stockStatus: StockStatus;
  variantsCount: number;
  variants: ProductSearchVariantItem[];
}

export interface ProductSearchResponse {
  items: ProductSearchItem[];
  pagination: PaginationMeta;
  meta: {
    searchDurationMs: number;
    cached: boolean;
    totalMatches: number;
  };
}

export interface AnalyticsSummary {
  totalProducts: number;
  totalVariants: number;
  totalWarehouses: number;
  totalStock: number;
  totalInventoryCostValue: number | null; // Scrubbed for STAFF
  totalRetailValue: number;
  nullCostPriceCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  pendingDocumentsCount: number;
  calculatedAt: string;
  cached?: boolean;
}

export interface CategoryDistributionItem {
  categoryId: string;
  categoryName: string;
  productCount: number;
  variantCount: number;
  totalStock: number;
  costValue?: number | null; // Scrubbed for STAFF
  retailValue: number;
}

export interface WarehouseDistributionItem {
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  skuCount: number;
  totalStock: number;
  costValue?: number | null; // Scrubbed for STAFF
  retailValue: number;
}

export interface StockTrendItem {
  date: string; // YYYY-MM-DD
  inboundQty: number;
  outboundQty: number;
  adjustmentQty: number;
  transferQty: number;
}

export interface TopStockedSkuItem {
  variantId: string;
  sku: string;
  variantName: string;
  productName: string;
  categoryName: string;
  price: number;
  totalStock: number;
  warehouseBreakdown: Array<{
    warehouseId: string;
    warehouseName: string;
    quantity: number;
  }>;
}

export interface LowStockAlertItem {
  variantId: string;
  sku: string;
  variantName: string;
  productName: string;
  categoryName: string;
  totalStock: number;
  minThreshold: number;
  deficit: number;
  alertLevel: 'OUT_OF_STOCK' | 'CRITICAL' | 'WARNING';
  warehouses: Array<{
    warehouseId: string;
    warehouseName: string;
    quantity: number;
    minThreshold: number;
  }>;
}

export interface InventoryValueBreakdown {
  totalCostValue: number;
  totalRetailValue: number;
  potentialGrossMargin: number;
  marginPercentage: number;
  breakdownByCategory: Array<{
    categoryId: string;
    categoryName: string;
    costValue: number;
    retailValue: number;
    marginPercentage: number;
  }>;
  breakdownByWarehouse: Array<{
    warehouseId: string;
    warehouseName: string;
    costValue: number;
    retailValue: number;
  }>;
}

export interface SystemPerformanceMetrics {
  cacheHits: number;
  cacheMisses: number;
  totalCacheRequests: number;
  hitRatePercentage: number;
  redisErrors: number;
  redisStatus: 'ready' | 'connecting' | 'reconnecting' | 'degraded' | 'offline';
  dbLatencyMs: number;
  redisLatencyMs: number;
  latencyStats: {
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
    avgMs: number;
    sampleCount: number;
  };
  uptimeSeconds: number;
  timestamp: string;
}


