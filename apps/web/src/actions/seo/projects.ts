"use server";

import {
  requireActionAuth,
  validateClientOwnership,
} from "@/lib/auth/action-auth";
import { getOpenSeo } from "@/lib/server-fetch";

interface ProjectParams {
  clientId: string;
}

interface Project {
  id: string;
  name: string;
  organizationId: string;
}

/**
 * Get or create the default project for a client.
 */
export async function getDefaultProject(params: ProjectParams): Promise<Project> {
  const auth = await requireActionAuth();
  await validateClientOwnership(params.clientId, auth);

  const query = new URLSearchParams({
    client_id: params.clientId,
  });
  return getOpenSeo<Project>(`/api/seo/projects?${query.toString()}`);
}
