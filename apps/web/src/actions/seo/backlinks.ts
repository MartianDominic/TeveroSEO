"use server";

import { postOpenSeo } from "@/lib/server-fetch";

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
  const query = buildQuery(params);
  return postOpenSeo(`/api/seo/backlinks?${query}`, {
    action: "overview",
    target: params.target,
    scope: params.scope,
    hideSpam: params.hideSpam,
    spamThreshold: params.spamThreshold,
  });
}

/**
 * Get referring domains for a target.
 */
export async function getBacklinksReferringDomains(params: BacklinksParams): Promise<unknown[]> {
  const query = buildQuery(params);
  return postOpenSeo<unknown[]>(`/api/seo/backlinks?${query}`, {
    action: "referring-domains",
    target: params.target,
    scope: params.scope,
  });
}

/**
 * Get top pages for a target.
 */
export async function getBacklinksTopPages(params: BacklinksParams): Promise<unknown[]> {
  const query = buildQuery(params);
  return postOpenSeo<unknown[]>(`/api/seo/backlinks?${query}`, {
    action: "top-pages",
    target: params.target,
    scope: params.scope,
  });
}
