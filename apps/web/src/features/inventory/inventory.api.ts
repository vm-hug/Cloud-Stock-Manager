import {
  ApiResponse,
  ImportJob,
  InventoryBalance,
  StockDocStatus,
  StockDocType,
  StockDocument,
  StockMovement,
  Warehouse,
} from '@cloud-stock/shared';
import { api } from '../../lib/api';

export const inventoryApi = {
  // ========================================================
  // WAREHOUSES
  // ========================================================

  async getWarehouses(params?: {
    page?: number;
    limit?: number;
    search?: string;
    isActive?: boolean;
  }): Promise<ApiResponse<Warehouse[]> & { pagination?: any }> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', params.page.toString());
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.search) query.set('search', params.search);
    if (params?.isActive !== undefined) query.set('isActive', params.isActive.toString());

    const qs = query.toString() ? `?${query.toString()}` : '';
    return api.get<Warehouse[]>(`/v1/warehouses${qs}`);
  },

  async getWarehouseById(id: string): Promise<ApiResponse<Warehouse>> {
    return api.get<Warehouse>(`/v1/warehouses/${id}`);
  },

  async createWarehouse(data: { code: string; name: string }): Promise<ApiResponse<Warehouse>> {
    return api.post<Warehouse>('/v1/warehouses', data);
  },

  async updateWarehouse(
    id: string,
    data: { name?: string; code?: string }
  ): Promise<ApiResponse<Warehouse>> {
    return api.patch<Warehouse>(`/v1/warehouses/${id}`, data);
  },

  async updateWarehouseStatus(id: string, isActive: boolean): Promise<ApiResponse<Warehouse>> {
    return api.patch<Warehouse>(`/v1/warehouses/${id}/status`, { isActive });
  },

  // ========================================================
  // INVENTORY BALANCES & ALERTS
  // ========================================================

  async getBalances(params?: {
    page?: number;
    limit?: number;
    warehouseId?: string;
    categoryId?: string;
    search?: string;
    stockStatus?: 'OUT_OF_STOCK' | 'LOW_STOCK' | 'IN_STOCK';
  }): Promise<ApiResponse<InventoryBalance[]> & { pagination?: any }> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', params.page.toString());
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.warehouseId) query.set('warehouseId', params.warehouseId);
    if (params?.categoryId) query.set('categoryId', params.categoryId);
    if (params?.search) query.set('search', params.search);
    if (params?.stockStatus) query.set('stockStatus', params.stockStatus);

    const qs = query.toString() ? `?${query.toString()}` : '';
    return api.get<InventoryBalance[]>(`/v1/inventory/balances${qs}`);
  },

  async getBalance(warehouseId: string, variantId: string): Promise<ApiResponse<InventoryBalance>> {
    return api.get<InventoryBalance>(`/v1/inventory/balances/${warehouseId}/${variantId}`);
  },

  async updateThreshold(
    warehouseId: string,
    variantId: string,
    minThreshold: number
  ): Promise<ApiResponse<InventoryBalance>> {
    return api.patch<InventoryBalance>(`/v1/inventory/balances/${warehouseId}/${variantId}/threshold`, {
      minThreshold,
    });
  },

  async getLowStock(params?: {
    page?: number;
    limit?: number;
    warehouseId?: string;
    search?: string;
  }): Promise<ApiResponse<InventoryBalance[]> & { pagination?: any }> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', params.page.toString());
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.warehouseId) query.set('warehouseId', params.warehouseId);
    if (params?.search) query.set('search', params.search);

    const qs = query.toString() ? `?${query.toString()}` : '';
    return api.get<InventoryBalance[]>(`/v1/inventory/low-stock${qs}`);
  },

  // ========================================================
  // STOCK DOCUMENTS
  // ========================================================

  async getDocuments(params?: {
    page?: number;
    limit?: number;
    documentCode?: string;
    type?: StockDocType;
    status?: StockDocStatus;
    warehouseId?: string;
    createdById?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<StockDocument[]> & { pagination?: any }> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', params.page.toString());
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.documentCode) query.set('documentCode', params.documentCode);
    if (params?.type) query.set('type', params.type);
    if (params?.status) query.set('status', params.status);
    if (params?.warehouseId) query.set('warehouseId', params.warehouseId);
    if (params?.createdById) query.set('createdById', params.createdById);
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);

    const qs = query.toString() ? `?${query.toString()}` : '';
    return api.get<StockDocument[]>(`/v1/stock-documents${qs}`);
  },

  async getDocumentById(id: string): Promise<ApiResponse<StockDocument>> {
    return api.get<StockDocument>(`/v1/stock-documents/${id}`);
  },

  async createDocument(data: {
    type: StockDocType;
    sourceWarehouseId?: string | null;
    destinationWarehouseId?: string | null;
    note?: string | null;
    items: Array<{
      variantId: string;
      quantity: number;
      adjustmentDelta?: number;
      unitPrice?: number;
    }>;
  }): Promise<ApiResponse<StockDocument>> {
    return api.post<StockDocument>('/v1/stock-documents', data);
  },

  async updateDraftDocument(
    id: string,
    data: {
      sourceWarehouseId?: string | null;
      destinationWarehouseId?: string | null;
      note?: string | null;
      items?: Array<{
        variantId: string;
        quantity: number;
        adjustmentDelta?: number;
        unitPrice?: number;
      }>;
    }
  ): Promise<ApiResponse<StockDocument>> {
    return api.patch<StockDocument>(`/v1/stock-documents/${id}`, data);
  },

  async submitDocument(id: string): Promise<ApiResponse<StockDocument>> {
    return api.post<StockDocument>(`/v1/stock-documents/${id}/submit`);
  },

  async approveDocument(id: string): Promise<ApiResponse<StockDocument>> {
    return api.post<StockDocument>(`/v1/stock-documents/${id}/approve`);
  },

  async rejectDocument(id: string, reason?: string): Promise<ApiResponse<StockDocument>> {
    return api.post<StockDocument>(`/v1/stock-documents/${id}/reject`, { reason });
  },

  async cancelDocument(id: string): Promise<ApiResponse<StockDocument>> {
    return api.post<StockDocument>(`/v1/stock-documents/${id}/cancel`);
  },

  // ========================================================
  // STOCK MOVEMENTS
  // ========================================================

  async getMovements(params?: {
    page?: number;
    limit?: number;
    warehouseId?: string;
    variantId?: string;
    documentId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<StockMovement[]> & { pagination?: any }> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', params.page.toString());
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.warehouseId) query.set('warehouseId', params.warehouseId);
    if (params?.variantId) query.set('variantId', params.variantId);
    if (params?.documentId) query.set('documentId', params.documentId);
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);

    const qs = query.toString() ? `?${query.toString()}` : '';
    return api.get<StockMovement[]>(`/v1/inventory/movements${qs}`);
  },

  // ========================================================
  // INVENTORY EXPORT (Blob download)
  // ========================================================

  async downloadExport(params: {
    format: 'csv' | 'xlsx';
    warehouseId?: string;
    categoryId?: string;
    stockStatus?: string;
  }): Promise<void> {
    const query = new URLSearchParams();
    query.set('format', params.format);
    if (params.warehouseId) query.set('warehouseId', params.warehouseId);
    if (params.categoryId) query.set('categoryId', params.categoryId);
    if (params.stockStatus) query.set('stockStatus', params.stockStatus);

    const baseUrl = api.getBaseUrl();
    const token = api.getAccessToken();
    const response = await fetch(`${baseUrl}/v1/inventory/export?${query.toString()}`, {
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
      },
    });

    if (!response.ok) {
      throw new Error(`Export download failed with status ${response.status}`);
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-report-${new Date().toISOString().slice(0, 10)}.${params.format}`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  // ========================================================
  // IMPORTS & BACKGROUND JOBS
  // ========================================================

  async uploadImport(file: File): Promise<ApiResponse<ImportJob>> {
    const formData = new FormData();
    formData.append('file', file);

    const baseUrl = api.getBaseUrl();
    const token = api.getAccessToken();
    const response = await fetch(`${baseUrl}/v1/imports/products`, {
      method: 'POST',
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
      },
      body: formData,
    });

    return response.json();
  },

  async getImportJobs(params?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<ApiResponse<ImportJob[]> & { pagination?: any }> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', params.page.toString());
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.status) query.set('status', params.status);

    const qs = query.toString() ? `?${query.toString()}` : '';
    return api.get<ImportJob[]>(`/v1/imports${qs}`);
  },

  async getImportJobById(id: string): Promise<ApiResponse<ImportJob>> {
    return api.get<ImportJob>(`/v1/imports/${id}`);
  },

  async downloadImportTemplate(format: 'csv' | 'xlsx'): Promise<void> {
    const baseUrl = api.getBaseUrl();
    const token = api.getAccessToken();
    const response = await fetch(`${baseUrl}/v1/imports/template?format=${format}`, {
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
      },
    });

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `product-catalog-template.${format}`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  async downloadErrorReport(jobId: string): Promise<void> {
    const baseUrl = api.getBaseUrl();
    const token = api.getAccessToken();
    const response = await fetch(`${baseUrl}/v1/imports/${jobId}/errors`, {
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
      },
    });

    if (!response.ok) {
      throw new Error('No error report found for this job.');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `import-errors-${jobId}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
};
