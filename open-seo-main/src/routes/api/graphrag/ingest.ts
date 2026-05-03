/**
 * GraphRAG Ingest Endpoint
 * Phase 65: GraphRAG Foundation (65-04)
 *
 * POST /api/graphrag/ingest
 * Ingests documents into tenant's knowledge graph.
 *
 * Security:
 * - Requires Clerk JWT authentication (T-65-11)
 * - Max 100KB per document, max 50 documents (T-65-12, T-65-13)
 * - Generic error messages (T-65-14)
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getLightRAGService } from "@/server/lib/lightrag";
import { getGraphService } from "@/server/features/graph";
import { resolveClerkContext } from "@/middleware/ensure-user/clerk";
import { createLogger } from "@/server/lib/logger";
import { AppError } from "@/server/lib/errors";

const log = createLogger({ module: "api-graphrag-ingest" });

const documentSchema = z.object({
  id: z.string().min(1, "Document ID required"),
  content: z.string().min(1, "Content required").max(100000, "Content too large (max 100KB)"),
  url: z.string().url().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const ingestSchema = z.object({
  documents: z
    .array(documentSchema)
    .min(1, "At least one document required")
    .max(50, "Maximum 50 documents per request"),
});

export const Route = createFileRoute("/api/graphrag/ingest")({
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
          const parsed = ingestSchema.safeParse(body);

          if (!parsed.success) {
            log.warn("Invalid ingest request", {
              workspaceId,
              errors: parsed.error.issues.map((i) => i.message),
            });
            return Response.json(
              { success: false, error: parsed.error.message },
              { status: 400 }
            );
          }

          const { documents } = parsed.data;

          // Ensure tenant graph is initialized
          const graphService = await getGraphService();
          await graphService.initializeTenant(workspaceId);

          // Insert documents via LightRAG
          const lightrag = getLightRAGService();
          const results = await lightrag.insertDocuments(
            workspaceId,
            documents.map((d) => ({
              id: d.id,
              content: d.content,
              url: d.url ?? "",
            }))
          );

          const totalEntities = results.reduce(
            (sum, r) => sum + r.entitiesExtracted,
            0
          );
          const latencyMs = Date.now() - startTime;

          log.info("GraphRAG ingest completed", {
            workspaceId,
            documentCount: documents.length,
            entitiesExtracted: totalEntities,
            latencyMs,
          });

          return Response.json({
            success: true,
            data: {
              processed: results.length,
              results: results.map((r) => ({
                documentId: r.documentId,
                chunksProcessed: r.chunksProcessed,
                entitiesExtracted: r.entitiesExtracted,
              })),
            },
          });
        } catch (error) {
          const latencyMs = Date.now() - startTime;

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

          // T-65-14: Generic error message
          log.error(
            "GraphRAG ingest failed",
            error instanceof Error ? error : new Error(String(error)),
            { workspaceId, latencyMs }
          );

          return Response.json(
            { success: false, error: "Ingest failed" },
            { status: 500 }
          );
        }
      },
    },
  },
});
