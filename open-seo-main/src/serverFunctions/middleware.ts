import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { AppError } from "@/server/lib/errors";
import { errorHandlingMiddleware } from "@/middleware/errorHandling";
import type { EnsuredUserContext } from "@/middleware/ensure-user/types";
import { ensureUserMiddleware } from "@/middleware/ensureUser";
import { requireManagedServiceAccess } from "@/server/billing/subscription";
import { resolveClientId } from "@/server/lib/client-context";

const ensuredUserContextSchema: z.ZodType<EnsuredUserContext> = z.object({
  userId: z.string(),
  userEmail: z.string(),
  organizationId: z.string(),
  project: z.any().optional(),
});

function getAuthenticatedContext(context: unknown): EnsuredUserContext {
  const result = ensuredUserContextSchema.safeParse(context);
  if (!result.success) {
    throw new AppError(
      "INTERNAL_ERROR",
      "Authenticated server function context missing",
    );
  }
  return result.data;
}

export const globalServerFunctionMiddleware = [
  errorHandlingMiddleware,
  ensureUserMiddleware,
] as const;

export const requireAuthenticatedContext = [
  createMiddleware({ type: "function" }).server(async ({ next, context }) => {
    const authenticatedContext = getAuthenticatedContext(context);
    await requireManagedServiceAccess(authenticatedContext);

    // AUTH-03 / SHELL-04: resolve client_id from header or URL query param.
    // Throws FORBIDDEN if the value is present but invalid/unknown.
    const { headers, url } = getRequest();
    const clientId = await resolveClientId(headers, url);

    return next({
      context: { ...authenticatedContext, clientId },
    });
  }),
] as const;

export const requireProjectContext = [
  createMiddleware({ type: "function" }).server(async ({ next, context }) => {
    const authenticatedContext = getAuthenticatedContext(context);

    await requireManagedServiceAccess(authenticatedContext);

    if (!authenticatedContext.project) {
      throw new AppError(
        "INTERNAL_ERROR",
        "Project context missing from authenticated server function",
      );
    }

    // AUTH-03 / SHELL-04: resolve client_id from header or URL query param.
    // Throws FORBIDDEN if the value is present but invalid/unknown.
    const { headers, url } = getRequest();
    const clientId = await resolveClientId(headers, url);

    return next({
      context: {
        ...authenticatedContext,
        project: authenticatedContext.project,
        projectId: authenticatedContext.project.id,
        clientId,
      },
    });
  }),
] as const;
