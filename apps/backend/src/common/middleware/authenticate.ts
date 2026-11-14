import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { UnauthorizedError } from '../errors/appError';
import { prisma } from '../../config/db';
import { Role } from '@cloud-stock/shared';

export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Missing or malformed Authorization header'));
  }

  const token = authHeader.substring(7).trim();

  try {
    const payload = verifyAccessToken(token);

    // Verify session validity if sessionId is present
    if (payload.sessionId) {
      const session = await prisma.refreshSession.findUnique({
        where: { id: payload.sessionId },
        select: { id: true, isRevoked: true, expiresAt: true },
      });

      if (!session || session.isRevoked || session.expiresAt < new Date()) {
        return next(new UnauthorizedError('Session has been revoked or expired'));
      }
    }

    // Verify user is still active in database
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return next(new UnauthorizedError('Account is inactive or does not exist'));
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as unknown as Role,
      sessionId: payload.sessionId,
    };

    next();
  } catch (error) {
    if (error instanceof Error && (error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError')) {
      return next(new UnauthorizedError(`Invalid token: ${error.message}`));
    }
    next(error);
  }
}
