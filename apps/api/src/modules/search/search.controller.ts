import { Request, Response, NextFunction } from 'express';
import { searchService, SearchService } from './search.service';
import { SearchProductsQueryInput } from './search.schema';
import { Role } from '@cloud-stock/shared';

export class SearchController {
  constructor(private service: SearchService = searchService) {}

  searchProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as unknown as SearchProductsQueryInput;
      const userRole = (req.user?.role as Role) || Role.STAFF;

      const result = await this.service.searchProducts(query, userRole);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };
}

export const searchController = new SearchController();

