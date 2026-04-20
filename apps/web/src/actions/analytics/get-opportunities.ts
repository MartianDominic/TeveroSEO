"use server";

/**
 * Server actions for opportunity identification.
 * Phase 25: Team & Intelligence - Opportunity Identification
 */

import { auth } from "@clerk/nextjs/server";
import {
  findOpportunities,
  prioritizeOpportunities,
} from "@/lib/analytics/opportunities";
import type { Opportunity, OpportunityFilter } from "@/types/opportunities";

/**
 * Get opportunities for a specific client.
 * @param clientId - The client ID to fetch opportunities for
 * @param filter - Optional filter for types, impact, and effort
 * @returns Array of opportunities sorted by priority
 */
export async function getClientOpportunities(
  clientId: string,
  filter?: OpportunityFilter
): Promise<Opportunity[]> {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  let opportunities = await findOpportunities(clientId);

  // Apply type filter
  if (filter?.types?.length) {
    opportunities = opportunities.filter((o) => filter.types!.includes(o.type));
  }

  // Apply impact filter
  if (filter?.minImpact) {
    const impactOrder = { high: 3, medium: 2, low: 1 };
    const minImpactNum = impactOrder[filter.minImpact];
    opportunities = opportunities.filter(
      (o) => impactOrder[o.impact] >= minImpactNum
    );
  }

  // Apply effort filter
  if (filter?.maxEffort) {
    const effortOrder = { low: 1, medium: 2, high: 3 };
    const maxEffortNum = effortOrder[filter.maxEffort];
    opportunities = opportunities.filter(
      (o) => effortOrder[o.effort] <= maxEffortNum
    );
  }

  return opportunities;
}

/**
 * Get top opportunities across a workspace.
 * Aggregates opportunities from all clients in the workspace.
 * @param workspaceId - The workspace ID
 * @param limit - Maximum number of opportunities to return
 * @returns Array of top opportunities across all clients
 */
export async function getTopOpportunities(
  workspaceId: string,
  limit = 10
): Promise<Opportunity[]> {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  // For workspace-level aggregation, we would need to:
  // 1. Fetch all clients in the workspace
  // 2. Get opportunities for each client
  // 3. Merge and re-prioritize
  // This is left as a placeholder for when workspace-level queries are added
  // For now, return empty array - clients should use getClientOpportunities
  return [];
}

/**
 * Get opportunity count for badge display.
 * @param clientId - The client ID
 * @returns Count of high-priority opportunities
 */
export async function getOpportunityCount(clientId: string): Promise<number> {
  const { userId } = await auth();
  if (!userId) {
    return 0;
  }

  try {
    const opportunities = await findOpportunities(clientId);
    // Count high-impact opportunities
    return opportunities.filter((o) => o.impact === "high").length;
  } catch {
    return 0;
  }
}
