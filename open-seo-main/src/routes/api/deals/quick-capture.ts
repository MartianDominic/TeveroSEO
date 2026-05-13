/**
 * Quick Capture API endpoint - Phase 101-03
 *
 * POST /api/deals/quick-capture - Create deal stub in < 5 seconds
 *
 * Supports entity chain creation per D-01:
 * - new/contacted stages: creates prospect only
 * - negotiating: creates prospect + proposal stub
 * - converted: creates prospect + proposal + contract (full chain)
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { QuickCaptureService } from "@/server/features/deals/services/QuickCaptureService";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { PIPELINE_STAGES } from "@/db/prospect-schema";
import { AppError } from "@/server/lib/errors";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api-deals-quick-capture" });

/**
 * Request schema for quick capture.
 * Requires domain and either email or phone for contact.
 */
const QuickCaptureRequestSchema = z.object({
  domain: z.string().min(1, "Domain is required"),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  contactName: z.string().optional(),
  companyName: z.string().optional(),
  stage: z.enum(PIPELINE_STAGES).default("new"),
  notes: z.string().optional(),
}).refine(
  (data) => data.contactEmail || data.contactPhone,
  { message: "Either email or phone is required", path: ["contactEmail"] }
);

export const Route = createFileRoute("/api/deals/quick-capture")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          // SECURITY: Require authentication
          const authContext = await requireApiAuth(request);

          // Parse and validate request body
          const body = await request.json();
          const input = QuickCaptureRequestSchema.parse(body);

          // Execute quick capture with workspace from auth context
          const result = await QuickCaptureService.quickCapture({
            ...input,
            workspaceId: authContext.organizationId,
            userId: authContext.userId,
          });

          log.info("Quick capture successful", {
            prospectId: result.prospectId,
            chainCreated: result.chainCreated,
            stage: input.stage,
            userId: authContext.userId,
          });

          return Response.json(
            { success: true, data: result },
            { status: 201 }
          );
        } catch (error) {
          // Handle authentication errors
          if (error instanceof AppError) {
            const status = error.code === "UNAUTHENTICATED" ? 401
              : error.code === "FORBIDDEN" ? 403
              : 400;
            return Response.json(
              { success: false, error: error.message },
              { status }
            );
          }

          // Handle validation errors
          if (error instanceof z.ZodError) {
            log.warn("Quick capture validation failed", { issues: error.issues });
            return Response.json(
              {
                success: false,
                error: "Validation failed",
                issues: error.issues
              },
              { status: 400 }
            );
          }

          // Handle unexpected errors
          log.error(
            "Quick capture failed",
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
