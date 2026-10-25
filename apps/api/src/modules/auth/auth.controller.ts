import { Request, Response, NextFunction } from 'express';
import { authService, AuthService } from './auth.service';
import { LoginInput } from './auth.schema';
import { env } from '../../config/env';
import { REFRESH_TOKEN_EXPIRY_MS } from '../../common/utils/jwt';
import { BadRequestError } from '../../common/errors/appError';

const REFRESH_COOKIE_NAME = 'refresh_token';

export class AuthController {
  constructor(private service: AuthService = authService) {}

  private setRefreshCookie(res: Response, refreshToken: string) {
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: REFRESH_TOKEN_EXPIRY_MS,
    });
  }

  private clearRefreshCookie(res: Response) {
    res.clearCookie(REFRESH_COOKIE_NAME, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/v1/auth',
    });
  }

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password } = req.body as LoginInput;
      const ip = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await this.service.login(email, password, ip, userAgent);

      this.setRefreshCookie(res, result.refreshToken);

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          accessToken: result.accessToken,
          expiresIn: result.expiresIn,
          user: result.user,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Prioritize HttpOnly cookie, fall back to request body for non-browser clients
      const rawToken = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;

      if (!rawToken) {
        throw new BadRequestError('No refresh token provided');
      }

      const ip = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await this.service.refresh(rawToken, ip, userAgent);

      this.setRefreshCookie(res, result.refreshToken);

      res.status(200).json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          accessToken: result.accessToken,
          expiresIn: result.expiresIn,
          user: result.user,
        },
      });
    } catch (error) {
      this.clearRefreshCookie(res);
      next(error);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rawToken = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;
      const userId = req.user?.id;
      const ip = req.ip || req.socket.remoteAddress;

      await this.service.logout(rawToken, userId, ip);

      this.clearRefreshCookie(res);

      res.status(200).json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  logoutAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const ip = req.ip || req.socket.remoteAddress;

      await this.service.logoutAll(userId, ip);

      this.clearRefreshCookie(res);

      res.status(200).json({
        success: true,
        message: 'All active sessions revoked successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const user = await this.service.getMe(userId);

      res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const authController = new AuthController();
