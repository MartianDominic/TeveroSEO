"use server";

import { z } from "zod";
import {
  requireActionAuth,
  validateClientOwnership,
} from "@/lib/auth/action-auth";
import { postOpenSeo } from "@/lib/server-fetch";
import { apiCostLimiter, checkRateLimit } from "@/lib/rate-limit";

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
export async function getBacklinksOverview(params: BacklinksOverviewParams): Promise<unknown> {
  const validated = backlinksOverviewParamsSchema.parse(params);
  const auth = await requireActionAuth();
  await validateClientOwnership(validated.clientId, auth);

  // Rate limit: 100 API calls per hour (DataForSEO costs money)
  await checkRateLimit(apiCostLimiter, auth.userId);

  const query = buildQuery(validated);
  return postOpenSeo(`/api/seo/backlinks?${query}`, {
    action: "overview",
    target: validated.target,
    scope: validated.scope,
    hideSpam: validated.hideSpam,
    spamThreshold: validated.spamThreshold,
  });
}

/**
 * Get referring domains for a target.
 */
export async function getBacklinksReferringDomains(params: BacklinksParams): Promise<unknown[]> {
  const validated = backlinksParamsSchema.parse(params);
  const auth = await requireActionAuth();
  await validateClientOwnership(validated.clientId, auth);

  const query = buildQuery(validated);
  return postOpenSeo<unknown[]>(`/api/seo/backlinks?${query}`, {
    action: "referring-domains",
    target: validated.target,
    scope: validated.scope,
  });
}

/**
 * Get top pages for a target.
 */
export async function getBacklinksTopPages(params: BacklinksParams): Promise<unknown[]> {
  const validated = backlinksParamsSchema.parse(params);
  const auth = await requireActionAuth();
  await validateClientOwnership(validated.clientId, auth);

  const query = buildQuery(validated);
  return postOpenSeo<unknown[]>(`/api/seo/backlinks?${query}`, {
    action: "top-pages",
    target: validated.target,
    scope: validated.scope,
  });
}
