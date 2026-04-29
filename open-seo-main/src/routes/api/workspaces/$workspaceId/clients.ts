/**
 * Workspace clients API endpoint.
 * Phase 41-04: CMS Integration Polish
 *
 * GET /api/workspaces/{workspaceId}/clients
 * Returns all clients belonging to a workspace.
 *
 * SECURITY NOTE (2026-04-28): Added workspace membership verification.
 * Previously only authenticated but did not verify workspace access.
 */
import { createFileRoute } from "@tanstack/react-router";
import { db } from "@/db";
import { clients } from "@/db/client-schema";
import { member } from "@/db/user-schema";
import { eq, desc, and } from "drizzle-orm";
import { createLogger } from "@/server/lib/logger";
import { AppError } from "@/server/lib/errors";
import { requireApiAuth } from "@/routes/api/seo/-middleware";

const log = createLogger({ module: "api/workspaces/clients" });

/**
 * Response structure for workspace client.
 */
interface WorkspaceClientResponse {
  id: string;
  name: string;
  domain: string;
  createdAt: string;
}

/**
 * Verify that a user is a member of the specified workspace.
 * @param userId - The authenticated user's ID
 * @param workspaceId - The workspace/organization ID to verify access to
 * @returns true if user is a member, false otherwise
 */
async function isWorkspaceMember(
  userId: string,
  workspaceId: string
): Promise<boolean> {
  const membership = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.userId, userId), eq(member.organizationId, workspaceId)))
    .limit(1);

  return membership.length > 0;
}

export const Route = createFileRoute("/api/workspaces/$workspaceId/clients")({
  server: {
    handlers: {
      GET: async ({
        request,
        params,
      }: {
        request: Request;
        params: { workspaceId: string };
      }) => {
        try {
          const { userId } = await requireApiAuth(request);

          const { workspaceId } = params;

          if (!workspaceId) {
            return Response.json(
              { error: "workspaceId is required" },
              { status: 400 }
            );
          }

          // SECURITY FIX: Verify user has access to this workspace
          const isMember = await isWorkspaceMember(userId, workspaceId);
          if (!isMember) {
            log.warn("Workspace access denied", {
              userId,
              workspaceId,
              reason: "not_member",
            });
            return Response.json(
              { error: "Access denied to this workspace" },
              { status: 403 }
            );
          }

          // Query clients for this workspace (excluding soft-deleted)
          const workspaceClients = await db
            .select({
              id: clients.id,
              name: clients.name,
              domain: clients.domain,
              createdAt: clients.createdAt,
            })
            .from(clients)
            .where(and(
              eq(clients.workspaceId, workspaceId),
              eq(clients.isDeleted, false)
            ))
            .orderBy(desc(clients.createdAt));

          // Format response
          const response: WorkspaceClientResponse[] = workspaceClients.map(
            (client) => ({
              id: client.id,
              name: client.name,
              domain: client.domain,
              createdAt: client.createdAt?.toISOString() ?? "",
            })
          );

          log.info("Workspace clients retrieved", {
            workspaceId,
            clientCount: response.length,
          });

          return Response.json(response);
        } catch (err) {
          if (err instanceof AppError) {
            const status =
              err.code === "UNAUTHENTICATED"
                ? 401
                : err.code === "FORBIDDEN"
                  ? 403
                  : 400;
            return Response.json({ error: err.message }, { status });
          }
          log.error(
            "Failed to fetch workspace clients",
            err instanceof Error ? err : new Error(String(err))
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },
    },
  },
});
