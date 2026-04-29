/**
 * Quick Check API endpoint.
 * Phase 43-02: Prospect Keyword Pipeline
 *
 * POST /api/keywords/quick-check
 * Check 1-20 keywords instantly without creating a workspace.
 * Returns volume, difficulty, CPC, competition metrics.
 * Optionally generates a shareable link.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { QuickCheckService } from "@/server/features/keywords/services/QuickCheckService";
import { createLogger } from "@/server/lib/logger";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { AppError } from "@/server/lib/errors";

const log = createLogger({ module: "api/keywords/quick-check" });

const QuickCheckSchema = z.object({
  keywords: z
    .array(z.string().min(1, "Keyword cannot be empty").max(200, "Keyword too long"))
    .min(1, "At least one keyword is required")
    .max(20, "Maximum 20 keywords allowed"),
  locationCode: z.number().int().positive().optional().default(2440),
  languageCode: z.string().optional().default("lt"),
  generateShareLink: z.boolean().optional().default(false),
});

export const Route = createFileRoute("/api/keywords/quick-check")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          // SECURITY: Require authentication to prevent unlimited lookups
          await requireApiAuth(request);

          const body = await request.json();
          const input = QuickCheckSchema.parse(body);

          // Create service with location/language if provided
          const service = new QuickCheckService(
            input.locationCode,
            input.languageCode
          );

          const result = await service.checkKeywords(input.keywords);

          let shareLink;
          if (input.generateShareLink) {
            shareLink = await service.generateShareLink(result);
          }

          log.info("Quick check completed", {
            keywordCount: input.keywords.length,
            cachedCount: result.cached,
            enrichedCount: result.enriched,
            costCents: result.costCents,
          });

          return Response.json({
            success: true,
            data: {
              ...result,
              shareLink,
            },
          });
        } catch (error) {
          if (error instanceof AppError) {
            const status = error.code === "UNAUTHENTICATED" ? 401 : error.code === "FORBIDDEN" ? 403 : 400;
            return Response.json(
              { success: false, error: error.message },
              { status }
            );
          }

          if (error instanceof z.ZodError) {
            log.warn("Quick check validation error", { errors: error.issues });
            return Response.json(
              {
                success: false,
                error: "Invalid input",
                details: error.issues,
              },
              { status: 400 }
            );
          }

          log.error(
            "Quick check failed",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json(
            {
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
          );
        }
      },
    },
  },
});
