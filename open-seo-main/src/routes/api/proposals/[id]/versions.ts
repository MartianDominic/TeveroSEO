/**
 * API endpoint for proposal version history.
 * Phase 57-06: Auto-Save + Version History
 *
 * GET /api/proposals/:id/versions - List all versions
 * POST /api/proposals/:id/versions - Create new version (used by auto-save)
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createLogger } from "@/server/lib/logger";
import { VersionService } from "@/server/features/proposals/services/VersionService";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { AppError } from "@/server/lib/errors";
import type { ProposalChangeType } from "@/db/schema";

const log = createLogger({ module: "api/proposals/versions" });

/**
 * Schema for creating a new version
 */
const CHANGE_TYPE_VALUES = [
  "content_edit",
  "section_reorder",
  "section_add",
  "section_delete",
  "ai_generated",
  "restore",
  "initial",
] as const;

const CreateVersionSchema = z.object({
  content: z.record(z.string(), z.unknown()),
  sectionOrder: z.array(z.string()).optional(),
  changeType: z.enum(CHANGE_TYPE_VALUES),
  changeDescription: z.string().optional(),
  changeDescriptionEn: z.string().optional(),
  changeDescriptionLt: z.string().optional(),
  changedSections: z.array(z.string()).optional(),
  significantOnly: z.boolean().optional(),
});

export const Route = createFileRoute("/api/proposals/id/versions")({
  server: {
    handlers: {
      /**
       * GET /api/proposals/:id/versions
       * List all versions for a proposal
       */
      GET: async ({
        request,
        params,
      }: {
        request: Request;
        params: { id: string };
      }) => {
        try {
          const { id: proposalId } = params;
          const auth = await requireApiAuth(request);

          log.info("Listing proposal versions", { proposalId, userId: auth.userId });

          const versions = await VersionService.listVersions(proposalId);

          return Response.json({
            success: true,
            data: {
              versions,
              count: versions.length,
            },
          });
        } catch (error) {
          if (error instanceof AppError) {
            return Response.json(
              { success: false, error: error.message },
              { status: error.code === "UNAUTHENTICATED" ? 401 : 500 }
            );
          }
          log.error("Failed to list versions", error instanceof Error ? error : new Error(String(error)));
          return Response.json(
            { success: false, error: "Failed to list versions" },
            { status: 500 }
          );
        }
      },

      /**
       * POST /api/proposals/:id/versions
       * Create new version
       */
      POST: async ({
        request,
        params,
      }: {
        request: Request;
        params: { id: string };
      }) => {
        try {
          const { id: proposalId } = params;
          const auth = await requireApiAuth(request);

          const body = await request.json();
          const parsed = CreateVersionSchema.safeParse(body);

          if (!parsed.success) {
            return Response.json(
              {
                success: false,
                error: "Invalid request body",
                details: parsed.error.issues,
              },
              { status: 400 }
            );
          }

          const {
            content,
            sectionOrder,
            changeType,
            changeDescription,
            changeDescriptionEn,
            changeDescriptionLt,
            changedSections,
            significantOnly,
          } = parsed.data;

          log.info("Creating proposal version", {
            proposalId,
            changeType,
            significantOnly,
            userId: auth.userId,
          });

          let version;

          if (significantOnly !== false) {
            // Only create if significant changes detected
            version = await VersionService.createVersionIfSignificant({
              proposalId,
              content: content as never,
              sectionOrder,
              changeType,
              changeDescription,
              changeDescriptionEn,
              changeDescriptionLt,
              changedSections,
              createdBy: auth.userId,
            });

            if (!version) {
              return Response.json({
                success: true,
                data: {
                  version: null,
                  message: "No significant changes detected",
                },
              });
            }
          } else {
            // Always create version
            version = await VersionService.createVersion({
              proposalId,
              content: content as never,
              sectionOrder,
              changeType,
              changeDescription,
              changeDescriptionEn,
              changeDescriptionLt,
              changedSections,
              createdBy: auth.userId,
            });
          }

          log.info("Version created", {
            proposalId,
            versionId: version.id,
            versionNumber: version.versionNumber,
          });

          return Response.json({
            success: true,
            data: { version },
          });
        } catch (error) {
          if (error instanceof AppError) {
            return Response.json(
              { success: false, error: error.message },
              { status: error.code === "UNAUTHENTICATED" ? 401 : 500 }
            );
          }
          log.error("Failed to create version", error instanceof Error ? error : new Error(String(error)));
          return Response.json(
            { success: false, error: "Failed to create version" },
            { status: 500 }
          );
        }
      },
    },
  },
});
