import {
  ApiResponse,
  Category,
  CloudinarySignedParams,
  Product,
  ProductImage,
  ProductVariant,
} from '@cloud-stock/shared';
import { api } from '../../lib/api';

export const catalogApi = {
  // ========================================================
  // CATEGORIES
  // ========================================================

  async getCategories(params?: {
    page?: number;
    limit?: number;
    search?: string;
    isActive?: boolean;
  }): Promise<ApiResponse<Category[]> & { pagination?: any }> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', params.page.toString());
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.search) query.set('search', params.search);
    if (params?.isActive !== undefined) query.set('isActive', params.isActive.toString());

    const qs = query.toString() ? `?${query.toString()}` : '';
    return api.get<Category[]>(`/v1/categories${qs}`);
  },

  async getCategoryById(id: string): Promise<ApiResponse<Category>> {
    return api.get<Category>(`/v1/categories/${id}`);
  },

  async createCategory(data: {
    name: string;
    slug?: string;
    description?: string | null;
    isActive?: boolean;
  }): Promise<ApiResponse<Category>> {
    return api.post<Category>('/v1/categories', data);
  },

  async updateCategory(
    id: string,
    data: {
      name?: string;
      slug?: string;
      description?: string | null;
      isActive?: boolean;
    }
  ): Promise<ApiResponse<Category>> {
    return api.patch<Category>(`/v1/categories/${id}`, data);
  },

  async updateCategoryStatus(id: string, isActive: boolean): Promise<ApiResponse<Category>> {
    return api.patch<Category>(`/v1/categories/${id}/status`, { isActive });
  },

  // ========================================================
  // PRODUCTS
  // ========================================================

  async getProducts(params?: {
    page?: number;
    limit?: number;
    search?: string;
    categoryId?: string;
    isActive?: boolean;
    includeDeleted?: boolean;
    sortBy?: 'createdAt' | 'name';
    sortOrder?: 'asc' | 'desc';
  }): Promise<ApiResponse<Product[]> & { pagination?: any }> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', params.page.toString());
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.search) query.set('search', params.search);
    if (params?.categoryId) query.set('categoryId', params.categoryId);
    if (params?.isActive !== undefined) query.set('isActive', params.isActive.toString());
    if (params?.includeDeleted) query.set('includeDeleted', 'true');
    if (params?.sortBy) query.set('sortBy', params.sortBy);
    if (params?.sortOrder) query.set('sortOrder', params.sortOrder);

    const qs = query.toString() ? `?${query.toString()}` : '';
    return api.get<Product[]>(`/v1/products${qs}`);
  },

  async getProductById(id: string): Promise<ApiResponse<Product>> {
    return api.get<Product>(`/v1/products/${id}`);
  },

  async createProduct(data: {
    name: string;
    categoryId: string;
    description?: string | null;
    slug?: string;
    isActive?: boolean;
  }): Promise<ApiResponse<Product>> {
    return api.post<Product>('/v1/products', data);
  },

  async updateProduct(
    id: string,
    data: {
      name?: string;
      categoryId?: string;
      description?: string | null;
      slug?: string;
      isActive?: boolean;
    }
  ): Promise<ApiResponse<Product>> {
    return api.patch<Product>(`/v1/products/${id}`, data);
  },

  async softDeleteProduct(id: string): Promise<ApiResponse<Product>> {
    return api.delete<Product>(`/v1/products/${id}`);
  },

  async restoreProduct(id: string): Promise<ApiResponse<Product>> {
    return api.patch<Product>(`/v1/products/${id}/restore`);
  },

  // ========================================================
  // VARIANTS
  // ========================================================

  async getVariants(productId: string): Promise<ApiResponse<ProductVariant[]>> {
    return api.get<ProductVariant[]>(`/v1/products/${productId}/variants`);
  },

  async getVariantById(id: string): Promise<ApiResponse<ProductVariant>> {
    return api.get<ProductVariant>(`/v1/variants/${id}`);
  },

  async createVariant(
    productId: string,
    data: {
      sku: string;
      name: string;
      price: number;
      costPrice?: number | null;
      attributes?: Record<string, string>;
      isActive?: boolean;
    }
  ): Promise<ApiResponse<ProductVariant>> {
    return api.post<ProductVariant>(`/v1/products/${productId}/variants`, data);
  },

  async updateVariant(
    id: string,
    data: {
      sku?: string;
      name?: string;
      price?: number;
      costPrice?: number | null;
      attributes?: Record<string, string>;
      isActive?: boolean;
    }
  ): Promise<ApiResponse<ProductVariant>> {
    return api.patch<ProductVariant>(`/v1/variants/${id}`, data);
  },

  async softDeleteVariant(id: string): Promise<ApiResponse<ProductVariant>> {
    return api.delete<ProductVariant>(`/v1/variants/${id}`);
  },

  async restoreVariant(id: string): Promise<ApiResponse<ProductVariant>> {
    return api.patch<ProductVariant>(`/v1/variants/${id}/restore`);
  },

  // ========================================================
  // PRODUCT IMAGES & CLOUDINARY
  // ========================================================

  async getImages(productId: string): Promise<ApiResponse<ProductImage[]>> {
    return api.get<ProductImage[]>(`/v1/products/${productId}/images`);
  },

  async requestUploadSignature(productId: string): Promise<ApiResponse<CloudinarySignedParams>> {
    return api.post<CloudinarySignedParams>(`/v1/products/${productId}/images/sign`);
  },

  async confirmImage(
    productId: string,
    data: {
      publicId: string;
      url: string;
      altText?: string | null;
      sortOrder?: number;
      isPrimary?: boolean;
    }
  ): Promise<ApiResponse<ProductImage>> {
    return api.post<ProductImage>(`/v1/products/${productId}/images/confirm`, data);
  },

  async updateImage(
    productId: string,
    imageId: string,
    data: {
      altText?: string | null;
      sortOrder?: number;
    }
  ): Promise<ApiResponse<ProductImage>> {
    return api.patch<ProductImage>(`/v1/products/${productId}/images/${imageId}`, data);
  },

  async setPrimaryImage(productId: string, imageId: string): Promise<ApiResponse<ProductImage>> {
    return api.patch<ProductImage>(`/v1/products/${productId}/images/${imageId}/primary`);
  },

  async deleteImage(productId: string, imageId: string): Promise<ApiResponse<{ message: string }>> {
    return api.delete<{ message: string }>(`/v1/products/${productId}/images/${imageId}`);
  },

  /**
   * Performs direct signed upload to Cloudinary CDN from the browser
   */
  async uploadToCloudinary(
    file: File,
    signedParams: CloudinarySignedParams
  ): Promise<{ publicId: string; url: string }> {
    // If running in development sandbox with unconfigured Cloudinary, handle fallback gracefully
    if (signedParams.cloudName === 'mock_cloud' || !signedParams.apiKey) {
      return {
        publicId: signedParams.publicId,
        url: URL.createObjectURL(file),
      };
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', signedParams.apiKey);
    formData.append('timestamp', signedParams.timestamp.toString());
    formData.append('signature', signedParams.signature);
    formData.append('folder', signedParams.folder);
    formData.append('public_id', signedParams.publicId);

    const uploadUrl = `https://api.cloudinary.com/v1_1/${signedParams.cloudName}/image/upload`;
    const res = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      throw new Error(errorData?.error?.message || 'Failed to upload image to Cloudinary CDN');
    }

    const json = await res.json();
    return {
      publicId: json.public_id,
      url: json.secure_url || json.url,
    };
  },
};
