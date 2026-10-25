import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env';
import { Role } from '@cloud-stock/shared';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: Role;
  name: string;
  sessionId: string;
}

export interface RefreshTokenPayload {
  sub: string;
  sessionId: string;
  family: string;
}

export const ACCESS_TOKEN_EXPIRY = '15m';
export const ACCESS_TOKEN_EXPIRY_MS = 15 * 60 * 1000;
export const REFRESH_TOKEN_EXPIRY = '7d';
export const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

export function signAccessToken(payload: AccessTokenPayload, options?: SignOptions): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
    algorithm: 'HS256',
    ...options,
  });
}

export function signRefreshToken(payload: RefreshTokenPayload, options?: SignOptions): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
    algorithm: 'HS256',
    ...options,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, {
    algorithms: ['HS256'],
  }) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET, {
    algorithms: ['HS256'],
  }) as RefreshTokenPayload;
}
