"use server";

import { z } from "zod";
import { logger } from '@/lib/logger';
import {
  requireActionAuth,
  validateClientOwnership,
  type ActionResult,
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
export async function getDefaultProject(params: ProjectParams): Promise<ActionResult<Project>> {
  const parseResult = projectParamsSchema.safeParse(params);
  if (!parseResult.success) {
    return { success: false, error: "Invalid parameters" };
  }
  const validated = parseResult.data;

  try {
    const auth = await requireActionAuth();
    await validateClientOwnership(validated.clientId, auth);

    const query = new URLSearchParams({
      client_id: validated.clientId,
    });
    const data = await getOpenSeo<Project>(`/api/seo/projects?${query.toString()}`);
    return { success: true, data };
  } catch (error) {
    logger.error("[getDefaultProject] Failed", error instanceof Error ? error : { error: String(error) });
    return { success: false, error: "Failed to get default project" };
  }
}

/**
 * Get a specific project by ID and validate it belongs to the client.
 * Returns null if project doesn't exist or doesn't belong to the client.
 *
 * TOCTOU FIX: Ownership validation happens BEFORE fetching project data.
 * The backend should also enforce client_id filtering in the query.
 */
export async function getProject(params: GetProjectParams): Promise<ActionResult<Project | null>> {
  const parseResult = getProjectParamsSchema.safeParse(params);
  if (!parseResult.success) {
    return { success: false, error: "Invalid parameters" };
  }
  const validated = parseResult.data;

  try {
    const auth = await requireActionAuth();
    // TOCTOU FIX: Validate ownership BEFORE any data fetch
    await validateClientOwnership(validated.clientId, auth);

    // Include client_id in query to let backend enforce ownership atomically
    const query = new URLSearchParams({
      client_id: validated.clientId,
    });
    const project = await getOpenSeo<Project>(`/api/seo/projects/${validated.projectId}?${query.toString()}`);

    // Verify the project belongs to the specified client (defense in depth)
    if (project.clientId && project.clientId !== validated.clientId) {
      return { success: true, data: null };
    }

    return { success: true, data: project };
  } catch (error) {
    // Return null for 404 errors (project not found)
    if (error instanceof Error && error.message.includes("404")) {
      return { success: true, data: null };
    }
    logger.error("[getProject] Failed", error instanceof Error ? error : { error: String(error) });
    return { success: false, error: "Failed to get project" };
  }
}
