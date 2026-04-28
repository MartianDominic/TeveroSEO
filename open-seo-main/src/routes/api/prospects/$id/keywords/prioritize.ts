/**
 * Keyword Prioritization API Endpoint
 * Phase 43-04: Prioritization Engine + UI
 *
 * POST /api/prospects/:id/keywords/prioritize - Run prioritization algorithm
 */

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  PrioritizationService,
  DEFAULT_WEIGHTS,
  type ScoreWeights,
} from "@/server/features/keywords/services/PrioritizationService";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api/prospects/:id/keywords/prioritize" });

const WeightsSchema = z.object({
  volume: z.number().min(0).max(1),
  competition: z.number().min(0).max(1),
  relevance: z.number().min(0).max(1),
  focus: z.number().min(0).max(1),
  position: z.number().min(0).max(1),
});

const PrioritizeSchema = z.object({
  weights: WeightsSchema.optional(),
});

export const Route = createFileRoute("/api/prospects/$id/keywords/prioritize")({
  server: {
    handlers: {
      /**
       * POST /api/prospects/:id/keywords/prioritize
       * Run prioritization algorithm on all keywords for a prospect
       *
       * Optionally provide custom weights (must sum to 1.0)
       */
      POST: async ({
        request,
        params,
      }: {
        request: Request;
        params: { id: string };
      }) => {
        try {
          const { id: prospectId } = params;
          const body = await request.json();
          const input = PrioritizeSchema.parse(body);

          // Validate weights sum to approximately 1.0 if provided
          if (input.weights) {
            const sum = Object.values(input.weights).reduce((a, b) => a + b, 0);
            if (Math.abs(sum - 1.0) > 0.01) {
              return Response.json(
                {
                  success: false,
                  error: `Weights must sum to 1.0, got ${sum.toFixed(2)}`,
                },
                { status: 400 }
              );
            }
          }

          log.info("Running keyword prioritization", {
            prospectId,
            customWeights: !!input.weights,
          });

          // Create service with custom weights if provided
          const weights: ScoreWeights = input.weights || DEFAULT_WEIGHTS;
          const service = new PrioritizationService(weights);

          const result = await service.prioritizeKeywords(prospectId);

          log.info("Prioritization complete", {
            prospectId,
            processed: result.keywordsProcessed,
            tierCounts: result.tierCounts,
          });

          return Response.json({
            success: true,
            data: result,
          });
        } catch (error) {
          if (error instanceof z.ZodError) {
            return Response.json(
              { success: false, error: error.issues },
              { status: 400 }
            );
          }
          log.error(
            "Prioritization failed",
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
