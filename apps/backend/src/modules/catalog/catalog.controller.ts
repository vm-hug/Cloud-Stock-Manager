import { Request, Response, NextFunction } from 'express';
import { catalogService, CatalogService } from './catalog.service';

export class CatalogController {
  constructor(private service: CatalogService = catalogService) {}

  // ========================================================
  // CATEGORIES
  // ========================================================

  getCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.getCategories(req.query as any);
      res.status(200).json({
        success: true,
        data: result.items,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  };

  getCategoryById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const category = await this.service.getCategoryById(req.params.id);
      res.status(200).json({
        success: true,
        data: category,
      });
    } catch (error) {
      next(error);
    }
  };

  createCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const category = await this.service.createCategory(
        req.body,
        req.user?.id,
        req.ip
      );
      res.status(201).json({
        success: true,
        message: 'Category created successfully',
        data: category,
      });
    } catch (error) {
      next(error);
    }
  };

  updateCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const category = await this.service.updateCategory(
        req.params.id,
        req.body,
        req.user?.id,
        req.ip
      );
      res.status(200).json({
        success: true,
        message: 'Category updated successfully',
        data: category,
      });
    } catch (error) {
      next(error);
    }
  };

  updateCategoryStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const category = await this.service.updateCategoryStatus(
        req.params.id,
        req.body.isActive,
        req.user?.id,
        req.ip
      );
      res.status(200).json({
        success: true,
        message: `Category ${category.isActive ? 'activated' : 'deactivated'} successfully`,
        data: category,
      });
    } catch (error) {
      next(error);
    }
  };

  // ========================================================
  // PRODUCTS
  // ========================================================

  getProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.getProducts(req.query as any);
      res.status(200).json({
        success: true,
        data: result.items,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  };

  getProductById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const product = await this.service.getProductById(req.params.id);
      res.status(200).json({
        success: true,
        data: product,
      });
    } catch (error) {
      next(error);
    }
  };

  createProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const product = await this.service.createProduct(
        req.body,
        req.user?.id,
        req.ip
      );
      res.status(201).json({
        success: true,
        message: 'Product created successfully',
        data: product,
      });
    } catch (error) {
      next(error);
    }
  };

  updateProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const product = await this.service.updateProduct(
        req.params.id,
        req.body,
        req.user?.id,
        req.ip
      );
      res.status(200).json({
        success: true,
        message: 'Product updated successfully',
        data: product,
      });
    } catch (error) {
      next(error);
    }
  };

  softDeleteProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const product = await this.service.softDeleteProduct(
        req.params.id,
        req.user?.id,
        req.ip
      );
      res.status(200).json({
        success: true,
        message: 'Product soft deleted successfully',
        data: product,
      });
    } catch (error) {
      next(error);
    }
  };

  restoreProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const product = await this.service.restoreProduct(
        req.params.id,
        req.user?.id,
        req.ip
      );
      res.status(200).json({
        success: true,
        message: 'Product restored successfully',
        data: product,
      });
    } catch (error) {
      next(error);
    }
  };

  // ========================================================
  // PRODUCT VARIANTS / SKU
  // ========================================================

  getVariantsByProductId = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const variants = await this.service.getVariantsByProductId(req.params.productId);
      res.status(200).json({
        success: true,
        data: variants,
      });
    } catch (error) {
      next(error);
    }
  };

  getVariantById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const variant = await this.service.getVariantById(req.params.id);
      res.status(200).json({
        success: true,
        data: variant,
      });
    } catch (error) {
      next(error);
    }
  };

  createVariant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const variant = await this.service.createVariant(
        req.params.productId,
        req.body,
        req.user?.id,
        req.ip
      );
      res.status(201).json({
        success: true,
        message: 'Variant created successfully',
        data: variant,
      });
    } catch (error) {
      next(error);
    }
  };

  updateVariant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const variant = await this.service.updateVariant(
        req.params.id,
        req.body,
        req.user?.id,
        req.ip
      );
      res.status(200).json({
        success: true,
        message: 'Variant updated successfully',
        data: variant,
      });
    } catch (error) {
      next(error);
    }
  };

  softDeleteVariant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const variant = await this.service.softDeleteVariant(
        req.params.id,
        req.user?.id,
        req.ip
      );
      res.status(200).json({
        success: true,
        message: 'Variant soft deleted successfully',
        data: variant,
      });
    } catch (error) {
      next(error);
    }
  };

  restoreVariant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const variant = await this.service.restoreVariant(
        req.params.id,
        req.user?.id,
        req.ip
      );
      res.status(200).json({
        success: true,
        message: 'Variant restored successfully',
        data: variant,
      });
    } catch (error) {
      next(error);
    }
  };

  // ========================================================
  // PRODUCT IMAGES & CLOUDINARY
  // ========================================================

  getImagesByProductId = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const images = await this.service.getImagesByProductId(req.params.id);
      res.status(200).json({
        success: true,
        data: images,
      });
    } catch (error) {
      next(error);
    }
  };

  generateImageUploadSignature = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const signatureParams = await this.service.generateImageUploadSignature(req.params.id);
      res.status(200).json({
        success: true,
        data: signatureParams,
      });
    } catch (error) {
      next(error);
    }
  };

  confirmImage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const image = await this.service.confirmImage(
        req.params.id,
        req.body,
        req.user?.id,
        req.ip
      );
      res.status(201).json({
        success: true,
        message: 'Image confirmed and saved successfully',
        data: image,
      });
    } catch (error) {
      next(error);
    }
  };

  updateImage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const image = await this.service.updateImage(
        req.params.id,
        req.params.imageId,
        req.body,
        req.user?.id,
        req.ip
      );
      res.status(200).json({
        success: true,
        message: 'Image updated successfully',
        data: image,
      });
    } catch (error) {
      next(error);
    }
  };

  setPrimaryImage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const image = await this.service.setPrimaryImage(
        req.params.id,
        req.params.imageId,
        req.user?.id,
        req.ip
      );
      res.status(200).json({
        success: true,
        message: 'Primary image updated successfully',
        data: image,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteImage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.deleteImage(
        req.params.id,
        req.params.imageId,
        req.user?.id,
        req.ip
      );
      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const catalogController = new CatalogController();
