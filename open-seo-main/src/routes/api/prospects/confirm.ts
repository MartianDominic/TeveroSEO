/**
 * API endpoint for confirming extraction and creating prospect.
 * Phase 56: Prospect Input Excellence
 *
 * POST /api/prospects/confirm
 * Creates a prospect with user-confirmed extraction data.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ProspectService } from "@/server/features/prospects/services/ProspectService";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { AppError } from "@/server/lib/errors";
import { logger } from "@/server/lib/logger";

const confirmRequestSchema = z.object({
  domain: z.string().optional(),
  inputMode: z.enum(["website", "website_with_context", "conversation"]),
  rawInput: z.string().max(50000).optional(),
  confirmedData: z.object({
    businessName: z.string().optional(),
    industry: z.string().optional(),
    services: z.array(z.string()).optional(),
    targetAudience: z.string().optional(),
    keywords: z.array(z.string()).optional(),
    location: z.string().optional(),
    confidence: z.number().min(0).max(100),
  }),
});

export const Route = createFileRoute("/api/prospects/confirm")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const auth = await requireApiAuth(request);
          const workspaceId = auth.organizationId;
          const userId = auth.userId;

          // Parse and validate request body
          const body = await request.json();
          const validated = confirmRequestSchema.safeParse(body);

          if (!validated.success) {
            return Response.json(
              {
                success: false,
                error: validated.error.issues[0]?.message || "Invalid input",
              },
              { status: 400 }
            );
          }

          const { domain, inputMode, rawInput, confirmedData } = validated.data;

          // For conversation-only mode, generate a placeholder domain if not provided
          // Or require at least a business name
          let prospectDomain = domain;
          if (!prospectDomain && inputMode === "conversation") {
            if (!confirmedData.businessName) {
              return Response.json(
                {
                  success: false,
                  error: "Business name is required when no domain is provided",
                },
                { status: 400 }
              );
            }
            // Generate a placeholder domain from business name
            prospectDomain = `${confirmedData.businessName.toLowerCase().replace(/[^a-z0-9]/g, "-")}.prospect`;
          }

          if (!prospectDomain) {
            return Response.json(
              { success: false, error: "Domain is required" },
              { status: 400 }
            );
          }

          // Create prospect with confirmed data
          const prospect = await ProspectService.create({
            workspaceId,
            domain: prospectDomain,
            companyName: confirmedData.businessName,
            industry: confirmedData.industry,
            notes: rawInput,
          });

          // Update with extraction data columns (from Plan 01 schema)
          // Note: This requires ProspectService.update to support these fields
          // For now, we'll use a raw update - Plan 01 added these columns
          await ProspectService.update(prospect.id, {
            // Fields added in Plan 01 migration
            inputMode,
            rawInput,
            extractedData: null, // Original extraction was before edits
            confirmedData: {
              ...confirmedData,
              confirmedAt: new Date().toISOString(),
              confirmedBy: userId,
            },
            confirmationStatus: "confirmed",
          } as Parameters<typeof ProspectService.update>[1]);

          logger.info("Prospect created with confirmed data", {
            prospectId: prospect.id,
            workspaceId,
            inputMode,
            confidence: confirmedData.confidence,
          });

          return Response.json({
            success: true,
            data: {
              prospectId: prospect.id,
              domain: prospectDomain,
            },
          });
        } catch (error) {
          if (error instanceof AppError) {
            const status =
              error.code === "CONFLICT"
                ? 409
                : error.code === "VALIDATION_ERROR"
                  ? 400
                  : 500;
            return Response.json(
              { success: false, error: error.message },
              { status }
            );
          }

          logger.error("Confirm endpoint error", error instanceof Error ? error : new Error(String(error)));
          return Response.json(
            { success: false, error: "Failed to create prospect" },
            { status: 500 }
          );
        }
      },
    },
  },
});
