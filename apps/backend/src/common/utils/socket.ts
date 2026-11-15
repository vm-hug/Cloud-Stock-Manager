import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { verifyAccessToken } from './jwt';
import { env } from '../../config/env';
import { Role } from '@cloud-stock/shared';

export interface RealtimeNotificationPayload {
  id: string;
  type:
    | 'PENDING_APPROVAL'
    | 'DOCUMENT_APPROVED'
    | 'DOCUMENT_REJECTED'
    | 'LOW_STOCK_ALERT'
    | 'SYSTEM_INFO';
  titleVi: string;
  titleEn: string;
  messageVi: string;
  messageEn: string;
  documentId?: string;
  documentCode?: string;
  link: string;
  actorName?: string;
  createdAt: string;
}

export interface StockDocumentChangedPayload {
  action: 'CREATED' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  documentId: string;
  documentCode: string;
  status: string;
  docType?: string;
  createdById?: string;
  actorName?: string;
  reason?: string;
  timestamp: string;
}

class SocketHub {
  private io: SocketIOServer | null = null;

  public init(httpServer: HttpServer): SocketIOServer {
    const allowedOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim());
    if (!allowedOrigins.includes('http://localhost:5173')) {
      allowedOrigins.push('http://localhost:5173');
    }

    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: allowedOrigins,
        credentials: true,
      },
      path: '/socket.io',
    });

    this.io.use((socket: Socket, next) => {
      try {
        const rawAuth =
          (socket.handshake.auth?.token as string | undefined) ||
          (socket.handshake.headers?.authorization as string | undefined);

        if (!rawAuth) {
          return next(new Error('Authentication token required'));
        }

        const token = rawAuth.startsWith('Bearer ') ? rawAuth.slice(7).trim() : rawAuth.trim();
        const payload = verifyAccessToken(token);

        socket.data.user = {
          id: payload.sub,
          email: payload.email,
          name: payload.name,
          role: payload.role,
        };

        return next();
      } catch {
        return next(new Error('Invalid or expired authentication token'));
      }
    });

    this.io.on('connection', (socket: Socket) => {
      const user = socket.data.user;
      if (user) {
        socket.join(`user:${user.id}`);
        socket.join(`role:${user.role}`);
        socket.join('workspace');
      }
    });

    return this.io;
  }

  public emitToRoles(roles: Role[], event: string, payload: unknown): void {
    if (!this.io) return;
    let chain = this.io.to(`role:${roles[0]}`);
    for (let i = 1; i < roles.length; i++) {
      chain = chain.to(`role:${roles[i]}`);
    }
    chain.emit(event, payload);
  }

  public emitToUser(userId: string, event: string, payload: unknown): void {
    if (!this.io) return;
    this.io.to(`user:${userId}`).emit(event, payload);
  }

  public emitToWorkspace(event: string, payload: unknown): void {
    if (!this.io) return;
    this.io.to('workspace').emit(event, payload);
  }
}

export const socketHub = new SocketHub();

