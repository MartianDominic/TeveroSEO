"use server";

import { z } from "zod";
import {
  requireActionAuth,
  validateWorkspaceMembership,
  validateClientOwnership,
  ActionAuthError,
  type ActionAuthContext,
} from "@/lib/auth/action-auth";
import { getFastApi } from "@/lib/server-fetch";
import { cacheGet, cacheSet, cacheTags } from "@/lib/cache";
import { env } from "@/lib/env";
import { checkActionRateLimit } from "@/lib/rate-limit/action-limiters";
import type {
  TeamMetrics,
  TeamMemberWithAssignments,
  ClientAssignment,
} from "@/types/team";

// Validation schemas
const workspaceIdSchema = z.string().uuid("Invalid workspace ID");
const clientIdSchema = z.string().uuid("Invalid client ID");
const memberIdSchema = z.string().uuid("Invalid member ID");

/**
 * Cache key for team metrics.
 */
const teamMetricsCacheKey = (workspaceId: string, role: string) =>
  `team:metrics:${workspaceId}:${role}`;

/**
 * Schema for workspace membership with role API response.
 */
const workspaceMembershipWithRoleSchema = z.object({
  isMember: z.boolean(),
  role: z.string().optional(),
});

/**
 * Validate that the user has a role that permits client reassignment.
 * Only owners and admins can reassign clients.
 */
async function validateReassignmentPermission(
  workspaceId: string,
  auth: ActionAuthContext
): Promise<void> {
  const backendUrl = env.OPEN_SEO_URL;

  try {
    const response = await fetch(
      `${backendUrl}/api/workspaces/${workspaceId}/membership?userId=${encodeURIComponent(auth.userId)}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new ActionAuthError('Access denied: Unable to verify permissions', 'FORBIDDEN');
    }

    const json = await response.json();
    const parsed = workspaceMembershipWithRoleSchema.safeParse(json);

    if (!parsed.success) {
      console.error('[TeamMetrics] Invalid membership response shape:', parsed.error);
      throw new ActionAuthError('Invalid response from authorization service', 'FORBIDDEN');
    }

    if (!parsed.data.isMember) {
      throw new ActionAuthError('Access denied: Not a member of this workspace', 'FORBIDDEN');
    }

    // Only owners and admins can reassign clients
    const allowedRoles = ['owner', 'admin'];
    if (!parsed.data.role || !allowedRoles.includes(parsed.data.role)) {
      throw new ActionAuthError(
        'Access denied: Only workspace owners and admins can reassign clients',
        'FORBIDDEN'
      );
    }
  } catch (error) {
    if (error instanceof ActionAuthError) {
      throw error;
    }

    console.error(
      `[ActionAuth] Failed to verify reassignment permission: workspaceId=${workspaceId}, userId=${auth.userId}`,
      error
    );
    throw new ActionAuthError('Unable to verify permissions. Please try again.', 'FORBIDDEN');
  }
}

/**
 * Get the user's role in the workspace for permission checks.
 */
async function getUserWorkspaceRole(
  workspaceId: string,
  auth: ActionAuthContext
): Promise<string> {
  const backendUrl = env.OPEN_SEO_URL;

  try {
    const response = await fetch(
      `${backendUrl}/api/workspaces/${workspaceId}/membership?userId=${encodeURIComponent(auth.userId)}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }
    );

    if (!response.ok) {
      return 'member'; // Default to most restrictive role
    }

    const json = await response.json();
    return json.role ?? 'member';
  } catch {
    return 'member'; // Default to most restrictive role on error
  }
}

/**
 * Filter team metrics based on user role.
 * - Owners/admins see full metrics including capacity and utilization
 * - Members see limited metrics (names, assignments only)
 * - Interns see only their own assignments
 */
function filterMetricsByRole(metrics: TeamMetrics, role: string, userId: string): TeamMetrics {
  // Owners and admins see everything
  if (role === 'owner' || role === 'admin') {
    return metrics;
  }

  // Members see team info but not sensitive capacity/utilization data
  if (role === 'member') {
    return {
      ...metrics,
      // Hide aggregate capacity metrics from non-admins
      totalCapacity: 0,
      utilizedCapacity: 0,
      utilizationPct: 0,
      overloadedMembers: 0,
      availableMembers: 0,
      members: metrics.members.map(member => ({
        ...member,
        // Hide individual capacity metrics
        capacity: 0,
        utilizationPct: 0,
        isOverloaded: false,
      })),
    };
  }

  // Interns only see their own data
  return {
    totalCapacity: 0,
    utilizedCapacity: 0,
    utilizationPct: 0,
    overloadedMembers: 0,
    availableMembers: 0,
    members: metrics.members
      .filter(member => member.id === userId)
      .map(member => ({
        ...member,
        capacity: 0,
        utilizationPct: 0,
        isOverloaded: false,
      })),
  };
}

/**
 * Fetch team metrics including member workloads and assignments.
 * Results are cached for 60 seconds with workspace tag for invalidation.
 * Rate limited: 60 operations per minute.
 *
 * SECURITY: Role-based filtering ensures users only see metrics appropriate
 * for their permission level:
 * - Owners/admins: Full metrics including capacity and utilization
 * - Members: Team info without sensitive capacity data
 * - Interns: Only their own assignments
 */
export async function getTeamMetrics(
  workspaceId: string
): Promise<TeamMetrics> {
  // Validate workspaceId format
  const validatedWorkspaceId = workspaceIdSchema.parse(workspaceId);

  const auth = await requireActionAuth();

  // Rate limit: prevent excessive metric fetches
  await checkActionRateLimit("teamMetrics", auth.userId);

  // Validate workspace membership to prevent IDOR
  await validateWorkspaceMembership(validatedWorkspaceId, auth);

  // Get user's role for permission-based filtering
  const userRole = await getUserWorkspaceRole(validatedWorkspaceId, auth);

  // Check cache first (cache key includes role for proper isolation)
  const cacheKey = teamMetricsCacheKey(validatedWorkspaceId, userRole);
  const cached = await cacheGet<TeamMetrics>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    // Fetch team data from backend
    const response = await getFastApi<{
      members: Array<{
        id: string;
        name: string;
        email: string;
        avatar?: string;
        role: "owner" | "admin" | "member";
        capacity: number;
        assignments: Array<{
          clientId: string;
          clientName: string;
          assignedAt: string;
        }>;
      }>;
    }>(`/api/workspaces/${validatedWorkspaceId}/team`);

    // Calculate metrics
    const members: TeamMemberWithAssignments[] = response.members.map(
      (member) => {
        const clientCount = member.assignments.length;
        const utilizationPct =
          member.capacity > 0
            ? Math.round((clientCount / member.capacity) * 100)
            : 0;
        const isOverloaded = utilizationPct >= 100;

        const assignments: ClientAssignment[] = member.assignments.map((a) => ({
          clientId: a.clientId,
          clientName: a.clientName,
          memberId: member.id,
          memberName: member.name,
          assignedAt: a.assignedAt,
        }));

        return {
          id: member.id,
          name: member.name,
          email: member.email,
          avatar: member.avatar,
          role: member.role,
          capacity: member.capacity,
          clientCount,
          assignments,
          utilizationPct,
          isOverloaded,
        };
      }
    );

    const totalCapacity = members.reduce((sum, m) => sum + m.capacity, 0);
    const utilizedCapacity = members.reduce((sum, m) => sum + m.clientCount, 0);
    const overloadedMembers = members.filter((m) => m.isOverloaded).length;
    const availableMembers = members.filter((m) => !m.isOverloaded).length;

    const fullMetrics: TeamMetrics = {
      totalCapacity,
      utilizedCapacity,
      utilizationPct:
        totalCapacity > 0
          ? Math.round((utilizedCapacity / totalCapacity) * 100)
          : 0,
      overloadedMembers,
      availableMembers,
      members,
    };

    // Apply role-based filtering before caching and returning
    const result = filterMetricsByRole(fullMetrics, userRole, auth.userId);

    // Cache result for 60 seconds (keyed by role for proper isolation)
    await cacheSet(cacheKey, result, {
      ttl: 60,
      tags: [cacheTags.workspace(validatedWorkspaceId)],
    });

    return result;
  } catch (error) {
    console.error("[getTeamMetrics] Failed to fetch team metrics:", error);
    // Return empty result on error for graceful degradation
    return {
      totalCapacity: 0,
      utilizedCapacity: 0,
      utilizationPct: 0,
      overloadedMembers: 0,
      availableMembers: 0,
      members: [],
      error: "Failed to load team metrics. Please try again.",
    };
  }
}

/**
 * Reassign a client to a different team member.
 * Requires owner or admin role in the workspace.
 * Rate limited: 60 operations per minute.
 */
export async function reassignClient(
  workspaceId: string,
  clientId: string,
  toMemberId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate all input IDs
    const validatedWorkspaceId = workspaceIdSchema.parse(workspaceId);
    const validatedClientId = clientIdSchema.parse(clientId);
    const validatedMemberId = memberIdSchema.parse(toMemberId);

    const auth = await requireActionAuth();

    // Rate limit: prevent bulk reassignment abuse
    await checkActionRateLimit("teamMetrics", auth.userId);

    // Validate workspace membership AND admin/owner role
    await validateReassignmentPermission(validatedWorkspaceId, auth);

    // Validate client belongs to this workspace/user
    await validateClientOwnership(validatedClientId, auth);

    await getFastApi<void>(
      `/api/workspaces/${validatedWorkspaceId}/clients/${validatedClientId}/reassign`,
      {
        method: "POST",
        body: JSON.stringify({ memberId: validatedMemberId }),
      } as RequestInit
    );

    // Invalidate cache after reassignment
    const cacheKey = teamMetricsCacheKey(validatedWorkspaceId, 'owner');
    await cacheSet(cacheKey, null, { ttl: 0 });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Reassignment failed",
    };
  }
}
