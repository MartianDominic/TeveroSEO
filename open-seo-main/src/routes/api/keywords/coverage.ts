/**
 * Coverage API Route
 * Phase 93: Keyword Coverage Intelligence
 *
 * GET /api/keywords/coverage?prospectId=xxx
 * Returns coverage summary for a prospect.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { coverageCalculator } from "@/server/features/keywords/services/CoverageCalculator";
import { db } from "@/db";
import { prospects } from "@/db/prospect-schema";
import { eq, and } from "drizzle-orm";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api:keywords:coverage" });

const querySchema = z.object({
  prospectId: z.string().min(1, "prospectId is required"),
});

export const Route = createFileRoute("/api/keywords/coverage")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        try {
          // Parse query params
          const url = new URL(request.url);
          const params = querySchema.safeParse({
            prospectId: url.searchParams.get("prospectId"),
          });

          if (!params.success) {
            return new Response(
              JSON.stringify({
                success: false,
                error: params.error.issues[0]?.message || "Invalid parameters",
              }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }

          const { prospectId } = params.data;

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

          // Calculate coverage
          const coverage = await coverageCalculator.calculateCoverage(prospectId);

          log.info("Coverage calculated", { prospectId, totalKeywords: coverage.totalKeywords });

          return new Response(
            JSON.stringify({ success: true, data: coverage }),
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

          log.error("Coverage API error", error as Error);
          return new Response(
            JSON.stringify({ success: false, error: "Internal server error" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});
