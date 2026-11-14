import { CloudinarySignedParams } from '@cloud-stock/shared';

export const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_IMAGE_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.type)) {
    return 'Only JPEG, PNG, and WebP images are supported.';
  }
  if (file.size > MAX_IMAGE_FILE_SIZE_BYTES) {
    return 'Image file size must be 5MB or smaller.';
  }
  return null;
}

/**
 * Direct signed upload from browser to Cloudinary CDN.
 * Falls back cleanly when running in an unconfigured sandbox.
 */
export async function uploadToCloudinaryDirect(
  file: File,
  signedParams: CloudinarySignedParams
): Promise<{ publicId: string; url: string }> {
  if (signedParams.cloudName === 'mock_cloud' || !signedParams.apiKey) {
    return {
      publicId: `${signedParams.folder}/${signedParams.publicId}`,
      url: URL.createObjectURL(file),
    };
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', signedParams.apiKey);
  formData.append('timestamp', signedParams.timestamp.toString());
  formData.append('signature', signedParams.signature);
  formData.append('folder', signedParams.folder);
  formData.append('public_id', signedParams.publicId);

  const uploadUrl = `https://api.cloudinary.com/v1_1/${signedParams.cloudName}/image/upload`;
  const res = await fetch(uploadUrl, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.error?.message || 'Failed to upload image to Cloudinary CDN');
  }

  const json = await res.json();
  return {
    publicId: json.public_id,
    url: json.secure_url || json.url,
  };
}

