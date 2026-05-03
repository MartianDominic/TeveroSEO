/**
 * Signed URL Generation and Validation
 *
 * Provides cryptographically signed URLs with expiration for secure media access.
 * Replaces insecure query token authentication (HIGH-01 security fix).
 *
 * Token Format: base64url(resourcePath + "." + expiresAt + "." + hmac)
 *
 * SECURITY:
 * - Uses HMAC-SHA256 for tamper-proof signatures
 * - URLs expire after configurable TTL (default: 1 hour)
 * - Fail-closed: invalid/expired tokens are rejected
 * - Constant-time comparison to prevent timing attacks
 */

import { createHmac, timingSafeEqual } from 'crypto';

import { logger } from '@/lib/logger';

/**
 * Default URL expiration: 1 hour in milliseconds
 */
const DEFAULT_URL_TTL_MS = 60 * 60 * 1000;

/**
 * Signed URL data returned after verification
 */
export interface SignedUrlData {
  resourcePath: string;
  expiresAt: number;
}

/**
 * Error thrown when signed URL verification fails
 */
export class SignedUrlError extends Error {
  constructor(
    message: string,
    public readonly code: 'INVALID' | 'EXPIRED' | 'MALFORMED' | 'NO_SECRET'
  ) {
    super(message);
    this.name = 'SignedUrlError';
  }
}

/**
 * Get the signing secret from environment.
 * Falls back to INTERNAL_API_KEY if SIGNED_URL_SECRET is not set.
 *
 * SECURITY: Throws if no secret is available
 */
function getSigningSecret(): string {
  const secret = process.env.SIGNED_URL_SECRET || process.env.INTERNAL_API_KEY;

  if (!secret || secret.length < 32) {
    logger.error('[signed-urls] No valid SIGNED_URL_SECRET or INTERNAL_API_KEY configured');
    throw new SignedUrlError(
      'Signed URL validation is not configured',
      'NO_SECRET'
    );
  }

  return secret;
}

/**
 * Compute HMAC signature for URL data
 */
function computeSignature(resourcePath: string, expiresAt: number, secret: string): string {
  const data = `${resourcePath}.${expiresAt}`;
  const hmac = createHmac('sha256', secret);
  hmac.update(data);
  return hmac.digest('base64url');
}

/**
 * Generate a signed URL token for a resource.
 *
 * @param resourcePath - The resource path to sign (e.g., "/media/123/image.png")
 * @param ttlMs - Token time-to-live in milliseconds (default: 1 hour)
 * @returns Signed URL token string
 *
 * @example
 * ```ts
 * const token = generateSignedUrlToken('/media/123/image.png');
 * const signedUrl = `/api/media/123/image.png?sig=${token}`;
 * ```
 */
export function generateSignedUrlToken(
  resourcePath: string,
  ttlMs: number = DEFAULT_URL_TTL_MS
): string {
  const secret = getSigningSecret();
  const expiresAt = Date.now() + ttlMs;

  const signature = computeSignature(resourcePath, expiresAt, secret);
  const tokenData = `${resourcePath}.${expiresAt}.${signature}`;

  // Base64url encode the full token
  return Buffer.from(tokenData).toString('base64url');
}

/**
 * Generate a complete signed URL for a resource.
 *
 * @param baseUrl - The base URL (e.g., "https://example.com")
 * @param resourcePath - The resource path (e.g., "/api/media/123/image.png")
 * @param ttlMs - Token time-to-live in milliseconds (default: 1 hour)
 * @returns Complete signed URL with signature parameter
 *
 * @example
 * ```ts
 * const signedUrl = generateSignedUrl('https://api.example.com', '/media/123/image.png');
 * // Returns: https://api.example.com/media/123/image.png?sig=...&exp=...
 * ```
 */
export function generateSignedUrl(
  baseUrl: string,
  resourcePath: string,
  ttlMs: number = DEFAULT_URL_TTL_MS
): string {
  const secret = getSigningSecret();
  const expiresAt = Date.now() + ttlMs;

  const signature = computeSignature(resourcePath, expiresAt, secret);

  // URL-safe encoding of parameters
  const url = new URL(resourcePath, baseUrl);
  url.searchParams.set('sig', signature);
  url.searchParams.set('exp', expiresAt.toString());

  return url.toString();
}

/**
 * Verify a signed URL token and extract its data.
 *
 * @param token - The signed URL token to verify
 * @returns Verified token data with resourcePath and expiresAt
 * @throws SignedUrlError if token is invalid, expired, or malformed
 *
 * @example
 * ```ts
 * try {
 *   const { resourcePath, expiresAt } = await verifySignedUrlToken(token);
 *   // Token is valid, serve the resource
 * } catch (error) {
 *   if (error instanceof SignedUrlError) {
 *     // Handle specific error codes
 *   }
 * }
 * ```
 */
export async function verifySignedUrlToken(token: string): Promise<SignedUrlData> {
  if (!token || typeof token !== 'string') {
    throw new SignedUrlError('Token is required', 'MALFORMED');
  }

  let decoded: string;
  try {
    decoded = Buffer.from(token, 'base64url').toString('utf8');
  } catch {
    logger.warn('[signed-urls] Failed to decode token', { tokenLength: token.length });
    throw new SignedUrlError('Invalid token encoding', 'MALFORMED');
  }

  // Split from the end to handle resource paths with dots
  const lastDotIndex = decoded.lastIndexOf('.');
  const secondLastDotIndex = decoded.lastIndexOf('.', lastDotIndex - 1);

  if (lastDotIndex === -1 || secondLastDotIndex === -1) {
    logger.warn('[signed-urls] Token has wrong format');
    throw new SignedUrlError('Invalid token format', 'MALFORMED');
  }

  const resourcePath = decoded.substring(0, secondLastDotIndex);
  const expiresAtStr = decoded.substring(secondLastDotIndex + 1, lastDotIndex);
  const signature = decoded.substring(lastDotIndex + 1);

  // Validate expiration timestamp
  const expiresAt = parseInt(expiresAtStr, 10);
  if (isNaN(expiresAt) || expiresAt <= 0) {
    logger.warn('[signed-urls] Invalid expiration timestamp', { expiresAtStr });
    throw new SignedUrlError('Invalid token expiration', 'MALFORMED');
  }

  // Check expiration BEFORE signature validation (fail fast)
  if (Date.now() > expiresAt) {
    logger.info('[signed-urls] Token expired', {
      resourcePath: resourcePath.slice(0, 50) + '...',
      expiredAt: new Date(expiresAt).toISOString(),
    });
    throw new SignedUrlError('URL has expired', 'EXPIRED');
  }

  // Verify signature
  const secret = getSigningSecret();
  const expectedSignature = computeSignature(resourcePath, expiresAt, secret);

  // Use timing-safe comparison to prevent timing attacks
  const signatureBuffer = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    logger.warn('[signed-urls] Invalid signature', {
      resourcePath: resourcePath.slice(0, 50) + '...',
    });
    throw new SignedUrlError('Invalid URL signature', 'INVALID');
  }

  return {
    resourcePath,
    expiresAt,
  };
}

/**
 * Verify a signed URL with sig and exp query parameters.
 *
 * @param resourcePath - The resource path being accessed
 * @param signature - The sig query parameter
 * @param expiresAtStr - The exp query parameter
 * @returns true if valid, throws SignedUrlError if invalid
 */
export async function verifySignedUrlParams(
  resourcePath: string,
  signature: string,
  expiresAtStr: string
): Promise<boolean> {
  if (!signature || !expiresAtStr) {
    throw new SignedUrlError('Signature and expiration required', 'MALFORMED');
  }

  const expiresAt = parseInt(expiresAtStr, 10);
  if (isNaN(expiresAt) || expiresAt <= 0) {
    throw new SignedUrlError('Invalid expiration timestamp', 'MALFORMED');
  }

  // Check expiration
  if (Date.now() > expiresAt) {
    logger.info('[signed-urls] URL expired', {
      resourcePath: resourcePath.slice(0, 50) + '...',
      expiredAt: new Date(expiresAt).toISOString(),
    });
    throw new SignedUrlError('URL has expired', 'EXPIRED');
  }

  // Verify signature
  const secret = getSigningSecret();
  const expectedSignature = computeSignature(resourcePath, expiresAt, secret);

  const signatureBuffer = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    logger.warn('[signed-urls] Invalid signature', {
      resourcePath: resourcePath.slice(0, 50) + '...',
    });
    throw new SignedUrlError('Invalid URL signature', 'INVALID');
  }

  return true;
}

/**
 * Safely verify a signed URL, returning null instead of throwing.
 * Use this for non-critical validation paths.
 */
export async function safeVerifySignedUrlToken(
  token: string
): Promise<SignedUrlData | null> {
  try {
    return await verifySignedUrlToken(token);
  } catch (error) {
    if (error instanceof SignedUrlError) {
      logger.debug('[signed-urls] Safe verify failed', { code: error.code });
    }
    return null;
  }
}
