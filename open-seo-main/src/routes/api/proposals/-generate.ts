/**
 * API endpoint for proposal generation.
 * Phase 43-06: Proposal Generation
 *
 * POST /api/proposals/generate
 * Generates a full AI-powered proposal for a prospect.
 *
 * SECURITY: Requires authentication via API key or Clerk JWT.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createLogger } from "@/server/lib/logger";
import {
  proposalGeneratorService,
  type ProposalScenario,
} from "@/server/features/proposals/services/ProposalGeneratorService";
import type { AwarenessLevel } from "@/server/features/proposals/services/AwarenessClassifier";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { AppError } from "@/server/lib/errors";
import { rateLimit, rateLimitExceededResponse } from "@/server/middleware/rate-limit";

/** Rate limit config for proposal generation: 5 proposals per hour per user (AI operation) */
const PROPOSAL_GEN_RATE_LIMIT = {
  limit: 5,
  window: 3600, // 1 hour in seconds
};

const log = createLogger({ module: "api/proposals/generate" });

interface GenerateRequestBody {
  prospectId: string;
  scenario: ProposalScenario;
  awarenessLevel?: AwarenessLevel;
  pricing: {
    setupFee: number;
    monthlyFee: number;
    contractMonths: number;
  };
  agencyInfo?: {
    name?: string;
    positioning?: string;
    differentiators?: string[];
  };
  language?: "lt" | "en";
}

/**
 * POST /api/proposals/generate
 *
 * Request body:
 * {
 *   "prospectId": "prosp_xxx",
 *   "scenario": "focused" | "full_audit" | "competitor_only",
 *   "awarenessLevel": "unaware" | "problem-aware" | ... (optional, auto-detected if not provided)
 *   "pricing": {
 *     "setupFee": 500,
 *     "monthlyFee": 800,
 *     "contractMonths": 6
 *   },
 *   "agencyInfo": { ... } (optional),
 *   "language": "lt" | "en" (optional, default "lt")
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "proposalId": "prop_xxx",
 *     "awarenessLevel": "solution-aware",
 *     "scenario": "focused",
 *     "sections": [...]
 *   }
 * }
 */
// @ts-expect-error Route type not yet in FileRoutesByPath - regenerate with `pnpm tanstack-router generate`
export const Route = createFileRoute("/api/proposals/generate")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          // CRITICAL: Authentication required
          const authContext = await requireApiAuth(request);
          log.debug("Authenticated request", { userId: authContext.userId });

          // Rate limit: 5 proposals per hour per user (AI operation)
          const rateLimitResult = await rateLimit({
            key: `proposal-gen:${authContext.userId}`,
            ...PROPOSAL_GEN_RATE_LIMIT,
          });
          if (!rateLimitResult.allowed) {
            return rateLimitExceededResponse(rateLimitResult);
          }

          const body: GenerateRequestBody = await request.json();

          // Validate required fields
          if (!body.prospectId) {
            return Response.json(
              { success: false, error: "prospectId is required" },
              { status: 400 }
            );
          }

          if (!body.scenario) {
            return Response.json(
              { success: false, error: "scenario is required" },
              { status: 400 }
            );
          }

          const validScenarios: ProposalScenario[] = [
            "focused",
            "full_audit",
            "competitor_only",
          ];
          if (!validScenarios.includes(body.scenario)) {
            return Response.json(
              {
                success: false,
                error: `Invalid scenario. Must be one of: ${validScenarios.join(", ")}`,
              },
              { status: 400 }
            );
          }

          if (!body.pricing) {
            return Response.json(
              { success: false, error: "pricing is required" },
              { status: 400 }
            );
          }

          log.info("Generating proposal", {
            prospectId: body.prospectId,
            scenario: body.scenario,
          });

          const result = await proposalGeneratorService.generateProposal({
            prospectId: body.prospectId,
            scenario: body.scenario,
            awarenessLevel: body.awarenessLevel,
            pricing: body.pricing,
            agencyInfo: body.agencyInfo,
            language: body.language,
          });

          log.info("Proposal generated successfully", {
            proposalId: result.proposalId,
            awarenessLevel: result.awarenessLevel,
          });

          return Response.json({
            success: true,
            data: result,
          });
        } catch (error) {
          // Handle authentication errors
          if (error instanceof AppError) {
            if (error.code === "UNAUTHENTICATED") {
              return Response.json({ success: false, error: error.message }, { status: 401 });
            }
            if (error.code === "FORBIDDEN") {
              return Response.json({ success: false, error: error.message }, { status: 403 });
            }
          }

          log.error("Failed to generate proposal", error instanceof Error ? error : new Error(String(error)));

          if (error instanceof Error && error.message === "Prospect not found") {
            return Response.json({ success: false, error: "Prospect not found" }, { status: 404 });
          }

          return Response.json(
            { success: false, error: "Failed to generate proposal" },
            { status: 500 }
          );
        }
      },
    },
  },
});
