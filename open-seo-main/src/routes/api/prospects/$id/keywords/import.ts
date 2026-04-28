/**
 * CSV Import API Endpoint
 * Phase 43-03: CSV Import + Metric Detection
 *
 * POST /api/prospects/{id}/keywords/import
 * - With X-Preview: true header → Returns preview with format detection
 * - Without header → Performs full import
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { csvImportService } from "@/server/features/keywords/services/CsvImportService";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api/prospects/keywords/import" });

/**
 * Schema for preview request.
 */
const PreviewSchema = z.object({
  csvContent: z.string().min(10, "CSV content too short"),
});

/**
 * Schema for import request.
 */
const ImportSchema = z.object({
  csvContent: z.string().min(10, "CSV content too short"),
  mappingOverrides: z
    .array(
      z.object({
        sourceColumn: z.string(),
        targetField: z.enum([
          "keyword",
          "volume",
          "difficulty",
          "cpc",
          "position",
          "url",
          "ignore",
        ]),
        confidence: z.number(),
        sampleValue: z.string(),
      })
    )
    .optional(),
  forceEnrich: z.boolean().optional(),
  mergeWithExisting: z.boolean().optional(),
});

export const Route = createFileRoute("/api/prospects/$id/keywords/import")({
  server: {
    handlers: {
      POST: async ({
        request,
        params,
      }: {
        request: Request;
        params: { id: string };
      }) => {
        try {
          const { id: prospectId } = params;

          if (!prospectId) {
            return Response.json(
              { success: false, error: "prospectId is required" },
              { status: 400 }
            );
          }

          const body = await request.json();

          // Check if this is a preview or import request
          const isPreview = request.headers.get("X-Preview") === "true";

          if (isPreview) {
            const input = PreviewSchema.parse(body);

            log.info("CSV preview requested", {
              prospectId,
              contentLength: input.csvContent.length,
            });

            const preview = csvImportService.previewCsv(input.csvContent);

            return Response.json({
              success: true,
              data: preview,
            });
          }

          // Full import
          const input = ImportSchema.parse(body);

          log.info("CSV import requested", {
            prospectId,
            contentLength: input.csvContent.length,
            hasOverrides: !!input.mappingOverrides,
            forceEnrich: input.forceEnrich,
          });

          const result = await csvImportService.importCsv({
            prospectId,
            csvContent: input.csvContent,
            mappingOverrides: input.mappingOverrides,
            forceEnrich: input.forceEnrich,
            mergeWithExisting: input.mergeWithExisting,
          });

          log.info("CSV import completed", {
            prospectId,
            rowsParsed: result.rowsParsed,
            rowsSkipped: result.rowsSkipped,
            inserted: result.importResult.inserted,
            merged: result.importResult.merged,
          });

          return Response.json({
            success: true,
            data: result,
          });
        } catch (error) {
          if (error instanceof z.ZodError) {
            log.warn("Validation error", { errors: error.issues });
            return Response.json(
              { success: false, error: "Invalid input", details: error.issues },
              { status: 400 }
            );
          }

          log.error(
            "CSV import failed",
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
