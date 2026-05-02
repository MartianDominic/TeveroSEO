/**
 * API endpoint for restoring a proposal version.
 * Phase 57-06: Auto-Save + Version History
 *
 * POST /api/proposals/:id/versions/:vid/restore
 * Restores the proposal to a previous version.
 */
import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-router-server";
import { createLogger } from "@/server/lib/logger";
import { VersionService } from "@/server/features/proposals/services/VersionService";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { AppError } from "@/server/lib/errors";

const log = createLogger({ module: "api/proposals/versions/restore" });

export const Route = createFileRoute(
  "/api/proposals/[id]/versions/[vid]/restore"
)({});

/**
 * POST /api/proposals/:id/versions/:vid/restore
 * Restore proposal to a specific version
 */
export const action = async ({
  params,
  context,
}: {
  params: { id: string; vid: string };
  request: Request;
  context: unknown;
}) => {
  const { id: proposalId, vid: versionId } = params;
  const { auth } = await requireApiAuth(context);

  log.info("Restoring proposal version", {
    proposalId,
    versionId,
    userId: auth.userId,
  });

  // Verify version exists and belongs to this proposal
  const version = await VersionService.getVersion(versionId);

  if (!version) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Version not found",
    });
  }

  if (version.proposalId !== proposalId) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Version does not belong to this proposal",
    });
  }

  // Restore the version
  const restoreVersion = await VersionService.restoreVersion(
    versionId,
    auth.userId
  );

  if (!restoreVersion) {
    throw new AppError({
      code: "INTERNAL_ERROR",
      message: "Failed to restore version",
    });
  }

  log.info("Version restored", {
    proposalId,
    restoredFrom: version.versionNumber,
    newVersionNumber: restoreVersion.versionNumber,
  });

  return json({
    success: true,
    data: {
      version: restoreVersion,
      restoredFrom: version.versionNumber,
    },
  });
};
