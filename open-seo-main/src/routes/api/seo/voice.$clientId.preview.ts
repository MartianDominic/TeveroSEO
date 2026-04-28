/**
 * Voice Preview API Route
 * Phase 37: Voice Preview - generates rewritten sample text in client's voice
 *
 * POST /api/seo/voice/:clientId/preview
 * Body: { sampleText: string, voiceMode?: "preservation" | "application" | "best_practices" }
 * Returns: { preview: string, compliance: ComplianceScore }
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import {
  voiceProfileService,
  VoiceConstraintBuilder,
  voiceComplianceService,
} from "@/server/features/voice";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { AppError } from "@/server/lib/errors";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api/seo/voice/preview" });

const CLAUDE_MODEL = process.env.CLAUDE_MODEL_VOICE_PREVIEW || "claude-3-5-sonnet-20241022";
const MAX_TOKENS = 2048;

const previewRequestSchema = z.object({
  sampleText: z.string().min(10, "Sample text must be at least 10 characters"),
  voiceMode: z.enum(["preservation", "application", "best_practices"]).optional(),
});

export const Route = createFileRoute("/api/seo/voice/$clientId/preview")({
  server: {
    handlers: {
      POST: async ({
        request,
        params,
      }: {
        request: Request;
        params: { clientId: string };
      }) => {
        try {
          await requireApiAuth(request);
          const { clientId } = params;

          if (!clientId) {
            throw new AppError("VALIDATION_ERROR", "Missing clientId");
          }

          const body = (await request.json()) as Record<string, unknown>;
          const parsed = previewRequestSchema.safeParse(body);

          if (!parsed.success) {
            return Response.json(
              { error: "Invalid input", details: parsed.error.issues },
              { status: 400 }
            );
          }

          const { sampleText, voiceMode } = parsed.data;

          const profile = await voiceProfileService.getByClientId(clientId);
          if (!profile) {
            return Response.json(
              { error: "No voice profile found for this client" },
              { status: 404 }
            );
          }

          const effectiveMode = voiceMode ?? profile.mode ?? "application";
          const profileWithMode = { ...profile, mode: effectiveMode };

          const builder = new VoiceConstraintBuilder();
          const constraints = await builder.build({ profile: profileWithMode });

          const systemPrompt = `You are a content rewriter that transforms text to match a specific brand voice.

${constraints}

INSTRUCTIONS:
- Rewrite the provided text to match the voice constraints above
- Preserve the core meaning and key information
- Adjust tone, vocabulary, and structure to align with the voice profile
- Return ONLY the rewritten text, no explanations`;

          const userPrompt = `Rewrite the following text in the specified voice:\n\n${sampleText}`;

          const anthropic = new Anthropic();
          const response = await anthropic.messages.create({
            model: CLAUDE_MODEL,
            max_tokens: MAX_TOKENS,
            messages: [
              { role: "user", content: userPrompt },
            ],
            system: systemPrompt,
          });

          const previewText =
            response.content[0].type === "text"
              ? response.content[0].text.trim()
              : "";

          const compliance = await voiceComplianceService.scoreContent(
            previewText,
            profile
          );

          log.info("Voice preview generated", {
            clientId,
            inputLength: sampleText.length,
            outputLength: previewText.length,
            complianceScore: compliance.overall,
          });

          return Response.json({
            preview: previewText,
            compliance: {
              overallScore: compliance.overall,
              passed: compliance.passed,
              dimensions: {
                tone_match: compliance.tone_match,
                vocabulary_match: compliance.vocabulary_match,
                structure_match: compliance.structure_match,
                personality_match: compliance.personality_match,
                rule_compliance: compliance.rule_compliance,
              },
              violations: compliance.violations,
            },
          });
        } catch (error) {
          if (error instanceof AppError) {
            const status =
              error.code === "NOT_FOUND"
                ? 404
                : error.code === "FORBIDDEN"
                  ? 403
                  : 400;
            return Response.json({ error: error.message }, { status });
          }
          log.error(
            "Voice preview generation failed",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json({ error: "Internal server error" }, { status: 500 });
        }
      },
    },
  },
});
