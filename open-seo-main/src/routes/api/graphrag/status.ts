/**
 * GraphRAG Status Endpoint
 * Phase 65: GraphRAG Foundation (65-04)
 *
 * GET /api/graphrag/status
 * Returns tenant GraphRAG health and statistics.
 *
 * Security:
 * - Requires Clerk JWT authentication (T-65-11)
 */
import { createFileRoute } from "@tanstack/react-router";
import { getLightRAGService } from "@/server/lib/lightrag";
import { getTenantGraphManager } from "@/server/lib/graph";
import { resolveClerkContext } from "@/middleware/ensure-user/clerk";
import { createLogger } from "@/server/lib/logger";
import { AppError } from "@/server/lib/errors";

const log = createLogger({ module: "api-graphrag-status" });

export const Route = createFileRoute("/api/graphrag/status")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        let workspaceId = "unknown";

        try {
          // CRITICAL: Authentication (T-65-11)
          const authContext = await resolveClerkContext(request.headers);
          workspaceId = authContext.organizationId;

          const lightrag = getLightRAGService();
          const graphManager = await getTenantGraphManager();

          // Check LightRAG health and tenant initialization
          const healthPromise = lightrag.healthCheck(workspaceId);

          // Attempt to get graph memory usage
          const memoryPromise = (async () => {
            try {
              const graph = await graphManager.getGraph(workspaceId);
              // FalkorDB doesn't expose memory per graph easily,
              // return 0 for now - can be enhanced with GRAPH.INFO command
              return 0;
            } catch {
              return 0;
            }
          })();

          const [health, memoryUsage] = await Promise.all([
            healthPromise,
            memoryPromise,
          ]);

          log.debug("GraphRAG status check", {
            workspaceId,
            healthy: health.healthy,
            tenantInitialized: health.tenantInitialized,
          });

          return Response.json({
            success: true,
            data: {
              healthy: health.healthy,
              tenantInitialized: health.tenantInitialized ?? false,
              graphMemoryBytes: memoryUsage,
            },
          });
        } catch (error) {
          if (error instanceof AppError) {
            const statusMap: Record<string, number> = {
              UNAUTHENTICATED: 401,
              FORBIDDEN: 403,
            };
            const status = statusMap[error.code] ?? 500;

            return Response.json(
              { success: false, error: error.message },
              { status }
            );
          }

          // Return degraded status on unexpected errors
          log.warn("GraphRAG status check failed, returning degraded", {
            workspaceId,
            error: error instanceof Error ? error.message : String(error),
          });

          return Response.json({
            success: true,
            data: {
              healthy: false,
              tenantInitialized: false,
              graphMemoryBytes: 0,
            },
          });
        }
      },
    },
  },
});
