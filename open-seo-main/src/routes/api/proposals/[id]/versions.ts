/**
 * API endpoint for proposal version history.
 * Phase 57-06: Auto-Save + Version History
 *
 * GET /api/proposals/:id/versions - List all versions
 * POST /api/proposals/:id/versions - Create new version (used by auto-save)
 */
import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-router-server";
import { z } from "zod";
import { createLogger } from "@/server/lib/logger";
import { VersionService } from "@/server/features/proposals/services/VersionService";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { AppError } from "@/server/lib/errors";
import { CHANGE_TYPES, type ChangeType } from "@/db/schema/proposal-versions";

const log = createLogger({ module: "api/proposals/versions" });

/**
 * Schema for creating a new version
 */
const CreateVersionSchema = z.object({
  content: z.record(z.unknown()),
  sectionOrder: z.array(z.string()).optional(),
  changeType: z.enum(CHANGE_TYPES as unknown as [ChangeType, ...ChangeType[]]),
  changeDescription: z.string().optional(),
  changeDescriptionEn: z.string().optional(),
  changeDescriptionLt: z.string().optional(),
  changedSections: z.array(z.string()).optional(),
  significantOnly: z.boolean().optional().default(true),
});

export const Route = createFileRoute("/api/proposals/[id]/versions")({
  /**
   * GET /api/proposals/:id/versions
   * List all versions for a proposal
   */
  async beforeLoad({ params, context }) {
    const { id: proposalId } = params;
    const { auth } = await requireApiAuth(context);

    log.info("Listing proposal versions", { proposalId, userId: auth.userId });

    const versions = await VersionService.listVersions(proposalId);

    return json({
      success: true,
      data: {
        versions,
        count: versions.length,
      },
    });
  },
});

/**
 * POST handler - Create new version
 */
export const action = async ({ params, request, context }: {
  params: { id: string };
  request: Request;
  context: unknown;
}) => {
  const { id: proposalId } = params;
  const { auth } = await requireApiAuth(context);

  const body = await request.json();
  const parsed = CreateVersionSchema.safeParse(body);

  if (!parsed.success) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Invalid request body",
      details: parsed.error.errors,
    });
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

  if (significantOnly) {
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
      return json({
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

  return json({
    success: true,
    data: { version },
  });
};
