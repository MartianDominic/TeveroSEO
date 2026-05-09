"use server";

/**
 * Server actions for opportunity identification.
 * Phase 25: Team & Intelligence - Opportunity Identification
 */

import { z } from "zod";

import {
  findOpportunities,
} from "@/lib/analytics/opportunities";
import {
  requireActionAuth,
  validateClientOwnership,
  validateWorkspaceMembership,
} from "@/lib/auth/action-auth";
import { logger } from '@/lib/logger';
import { checkActionRateLimit } from "@/lib/rate-limit/action-limiters";
import { getOpenSeo } from "@/lib/server-fetch";
import type { Opportunity, OpportunityFilter } from "@/types/opportunities";

// Validation schemas
const clientIdSchema = z.string().uuid("Invalid client ID");
const workspaceIdSchema = z.string().uuid("Invalid workspace ID");

// FIX: Align filter schema with OpportunityType enum (snake_case, not hyphenated)
const opportunityFilterSchema = z.object({
  types: z.array(z.enum(["ctr_improvement", "ranking_gap", "quick_win", "content_opportunity"])).optional(),
  minImpact: z.enum(["low", "medium", "high"]).optional(),
  maxEffort: z.enum(["low", "medium", "high"]).optional(),
}).strict();

const topOpportunitiesLimitSchema = z.number().int().min(1).max(100).default(10);

const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(50).default(20),
}).strict();

/**
 * Pagination metadata for list responses.
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Paginated response wrapper.
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

/**
 * Get opportunities for a specific client with pagination.
 * Rate limited: 30 operations per minute.
 * @param clientId - The client ID to fetch opportunities for
 * @param filter - Optional filter for types, impact, and effort
 * @param pagination - Optional pagination parameters (page, limit)
 * @returns Paginated array of opportunities sorted by priority
 */
export async function getClientOpportunities(
  clientId: string,
  filter?: OpportunityFilter,
  pagination?: { page?: number; limit?: number }
): Promise<PaginatedResponse<Opportunity>> {
  // Validate inputs
  const validatedClientId = clientIdSchema.parse(clientId);
  if (filter) {
    opportunityFilterSchema.parse(filter);
  }
  const { page, limit } = paginationSchema.parse(pagination ?? {});

  const auth = await requireActionAuth();

  // Rate limit: opportunity analysis can be expensive
  await checkActionRateLimit("opportunities", auth.userId);

  await validateClientOwnership(validatedClientId, auth);

  let opportunities = await findOpportunities(clientId);

  // Apply type filter
  if (filter?.types?.length) {
    const filterTypes = filter.types;
    opportunities = opportunities.filter((o) => filterTypes.includes(o.type));
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

  // Calculate pagination
  const total = opportunities.length;
  const totalPages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;
  const paginatedData = opportunities.slice(offset, offset + limit);

  return {
    data: paginatedData,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
}

/**
 * Get top opportunities across a workspace with pagination.
 * Aggregates opportunities from all clients in the workspace.
 * Validates workspace membership before fetching.
 * Rate limited: 30 operations per minute.
 * @param workspaceId - The workspace ID
 * @param options - Pagination options (page, limit)
 * @returns Paginated array of top opportunities across all clients
 */
export async function getTopOpportunities(
  workspaceId: string,
  options?: { page?: number; limit?: number }
): Promise<PaginatedResponse<Opportunity>> {
  // Validate inputs
  const validatedWorkspaceId = workspaceIdSchema.parse(workspaceId);
  const { page, limit } = paginationSchema.parse(options ?? {});

  const auth = await requireActionAuth();

  // Rate limit: workspace aggregation is expensive
  await checkActionRateLimit("opportunities", auth.userId);

  // Validate workspace membership before accessing workspace data
  await validateWorkspaceMembership(validatedWorkspaceId, auth);

  try {
    // Get clients in workspace with LIMIT to prevent unbounded queries
    // Maximum 50 clients for workspace aggregation to bound memory usage
    const MAX_CLIENTS = 50;
    const clients = await getOpenSeo<{ id: string; name: string }[]>(
      `/api/workspaces/${workspaceId}/clients?limit=${MAX_CLIENTS}`
    );

    if (!clients || clients.length === 0) {
      return {
        data: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      };
    }

    // Aggregate opportunities from clients (bounded to MAX_CLIENTS)
    const allOpportunities: Opportunity[] = [];
    const MAX_OPPS_PER_CLIENT = 20;

    // Process in batches of 10 to avoid overwhelming the API
    const BATCH_SIZE = 10;
    for (let i = 0; i < clients.length; i += BATCH_SIZE) {
      const batch = clients.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (client) => {
          try {
            // Fetch up to 20 opportunities per client to get good coverage
            const clientOpportunities = await findOpportunities(client.id);
            allOpportunities.push(
              ...clientOpportunities.slice(0, MAX_OPPS_PER_CLIENT).map((opp) => ({
                ...opp,
                clientId: client.id,
                clientName: client.name,
              }))
            );
          } catch (error) {
            // Log but don't fail the whole request if one client fails
            logger.warn(`Failed to fetch opportunities for client ${client.id}:`, { detail: error });
          }
        })
      );
    }

    // Sort by potential impact (estimated gain)
    const sortedOpportunities = allOpportunities.sort(
      (a, b) => (b.metrics?.estimatedGain ?? 0) - (a.metrics?.estimatedGain ?? 0)
    );

    // Calculate pagination
    const total = sortedOpportunities.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const paginatedData = sortedOpportunities.slice(offset, offset + limit);

    return {
      data: paginatedData,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  } catch (error) {
    logger.error("Failed to fetch workspace opportunities", error instanceof Error ? error : { error: String(error) });
    return {
      data: [],
      pagination: { page, limit, total: 0, totalPages: 0 },
    };
  }
}

/**
 * Get opportunity count for badge display.
 * @param clientId - The client ID
 * @returns Count of high-priority opportunities
 */
export async function getOpportunityCount(clientId: string): Promise<number> {
  try {
    // Validate clientId format
    const validatedClientId = clientIdSchema.parse(clientId);

    const auth = await requireActionAuth();
    await validateClientOwnership(validatedClientId, auth);

    const opportunities = await findOpportunities(clientId);
    // Count high-impact opportunities
    return opportunities.filter((o) => o.impact === "high").length;
  } catch {
    return 0;
  }
}
