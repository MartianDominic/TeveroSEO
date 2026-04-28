/**
 * Workspace ranking data API endpoint.
 * Phase 41-02: Pattern Detection with Real GSC Data
 *
 * GET /api/workspaces/{workspaceId}/ranking-data
 * Returns aggregated keyword ranking data for all clients in a workspace.
 */
import { createFileRoute } from "@tanstack/react-router";
import { db } from "@/db";
import { keywordRankings } from "@/db/ranking-schema";
import { savedKeywords, projects } from "@/db/app.schema";
import { clients } from "@/db/client-schema";
import { eq, desc, and, gte } from "drizzle-orm";
import { createLogger } from "@/server/lib/logger";
import { AppError } from "@/server/lib/errors";
import { requireApiAuth } from "@/routes/api/seo/-middleware";

const log = createLogger({ module: "api/workspaces/ranking-data" });

/**
 * Individual keyword ranking data.
 */
interface KeywordRankingResponse {
  keyword: string;
  currentPosition: number | null;
  previousPosition: number | null;
  change: number;
}

/**
 * Client ranking data response.
 */
interface ClientRankingResponse {
  clientId: string;
  clientName: string;
  topKeywords: KeywordRankingResponse[];
  improvedCount: number;
  droppedCount: number;
}

export const Route = createFileRoute(
  "/api/workspaces/$workspaceId/ranking-data"
)({
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

          // Get all clients in workspace with their projects
          const workspaceClients = await db
            .select({
              id: clients.id,
              name: clients.name,
            })
            .from(clients)
            .where(eq(clients.workspaceId, workspaceId));

          if (workspaceClients.length === 0) {
            return Response.json([]);
          }

          // Calculate date 7 days ago for previous position comparison
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          const weekAgoStr = weekAgo.toISOString().split("T")[0];

          // Fetch ranking data for each client
          const rankingData: ClientRankingResponse[] = await Promise.all(
            workspaceClients.map(async (client) => {
              // Get projects for this client
              const clientProjects = await db
                .select({ id: projects.id })
                .from(projects)
                .where(eq(projects.organizationId, workspaceId))
                .limit(5);

              if (clientProjects.length === 0) {
                return {
                  clientId: client.id,
                  clientName: client.name,
                  topKeywords: [],
                  improvedCount: 0,
                  droppedCount: 0,
                };
              }

              // Get tracked keywords for these projects
              const projectIds = clientProjects.map((p) => p.id);
              const keywords = await db
                .select({
                  id: savedKeywords.id,
                  keyword: savedKeywords.keyword,
                  projectId: savedKeywords.projectId,
                })
                .from(savedKeywords)
                .where(
                  and(
                    eq(savedKeywords.trackingEnabled, true),
                    // Get from first project for simplicity
                    eq(savedKeywords.projectId, projectIds[0])
                  )
                )
                .limit(10);

              // Get rankings for each keyword
              const topKeywords: KeywordRankingResponse[] = await Promise.all(
                keywords.slice(0, 10).map(async (kw) => {
                  // Get latest ranking
                  const [latest] = await db
                    .select({
                      position: keywordRankings.position,
                      date: keywordRankings.date,
                    })
                    .from(keywordRankings)
                    .where(eq(keywordRankings.keywordId, kw.id))
                    .orderBy(desc(keywordRankings.date))
                    .limit(1);

                  // Get ranking from ~7 days ago
                  const [previous] = await db
                    .select({
                      position: keywordRankings.position,
                    })
                    .from(keywordRankings)
                    .where(
                      and(
                        eq(keywordRankings.keywordId, kw.id),
                        gte(keywordRankings.date, new Date(weekAgoStr))
                      )
                    )
                    .orderBy(keywordRankings.date)
                    .limit(1);

                  const currentPosition = latest?.position ?? null;
                  const previousPosition = previous?.position ?? null;
                  // Positive change = improvement (lower position is better)
                  const change =
                    currentPosition !== null && previousPosition !== null
                      ? previousPosition - currentPosition
                      : 0;

                  return {
                    keyword: kw.keyword,
                    currentPosition,
                    previousPosition,
                    change,
                  };
                })
              );

              const improvedCount = topKeywords.filter((r) => r.change > 0).length;
              const droppedCount = topKeywords.filter((r) => r.change < 0).length;

              return {
                clientId: client.id,
                clientName: client.name,
                topKeywords,
                improvedCount,
                droppedCount,
              };
            })
          );

          log.info("Ranking data retrieved", {
            workspaceId,
            clientCount: rankingData.length,
          });

          return Response.json(rankingData);
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
            "Failed to fetch ranking data",
            err instanceof Error ? err : new Error(String(err))
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },
    },
  },
});
