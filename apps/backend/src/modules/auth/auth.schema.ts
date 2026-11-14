import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Please provide a valid email address'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters long'),
});

export const confirmAvatarSchema = z.object({
  publicId: z.string().trim().min(1, 'publicId is required').max(300),
  url: z
    .string()
    .trim()
    .url('Valid avatar URL is required')
    .refine(
      (val) => val.startsWith('https://') || val.startsWith('http://'),
      'Avatar URL must use HTTP or HTTPS'
    ),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ConfirmAvatarInput = z.infer<typeof confirmAvatarSchema>;
