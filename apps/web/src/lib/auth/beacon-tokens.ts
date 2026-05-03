/**
 * Beacon Token Verification
 *
 * Provides cryptographic validation of beacon tracking tokens using HMAC.
 * This prevents token forgery and adds time-based expiration.
 *
 * Token Format: base64url(proposalToken + "." + expiresAt + "." + hmac)
 *
 * SECURITY:
 * - Uses HMAC-SHA256 for tamper-proof signatures
 * - Tokens expire after 30 days by default
 * - Fail-closed: invalid/expired tokens are rejected
 * - Constant-time comparison to prevent timing attacks
 */

import { createHmac, timingSafeEqual } from 'crypto';

import { logger } from '@/lib/logger';

/**
 * Default token expiration: 30 days in milliseconds
 */
const DEFAULT_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Beacon token data returned after verification
 */
export interface BeaconTokenData {
  proposalToken: string;
  expiresAt: number;
}

/**
 * Error thrown when beacon token verification fails
 */
export class BeaconTokenError extends Error {
  constructor(
    message: string,
    public readonly code: 'INVALID' | 'EXPIRED' | 'MALFORMED' | 'NO_SECRET'
  ) {
    super(message);
    this.name = 'BeaconTokenError';
  }
}

/**
 * Get the beacon secret from environment.
 * Falls back to INTERNAL_API_KEY if BEACON_SECRET is not set.
 *
 * SECURITY: Throws if no secret is available
 */
function getBeaconSecret(): string {
  const secret = process.env.BEACON_SECRET || process.env.INTERNAL_API_KEY;

  if (!secret || secret.length < 32) {
    logger.error('[beacon-tokens] No valid BEACON_SECRET or INTERNAL_API_KEY configured');
    throw new BeaconTokenError(
      'Beacon token validation is not configured',
      'NO_SECRET'
    );
  }

  return secret;
}

/**
 * Compute HMAC signature for token data
 */
function computeSignature(proposalToken: string, expiresAt: number, secret: string): string {
  const data = `${proposalToken}.${expiresAt}`;
  const hmac = createHmac('sha256', secret);
  hmac.update(data);
  return hmac.digest('base64url');
}

/**
 * Generate a signed beacon token for a proposal.
 *
 * @param proposalToken - The proposal's public access token
 * @param ttlMs - Token time-to-live in milliseconds (default: 30 days)
 * @returns Signed beacon token string
 *
 * @example
 * ```ts
 * const beaconToken = generateBeaconToken('abc123def456...');
 * // Use in beacon URL: /api/proposals/beacon?t={beaconToken}
 * ```
 */
export function generateBeaconToken(
  proposalToken: string,
  ttlMs: number = DEFAULT_TOKEN_TTL_MS
): string {
  const secret = getBeaconSecret();
  const expiresAt = Date.now() + ttlMs;

  const signature = computeSignature(proposalToken, expiresAt, secret);
  const tokenData = `${proposalToken}.${expiresAt}.${signature}`;

  // Base64url encode the full token
  return Buffer.from(tokenData).toString('base64url');
}

/**
 * Verify a beacon token and extract its data.
 *
 * @param token - The beacon token to verify
 * @returns Verified token data with proposalToken and expiresAt
 * @throws BeaconTokenError if token is invalid, expired, or malformed
 *
 * @example
 * ```ts
 * try {
 *   const { proposalToken, expiresAt } = await verifyBeaconToken(token);
 *   // Token is valid, proceed with tracking
 * } catch (error) {
 *   if (error instanceof BeaconTokenError) {
 *     // Handle specific error codes
 *   }
 * }
 * ```
 */
export async function verifyBeaconToken(token: string): Promise<BeaconTokenData> {
  if (!token || typeof token !== 'string') {
    throw new BeaconTokenError('Token is required', 'MALFORMED');
  }

  let decoded: string;
  try {
    decoded = Buffer.from(token, 'base64url').toString('utf8');
  } catch {
    logger.warn('[beacon-tokens] Failed to decode token', { tokenLength: token.length });
    throw new BeaconTokenError('Invalid token encoding', 'MALFORMED');
  }

  const parts = decoded.split('.');
  if (parts.length !== 3) {
    logger.warn('[beacon-tokens] Token has wrong number of parts', { parts: parts.length });
    throw new BeaconTokenError('Invalid token format', 'MALFORMED');
  }

  const [proposalToken, expiresAtStr, signature] = parts;

  // Validate expiration timestamp
  const expiresAt = parseInt(expiresAtStr, 10);
  if (isNaN(expiresAt) || expiresAt <= 0) {
    logger.warn('[beacon-tokens] Invalid expiration timestamp', { expiresAtStr });
    throw new BeaconTokenError('Invalid token expiration', 'MALFORMED');
  }

  // Check expiration BEFORE signature validation (fail fast)
  if (Date.now() > expiresAt) {
    logger.info('[beacon-tokens] Token expired', {
      proposalToken: proposalToken.slice(0, 8) + '...',
      expiredAt: new Date(expiresAt).toISOString(),
    });
    throw new BeaconTokenError('Token has expired', 'EXPIRED');
  }

  // Verify signature
  const secret = getBeaconSecret();
  const expectedSignature = computeSignature(proposalToken, expiresAt, secret);

  // Use timing-safe comparison to prevent timing attacks
  const signatureBuffer = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    logger.warn('[beacon-tokens] Invalid signature', {
      proposalToken: proposalToken.slice(0, 8) + '...',
    });
    throw new BeaconTokenError('Invalid token signature', 'INVALID');
  }

  return {
    proposalToken,
    expiresAt,
  };
}

/**
 * Check if a token is a signed beacon token (vs raw proposal token).
 * Does not verify the signature, just checks the format.
 */
export function isSignedBeaconToken(token: string): boolean {
  if (!token || typeof token !== 'string') {
    return false;
  }

  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts = decoded.split('.');
    return parts.length === 3;
  } catch {
    return false;
  }
}

/**
 * Safely verify a beacon token, returning null instead of throwing.
 * Use this for non-critical validation paths.
 */
export async function safeVerifyBeaconToken(
  token: string
): Promise<BeaconTokenData | null> {
  try {
    return await verifyBeaconToken(token);
  } catch (error) {
    if (error instanceof BeaconTokenError) {
      logger.debug('[beacon-tokens] Safe verify failed', { code: error.code });
    }
    return null;
  }
}
