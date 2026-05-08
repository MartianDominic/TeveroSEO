/**
 * Analytics Route Authentication Helpers
 * Phase 96-Security: Centralized auth for analytics API routes
 *
 * Provides:
 * - JWT-based workspace authentication
 * - Site ownership verification
 * - Client-to-site relationship validation
 *
 * Security notes:
 * - Never trust X-Workspace-ID header alone - must be verified against JWT
 * - For site-scoped routes, verify site belongs to authenticated workspace
 * - All database queries use parameterized queries to prevent SQL injection
 *
 * API-002 FIX: All error responses now match OpenAPI spec format:
 * { success: false, error: { code: "ERROR_CODE", message: "..." } }
 */
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { verifyRequestToken } from "@/server/lib/clerk-verify";
import { AppError } from "@/server/lib/errors";
import {
  ERROR_CODES,
  createErrorResponse,
  getHttpStatusForError,
} from "@/server/features/analytics/types/api-responses";

/**
 * Authenticated workspace context returned from authenticateAnalyticsRequest.
 */
export interface AnalyticsAuthContext {
  /** Verified user ID from JWT */
  userId: string;
  /** Workspace ID from JWT (organization membership) */
  workspaceId: string;
  /** User email */
  email: string;
}

/**
 * Authenticate an analytics API request and return verified workspace context.
 *
 * Extracts and validates the JWT from Authorization header, then derives
 * the workspace ID from the authenticated user's organization membership.
 *
 * @param request - The HTTP request
 * @returns AnalyticsAuthContext with verified userId and workspaceId
 * @throws Response with 401 if authentication fails
 *
 * Security: This replaces the vulnerable X-Workspace-ID header trust pattern.
 * The workspace is derived from the authenticated session, not user-supplied headers.
 */
export async function authenticateAnalyticsRequest(
  request: Request
): Promise<AnalyticsAuthContext> {
  try {
    const claims = await verifyRequestToken(request);

    // Get workspace ID from header, but validate it matches user's organization
    const headerWorkspaceId = request.headers.get("X-Workspace-ID");

    if (!headerWorkspaceId) {
      throw new AppError("UNAUTHENTICATED", "Workspace ID required");
    }

    // Verify user has access to this workspace by checking organization membership
    // In Clerk, users belong to organizations. We need to verify the workspace
    // matches the user's organization or that they have access.
    // For now, we validate that the workspace exists and contains the user's resources.
    const hasAccess = await verifyWorkspaceMembership(claims.userId, headerWorkspaceId);
    if (!hasAccess) {
      throw new AppError("PERMISSION_DENIED", "No access to this workspace");
    }

    return {
      userId: claims.userId,
      workspaceId: headerWorkspaceId,
      email: claims.email,
    };
  } catch (error) {
    if (error instanceof AppError) {
      // API-002 FIX: Use standardized error format matching OpenAPI spec
      const code = error.code === "UNAUTHENTICATED" ? ERROR_CODES.UNAUTHORIZED : ERROR_CODES.FORBIDDEN;
      const status = getHttpStatusForError(code);
      throw Response.json(
        createErrorResponse(code, error.message),
        { status }
      );
    }
    // API-002 FIX: Use standardized error format matching OpenAPI spec
    throw Response.json(
      createErrorResponse(ERROR_CODES.UNAUTHORIZED, "Authentication failed"),
      { status: 401 }
    );
  }
}

/**
 * Verify that a site belongs to the authenticated workspace.
 *
 * Used for routes that accept siteId parameter to prevent IDOR attacks.
 * Checks: siteConnection -> client -> workspace chain.
 *
 * @param siteId - The site connection ID from request
 * @param workspaceId - The authenticated workspace ID
 * @returns true if site belongs to workspace, false otherwise
 */
export async function verifySiteOwnership(
  siteId: string,
  workspaceId: string
): Promise<boolean> {
  // Query: siteConnections JOIN clients ON clientId
  // WHERE siteConnections.id = siteId AND clients.workspaceId = workspaceId
  const result = await db.execute(sql`
    SELECT sc.id
    FROM site_connections sc
    INNER JOIN clients c ON sc.client_id = c.id
    WHERE sc.id = ${siteId}
      AND c.workspace_id = ${workspaceId}
      AND c.is_deleted = false
    LIMIT 1
  `);

  return result.rows.length > 0;
}

/**
 * Get client ID from site ID with workspace verification.
 *
 * Used for routes that need the client ID for database queries.
 * Returns null if site doesn't exist or doesn't belong to workspace.
 *
 * @param siteId - The site connection ID
 * @param workspaceId - The authenticated workspace ID
 * @returns Client ID if found and authorized, null otherwise
 */
export async function getClientIdFromSite(
  siteId: string,
  workspaceId: string
): Promise<string | null> {
  const result = await db.execute(sql`
    SELECT c.id as client_id
    FROM site_connections sc
    INNER JOIN clients c ON sc.client_id = c.id
    WHERE sc.id = ${siteId}
      AND c.workspace_id = ${workspaceId}
      AND c.is_deleted = false
    LIMIT 1
  `);

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0].client_id as string;
}

/**
 * Verify that user has membership in the specified workspace.
 *
 * Security: This function verifies BOTH that the workspace exists AND that
 * the user has an active membership in that organization. This prevents
 * users from accessing workspaces they don't belong to.
 *
 * The member table links users to organizations with roles (owner, admin, member).
 * We check for any valid membership - role-based access control can be added
 * at a higher level if needed.
 *
 * @param userId - The authenticated user ID (from Clerk JWT)
 * @param workspaceId - The workspace/organization ID to verify
 * @returns true if user has membership in the workspace, false otherwise
 */
async function verifyWorkspaceMembership(
  userId: string,
  workspaceId: string
): Promise<boolean> {
  try {
    // Query the member table to verify user has membership in this organization
    // This checks both that the organization exists AND that the user is a member
    const membershipResult = await db.execute(sql`
      SELECT m.id, m.role
      FROM member m
      INNER JOIN organization o ON m.organization_id = o.id
      WHERE m.user_id = ${userId}
        AND m.organization_id = ${workspaceId}
        AND o.is_archived = false
      LIMIT 1
    `);

    if (membershipResult.rows.length > 0) {
      // User has valid membership in this workspace
      return true;
    }

    // No membership found - check if this is because:
    // 1. The organization doesn't exist
    // 2. The user isn't a member
    // Log for debugging but don't expose details to the client
    const orgExists = await db.execute(sql`
      SELECT 1 FROM organization WHERE id = ${workspaceId} AND is_archived = false LIMIT 1
    `);

    if (orgExists.rows.length === 0) {
      console.warn(
        `[analytics-auth] Workspace membership check failed: organization ${workspaceId} does not exist or is archived`
      );
    } else {
      console.warn(
        `[analytics-auth] Workspace membership check failed: user ${userId} is not a member of organization ${workspaceId}`
      );
    }

    return false;
  } catch (error) {
    // Log the error but deny access by default for security
    console.error(
      `[analytics-auth] Error verifying workspace membership for user ${userId} in workspace ${workspaceId}:`,
      error
    );
    // Deny access on error - fail secure
    return false;
  }
}

/**
 * Standard 401 Unauthorized response.
 * API-002 FIX: Uses standardized error format matching OpenAPI spec.
 */
export function unauthorizedResponse(message = "Unauthorized"): Response {
  return Response.json(
    createErrorResponse(ERROR_CODES.UNAUTHORIZED, message),
    { status: 401 }
  );
}

/**
 * Standard 403 Forbidden response.
 * API-002 FIX: Uses standardized error format matching OpenAPI spec.
 */
export function forbiddenResponse(message = "Access denied"): Response {
  return Response.json(
    createErrorResponse(ERROR_CODES.FORBIDDEN, message),
    { status: 403 }
  );
}

/**
 * Standard 404 Not Found response for sites.
 * API-002 FIX: Uses standardized error format matching OpenAPI spec.
 */
export function siteNotFoundResponse(): Response {
  return Response.json(
    createErrorResponse(ERROR_CODES.NOT_FOUND, "Site not found"),
    { status: 404 }
  );
}
