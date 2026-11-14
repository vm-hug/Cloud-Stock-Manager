import { Request, Response, NextFunction } from 'express';
import { ZodTypeAny, ZodError } from 'zod';
import { BadRequestError } from '../errors/appError';

interface RequestValidators {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

export function validateRequest(validators: RequestValidators) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (validators.params) {
        req.params = await validators.params.parseAsync(req.params);
      }
      if (validators.query) {
        req.query = await validators.query.parseAsync(req.query);
      }
      if (validators.body) {
        req.body = await validators.body.parseAsync(req.body);
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        next(new BadRequestError('Validation failed', details));
        return;
      }
      next(error);
    }
  };
}
