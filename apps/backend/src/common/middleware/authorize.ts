import { Request, Response, NextFunction } from 'express';
import { Role } from '@cloud-stock/shared';
import { ForbiddenError, UnauthorizedError } from '../errors/appError';

export function requireRoles(allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `Forbidden: Insufficient privileges. Required role: [${allowedRoles.join(', ')}]`
        )
      );
    }

    next();
  };
}
