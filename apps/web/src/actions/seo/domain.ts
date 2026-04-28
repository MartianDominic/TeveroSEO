"use server";

import { z } from "zod";
import {
  requireActionAuth,
  validateClientOwnership,
} from "@/lib/auth/action-auth";
import { postOpenSeo } from "@/lib/server-fetch";

// Validation schemas
const clientIdSchema = z.string().uuid("Invalid client ID format");
const projectIdSchema = z.string().uuid("Invalid project ID format");

// Domain validation - no protocol, valid hostname format
const domainSchema = z
  .string()
  .min(1, "Domain is required")
  .max(253, "Domain too long")
  .regex(
    /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i,
    "Invalid domain format (use hostname without protocol, e.g., example.com)"
  );

const domainOverviewParamsSchema = z.object({
  projectId: projectIdSchema,
  clientId: clientIdSchema,
  domain: domainSchema,
  subdomains: z.boolean().optional(),
  sort: z.enum(["position", "traffic", "volume", "cpc", "url"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),
  tab: z.enum(["organic", "paid", "backlinks"]).optional(),
  search: z.string().max(200, "Search query too long").optional(),
});

// Type inference from Zod schema
type DomainOverviewParams = z.infer<typeof domainOverviewParamsSchema>;

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
 * Get domain overview from DataForSEO.
 */
export async function getDomainOverview(params: DomainOverviewParams): Promise<unknown> {
  const validated = domainOverviewParamsSchema.parse(params);
  const auth = await requireActionAuth();
  await validateClientOwnership(validated.clientId, auth);

  const query = buildQuery(validated);
  return postOpenSeo(`/api/seo/domain?${query}`, {
    domain: validated.domain,
    subdomains: validated.subdomains,
    sort: validated.sort,
    order: validated.order,
    tab: validated.tab,
    search: validated.search,
  });
}
