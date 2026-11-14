import { Request, Response, NextFunction } from 'express';
import { usersService, UsersService } from './users.service';
import {
  CreateUserInput,
  UpdateUserInput,
  ChangeUserRoleInput,
  ChangeUserStatusInput,
  ResetUserPasswordInput,
  UserQueryInput,
} from './users.schema';

export class UsersController {
  constructor(private service: UsersService = usersService) {}

  getUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as unknown as UserQueryInput;
      const result = await this.service.getUsers(query);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getUserById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const result = await this.service.getUserById(id);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  createUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorId = req.user!.id;
      const input = req.body as CreateUserInput;
      const ip = req.ip || req.socket.remoteAddress;

      const result = await this.service.createUser(actorId, input, ip);

      res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  updateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorId = req.user!.id;
      const { id } = req.params;
      const input = req.body as UpdateUserInput;
      const ip = req.ip || req.socket.remoteAddress;

      const result = await this.service.updateUser(actorId, id, input, ip);

      res.status(200).json({
        success: true,
        message: 'User profile updated successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  changeUserRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorId = req.user!.id;
      const { id } = req.params;
      const input = req.body as ChangeUserRoleInput;
      const ip = req.ip || req.socket.remoteAddress;

      const result = await this.service.changeUserRole(actorId, id, input, ip);

      res.status(200).json({
        success: true,
        message: 'User role changed successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  changeUserStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorId = req.user!.id;
      const { id } = req.params;
      const input = req.body as ChangeUserStatusInput;
      const ip = req.ip || req.socket.remoteAddress;

      const result = await this.service.changeUserStatus(actorId, id, input, ip);

      res.status(200).json({
        success: true,
        message: `User ${input.isActive ? 'activated' : 'deactivated'} successfully`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  resetUserPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorId = req.user!.id;
      const { id } = req.params;
      const input = req.body as ResetUserPasswordInput;
      const ip = req.ip || req.socket.remoteAddress;

      const result = await this.service.resetUserPassword(actorId, id, input, ip);

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const usersController = new UsersController();
