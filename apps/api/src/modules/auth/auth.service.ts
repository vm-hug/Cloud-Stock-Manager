import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { authRepository, AuthRepository } from './auth.repository';
import { auditService } from '../audit/audit.service';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  ACCESS_TOKEN_EXPIRY_MS,
  REFRESH_TOKEN_EXPIRY_MS,
} from '../../common/utils/jwt';
import { hashToken } from '../../common/utils/crypto';
import { UnauthorizedError } from '../../common/errors/appError';
import { AuditAction, Role } from '@cloud-stock/shared';

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    name: string;
    email: string;
    role: Role;
    isActive: boolean;
    lastLoginAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
}

export class AuthService {
  constructor(private repo: AuthRepository = authRepository) {}

  async login(
    email: string,
    passwordPlain: string,
    ipAddress?: string | null,
    userAgent?: string | null
  ): Promise<LoginResult> {
    const user = await this.repo.findUserByEmail(email);

    if (!user) {
      await auditService.recordLog({
        action: AuditAction.LOGIN_FAILED,
        entityType: 'USER',
        entityId: 'UNKNOWN',
        metadata: { attemptedEmail: email, reason: 'USER_NOT_FOUND' },
        ipAddress,
      });
      throw new UnauthorizedError('Invalid email or password');
    }

    if (!user.isActive) {
      await auditService.recordLog({
        actorId: user.id,
        action: AuditAction.LOGIN_FAILED,
        entityType: 'USER',
        entityId: user.id,
        metadata: { reason: 'ACCOUNT_INACTIVE' },
        ipAddress,
      });
      throw new UnauthorizedError('Account is inactive. Please contact your system administrator.');
    }

    const isMatch = await bcrypt.compare(passwordPlain, user.passwordHash);
    if (!isMatch) {
      await auditService.recordLog({
        actorId: user.id,
        action: AuditAction.LOGIN_FAILED,
        entityType: 'USER',
        entityId: user.id,
        metadata: { reason: 'PASSWORD_MISMATCH' },
        ipAddress,
      });
      throw new UnauthorizedError('Invalid email or password');
    }

    // 1. Create a session in Database
    const family = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);

    // Initial placeholder hash that will be immediately updated or created with known ID
    const initialTokenId = crypto.randomUUID();
    const refreshToken = signRefreshToken({
      sub: user.id,
      sessionId: initialTokenId,
      family,
    });
    const tokenHash = hashToken(refreshToken);

    const session = await this.repo.createSession({
      userId: user.id,
      tokenHash,
      family,
      expiresAt,
      ipAddress,
      userAgent,
    });

    // 2. Sign Access Token
    const accessToken = signAccessToken({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role as unknown as Role,
      sessionId: session.id,
    });

    // 3. Update last login timestamp
    const now = new Date();
    await this.repo.updateUserLastLogin(user.id, now);

    // 4. Record Audit Log
    await auditService.recordLog({
      actorId: user.id,
      action: AuditAction.LOGIN_SUCCESS,
      entityType: 'USER',
      entityId: user.id,
      metadata: { sessionId: session.id, userAgent },
      ipAddress,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: Math.floor(ACCESS_TOKEN_EXPIRY_MS / 1000),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role as unknown as Role,
        isActive: user.isActive,
        lastLoginAt: now.toISOString(),
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
    };
  }

  async refresh(
    rawRefreshToken: string,
    ipAddress?: string | null,
    userAgent?: string | null
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number; user: LoginResult['user'] }> {
    let payload;
    try {
      payload = verifyRefreshToken(rawRefreshToken);
    } catch {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const tokenHash = hashToken(rawRefreshToken);
    const session = await this.repo.findSessionByTokenHash(tokenHash);

    // REUSE DETECTION: If token signature is valid but hash is not found OR session is already revoked
    if (!session || session.isRevoked) {
      const familyToRevoke = session?.family || payload.family;
      if (familyToRevoke) {
        // Revoke the entire family because token reuse has been detected!
        await this.repo.revokeFamily(familyToRevoke);
      }
      await auditService.recordLog({
        actorId: payload.sub,
        action: AuditAction.REFRESH_TOKEN_REVOKED,
        entityType: 'REFRESH_SESSION',
        entityId: payload.sessionId || 'UNKNOWN',
        metadata: { reason: 'TOKEN_REUSE_DETECTED', family: familyToRevoke },
        ipAddress,
      });
      throw new UnauthorizedError('Session has been revoked due to reuse detection');
    }

    // Check expiration
    if (session.expiresAt < new Date()) {
      await this.repo.revokeSession(session.id);
      throw new UnauthorizedError('Refresh token expired');
    }

    // Check user active status
    if (!session.user.isActive) {
      await this.repo.revokeAllUserSessions(session.user.id);
      throw new UnauthorizedError('Account is inactive');
    }

    // Rotate token: Generate new token and update hash atomically
    const newExpiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);
    const newRefreshToken = signRefreshToken({
      sub: session.user.id,
      sessionId: session.id,
      family: session.family,
    });
    const newTokenHash = hashToken(newRefreshToken);

    await this.repo.rotateSessionToken(session.id, newTokenHash, newExpiresAt);

    // Issue new access token
    const newAccessToken = signAccessToken({
      sub: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role as unknown as Role,
      sessionId: session.id,
    });

    const fullUser = await this.repo.findUserById(session.user.id);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: Math.floor(ACCESS_TOKEN_EXPIRY_MS / 1000),
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: session.user.role as unknown as Role,
        isActive: session.user.isActive,
        lastLoginAt: fullUser?.lastLoginAt?.toISOString() || null,
        createdAt: fullUser?.createdAt.toISOString() || new Date().toISOString(),
        updatedAt: fullUser?.updatedAt.toISOString() || new Date().toISOString(),
      },
    };
  }

  async logout(rawRefreshToken?: string, userId?: string, ipAddress?: string | null): Promise<void> {
    if (rawRefreshToken) {
      try {
        const tokenHash = hashToken(rawRefreshToken);
        const session = await this.repo.findSessionByTokenHash(tokenHash);
        if (session && !session.isRevoked) {
          await this.repo.revokeSession(session.id);
          await auditService.recordLog({
            actorId: session.userId,
            action: AuditAction.LOGOUT,
            entityType: 'REFRESH_SESSION',
            entityId: session.id,
            ipAddress,
          });
          return;
        }
      } catch {
        // Silently proceed
      }
    }

    if (userId) {
      await auditService.recordLog({
        actorId: userId,
        action: AuditAction.LOGOUT,
        entityType: 'USER',
        entityId: userId,
        ipAddress,
      });
    }
  }

  async logoutAll(userId: string, ipAddress?: string | null): Promise<void> {
    await this.repo.revokeAllUserSessions(userId);
    await auditService.recordLog({
      actorId: userId,
      action: AuditAction.LOGOUT,
      entityType: 'USER',
      entityId: userId,
      metadata: { scope: 'ALL_DEVICES' },
      ipAddress,
    });
  }

  async getMe(userId: string) {
    const user = await this.repo.findUserById(userId);
    if (!user) {
      throw new UnauthorizedError('User not found');
    }
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}

export const authService = new AuthService();
