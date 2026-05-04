/**
 * POST /api/proposals/:id/generate - AI content generation endpoint.
 * Phase 57-07: AI Content Generation
 *
 * Generates AI-powered content for proposal sections.
 * Creates a version with changeType: ai_generated.
 *
 * SECURITY: Requires authentication via API key or Clerk JWT.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { proposals, type ProposalContent } from "@/db/proposal-schema";
import {
  proposalAIGenerationService,
  type GeneratableSectionType,
  type ContextType,
  type TonePreset,
  type GenerationLanguage,
} from "@/server/features/proposals/services/ProposalAIGenerationService";
import { VersionService } from "@/server/features/proposals/services/VersionService";
import { createLogger } from "@/server/lib/logger";
import { rateLimit, rateLimitExceededResponse } from "@/server/middleware/rate-limit";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { AppError } from "@/server/lib/errors";

const log = createLogger({ module: "api/proposals/generate" });

/**
 * Rate limit config: 10 generations per hour per proposal.
 */
const AI_GEN_RATE_LIMIT = {
  limit: 10,
  window: 3600, // 1 hour
};

/**
 * Request body schema.
 */
const generateRequestSchema = z.object({
  sections: z.array(
    z.enum(["hero", "current_state", "opportunities", "roi"])
  ).min(1, "At least one section required"),
  context: z.array(
    z.enum(["audit", "keywords", "prospect", "competitor"])
  ).default([]),
  tone: z.enum(["professional", "friendly", "technical", "urgent"]).default("professional"),
  language: z.enum(["en", "lt"]).default("lt"),
});

export type GenerateRequest = z.infer<typeof generateRequestSchema>;

/**
 * Route definition - TanStack Start pattern.
 */
export const Route = createFileRoute("/api/proposals/id/generate")({
  server: {
    handlers: {
      /**
       * POST - Generate AI content for proposal sections.
       */
      POST: async ({ request }: { request: Request }) => {
        try {
          // CRITICAL: Authentication required
          const authContext = await requireApiAuth(request);
          log.debug("Authenticated request", { userId: authContext.userId });

          // Extract proposal ID from URL
          const url = new URL(request.url);
          const pathParts = url.pathname.split("/");
          const proposalIdIndex = pathParts.findIndex((p) => p === "proposals") + 1;
          const proposalId = pathParts[proposalIdIndex];

          if (!proposalId) {
            return Response.json(
              { success: false, error: "Proposal ID required" },
              { status: 400 }
            );
          }

          // Rate limit per user (not per proposal to prevent bypass)
          const rateLimitResult = await rateLimit({
            key: `ai-gen:${authContext.userId}`,
            ...AI_GEN_RATE_LIMIT,
          });

          if (!rateLimitResult.allowed) {
            return rateLimitExceededResponse(rateLimitResult);
          }

          // Verify proposal exists
          const [proposal] = await db
            .select({
              id: proposals.id,
              workspaceId: proposals.workspaceId,
              content: proposals.content,
            })
            .from(proposals)
            .where(eq(proposals.id, proposalId))
            .limit(1);

          if (!proposal) {
            return Response.json(
              { success: false, error: "Proposal not found" },
              { status: 404 }
            );
          }

          // Parse and validate body
          const body = await request.json();
          const parsed = generateRequestSchema.safeParse(body);

          if (!parsed.success) {
            return Response.json(
              { success: false, error: "Validation failed", details: parsed.error.flatten() },
              { status: 400 }
            );
          }

          const { sections, context, tone, language } = parsed.data;

          log.info("Starting AI generation", {
            proposalId,
            sections,
            context,
            tone,
            language,
          });

          // Generate content
          const result = await proposalAIGenerationService.generateContent({
            proposalId,
            sections: sections as GeneratableSectionType[],
            context: context as ContextType[],
            tone: tone as TonePreset,
            language: language as GenerationLanguage,
          });

          // Parse generated content into proposal structure
          const updatedContent = { ...proposal.content } as ProposalContent;

          for (const generated of result.generated) {
            try {
              const parsedContent = JSON.parse(generated.content);

              switch (generated.sectionType) {
                case "hero":
                  if (parsedContent.headline) {
                    updatedContent.hero = {
                      ...updatedContent.hero,
                      headline: parsedContent.headline,
                      subheadline: parsedContent.subheadline || updatedContent.hero?.subheadline || "",
                      trafficValue:
                        parsedContent.highlightMetric?.value
                          ? parseInt(String(parsedContent.highlightMetric.value).replace(/\D/g, ""), 10) || 0
                          : updatedContent.hero?.trafficValue || 0,
                    };
                  }
                  break;

                case "current_state":
                  if (parsedContent.summary || parsedContent.metrics) {
                    updatedContent.currentState = {
                      ...updatedContent.currentState,
                      traffic: updatedContent.currentState?.traffic || 0,
                      keywords: updatedContent.currentState?.keywords || 0,
                      value: updatedContent.currentState?.value || 0,
                      chartData: updatedContent.currentState?.chartData || [],
                    };
                  }
                  break;

                case "opportunities":
                  // Keep existing opportunities, AI content is supplementary
                  break;

                case "roi":
                  if (parsedContent.projections || parsedContent.comparison) {
                    updatedContent.roi = {
                      ...updatedContent.roi,
                      projectedTrafficGain: updatedContent.roi?.projectedTrafficGain || 0,
                      trafficValue: updatedContent.roi?.trafficValue || 0,
                      defaultConversionRate: updatedContent.roi?.defaultConversionRate || 0.02,
                      defaultAov: updatedContent.roi?.defaultAov || 50,
                    };
                  }
                  break;
              }
            } catch {
              log.warn("Could not parse AI content as JSON", {
                sectionType: generated.sectionType,
              });
            }
          }

          // Create version with AI-generated content
          const version = await VersionService.createVersion({
            proposalId,
            content: updatedContent,
            changeType: "ai_generated",
            changeDescriptionEn: `AI generated: ${sections.join(", ")}`,
            changeDescriptionLt: `AI sugeneravo: ${sections.join(", ")}`,
            changedSections: sections,
          });

          // Update proposal content
          await db
            .update(proposals)
            .set({
              content: updatedContent,
              updatedAt: new Date(),
            })
            .where(eq(proposals.id, proposalId));

          log.info("AI generation complete", {
            proposalId,
            generatedCount: result.generated.length,
            errorCount: result.errors.length,
            versionId: version.id,
          });

          return Response.json({
            success: true,
            data: {
              generated: result.generated,
              errors: result.errors,
              versionId: version.id,
              versionNumber: version.versionNumber,
            },
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

          log.error(
            "AI generation failed",
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
