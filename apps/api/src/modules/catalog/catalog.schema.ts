import { z } from 'zod';

// ========================================================
// Category Schemas
// ========================================================

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, 'Category name is required').max(100),
  slug: z.string().trim().max(120).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export const updateCategorySchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  slug: z.string().trim().max(120).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const updateCategoryStatusSchema = z.object({
  isActive: z.boolean({ required_error: 'isActive status boolean is required' }),
});

export const categoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().optional(),
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),
});

// ========================================================
// Product Schemas
// ========================================================

export const createProductSchema = z.object({
  name: z.string().trim().min(1, 'Product name is required').max(200),
  categoryId: z.string().uuid('Valid categoryId UUID is required'),
  description: z.string().trim().max(2000).optional().nullable(),
  slug: z.string().trim().max(220).optional(),
  isActive: z.boolean().optional().default(true),
});

export const updateProductSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  categoryId: z.string().uuid().optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  slug: z.string().trim().max(220).optional(),
  isActive: z.boolean().optional(),
});

export const productQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().optional(),
  categoryId: z.string().uuid().optional(),
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),
  includeDeleted: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => val === 'true'),
  sortBy: z.enum(['createdAt', 'name']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// ========================================================
// Product Variant Schemas
// ========================================================

export const createVariantSchema = z.object({
  sku: z.string().trim().min(2, 'SKU must be at least 2 characters').max(50),
  name: z.string().trim().min(1, 'Variant name is required').max(150),
  price: z.coerce
    .number()
    .min(0, 'Selling price must be non-negative')
    .refine((val) => !isNaN(val), 'Invalid selling price'),
  costPrice: z.coerce
    .number()
    .min(0, 'Cost price must be non-negative')
    .optional()
    .nullable(),
  attributes: z.record(z.string()).optional().default({}),
  isActive: z.boolean().optional().default(true),
});

export const updateVariantSchema = z.object({
  sku: z.string().trim().min(2).max(50).optional(),
  name: z.string().trim().min(1).max(150).optional(),
  price: z.coerce
    .number()
    .min(0, 'Selling price must be non-negative')
    .optional(),
  costPrice: z.coerce
    .number()
    .min(0, 'Cost price must be non-negative')
    .optional()
    .nullable(),
  attributes: z.record(z.string()).optional(),
  isActive: z.boolean().optional(),
});

// ========================================================
// Product Image Schemas
// ========================================================

export const confirmImageSchema = z.object({
  publicId: z.string().trim().min(1, 'Cloudinary publicId is required'),
  url: z.string().url('Valid image URL is required'),
  altText: z.string().trim().max(255).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).optional().default(0),
  isPrimary: z.boolean().optional().default(false),
});

export const updateImageSchema = z.object({
  altText: z.string().trim().max(255).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CategoryQueryInput = z.infer<typeof categoryQuerySchema>;

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductQueryInput = z.infer<typeof productQuerySchema>;

export type CreateVariantInput = z.infer<typeof createVariantSchema>;
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;

export type ConfirmImageInput = z.infer<typeof confirmImageSchema>;
export type UpdateImageInput = z.infer<typeof updateImageSchema>;
