"use server";

import { z } from "zod";

import {
  requireActionAuth,
  validateClientOwnership,
  type ActionResult,
} from "@/lib/auth/action-auth";
import { logger } from '@/lib/logger';
import { apiCostLimiter, checkRateLimit } from "@/lib/rate-limit";
import { postOpenSeo } from "@/lib/server-fetch";

// Validation schemas
const backlinksParamsSchema = z.object({
  projectId: z.string().uuid("Invalid project ID format"),
  clientId: z.string().uuid("Invalid client ID format"),
  target: z.string().url("Invalid target URL").max(2048, "Target URL too long"),
  scope: z.enum(["domain", "subdomain", "page"]),
});

const backlinksOverviewParamsSchema = backlinksParamsSchema.extend({
  hideSpam: z.boolean().optional(),
  spamThreshold: z.number().int().min(0).max(100).optional(),
});

interface BacklinksParams {
  projectId: string;
  clientId: string;
  target: string;
  scope: string;
}

interface BacklinksOverviewParams extends BacklinksParams {
  hideSpam?: boolean;
  spamThreshold?: number;
}

/**
 * Build query string with client_id and project_id.
 */
function buildQuery(params: { projectId: string; clientId: string }): string {
  const query = new URLSearchParams({
    client_id: params.clientId,
    project_id: params.projectId,
  });
  return query.toString();
}

/**
 * Get backlinks overview for a target.
 */
export async function getBacklinksOverview(params: BacklinksOverviewParams): Promise<ActionResult<unknown>> {
  try {
    const validated = backlinksOverviewParamsSchema.parse(params);
    const auth = await requireActionAuth();
    await validateClientOwnership(validated.clientId, auth);

    // Rate limit: 100 API calls per hour (DataForSEO costs money)
    await checkRateLimit(apiCostLimiter, auth.userId);

    const query = buildQuery(validated);
    const data = await postOpenSeo(`/api/seo/backlinks?${query}`, {
      action: "overview",
      target: validated.target,
      scope: validated.scope,
      hideSpam: validated.hideSpam,
      spamThreshold: validated.spamThreshold,
    });
    return { success: true, data };
  } catch (error) {
    logger.error("[getBacklinksOverview]", { message: error instanceof Error ? error.message : "Unknown error" });
    if (error instanceof z.ZodError) {
      return { success: false, error: "Invalid backlinks parameters" };
    }
    return { success: false, error: "Failed to get backlinks overview. Please try again." };
  }
}

/**
 * Get referring domains for a target.
 */
export async function getBacklinksReferringDomains(params: BacklinksParams): Promise<ActionResult<unknown[]>> {
  try {
    const validated = backlinksParamsSchema.parse(params);
    const auth = await requireActionAuth();
    await validateClientOwnership(validated.clientId, auth);

    // Rate limit: 100 API calls per hour (DataForSEO costs money)
    await checkRateLimit(apiCostLimiter, auth.userId);

    const query = buildQuery(validated);
    const data = await postOpenSeo<unknown[]>(`/api/seo/backlinks?${query}`, {
      action: "referring-domains",
      target: validated.target,
      scope: validated.scope,
    });
    return { success: true, data };
  } catch (error) {
    logger.error("[getBacklinksReferringDomains]", { message: error instanceof Error ? error.message : "Unknown error" });
    if (error instanceof z.ZodError) {
      return { success: false, error: "Invalid backlinks parameters" };
    }
    return { success: false, error: "Failed to get referring domains. Please try again." };
  }
}

/**
 * Get top pages for a target.
 */
export async function getBacklinksTopPages(params: BacklinksParams): Promise<ActionResult<unknown[]>> {
  try {
    const validated = backlinksParamsSchema.parse(params);
    const auth = await requireActionAuth();
    await validateClientOwnership(validated.clientId, auth);

    // Rate limit: 100 API calls per hour (DataForSEO costs money)
    await checkRateLimit(apiCostLimiter, auth.userId);

    const query = buildQuery(validated);
    const data = await postOpenSeo<unknown[]>(`/api/seo/backlinks?${query}`, {
      action: "top-pages",
      target: validated.target,
      scope: validated.scope,
    });
    return { success: true, data };
  } catch (error) {
    logger.error("[getBacklinksTopPages]", { message: error instanceof Error ? error.message : "Unknown error" });
    if (error instanceof z.ZodError) {
      return { success: false, error: "Invalid backlinks parameters" };
    }
    return { success: false, error: "Failed to get top pages. Please try again." };
  }
}
