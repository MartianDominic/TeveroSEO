/**
 * Competitor Spy API endpoint.
 * Phase 43-02: Prospect Keyword Pipeline
 *
 * POST /api/keywords/competitor-spy
 * Extract top keywords for a competitor domain.
 * Returns position, volume, CPC, URL, and traffic estimates.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { CompetitorSpyService } from "@/server/features/keywords/services/CompetitorSpyService";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api/keywords/competitor-spy" });

const CompetitorSpySchema = z.object({
  domain: z
    .string()
    .min(1, "Domain is required")
    .max(255, "Domain too long")
    .refine(
      (val) => /^[a-zA-Z0-9][a-zA-Z0-9-_.]+\.[a-zA-Z]{2,}/.test(val.replace(/^https?:\/\//, "")),
      "Invalid domain format"
    ),
  limit: z.number().int().min(1).max(500).optional().default(100),
  locationCode: z.number().int().positive().optional().default(2440),
  languageCode: z.string().optional().default("lt"),
});

export const Route = createFileRoute("/api/keywords/competitor-spy")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const body = await request.json();
          const input = CompetitorSpySchema.parse(body);

          // Create service with location/language if provided
          const service = new CompetitorSpyService(
            input.locationCode,
            input.languageCode
          );

          const result = await service.spyOnCompetitor(input.domain, input.limit);

          log.info("Competitor spy completed", {
            domain: result.domain,
            keywordCount: result.totalKeywords,
            estimatedTraffic: result.estimatedTraffic,
            cached: result.cached,
            costCents: result.costCents,
          });

          return Response.json({
            success: true,
            data: result,
          });
        } catch (error) {
          if (error instanceof z.ZodError) {
            log.warn("Competitor spy validation error", { errors: error.issues });
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
            "Competitor spy failed",
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
