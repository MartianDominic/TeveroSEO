/**
 * Prospect Keywords API Endpoint
 * Phase 43-04: Prioritization Engine + UI
 *
 * GET /api/prospects/:id/keywords - List keywords with filtering and sorting
 * PATCH /api/prospects/:id/keywords - Bulk update tier for selected keywords
 */

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { db } from "@/db";
import { prospectKeywords, KEYWORD_TIERS } from "@/db/prospect-keyword-schema";
import { eq, desc, asc, and, inArray, isNotNull, sql } from "drizzle-orm";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api/prospects/:id/keywords" });

const ListQuerySchema = z.object({
  tier: z.enum(KEYWORD_TIERS).optional(),
  source: z.string().optional(),
  quickWin: z.coerce.boolean().optional(),
  sortBy: z
    .enum(["compositeScore", "searchVolume", "keywordDifficulty", "createdAt"])
    .optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  limit: z.coerce.number().min(1).max(500).optional(),
  offset: z.coerce.number().min(0).optional(),
});

const BulkUpdateSchema = z.object({
  keywordIds: z.array(z.string()).min(1).max(500),
  tier: z.enum(KEYWORD_TIERS),
});

export const Route = createFileRoute("/api/prospects/$id/keywords/")({
  server: {
    handlers: {
      /**
       * GET /api/prospects/:id/keywords
       * List keywords with filtering and sorting
       */
      GET: async ({
        request,
        params,
      }: {
        request: Request;
        params: { id: string };
      }) => {
        try {
          const { id: prospectId } = params;
          const url = new URL(request.url);
          const queryParams = Object.fromEntries(url.searchParams);
          const query = ListQuerySchema.parse(queryParams);

          log.info("Listing keywords for prospect", { prospectId, query });

          // Build query conditions
          const conditions = [eq(prospectKeywords.prospectId, prospectId)];

          if (query.tier) {
            conditions.push(eq(prospectKeywords.tier, query.tier));
          }
          if (query.source) {
            conditions.push(eq(prospectKeywords.source, query.source));
          }
          if (query.quickWin) {
            conditions.push(isNotNull(prospectKeywords.quickWinType));
          }

          // Determine sort
          const sortColumn = {
            compositeScore: prospectKeywords.compositeScore,
            searchVolume: prospectKeywords.searchVolume,
            keywordDifficulty: prospectKeywords.keywordDifficulty,
            createdAt: prospectKeywords.createdAt,
          }[query.sortBy || "compositeScore"];

          const orderFn = query.sortOrder === "asc" ? asc : desc;

          // Execute query
          const keywords = await db
            .select()
            .from(prospectKeywords)
            .where(and(...conditions))
            .orderBy(
              orderFn(sortColumn || prospectKeywords.compositeScore)
            )
            .limit(query.limit || 100)
            .offset(query.offset || 0);

          // Get total count
          const totalResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(prospectKeywords)
            .where(eq(prospectKeywords.prospectId, prospectId));

          const total = Number(totalResult[0]?.count ?? 0);

          // Get tier counts
          const tierCounts = await db
            .select({
              tier: prospectKeywords.tier,
              count: sql<number>`count(*)`,
            })
            .from(prospectKeywords)
            .where(eq(prospectKeywords.prospectId, prospectId))
            .groupBy(prospectKeywords.tier);

          const counts: Record<string, number> = {};
          for (const row of tierCounts) {
            if (row.tier) counts[row.tier] = Number(row.count);
          }

          return Response.json({
            success: true,
            data: {
              keywords,
              total,
              filtered: keywords.length,
              tierCounts: counts,
            },
          });
        } catch (error) {
          if (error instanceof z.ZodError) {
            return Response.json(
              { success: false, error: error.issues },
              { status: 400 }
            );
          }
          log.error(
            "Keyword list failed",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
          );
        }
      },

      /**
       * PATCH /api/prospects/:id/keywords
       * Bulk update tier for selected keywords
       */
      PATCH: async ({
        request,
        params,
      }: {
        request: Request;
        params: { id: string };
      }) => {
        try {
          const { id: prospectId } = params;
          const body = await request.json();
          const input = BulkUpdateSchema.parse(body);

          log.info("Bulk updating keyword tiers", {
            prospectId,
            keywordCount: input.keywordIds.length,
            tier: input.tier,
          });

          // Update keywords - verify they belong to this prospect
          const result = await db
            .update(prospectKeywords)
            .set({ tier: input.tier, updatedAt: new Date() })
            .where(
              and(
                inArray(prospectKeywords.id, input.keywordIds),
                eq(prospectKeywords.prospectId, prospectId)
              )
            );

          return Response.json({
            success: true,
            data: { updated: input.keywordIds.length },
          });
        } catch (error) {
          if (error instanceof z.ZodError) {
            return Response.json(
              { success: false, error: error.issues },
              { status: 400 }
            );
          }
          log.error(
            "Bulk update failed",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
          );
        }
      },
    },
  },
});
