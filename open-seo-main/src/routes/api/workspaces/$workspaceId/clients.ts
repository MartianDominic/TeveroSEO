/**
 * Workspace clients API endpoint.
 * Phase 41-04: CMS Integration Polish
 *
 * GET /api/workspaces/{workspaceId}/clients
 * Returns all clients belonging to a workspace.
 */
import { createFileRoute } from "@tanstack/react-router";
import { db } from "@/db";
import { clients } from "@/db/client-schema";
import { eq, desc } from "drizzle-orm";
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
          await requireApiAuth(request);

          const { workspaceId } = params;

          if (!workspaceId) {
            return Response.json(
              { error: "workspaceId is required" },
              { status: 400 }
            );
          }

          // Query clients for this workspace
          const workspaceClients = await db
            .select({
              id: clients.id,
              name: clients.name,
              domain: clients.domain,
              createdAt: clients.createdAt,
            })
            .from(clients)
            .where(eq(clients.workspaceId, workspaceId))
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
