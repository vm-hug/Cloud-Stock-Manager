import { z } from 'zod';
import { Role } from '@cloud-stock/shared';

const passwordComplexityRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&_\-#])[A-Za-z\d@$!%*?&_\-#]{8,}$/;

export const createUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Full name must have at least 2 characters')
    .max(100, 'Full name must not exceed 100 characters'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Please provide a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(
      passwordComplexityRegex,
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    ),
  role: z.nativeEnum(Role, {
    errorMap: () => ({ message: 'Role must be ADMIN, MANAGER, or STAFF' }),
  }),
});

export const updateUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Full name must have at least 2 characters')
    .max(100, 'Full name must not exceed 100 characters'),
});

export const changeUserRoleSchema = z.object({
  role: z.nativeEnum(Role, {
    errorMap: () => ({ message: 'Role must be ADMIN, MANAGER, or STAFF' }),
  }),
});

export const changeUserStatusSchema = z.object({
  isActive: z.boolean({
    required_error: 'isActive status boolean is required',
  }),
});

export const resetUserPasswordSchema = z.object({
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(
      passwordComplexityRegex,
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    ),
});

export const userQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  role: z.nativeEnum(Role).optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => (val === 'true' ? true : val === 'false' ? false : undefined)),
  sortBy: z.enum(['createdAt', 'name', 'email', 'lastLoginAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ChangeUserRoleInput = z.infer<typeof changeUserRoleSchema>;
export type ChangeUserStatusInput = z.infer<typeof changeUserStatusSchema>;
export type ResetUserPasswordInput = z.infer<typeof resetUserPasswordSchema>;
export type UserQueryInput = z.infer<typeof userQuerySchema>;
