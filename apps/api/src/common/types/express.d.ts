import { Role } from '@cloud-stock/shared';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
  name: string;
  sessionId?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
