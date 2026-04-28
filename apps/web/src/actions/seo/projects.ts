"use server";

import { z } from "zod";
import {
  requireActionAuth,
  validateClientOwnership,
} from "@/lib/auth/action-auth";
import { getOpenSeo } from "@/lib/server-fetch";

// Validation schemas
const projectParamsSchema = z.object({
  clientId: z.string().uuid("Invalid client ID format"),
});

const getProjectParamsSchema = z.object({
  projectId: z.string().uuid("Invalid project ID format"),
  clientId: z.string().uuid("Invalid client ID format"),
});

interface ProjectParams {
  clientId: string;
}

interface GetProjectParams {
  projectId: string;
  clientId: string;
}

interface Project {
  id: string;
  name: string;
  organizationId: string;
  clientId?: string;
}

/**
 * Get or create the default project for a client.
 */
export async function getDefaultProject(params: ProjectParams): Promise<Project> {
  const validated = projectParamsSchema.parse(params);
  const auth = await requireActionAuth();
  await validateClientOwnership(validated.clientId, auth);

  const query = new URLSearchParams({
    client_id: validated.clientId,
  });
  return getOpenSeo<Project>(`/api/seo/projects?${query.toString()}`);
}

/**
 * Get a specific project by ID and validate it belongs to the client.
 * Returns null if project doesn't exist or doesn't belong to the client.
 */
export async function getProject(params: GetProjectParams): Promise<Project | null> {
  const validated = getProjectParamsSchema.parse(params);
  const auth = await requireActionAuth();
  await validateClientOwnership(validated.clientId, auth);

  try {
    const project = await getOpenSeo<Project>(`/api/seo/projects/${validated.projectId}`);

    // Verify the project belongs to the specified client
    if (project.clientId && project.clientId !== validated.clientId) {
      return null;
    }

    return project;
  } catch (error) {
    // Return null for 404 errors (project not found)
    if (error instanceof Error && error.message.includes("404")) {
      return null;
    }
    throw error;
  }
}
