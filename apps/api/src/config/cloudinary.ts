import { v2 as cloudinary } from 'cloudinary';
import { env } from './env';

export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  isConfigured: boolean;
}

export const cloudinaryConfig: CloudinaryConfig = {
  cloudName: env.CLOUDINARY_CLOUD_NAME || '',
  apiKey: env.CLOUDINARY_API_KEY || '',
  apiSecret: env.CLOUDINARY_API_SECRET || '',
  isConfigured: Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET),
};

if (cloudinaryConfig.isConfigured) {
  cloudinary.config({
    cloud_name: cloudinaryConfig.cloudName,
    api_key: cloudinaryConfig.apiKey,
    api_secret: cloudinaryConfig.apiSecret,
    secure: true,
  });
}

/**
 * Generates Cloudinary signed upload parameters for direct client uploads.
 */
export function generateSignedUploadParams(folder: string, publicId: string) {
  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign: Record<string, string | number> = {
    folder,
    public_id: publicId,
    timestamp,
  };

  let signature = 'mock_signature_for_unconfigured_cloudinary';
  if (cloudinaryConfig.isConfigured) {
    signature = cloudinary.utils.api_sign_request(paramsToSign, cloudinaryConfig.apiSecret);
  }

  return {
    signature,
    timestamp,
    apiKey: cloudinaryConfig.apiKey || 'mock_api_key',
    cloudName: cloudinaryConfig.cloudName || 'mock_cloud',
    folder,
    publicId,
  };
}

/**
 * Safely verifies if an asset exists in Cloudinary.
 */
export async function verifyCloudinaryResource(publicId: string): Promise<boolean> {
  // In test environment or unconfigured sandbox, accept structured mock assets
  if (process.env.NODE_ENV === 'test' || !cloudinaryConfig.isConfigured) {
    return true;
  }

  try {
    const resource = await cloudinary.api.resource(publicId);
    return Boolean(resource && resource.public_id === publicId);
  } catch (error) {
    console.error(`Cloudinary resource verification failed for ${publicId}:`, error);
    return false;
  }
}

/**
 * Destroys an image asset on Cloudinary CDN.
 */
export async function deleteCloudinaryAsset(publicId: string): Promise<boolean> {
  if (!cloudinaryConfig.isConfigured) {
    return true;
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId, { invalidate: true });
    return result.result === 'ok' || result.result === 'not found';
  } catch (error) {
    console.error(`Failed to delete Cloudinary asset ${publicId}:`, error);
    return false;
  }
}

/**
 * Generates transformed/optimized CDN delivery URL
 */
export function getOptimizedImageUrl(publicId: string, options: { width?: number; height?: number; crop?: string } = {}) {
  if (!cloudinaryConfig.isConfigured) {
    return `https://res.cloudinary.com/mock_cloud/image/upload/${publicId}`;
  }

  return cloudinary.url(publicId, {
    secure: true,
    fetch_format: 'auto',
    quality: 'auto',
    width: options.width,
    height: options.height,
    crop: options.crop || 'limit',
  });
}

export { cloudinary };
