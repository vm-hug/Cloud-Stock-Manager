import bcrypt from 'bcrypt';
import { usersRepository, UsersRepository } from './users.repository';
import { authRepository, AuthRepository } from '../auth/auth.repository';
import { auditService } from '../audit/audit.service';
import {
  CreateUserInput,
  UpdateUserInput,
  ChangeUserRoleInput,
  ChangeUserStatusInput,
  ResetUserPasswordInput,
  UserQueryInput,
} from './users.schema';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '../../common/errors/appError';
import { AuditAction, Role } from '@cloud-stock/shared';

const BCRYPT_SALT_ROUNDS = 10;

export class UsersService {
  constructor(
    private repo: UsersRepository = usersRepository,
    private authRepo: AuthRepository = authRepository
  ) {}

  async getUsers(query: UserQueryInput) {
    return this.repo.findUsers(query);
  }

  async getUserById(id: string) {
    const user = await this.repo.findUserById(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return {
      ...user,
      lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  async createUser(actorId: string, input: CreateUserInput, ipAddress?: string | null) {
    // 1. Check unique email
    const existing = await this.repo.findUserByEmail(input.email);
    if (existing) {
      throw new ConflictError('A user with this email address already exists');
    }

    // 2. Hash password
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS);

    // 3. Create user
    const user = await this.repo.createUser({
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role as Role,
    });

    // 4. Record Audit Log
    await auditService.recordLog({
      actorId,
      action: AuditAction.CREATE_USER,
      entityType: 'USER',
      entityId: user.id,
      metadata: { name: user.name, email: user.email, role: user.role },
      ipAddress,
    });

    return {
      ...user,
      lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  async updateUser(actorId: string, targetUserId: string, input: UpdateUserInput, ipAddress?: string | null) {
    const user = await this.repo.findUserById(targetUserId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const updated = await this.repo.updateUser(targetUserId, {
      name: input.name,
    });

    await auditService.recordLog({
      actorId,
      action: AuditAction.UPDATE_USER,
      entityType: 'USER',
      entityId: targetUserId,
      metadata: { previousName: user.name, newName: input.name },
      ipAddress,
    });

    return {
      ...updated,
      lastLoginAt: updated.lastLoginAt ? updated.lastLoginAt.toISOString() : null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async changeUserRole(actorId: string, targetUserId: string, input: ChangeUserRoleInput, ipAddress?: string | null) {
    const user = await this.repo.findUserById(targetUserId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Protect last active administrator: Cannot demote the last admin
    if (user.role === 'ADMIN' && input.role !== 'ADMIN') {
      const activeAdminCount = await this.repo.countActiveAdmins();
      if (activeAdminCount <= 1) {
        throw new BadRequestError('Cannot change role: System requires at least one active Administrator');
      }
    }

    const updated = await this.repo.updateUser(targetUserId, {
      role: input.role as Role,
    });

    // Revoke all sessions on role change so user must re-authenticate with new permissions
    await this.authRepo.revokeAllUserSessions(targetUserId);

    await auditService.recordLog({
      actorId,
      action: AuditAction.CHANGE_USER_ROLE,
      entityType: 'USER',
      entityId: targetUserId,
      metadata: { previousRole: user.role, newRole: input.role },
      ipAddress,
    });

    return {
      ...updated,
      lastLoginAt: updated.lastLoginAt ? updated.lastLoginAt.toISOString() : null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async changeUserStatus(actorId: string, targetUserId: string, input: ChangeUserStatusInput, ipAddress?: string | null) {
    const user = await this.repo.findUserById(targetUserId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Protect last active administrator: Cannot deactivate the last admin
    if (!input.isActive && user.role === 'ADMIN' && user.isActive) {
      const activeAdminCount = await this.repo.countActiveAdmins();
      if (activeAdminCount <= 1) {
        throw new BadRequestError('Cannot deactivate the last active Administrator in the system');
      }
    }

    const updated = await this.repo.updateUser(targetUserId, {
      isActive: input.isActive,
    });

    // If deactivating user, revoke all active sessions immediately
    if (!input.isActive) {
      await this.authRepo.revokeAllUserSessions(targetUserId);
    }

    const action = input.isActive ? AuditAction.ACTIVATE_USER : AuditAction.DEACTIVATE_USER;
    await auditService.recordLog({
      actorId,
      action,
      entityType: 'USER',
      entityId: targetUserId,
      metadata: { isActive: input.isActive },
      ipAddress,
    });

    return {
      ...updated,
      lastLoginAt: updated.lastLoginAt ? updated.lastLoginAt.toISOString() : null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async resetUserPassword(
    actorId: string,
    targetUserId: string,
    input: ResetUserPasswordInput,
    ipAddress?: string | null
  ) {
    const user = await this.repo.findUserById(targetUserId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS);

    await this.repo.updateUser(targetUserId, {
      passwordHash,
    });

    // Revoke all active sessions so user must log in with new password
    await this.authRepo.revokeAllUserSessions(targetUserId);

    await auditService.recordLog({
      actorId,
      action: AuditAction.RESET_USER_PASSWORD,
      entityType: 'USER',
      entityId: targetUserId,
      metadata: { targetEmail: user.email },
      ipAddress,
    });

    return {
      message: 'Password reset successfully. All existing sessions have been revoked.',
    };
  }
}

export const usersService = new UsersService();
