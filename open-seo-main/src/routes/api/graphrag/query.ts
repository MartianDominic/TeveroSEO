/**
 * GraphRAG Query Endpoint
 * Phase 65: GraphRAG Foundation (65-04)
 *
 * POST /api/graphrag/query
 * Returns hybrid search results for a natural language query.
 *
 * Security:
 * - Requires Clerk JWT authentication (T-65-11)
 * - Query length limited to 2000 chars (T-65-12)
 * - Generic error messages to prevent info disclosure (T-65-14)
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getRetrievalService } from "@/server/features/graph";
import { resolveClerkContext } from "@/middleware/ensure-user/clerk";
import { createLogger } from "@/server/lib/logger";
import { AppError } from "@/server/lib/errors";

const log = createLogger({ module: "api-graphrag-query" });

const querySchema = z.object({
  query: z.string().min(1, "Query required").max(2000, "Query too long (max 2000 chars)"),
  mode: z.enum(["hybrid", "vector", "graph", "lightrag"]).default("hybrid"),
  k: z.number().int().min(1).max(100).default(20),
  includeContent: z.boolean().default(true),
});

export const Route = createFileRoute("/api/graphrag/query")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const startTime = Date.now();
        let workspaceId = "unknown";

        try {
          // CRITICAL: Authentication (T-65-11)
          const authContext = await resolveClerkContext(request.headers);
          workspaceId = authContext.organizationId;

          const body = (await request.json()) as Record<string, unknown>;
          const parsed = querySchema.safeParse(body);

          if (!parsed.success) {
            log.warn("Invalid query request", {
              workspaceId,
              errors: parsed.error.issues.map((i) => i.message),
            });
            return Response.json(
              { success: false, error: parsed.error.message },
              { status: 400 }
            );
          }

          const { query, mode, k, includeContent } = parsed.data;

          const retrieval = getRetrievalService();
          const result = await retrieval.retrieve(workspaceId, query, {
            mode,
            k,
            includeContent,
          });

          log.info("GraphRAG query completed", {
            workspaceId,
            mode,
            latencyMs: result.latencyMs,
            resultCount: result.results.length,
          });

          return Response.json({
            success: true,
            data: {
              results: result.results,
              mode: result.mode,
              latencyMs: result.latencyMs,
            },
          });
        } catch (error) {
          const latencyMs = Date.now() - startTime;

          if (error instanceof AppError) {
            const statusMap: Record<string, number> = {
              UNAUTHENTICATED: 401,
              FORBIDDEN: 403,
              NOT_FOUND: 404,
            };
            const status = statusMap[error.code] ?? 500;

            return Response.json(
              { success: false, error: error.message },
              { status }
            );
          }

          // T-65-14: Generic error message, detailed logging server-side
          log.error(
            "GraphRAG query failed",
            error instanceof Error ? error : new Error(String(error)),
            { workspaceId, latencyMs }
          );

          return Response.json(
            { success: false, error: "Query failed" },
            { status: 500 }
          );
        }
      },
    },
  },
});
