/**
 * Portal Authentication Middleware
 * Phase 96-05: Portal-to-Workspace Bridge
 *
 * Bridges portal token authentication with P96 analytics routes.
 * Resolves: portal token -> clientId -> workspaceId
 *
 * SECURITY:
 * - Validates portal tokens (expiry, revocation)
 * - Derives workspaceId from database, NOT from user input
 * - All database queries use parameterized queries (Drizzle)
 *
 * Usage:
 * ```ts
 * import { validatePortalAuth } from '@/server/middleware/portal-auth';
 *
 * const authResult = await validatePortalAuth(request);
 * if (!authResult.success) {
 *   return portalAuthErrorResponse(authResult);
 * }
 * // authResult.data contains verified clientId, workspaceId, permissions
 * ```
 */

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { clients } from "@/db/client-schema";
import { portalTokens, type AuthLevel } from "@/db/portal-schema";
import { createLogger, redactUserId } from "@/server/lib/logger";

const logger = createLogger({ module: "portal-auth" });

// ============================================================================
// Types
// ============================================================================

/**
 * Permissions derived from portal auth level.
 * Maps auth levels to granular permissions for analytics access.
 */
export interface PortalPermissions {
  /** Can view dashboard metrics */
  canViewDashboard: boolean;
  /** Can view keyword rankings */
  canViewKeywords: boolean;
  /** Can view activity feed */
  canViewActivity: boolean;
  /** Can view notifications */
  canViewNotifications: boolean;
  /** Can access P96 analytics (trends, cannibalization, etc.) */
  canViewAnalytics: boolean;
  /** Can export data */
  canExport: boolean;
  /** Auth level from token */
  authLevel: AuthLevel;
}

/**
 * Result of successful portal authentication.
 */
export interface PortalAuthData {
  /** Client ID from validated token */
  clientId: string;
  /** Client's workspace ID (derived from database) */
  workspaceId: string;
  /** Client name for display */
  clientName: string;
  /** Client domain */
  clientDomain: string;
  /** Permissions based on auth level */
  permissions: PortalPermissions;
  /** Token ID for audit trail */
  tokenId: string;
}

/**
 * Successful portal authentication response.
 */
export interface PortalAuthSuccess {
  success: true;
  data: PortalAuthData;
}

/**
 * Failed portal authentication response.
 */
export interface PortalAuthFailure {
  success: false;
  error: {
    code: "UNAUTHORIZED" | "FORBIDDEN" | "TOKEN_EXPIRED" | "TOKEN_REVOKED" | "CLIENT_NOT_FOUND";
    message: string;
  };
  statusCode: 401 | 403 | 404;
}

/**
 * Union type for portal authentication result.
 */
export type PortalAuthResult = PortalAuthSuccess | PortalAuthFailure;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract portal token from request.
 * Checks Authorization header first, then falls back to query parameter.
 */
function extractToken(request: Request): string | null {
  // Check Authorization header first
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  // Fall back to query parameter
  const url = new URL(request.url);
  return url.searchParams.get("token");
}

/**
 * Map auth level to permissions.
 * Higher auth levels grant more permissions.
 */
function getPermissionsForAuthLevel(authLevel: AuthLevel): PortalPermissions {
  // Base permissions for all auth levels
  const base: PortalPermissions = {
    canViewDashboard: true,
    canViewKeywords: true,
    canViewActivity: true,
    canViewNotifications: true,
    canViewAnalytics: false,
    canExport: false,
    authLevel,
  };

  switch (authLevel) {
    case "token_only":
      // Basic access - no analytics, no export
      return base;

    case "email_verify":
      // Verified email - enable analytics access
      return {
        ...base,
        canViewAnalytics: true,
      };

    case "full_login":
      // Full login - all permissions
      return {
        ...base,
        canViewAnalytics: true,
        canExport: true,
      };

    default:
      // Fail secure - minimal permissions
      return base;
  }
}

// ============================================================================
// Main Exports
// ============================================================================

/**
 * Validate portal authentication and return verified context.
 *
 * This is the primary function for securing portal API routes.
 * It extracts the portal token, validates it, and resolves
 * the client and workspace from the database.
 *
 * SECURITY: The workspaceId is derived from the database based on
 * the client record, NOT from any user-supplied input.
 *
 * @param request - The HTTP request
 * @returns PortalAuthResult with success/failure and data/error
 *
 * @example
 * const auth = await validatePortalAuth(request);
 * if (!auth.success) {
 *   return portalAuthErrorResponse(auth);
 * }
 * // auth.data.clientId and auth.data.workspaceId are now VERIFIED safe to use
 */
export async function validatePortalAuth(
  request: Request
): Promise<PortalAuthResult> {
  // Step 1: Extract token from request
  const token = extractToken(request);

  if (!token) {
    logger.debug("Portal auth failed: no token provided");
    return {
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Portal authentication token required",
      },
      statusCode: 401,
    };
  }

  // Step 2: Validate token in database
  let tokenRecord;
  try {
    tokenRecord = await db.query.portalTokens.findFirst({
      where: eq(portalTokens.token, token),
    });
  } catch (error) {
    logger.error(
      "Database error validating portal token",
      error instanceof Error ? error : new Error(String(error))
    );
    return {
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication service unavailable",
      },
      statusCode: 401,
    };
  }

  if (!tokenRecord) {
    logger.warn("Portal auth failed: token not found", {
      tokenPrefix: token.slice(0, 4) + "...",
    });
    return {
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid authentication token",
      },
      statusCode: 401,
    };
  }

  // Step 3: Check token revocation
  if (tokenRecord.isRevoked) {
    logger.warn("Portal auth failed: token revoked", {
      tokenId: tokenRecord.id,
      revokedAt: tokenRecord.revokedAt,
    });
    return {
      success: false,
      error: {
        code: "TOKEN_REVOKED",
        message: "This access link has been revoked",
      },
      statusCode: 401,
    };
  }

  // Step 4: Check token expiry
  if (tokenRecord.expiresAt < new Date()) {
    logger.warn("Portal auth failed: token expired", {
      tokenId: tokenRecord.id,
      expiresAt: tokenRecord.expiresAt,
    });
    return {
      success: false,
      error: {
        code: "TOKEN_EXPIRED",
        message: "This access link has expired",
      },
      statusCode: 401,
    };
  }

  // Step 5: Look up client and workspace
  let clientRecord;
  try {
    clientRecord = await db.query.clients.findFirst({
      where: eq(clients.id, tokenRecord.clientId),
    });
  } catch (error) {
    logger.error(
      "Database error looking up client",
      error instanceof Error ? error : new Error(String(error)),
      { clientId: tokenRecord.clientId }
    );
    return {
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication service unavailable",
      },
      statusCode: 401,
    };
  }

  if (!clientRecord || clientRecord.isDeleted) {
    logger.warn("Portal auth failed: client not found or deleted", {
      clientId: tokenRecord.clientId,
      isDeleted: clientRecord?.isDeleted,
    });
    return {
      success: false,
      error: {
        code: "CLIENT_NOT_FOUND",
        message: "Client account not found",
      },
      statusCode: 404,
    };
  }

  // Step 6: Update token access tracking (async, don't block response)
  db.update(portalTokens)
    .set({
      lastAccessedAt: new Date(),
      accessCount: (tokenRecord.accessCount ?? 0) + 1,
    })
    .where(eq(portalTokens.id, tokenRecord.id))
    .catch((error) => {
      logger.warn("Failed to update token access tracking", {
        tokenId: tokenRecord.id,
        error: error instanceof Error ? error.message : String(error),
      });
    });

  // Step 7: Build permissions from auth level
  const authLevel = tokenRecord.authLevel as AuthLevel;
  const permissions = getPermissionsForAuthLevel(authLevel);

  logger.debug("Portal auth successful", {
    clientId: redactUserId(clientRecord.id),
    workspaceId: clientRecord.workspaceId,
    authLevel,
  });

  return {
    success: true,
    data: {
      clientId: clientRecord.id,
      workspaceId: clientRecord.workspaceId,
      clientName: clientRecord.name,
      clientDomain: clientRecord.domain,
      permissions,
      tokenId: tokenRecord.id,
    },
  };
}

/**
 * Verify that the requested clientId matches the authenticated client.
 * Use this when routes include clientId as a URL parameter.
 *
 * @param authResult - Result from validatePortalAuth()
 * @param requestedClientId - Client ID from URL params
 * @returns PortalAuthResult - same as input if authorized, 403 if mismatch
 */
export function verifyClientIdMatch(
  authResult: PortalAuthSuccess,
  requestedClientId: string
): PortalAuthResult {
  if (authResult.data.clientId !== requestedClientId) {
    logger.warn("Portal auth: client ID mismatch", {
      tokenClientId: redactUserId(authResult.data.clientId),
      requestedClientId: redactUserId(requestedClientId),
    });
    return {
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "Access denied",
      },
      statusCode: 403,
    };
  }

  return authResult;
}

/**
 * Check if portal auth has a specific permission.
 *
 * @param authResult - Result from validatePortalAuth()
 * @param permission - Permission key to check
 * @returns true if permission is granted
 */
export function hasPortalPermission(
  authResult: PortalAuthSuccess,
  permission: keyof Omit<PortalPermissions, "authLevel">
): boolean {
  return authResult.data.permissions[permission];
}

/**
 * Require a specific permission, returning error response if denied.
 *
 * @param authResult - Result from validatePortalAuth()
 * @param permission - Required permission
 * @param featureName - Human-readable feature name for error message
 * @returns PortalAuthResult - same as input if authorized, 403 if denied
 */
export function requirePortalPermission(
  authResult: PortalAuthSuccess,
  permission: keyof Omit<PortalPermissions, "authLevel">,
  featureName: string
): PortalAuthResult {
  if (!authResult.data.permissions[permission]) {
    logger.warn("Portal permission denied", {
      clientId: redactUserId(authResult.data.clientId),
      permission,
      authLevel: authResult.data.permissions.authLevel,
    });
    return {
      success: false,
      error: {
        code: "FORBIDDEN",
        message: `Access to ${featureName} requires email verification`,
      },
      statusCode: 403,
    };
  }

  return authResult;
}

// ============================================================================
// Response Helpers
// ============================================================================

/**
 * Convert PortalAuthFailure to a Response object.
 * Convenience helper for route handlers.
 *
 * @param failure - The authentication/authorization failure
 * @returns Response with appropriate status code
 */
export function portalAuthErrorResponse(failure: PortalAuthFailure): Response {
  return Response.json(
    {
      success: false,
      error: failure.error.message,
      code: failure.error.code,
    },
    { status: failure.statusCode }
  );
}

/**
 * Standard portal unauthorized response.
 */
export function portalUnauthorizedResponse(
  message = "Portal authentication required"
): Response {
  return Response.json(
    { success: false, error: message, code: "UNAUTHORIZED" },
    { status: 401 }
  );
}

/**
 * Standard portal forbidden response.
 */
export function portalForbiddenResponse(message = "Access denied"): Response {
  return Response.json(
    { success: false, error: message, code: "FORBIDDEN" },
    { status: 403 }
  );
}
