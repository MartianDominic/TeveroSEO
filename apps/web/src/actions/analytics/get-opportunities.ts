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
import { getOpenSeo } from "@/lib/server-fetch";
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

  try {
    // Get all clients in workspace
    const clients = await getOpenSeo<{ id: string; name: string }[]>(
      `/api/workspaces/${workspaceId}/clients`
    );

    if (!clients || clients.length === 0) {
      return [];
    }

    // Aggregate opportunities from all clients
    const allOpportunities: Opportunity[] = [];

    await Promise.all(
      clients.map(async (client) => {
        try {
          // Fetch up to 20 opportunities per client to get good coverage
          const clientOpportunities = await findOpportunities(client.id);
          allOpportunities.push(
            ...clientOpportunities.slice(0, 20).map((opp) => ({
              ...opp,
              clientId: client.id,
              clientName: client.name,
            }))
          );
        } catch (error) {
          // Log but don't fail the whole request if one client fails
          console.warn(
            `Failed to fetch opportunities for client ${client.id}:`,
            error
          );
        }
      })
    );

    // Sort by potential impact (potentialClicks) and return top N
    return allOpportunities
      .sort((a, b) => (b.potentialClicks ?? 0) - (a.potentialClicks ?? 0))
      .slice(0, limit);
  } catch (error) {
    console.error("Failed to fetch workspace opportunities:", error);
    return [];
  }
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
