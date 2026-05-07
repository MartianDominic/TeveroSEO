/**
 * On-Page Mastery Analysis API
 * Phase 92-09: API Routes + UI Components
 *
 * POST /api/onpage-mastery/analyze/$clientId - Run on-page analysis
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  getVerticalClassifierService,
  getQualityGateService,
  getRuleEngineService,
} from "@/server/features/onpage-mastery/services";
import type { OnPageMasteryContext } from "@/server/features/onpage-mastery/types";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api/onpage-mastery/analyze" });

const AnalyzeRequestSchema = z.object({
  url: z.string().url(),
  html: z.string().min(100).max(500000),
  serpContent: z.array(z.string()).optional(),
  pageId: z.string().optional(),
});

export const Route = createFileRoute(
  "/api/onpage-mastery/analyze/$clientId" as never
)({
  server: {
    handlers: {
      POST: async ({
        request,
        params,
      }: {
        request: Request;
        params: { clientId: string };
      }) => {
        const { clientId } = params;

        try {
          const body = (await request.json()) as Record<string, unknown>;
          const parsed = AnalyzeRequestSchema.safeParse(body);

          if (!parsed.success) {
            return Response.json(
              { success: false, error: parsed.error.message },
              { status: 400 }
            );
          }

          const { url, html, serpContent, pageId } = parsed.data;

          // 1. Classify vertical
          const classifier = await getVerticalClassifierService();
          const domain = new URL(url).hostname;
          const path = new URL(url).pathname;
          const classification = await classifier.classify(
            domain,
            path,
            html,
            clientId
          );

          // 2. Build context
          const ctx: OnPageMasteryContext = {
            url,
            html,
            vertical: classification.vertical,
            isYmyl: classification.isYmyl,
            clientId,
            pageId,
          };

          // 3. Run quality gates
          const gateService = getQualityGateService();
          const gateResults = await gateService.evaluateAll(
            html,
            classification.vertical,
            serpContent || []
          );

          // 4. Run scorecard
          const ruleEngine = await getRuleEngineService();
          const scorecard = await ruleEngine.evaluateScorecard(ctx);

          return Response.json({
            success: true,
            data: {
              classification,
              qualityGates: gateResults,
              scorecard,
              combinedScore: Math.round(
                gateResults.overallScore * 0.4 + scorecard.score * 0.6
              ),
              blockingFailures: gateResults.blockingFailures,
              recommendations: generateRecommendations(gateResults, scorecard),
            },
          });
        } catch (error) {
          log.error(
            "On-page analysis failed",
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
});

interface GateResults {
  overallScore: number;
  blockingFailures: string[];
}

interface Scorecard {
  score: number;
  failedRules: Array<{ name: string; message: string }>;
}

function generateRecommendations(
  gateResults: GateResults,
  scorecard: Scorecard
): string[] {
  const recommendations: string[] = [];

  for (const failure of gateResults.blockingFailures) {
    recommendations.push(`BLOCKING: Fix ${failure} before publishing`);
  }

  for (const failed of scorecard.failedRules.slice(0, 5)) {
    recommendations.push(`${failed.name}: ${failed.message}`);
  }

  return recommendations;
}
