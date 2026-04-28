import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { resolveUserContext } from "@/middleware/ensure-user";
import type {
  EnsuredProject,
  EnsuredUserContext,
} from "@/middleware/ensure-user/types";
import { AppError } from "@/server/lib/errors";
import { ProjectRepository } from "@/server/features/projects/repositories/ProjectRepository";

function extractProjectId(data: unknown) {
  if (!data || typeof data !== "object" || !("projectId" in data)) {
    return null;
  }

  const projectId = (data as { projectId?: unknown }).projectId;
  return typeof projectId === "string" && projectId.length > 0
    ? projectId
    : null;
}

/**
 * Authentication middleware — verifies Clerk JWT from Authorization header.
 *
 * - Extracts Bearer token from Authorization header
 * - Verifies JWT against Clerk JWKS
 * - Looks up or creates user by clerk_user_id
 * - Returns EnsuredUserContext with userId, userEmail, organizationId
 *
 * Throws AppError("UNAUTHENTICATED") if token is missing, invalid, or expired.
 */
export const ensureUserMiddleware = createMiddleware({
  type: "function",
}).server(async ({ next, data }) => {
  const headers = getRequest().headers;
  const context: EnsuredUserContext = await resolveUserContext(headers);

  const projectId = extractProjectId(data);

  let project: EnsuredProject | undefined;

  if (projectId) {
    // ADR 0001 intentionally keeps project authorization here so every
    // project-scoped server function gets the same request-scoped org+project
    // check before handlers run. Function-level middleware narrows the type.
    project = await ProjectRepository.getProjectForOrganization(
      projectId,
      context.organizationId,
    );

    if (!project) {
      throw new AppError("NOT_FOUND");
    }
  }

  return next({
    context: {
      ...context,
      project,
    },
  });
});
