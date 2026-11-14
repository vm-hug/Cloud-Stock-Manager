import crypto from 'crypto';

/**
 * Computes SHA-256 hash of a string (used to securely store refresh token hashes)
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generates cryptographically secure random token string
 */
export function generateRandomToken(bytes = 40): string {
  return crypto.randomBytes(bytes).toString('hex');
}
