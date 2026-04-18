"use server";

import { postOpenSeo } from "@/lib/server-fetch";

interface DomainOverviewParams {
  projectId: string;
  clientId: string;
  domain: string;
  subdomains?: boolean;
  sort?: string;
  order?: string;
  tab?: string;
  search?: string;
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
 * Get domain overview from DataForSEO.
 */
export async function getDomainOverview(params: DomainOverviewParams): Promise<unknown> {
  const query = buildQuery(params);
  return postOpenSeo(`/api/seo/domain?${query}`, {
    domain: params.domain,
    subdomains: params.subdomains,
    sort: params.sort,
    order: params.order,
    tab: params.tab,
    search: params.search,
  });
}
