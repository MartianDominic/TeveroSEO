/**
 * Phase 68-01: Clerk Token Verifier
 *
 * Provides JWT verification for Clerk session tokens.
 * Wraps the existing verifyClerkJWT function with a standardized interface
 * for use in client-context resolution and middleware.
 *
 * Security: All API routes must validate JWT before trusting user identity headers.
 * This module ensures forged X-User-Id headers without valid JWT are rejected.
 */

import { verifyClerkJWT } from "./clerk-jwt";
import { AppError } from "./errors";

/**
 * Claims extracted from a verified Clerk JWT.
 */
export interface ClerkClaims {
  /** User ID (Clerk's sub claim) */
  userId: string;
  /** Organization ID (if using Clerk Organizations) */
  orgId?: string;
  /** Session ID */
  sessionId?: string;
  /** User email */
  email: string;
}

/**
 * Verify a Clerk JWT and return standardized claims.
 *
 * @param token - JWT string from Authorization Bearer header
 * @returns ClerkClaims with userId, email, and optional org/session IDs
 * @throws AppError("UNAUTHENTICATED") with 401 status on invalid/expired token
 * @throws Error if CLERK_PUBLISHABLE_KEY is not configured
 *
 * Security notes:
 * - Validates RS256 signature via JWKS
 * - Validates issuer matches expected Clerk instance
 * - Enforces 24h max token age
 * - 30s clock skew tolerance
 */
export async function verifyClerkToken(token: string): Promise<ClerkClaims> {
  // The existing verifyClerkJWT already throws AppError("UNAUTHENTICATED")
  // on invalid tokens, which corresponds to 401 status
  const { userId, email, name } = await verifyClerkJWT(token);

  return {
    userId,
    email,
    // Note: Clerk JWT claims for organizations are available as org_id
    // when using Clerk Organizations. For now, we don't have org support.
    orgId: undefined,
    // Session ID would be the 'sid' claim, but not currently extracted
    // by verifyClerkJWT. Add if needed.
    sessionId: undefined,
  };
}

/**
 * Extract Bearer token from Authorization header.
 *
 * @param authHeader - The Authorization header value
 * @returns The token string, or null if not a Bearer token
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return null;
  }

  return parts[1];
}

/**
 * Verify JWT from request Authorization header.
 *
 * @param request - The HTTP request
 * @returns ClerkClaims on success
 * @throws AppError("UNAUTHENTICATED") if no valid Bearer token
 *
 * Usage:
 * ```ts
 * const claims = await verifyRequestToken(request);
 * // claims.userId is now trusted
 * ```
 */
export async function verifyRequestToken(request: Request): Promise<ClerkClaims> {
  const authHeader = request.headers.get("Authorization");
  const token = extractBearerToken(authHeader);

  if (!token) {
    throw new AppError("UNAUTHENTICATED", "Missing or invalid Authorization header");
  }

  return verifyClerkToken(token);
}
