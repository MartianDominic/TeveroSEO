/**
 * API endpoint for tiered proposal generation.
 * Phase 101-06: Tiered AI Proposal Generation
 *
 * POST /api/proposals/tiered-generate
 * Generates proposals with 4 modes per D-03: Full AI, AI-Assisted, Template+Manual, Blank
 *
 * GET /api/proposals/tiered-generate
 * Returns available generation modes and their descriptions.
 *
 * SECURITY: Requires authentication via API key or Clerk JWT.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  ProposalGenerationService,
  ProposalGenerationMode,
  type GenerationInput,
} from "@/server/features/proposals/services/ProposalGenerationService";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { AppError } from "@/server/lib/errors";
import { createLogger } from "@/server/lib/logger";
import { rateLimit, rateLimitExceededResponse } from "@/server/middleware/rate-limit";

const log = createLogger({ module: "api/proposals/tiered-generate" });

/** Rate limit: 10 generations per hour (AI operations are expensive) */
const TIERED_GEN_RATE_LIMIT = {
  limit: 10,
  window: 3600,
};

/**
 * Zod schemas for discriminated union validation
 */
const FullAISchema = z.object({
  mode: z.literal(ProposalGenerationMode.FULL_AI),
  prospectId: z.string().min(1, "prospectId is required"),
  packageId: z.string().min(1, "packageId is required"),
  templateId: z.string().optional(),
  additionalContext: z.string().optional(),
});

const AIAssistedSchema = z.object({
  mode: z.literal(ProposalGenerationMode.AI_ASSISTED),
  prospectId: z.string().min(1, "prospectId is required"),
  packageId: z.string().min(1, "packageId is required"),
  templateId: z.string().optional(),
  partialContent: z.object({
    headline: z.string().optional(),
    painPoints: z.array(z.string()).optional(),
    opportunities: z.array(z.string()).optional(),
    customInclusions: z.array(z.string()).optional(),
  }),
});

const TemplateManualSchema = z.object({
  mode: z.literal(ProposalGenerationMode.TEMPLATE_MANUAL),
  prospectId: z.string().min(1, "prospectId is required"),
  templateId: z.string().min(1, "templateId is required"),
  packageId: z.string().min(1, "packageId is required"),
});

const BlankSchema = z.object({
  mode: z.literal(ProposalGenerationMode.BLANK),
  prospectId: z.string().min(1, "prospectId is required"),
});

const GenerateRequestSchema = z.discriminatedUnion("mode", [
  FullAISchema,
  AIAssistedSchema,
  TemplateManualSchema,
  BlankSchema,
]);

/**
 * Map validated input to GenerationInput type
 */
function toGenerationInput(input: z.infer<typeof GenerateRequestSchema>): GenerationInput {
  switch (input.mode) {
    case ProposalGenerationMode.FULL_AI:
      return {
        mode: input.mode,
        data: {
          prospectId: input.prospectId,
          packageId: input.packageId,
          templateId: input.templateId,
          additionalContext: input.additionalContext,
        },
      };

    case ProposalGenerationMode.AI_ASSISTED:
      return {
        mode: input.mode,
        data: {
          prospectId: input.prospectId,
          packageId: input.packageId,
          templateId: input.templateId,
          partialContent: input.partialContent,
        },
      };

    case ProposalGenerationMode.TEMPLATE_MANUAL:
      return {
        mode: input.mode,
        data: {
          prospectId: input.prospectId,
          templateId: input.templateId,
          packageId: input.packageId,
        },
      };

    case ProposalGenerationMode.BLANK:
      return {
        mode: input.mode,
        data: {
          prospectId: input.prospectId,
        },
      };
  }
}

// @ts-expect-error Route type not yet in FileRoutesByPath - regenerate with `pnpm tanstack-router generate`
export const Route = createFileRoute("/api/proposals/tiered-generate")({
  server: {
    handlers: {
      /**
       * POST /api/proposals/tiered-generate
       *
       * Generate a proposal using one of 4 modes:
       * - full_ai: AI generates complete proposal
       * - ai_assisted: AI expands user-provided details
       * - template_manual: Use template with package pricing
       * - blank: Empty structure for custom deals
       */
      POST: async ({ request }: { request: Request }) => {
        try {
          // 1. Authenticate request
          const authContext = await requireApiAuth(request);
          log.debug("Authenticated request", { userId: authContext.userId });

          // 2. Rate limit check (AI operations are expensive)
          const rateLimitResult = await rateLimit({
            key: `tiered-gen:${authContext.userId}`,
            ...TIERED_GEN_RATE_LIMIT,
          });
          if (!rateLimitResult.allowed) {
            return rateLimitExceededResponse(rateLimitResult);
          }

          // 3. Parse and validate request body
          const body = await request.json();
          const parseResult = GenerateRequestSchema.safeParse(body);

          if (!parseResult.success) {
            return Response.json(
              {
                success: false,
                error: "Invalid request",
                details: parseResult.error.issues,
              },
              { status: 400 }
            );
          }

          const input = parseResult.data;
          const generationInput = toGenerationInput(input);

          log.info("Generating proposal", {
            mode: input.mode,
            prospectId: input.prospectId,
            workspaceId: authContext.organizationId,
          });

          // 4. Generate proposal
          const result = await ProposalGenerationService.generate(
            generationInput,
            authContext.organizationId,
            authContext.userId
          );

          log.info("Proposal generated successfully", {
            proposalId: result.proposalId,
            mode: result.mode,
            aiGenerated: result.aiGenerated,
          });

          return Response.json(
            {
              success: true,
              data: result,
            },
            { status: 201 }
          );
        } catch (error) {
          // Handle authentication errors
          if (error instanceof AppError) {
            if (error.code === "UNAUTHENTICATED") {
              return Response.json(
                { success: false, error: error.message },
                { status: 401 }
              );
            }
            if (error.code === "FORBIDDEN") {
              return Response.json(
                { success: false, error: error.message },
                { status: 403 }
              );
            }
          }

          // Handle specific errors
          const message = error instanceof Error ? error.message : "Generation failed";

          if (message.includes("Prospect not found")) {
            return Response.json(
              { success: false, error: "Prospect not found" },
              { status: 404 }
            );
          }

          if (message.includes("Package not found") || message.includes("No template found")) {
            return Response.json(
              { success: false, error: message },
              { status: 404 }
            );
          }

          log.error("Proposal generation failed", error instanceof Error ? error : new Error(String(error)));

          return Response.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
          );
        }
      },

      /**
       * GET /api/proposals/tiered-generate
       *
       * Returns available generation modes and their descriptions.
       * Useful for UI to render mode selector.
       */
      GET: async ({ request }: { request: Request }) => {
        try {
          // Authentication required to get modes (prevents enumeration)
          await requireApiAuth(request);

          return Response.json({
            success: true,
            data: {
              modes: [
                {
                  id: ProposalGenerationMode.FULL_AI,
                  name: "Full AI Generation",
                  description: "AI generates complete proposal from domain and package selection",
                  aiLevel: "full",
                  requiredFields: ["prospectId", "packageId"],
                  optionalFields: ["templateId", "additionalContext"],
                },
                {
                  id: ProposalGenerationMode.AI_ASSISTED,
                  name: "AI-Assisted",
                  description: "Provide key details (headline, pain points), AI fills in the gaps",
                  aiLevel: "partial",
                  requiredFields: ["prospectId", "packageId", "partialContent"],
                  optionalFields: ["templateId"],
                },
                {
                  id: ProposalGenerationMode.TEMPLATE_MANUAL,
                  name: "Template + Manual",
                  description: "Pick template and package, fill in client specifics manually",
                  aiLevel: "none",
                  requiredFields: ["prospectId", "templateId", "packageId"],
                  optionalFields: [],
                },
                {
                  id: ProposalGenerationMode.BLANK,
                  name: "Blank Manual",
                  description: "Start from scratch for fully custom deals",
                  aiLevel: "none",
                  requiredFields: ["prospectId"],
                  optionalFields: [],
                },
              ],
            },
          });
        } catch (error) {
          if (error instanceof AppError && error.code === "UNAUTHENTICATED") {
            return Response.json(
              { success: false, error: error.message },
              { status: 401 }
            );
          }

          return Response.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
          );
        }
      },
    },
  },
});
