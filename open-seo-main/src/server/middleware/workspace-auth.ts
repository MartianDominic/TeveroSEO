/**
 * Workspace Authentication Middleware
 * Phase 97-Security: CRITICAL IDOR vulnerability fix
 *
 * This middleware derives workspace ID from the authenticated session,
 * eliminating the IDOR vulnerability caused by trusting X-Workspace-ID headers.
 *
 * SECURITY CRITICAL:
 * - NEVER trust client-supplied X-Workspace-ID header alone
 * - ALWAYS derive workspace from authenticated session
 * - All database queries use parameterized queries (Drizzle handles this)
 *
 * Authentication flow:
 * 1. Extract and verify JWT from Authorization header
 * 2. Query database for user's workspace memberships
 * 3. Return verified workspace context or appropriate error
 *
 * Usage:
 * ```ts
 * import { getAuthenticatedWorkspace, requireWorkspaceAccess } from '@/server/middleware/workspace-auth';
 *
 * // Get user's primary workspace
 * const result = await getAuthenticatedWorkspace(request);
 * if (!result.success) {
 *   return Response.json({ error: result.error }, { status: result.statusCode });
 * }
 * const { userId, workspaceId, role } = result.data;
 *
 * // Or verify access to a specific workspace
 * await requireWorkspaceAccess(request, someWorkspaceId);
 * ```
 */

import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db";
import { member, organization } from "@/db/user-schema";
import { verifyRequestToken, type ClerkClaims } from "@/server/lib/clerk-verify";
import { createLogger, redactUserId } from "@/server/lib/logger";
import { AppError } from "@/server/lib/errors";

const logger = createLogger({ module: "workspace-auth" });

// ============================================================================
// Types
// ============================================================================

/**
 * Workspace role levels for RBAC.
 * Ordered by permission level (owner > admin > member > viewer).
 */
export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";

/**
 * Result of successful workspace authentication.
 * Contains verified user identity and workspace access details.
 */
export interface WorkspaceAuthResult {
  /** Verified user ID from JWT (Clerk user_* ID) */
  userId: string;
  /** User email from JWT */
  email: string;
  /** Workspace ID the user has access to (organization ID) */
  workspaceId: string;
  /** User's role in this workspace */
  role: WorkspaceRole;
  /** Membership ID for audit trail */
  membershipId: string;
}

/**
 * Successful authentication response.
 */
export interface WorkspaceAuthSuccess {
  success: true;
  data: WorkspaceAuthResult;
}

/**
 * Failed authentication response with error details.
 */
export interface WorkspaceAuthFailure {
  success: false;
  error: string;
  statusCode: 401 | 403 | 500;
  code: "UNAUTHORIZED" | "FORBIDDEN" | "INTERNAL_ERROR";
}

/**
 * Union type for authentication result.
 */
export type WorkspaceAuthResponse = WorkspaceAuthSuccess | WorkspaceAuthFailure;

/**
 * Workspace membership record from database.
 */
interface WorkspaceMembership {
  membershipId: string;
  organizationId: string;
  organizationName: string;
  role: string;
  createdAt: Date;
}

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Custom error for workspace authentication failures.
 * Extends AppError for consistent error handling across the application.
 */
export class WorkspaceAuthError extends AppError {
  public readonly statusCode: 401 | 403 | 500;
  public readonly authCode: "UNAUTHORIZED" | "FORBIDDEN" | "INTERNAL_ERROR";

  constructor(
    message: string,
    statusCode: 401 | 403 | 500,
    code: "UNAUTHORIZED" | "FORBIDDEN" | "INTERNAL_ERROR"
  ) {
    // Map to AppError error codes
    const appErrorCode = code === "UNAUTHORIZED" ? "UNAUTHENTICATED" :
                         code === "FORBIDDEN" ? "FORBIDDEN" : "INTERNAL_ERROR";
    super(appErrorCode, message);
    this.name = "WorkspaceAuthError";
    this.statusCode = statusCode;
    this.authCode = code;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map role string from database to typed WorkspaceRole.
 * Defaults to "member" for unknown roles (fail-safe).
 */
function parseRole(role: string | null | undefined): WorkspaceRole {
  const normalized = role?.toLowerCase();
  if (normalized === "owner") return "owner";
  if (normalized === "admin") return "admin";
  if (normalized === "viewer") return "viewer";
  return "member"; // Default role
}

/**
 * Fetch all workspace memberships for a user.
 * Returns array of memberships ordered by creation date (oldest first = primary).
 */
async function getUserWorkspaceMemberships(
  userId: string
): Promise<WorkspaceMembership[]> {
  const memberships = await db
    .select({
      membershipId: member.id,
      organizationId: member.organizationId,
      organizationName: organization.name,
      role: member.role,
      createdAt: member.createdAt,
    })
    .from(member)
    .innerJoin(organization, eq(member.organizationId, organization.id))
    .where(
      and(
        eq(member.userId, userId),
        eq(organization.isArchived, false)
      )
    )
    .orderBy(member.createdAt); // Oldest first = primary workspace

  return memberships.map((m) => ({
    membershipId: m.membershipId,
    organizationId: m.organizationId,
    organizationName: m.organizationName,
    role: m.role,
    createdAt: m.createdAt,
  }));
}

/**
 * Check if user has membership in a specific workspace.
 * Returns membership details if found, null otherwise.
 */
async function getWorkspaceMembership(
  userId: string,
  workspaceId: string
): Promise<WorkspaceMembership | null> {
  const memberships = await db
    .select({
      membershipId: member.id,
      organizationId: member.organizationId,
      organizationName: organization.name,
      role: member.role,
      createdAt: member.createdAt,
    })
    .from(member)
    .innerJoin(organization, eq(member.organizationId, organization.id))
    .where(
      and(
        eq(member.userId, userId),
        eq(member.organizationId, workspaceId),
        eq(organization.isArchived, false)
      )
    )
    .limit(1);

  if (memberships.length === 0) {
    return null;
  }

  const m = memberships[0];
  return {
    membershipId: m.membershipId,
    organizationId: m.organizationId,
    organizationName: m.organizationName,
    role: m.role,
    createdAt: m.createdAt,
  };
}

// ============================================================================
// Main Exports
// ============================================================================

/**
 * Authenticate request and return workspace context.
 *
 * This is the primary function for securing API routes against IDOR attacks.
 * It extracts the JWT from the request, verifies it, and looks up the user's
 * workspace memberships from the database.
 *
 * SECURITY: The workspace ID is derived from the database based on the
 * authenticated user, NOT from any client-supplied header.
 *
 * Behavior:
 * - If user has exactly one workspace: returns that workspace
 * - If user has multiple workspaces: checks X-Workspace-ID header and validates
 *   that the user has access to that workspace (doesn't trust blindly)
 * - If user has no workspaces: returns 403 Forbidden
 *
 * @param request - The HTTP request
 * @returns WorkspaceAuthResponse with success/failure and data/error
 *
 * @example
 * const auth = await getAuthenticatedWorkspace(request);
 * if (!auth.success) {
 *   return Response.json({ success: false, error: auth.error }, { status: auth.statusCode });
 * }
 * // auth.data.workspaceId is now VERIFIED safe to use
 */
export async function getAuthenticatedWorkspace(
  request: Request
): Promise<WorkspaceAuthResponse> {
  let claims: ClerkClaims;

  // Step 1: Verify JWT and extract user identity
  try {
    claims = await verifyRequestToken(request);
  } catch (error) {
    const message = error instanceof AppError ? error.message : "Authentication failed";
    logger.warn("JWT verification failed", {
      error: error instanceof Error ? error.message : String(error),
      path: new URL(request.url).pathname,
    });
    return {
      success: false,
      error: message,
      statusCode: 401,
      code: "UNAUTHORIZED",
    };
  }

  // Step 2: Fetch user's workspace memberships
  let memberships: WorkspaceMembership[];
  try {
    memberships = await getUserWorkspaceMemberships(claims.userId);
  } catch (error) {
    logger.error(
      "Database error fetching workspace memberships",
      error instanceof Error ? error : new Error(String(error)),
      { userId: redactUserId(claims.userId) }
    );
    return {
      success: false,
      error: "Service temporarily unavailable",
      statusCode: 500,
      code: "INTERNAL_ERROR",
    };
  }

  // Step 3: Handle no workspace memberships
  if (memberships.length === 0) {
    logger.warn("User has no workspace memberships", {
      userId: redactUserId(claims.userId),
      email: claims.email,
    });
    return {
      success: false,
      error: "No workspace access. Contact your administrator.",
      statusCode: 403,
      code: "FORBIDDEN",
    };
  }

  // Step 4: Determine which workspace to use
  let selectedWorkspace: WorkspaceMembership;

  if (memberships.length === 1) {
    // Single workspace: use it directly
    selectedWorkspace = memberships[0];
  } else {
    // Multiple workspaces: check if client specified one AND verify access
    const requestedWorkspaceId = request.headers.get("X-Workspace-ID");

    if (requestedWorkspaceId) {
      // Validate the requested workspace against user's memberships
      const matchingMembership = memberships.find(
        (m) => m.organizationId === requestedWorkspaceId
      );

      if (!matchingMembership) {
        // User requested a workspace they don't have access to
        logger.warn("User requested workspace without access", {
          userId: redactUserId(claims.userId),
          requestedWorkspaceId,
          availableWorkspaces: memberships.map((m) => m.organizationId),
        });
        return {
          success: false,
          error: "Access denied to requested workspace",
          statusCode: 403,
          code: "FORBIDDEN",
        };
      }

      selectedWorkspace = matchingMembership;
    } else {
      // No workspace specified: use primary (oldest membership)
      selectedWorkspace = memberships[0];
      logger.debug("Using primary workspace for multi-workspace user", {
        userId: redactUserId(claims.userId),
        workspaceId: selectedWorkspace.organizationId,
        workspaceCount: memberships.length,
      });
    }
  }

  // Step 5: Return verified workspace context
  logger.debug("Workspace authentication successful", {
    userId: redactUserId(claims.userId),
    workspaceId: selectedWorkspace.organizationId,
    role: selectedWorkspace.role,
  });

  return {
    success: true,
    data: {
      userId: claims.userId,
      email: claims.email,
      workspaceId: selectedWorkspace.organizationId,
      role: parseRole(selectedWorkspace.role),
      membershipId: selectedWorkspace.membershipId,
    },
  };
}

/**
 * Verify user has access to a specific workspace.
 *
 * Use this when the route already knows which workspace it needs to access
 * (e.g., from URL params or query string) and needs to verify the authenticated
 * user has permission.
 *
 * SECURITY: This verifies membership in the database, not just header values.
 *
 * @param request - The HTTP request
 * @param workspaceId - The workspace ID to verify access for
 * @returns WorkspaceAuthResponse with verified context
 * @throws WorkspaceAuthError if authentication or authorization fails
 *
 * @example
 * const auth = await requireWorkspaceAccess(request, params.workspaceId);
 * if (!auth.success) {
 *   return Response.json({ error: auth.error }, { status: auth.statusCode });
 * }
 * // User is verified to have access to workspaceId
 */
export async function requireWorkspaceAccess(
  request: Request,
  workspaceId: string
): Promise<WorkspaceAuthResponse> {
  let claims: ClerkClaims;

  // Step 1: Verify JWT
  try {
    claims = await verifyRequestToken(request);
  } catch (error) {
    const message = error instanceof AppError ? error.message : "Authentication failed";
    logger.warn("JWT verification failed", {
      error: error instanceof Error ? error.message : String(error),
      path: new URL(request.url).pathname,
      targetWorkspaceId: workspaceId,
    });
    return {
      success: false,
      error: message,
      statusCode: 401,
      code: "UNAUTHORIZED",
    };
  }

  // Step 2: Verify membership in the specific workspace
  let membership: WorkspaceMembership | null;
  try {
    membership = await getWorkspaceMembership(claims.userId, workspaceId);
  } catch (error) {
    logger.error(
      "Database error verifying workspace membership",
      error instanceof Error ? error : new Error(String(error)),
      {
        userId: redactUserId(claims.userId),
        workspaceId,
      }
    );
    return {
      success: false,
      error: "Service temporarily unavailable",
      statusCode: 500,
      code: "INTERNAL_ERROR",
    };
  }

  // Step 3: Check if membership exists
  if (!membership) {
    logger.warn("User lacks membership in requested workspace", {
      userId: redactUserId(claims.userId),
      workspaceId,
    });
    return {
      success: false,
      error: "Access denied",
      statusCode: 403,
      code: "FORBIDDEN",
    };
  }

  // Step 4: Return verified context
  logger.debug("Workspace access verified", {
    userId: redactUserId(claims.userId),
    workspaceId,
    role: membership.role,
  });

  return {
    success: true,
    data: {
      userId: claims.userId,
      email: claims.email,
      workspaceId: membership.organizationId,
      role: parseRole(membership.role),
      membershipId: membership.membershipId,
    },
  };
}

/**
 * Check if a role has at least a minimum permission level.
 * Role hierarchy: owner > admin > member > viewer
 *
 * @param userRole - User's actual role
 * @param minRole - Minimum required role
 * @returns true if userRole >= minRole in the hierarchy
 */
export function hasMinimumRole(userRole: WorkspaceRole, minRole: WorkspaceRole): boolean {
  const hierarchy: Record<WorkspaceRole, number> = {
    viewer: 1,
    member: 2,
    admin: 3,
    owner: 4,
  };

  return hierarchy[userRole] >= hierarchy[minRole];
}

/**
 * Require a minimum role level for an operation.
 * Use after getAuthenticatedWorkspace() to add role-based authorization.
 *
 * @param authResult - Result from getAuthenticatedWorkspace()
 * @param minRole - Minimum required role
 * @returns WorkspaceAuthResponse - same as input if authorized, 403 if not
 *
 * @example
 * const auth = await getAuthenticatedWorkspace(request);
 * if (!auth.success) return Response.json({ error: auth.error }, { status: auth.statusCode });
 *
 * const adminAuth = requireMinimumRole(auth, "admin");
 * if (!adminAuth.success) return Response.json({ error: adminAuth.error }, { status: adminAuth.statusCode });
 */
export function requireMinimumRole(
  authResult: WorkspaceAuthSuccess,
  minRole: WorkspaceRole
): WorkspaceAuthResponse {
  if (!hasMinimumRole(authResult.data.role, minRole)) {
    logger.warn("Insufficient role for operation", {
      userId: redactUserId(authResult.data.userId),
      workspaceId: authResult.data.workspaceId,
      userRole: authResult.data.role,
      requiredRole: minRole,
    });
    return {
      success: false,
      error: `Requires ${minRole} role or higher`,
      statusCode: 403,
      code: "FORBIDDEN",
    };
  }

  return authResult;
}

// ============================================================================
// Response Helpers
// ============================================================================

/**
 * Convert WorkspaceAuthFailure to a Response object.
 * Convenience helper for route handlers.
 *
 * @param failure - The authentication/authorization failure
 * @returns Response with appropriate status code
 */
export function toAuthErrorResponse(failure: WorkspaceAuthFailure): Response {
  return Response.json(
    { success: false, error: failure.error, code: failure.code },
    { status: failure.statusCode }
  );
}

/**
 * Standard unauthorized response.
 */
export function unauthorizedResponse(message = "Authentication required"): Response {
  return Response.json(
    { success: false, error: message, code: "UNAUTHORIZED" },
    { status: 401 }
  );
}

/**
 * Standard forbidden response.
 */
export function forbiddenResponse(message = "Access denied"): Response {
  return Response.json(
    { success: false, error: message, code: "FORBIDDEN" },
    { status: 403 }
  );
}
