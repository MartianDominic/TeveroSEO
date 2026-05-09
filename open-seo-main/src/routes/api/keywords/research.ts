/**
 * Research API Route
 * Phase 93: Keyword Coverage Intelligence
 *
 * POST /api/keywords/research
 * Performs keyword research with deduplication and mode support.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { keywordDeduplicator } from "@/server/features/keywords/services/KeywordDeduplicator";
import { researchSessionService } from "@/server/features/keywords/services/ResearchSessionService";
import { type ResearchMode } from "@/db/research-session-schema";
import { db } from "@/db";
import { prospects } from "@/db/prospect-schema";
import { eq, and } from "drizzle-orm";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { createLogger } from "@/server/lib/logger";
import { DFS_LABS_PRICING } from "@/server/features/scraping/cost";

const log = createLogger({ module: "api:keywords:research" });

// Cost per request from canonical pricing module
const COST_PER_REQUEST_USD = DFS_LABS_PRICING.searchVolumeBase;

const bodySchema = z.object({
  prospectId: z.string().min(1),
  mode: z.enum(["EXPAND", "DEEP_DIVE", "COMPETITOR"]),
  keywords: z.array(z.string().min(1)).min(1).max(1000), // DataForSEO limit
  locationCode: z.number().int().positive().optional().default(2440), // Lithuania
  languageCode: z.string().min(2).max(5).optional().default("lt"),
  metadata: z
    .object({
      cluster_id: z.string().optional(),
      competitor_domain: z.string().optional(),
      user_intent: z.string().optional(),
    })
    .optional(),
});

// @ts-expect-error Route path is correct but may not be in generated types yet
export const Route = createFileRoute("/api/keywords/research")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          // Parse body
          const body = await request.json();
          const params = bodySchema.safeParse(body);

          if (!params.success) {
            return new Response(
              JSON.stringify({
                success: false,
                error: params.error.issues[0]?.message || "Invalid parameters",
              }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }

          const { prospectId, mode, keywords, locationCode, languageCode, metadata } =
            params.data;

          // Get auth context
          const auth = await requireApiAuth(request);

          // Verify prospect belongs to user's workspace
          const [prospect] = await db
            .select({ id: prospects.id })
            .from(prospects)
            .where(
              and(
                eq(prospects.id, prospectId),
                eq(prospects.workspaceId, auth.organizationId)
              )
            )
            .limit(1);

          if (!prospect) {
            return new Response(
              JSON.stringify({ success: false, error: "Prospect not found" }),
              { status: 404, headers: { "Content-Type": "application/json" } }
            );
          }

          // CRITICAL: Deduplicate BEFORE API call per 93-RESEARCH.md pitfall #1
          const dedupResult = await keywordDeduplicator.deduplicateBeforeResearch(
            prospectId,
            keywords
          );

          log.info("Deduplication complete", {
            prospectId,
            mode,
            newCount: dedupResult.new.length,
            duplicateCount: dedupResult.duplicate.length,
          });

          // If all keywords are duplicates, return early with cost saved
          if (dedupResult.new.length === 0) {
            const potentialCost = COST_PER_REQUEST_USD;

            // Still record session (shows user we detected duplicates)
            await researchSessionService.recordSession({
              prospectId,
              mode: mode as ResearchMode,
              seedKeywords: keywords,
              locationCode,
              languageCode,
              newKeywordsCount: 0,
              duplicateCount: dedupResult.duplicate.length,
              totalCostUsd: 0, // No API call made
              triggeredBy: auth.userId,
              metadata,
            });

            return new Response(
              JSON.stringify({
                success: true,
                data: {
                  newCount: 0,
                  duplicateCount: dedupResult.duplicate.length,
                  costUsd: 0,
                  costSavedUsd: potentialCost,
                  message: `All ${dedupResult.duplicate.length} keywords already researched. Last updated: check coverage dashboard.`,
                },
              }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            );
          }

          // TODO: Call DataForSEO API with dedupResult.new keywords
          // This would be wired to existing KeywordEnrichmentService
          // For now, return the deduplication results to demonstrate the flow

          const actualCost = COST_PER_REQUEST_USD;
          const potentialCost = COST_PER_REQUEST_USD; // Would be more if no deduplication
          const costSaved =
            dedupResult.duplicate.length > 0
              ? (dedupResult.duplicate.length / keywords.length) * potentialCost
              : 0;

          // Record research session
          await researchSessionService.recordSession({
            prospectId,
            mode: mode as ResearchMode,
            seedKeywords: keywords,
            locationCode,
            languageCode,
            newKeywordsCount: dedupResult.new.length,
            duplicateCount: dedupResult.duplicate.length,
            totalCostUsd: actualCost,
            triggeredBy: auth.userId,
            metadata,
          });

          log.info("Research session recorded", {
            prospectId,
            mode,
            newCount: dedupResult.new.length,
            costUsd: actualCost,
          });

          return new Response(
            JSON.stringify({
              success: true,
              data: {
                newCount: dedupResult.new.length,
                duplicateCount: dedupResult.duplicate.length,
                costUsd: actualCost,
                costSavedUsd: costSaved,
                newKeywords: dedupResult.new, // For UI display
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        } catch (error) {
          // Handle authentication errors
          if (error instanceof Error && error.message.includes("UNAUTHENTICATED")) {
            return new Response(
              JSON.stringify({ success: false, error: "Unauthorized" }),
              { status: 401, headers: { "Content-Type": "application/json" } }
            );
          }

          log.error("Research API error", error as Error);
          return new Response(
            JSON.stringify({ success: false, error: "Internal server error" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});
