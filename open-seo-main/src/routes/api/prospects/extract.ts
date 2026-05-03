/**
 * API endpoint for prospect extraction.
 * Phase 56: Prospect Input Excellence
 *
 * POST /api/prospects/extract
 * Extracts business information from conversation text using Claude AI.
 *
 * Security:
 * - T-56-04: Rate limited to 50 extractions per day per workspace
 * - T-56-05: Input sanitized, max 50KB content
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  extractFromConversation,
  type ExtractedProspectData,
} from "@/server/features/prospects/services/ConversationExtractor";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { AppError } from "@/server/lib/errors";
import { logger } from "@/server/lib/logger";

// Rate limit tracking (in-memory for now, could use Redis)
const extractionCounts = new Map<string, { count: number; resetAt: number }>();
const MAX_EXTRACTIONS_PER_DAY = 50;

function checkRateLimit(workspaceId: string): void {
  const now = Date.now();
  const record = extractionCounts.get(workspaceId);

  if (!record || record.resetAt < now) {
    // Reset at midnight UTC
    const tomorrow = new Date();
    tomorrow.setUTCHours(24, 0, 0, 0);
    extractionCounts.set(workspaceId, {
      count: 1,
      resetAt: tomorrow.getTime(),
    });
    return;
  }

  if (record.count >= MAX_EXTRACTIONS_PER_DAY) {
    throw new AppError(
      "RATE_LIMIT",
      `Maximum ${MAX_EXTRACTIONS_PER_DAY} extractions per day. Resets at midnight UTC.`,
    );
  }

  record.count++;
}

const extractRequestSchema = z.object({
  content: z
    .string()
    .min(50, "Content must be at least 50 characters")
    .max(50000, "Content exceeds 50KB limit"),
  inputMode: z.enum(["website", "website_with_context", "conversation"]),
  domain: z.string().optional(),
  contextNotes: z.string().max(50000, "Context notes exceed 50KB limit").optional(),
});

export const Route = createFileRoute("/api/prospects/extract")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const auth = await requireApiAuth(request);
          const workspaceId = auth.organizationId;

          // Check rate limit
          checkRateLimit(workspaceId);

          // Parse and validate request body
          const body = await request.json();
          const validated = extractRequestSchema.safeParse(body);

          if (!validated.success) {
            return Response.json(
              {
                success: false,
                error: validated.error.issues[0]?.message || "Invalid input",
              },
              { status: 400 },
            );
          }

          // Run extraction
          const result = await extractFromConversation(validated.data);

          logger.info("Extraction completed", {
            workspaceId,
            inputMode: validated.data.inputMode,
            confidence: result.confidence,
          });

          return Response.json({ success: true, data: result });
        } catch (error) {
          if (error instanceof AppError) {
            const status =
              error.code === "RATE_LIMIT"
                ? 429
                : error.code === "VALIDATION_ERROR"
                  ? 400
                  : 500;
            return Response.json({ success: false, error: error.message }, { status });
          }

          logger.error("Extraction endpoint error", error instanceof Error ? error : new Error(String(error)));
          return Response.json(
            { success: false, error: "An unexpected error occurred" },
            { status: 500 },
          );
        }
      },
    },
  },
});
