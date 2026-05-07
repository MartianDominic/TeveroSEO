/**
 * On-Page Mastery Scorecard API
 * Phase 92-09: API Routes + UI Components
 *
 * GET /api/onpage-mastery/scorecard/$clientId - Get scorecard results
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { pageQualityScores } from "@/db/onpage-mastery-schema";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api/onpage-mastery/scorecard" });

const QuerySchema = z.object({
  pageId: z.string().optional(),
  pageUrl: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

export const Route = createFileRoute(
  "/api/onpage-mastery/scorecard/$clientId" as never
)(
  {
    server: {
      handlers: {
        GET: async ({
          request,
          params,
        }: {
          request: Request;
          params: { clientId: string };
        }) => {
          const { clientId } = params;
          const url = new URL(request.url);
          const query = QuerySchema.safeParse(
            Object.fromEntries(url.searchParams)
          );

          if (!query.success) {
            return Response.json(
              { success: false, error: query.error.message },
              { status: 400 }
            );
          }

          try {
            const scores = await db
              .select()
              .from(pageQualityScores)
              .where(eq(pageQualityScores.clientId, clientId))
              .limit(query.data.limit)
              .offset(query.data.offset)
              .orderBy(desc(pageQualityScores.updatedAt));

            return Response.json({
              success: true,
              data: scores,
              pagination: {
                limit: query.data.limit,
                offset: query.data.offset,
                hasMore: scores.length === query.data.limit,
              },
            });
          } catch (error) {
            log.error(
              "Failed to fetch scorecards",
              error instanceof Error ? error : new Error(String(error))
            );
            return Response.json(
              { success: false, error: (error as Error).message },
              { status: 500 }
            );
          }
        },
      },
    },
  }
);
