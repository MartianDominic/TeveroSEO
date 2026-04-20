"use server";

import { getFastApi } from "@/lib/server-fetch";
import { cacheGet, cacheSet, cacheKeys, cacheTags } from "@/lib/cache";
import type {
  TeamMetrics,
  TeamMemberWithAssignments,
  ClientAssignment,
} from "@/types/team";

/**
 * Cache key for team metrics.
 */
const teamMetricsCacheKey = (workspaceId: string) =>
  `team:metrics:${workspaceId}`;

/**
 * Fetch team metrics including member workloads and assignments.
 * Results are cached for 60 seconds with workspace tag for invalidation.
 */
export async function getTeamMetrics(
  workspaceId: string
): Promise<TeamMetrics> {
  // Check cache first
  const cacheKey = teamMetricsCacheKey(workspaceId);
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
    }>(`/api/workspaces/${workspaceId}/team`);

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

    const result: TeamMetrics = {
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

    // Cache result for 60 seconds
    await cacheSet(cacheKey, result, {
      ttl: 60,
      tags: [cacheTags.workspace(workspaceId)],
    });

    return result;
  } catch (error) {
    // Return empty result on error for graceful degradation
    return {
      totalCapacity: 0,
      utilizedCapacity: 0,
      utilizationPct: 0,
      overloadedMembers: 0,
      availableMembers: 0,
      members: [],
    };
  }
}

/**
 * Reassign a client to a different team member.
 */
export async function reassignClient(
  workspaceId: string,
  clientId: string,
  toMemberId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await getFastApi<void>(
      `/api/workspaces/${workspaceId}/clients/${clientId}/reassign`,
      {
        method: "POST",
        body: JSON.stringify({ memberId: toMemberId }),
      } as RequestInit
    );

    // Invalidate cache after reassignment
    const cacheKey = teamMetricsCacheKey(workspaceId);
    await cacheSet(cacheKey, null, { ttl: 0 });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Reassignment failed",
    };
  }
}
