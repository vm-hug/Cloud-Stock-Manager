import { prisma } from '../../config/db';

export class AuthRepository {
  async findUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  async findUserById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async updateUserLastLogin(id: string, date: Date) {
    return prisma.user.update({
      where: { id },
      data: { lastLoginAt: date },
    });
  }

  async createSession(data: {
    userId: string;
    tokenHash: string;
    family: string;
    expiresAt: Date;
    ipAddress?: string | null;
    userAgent?: string | null;
  }) {
    return prisma.refreshSession.create({
      data: {
        userId: data.userId,
        tokenHash: data.tokenHash,
        family: data.family,
        expiresAt: data.expiresAt,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });
  }

  async findSessionByTokenHash(tokenHash: string) {
    return prisma.refreshSession.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
          },
        },
      },
    });
  }

  async findSessionById(id: string) {
    return prisma.refreshSession.findUnique({
      where: { id },
    });
  }

  async rotateSessionToken(id: string, newTokenHash: string, newExpiresAt: Date) {
    return prisma.refreshSession.update({
      where: { id },
      data: {
        tokenHash: newTokenHash,
        expiresAt: newExpiresAt,
        lastUsedAt: new Date(),
      },
    });
  }

  async revokeSession(id: string) {
    return prisma.refreshSession.update({
      where: { id },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
      },
    });
  }

  async revokeFamily(family: string) {
    return prisma.refreshSession.updateMany({
      where: { family },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
      },
    });
  }

  async revokeAllUserSessions(userId: string) {
    return prisma.refreshSession.updateMany({
      where: {
        userId,
        isRevoked: false,
      },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
      },
    });
  }
}

export const authRepository = new AuthRepository();
