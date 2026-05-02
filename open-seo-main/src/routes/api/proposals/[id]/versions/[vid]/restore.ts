/**
 * API endpoint for restoring a proposal version.
 * Phase 57-06: Auto-Save + Version History
 *
 * POST /api/proposals/:id/versions/:vid/restore
 * Restores the proposal to a previous version.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createLogger } from "@/server/lib/logger";
import { VersionService } from "@/server/features/proposals/services/VersionService";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { AppError } from "@/server/lib/errors";

const log = createLogger({ module: "api/proposals/versions/restore" });

// @ts-expect-error - Route path not in FileRoutesByPath yet
export const Route = createFileRoute("/api/proposals/[id]/versions/[vid]/restore")({
  server: {
    handlers: {
      /**
       * POST /api/proposals/:id/versions/:vid/restore
       * Restore proposal to a specific version
       */
      POST: async ({
        request,
        params,
      }: {
        request: Request;
        params: { id: string; vid: string };
      }) => {
        try {
          const { id: proposalId, vid: versionId } = params;
          const auth = await requireApiAuth(request);

          log.info("Restoring proposal version", {
            proposalId,
            versionId,
            userId: auth.userId,
          });

          // Verify version exists and belongs to this proposal
          const version = await VersionService.getVersion(versionId);

          if (!version) {
            return Response.json(
              { success: false, error: "Version not found" },
              { status: 404 }
            );
          }

          if (version.proposalId !== proposalId) {
            return Response.json(
              { success: false, error: "Version does not belong to this proposal" },
              { status: 400 }
            );
          }

          // Restore the version
          const restoreVersion = await VersionService.restoreVersion(
            versionId,
            auth.userId
          );

          if (!restoreVersion) {
            return Response.json(
              { success: false, error: "Failed to restore version" },
              { status: 500 }
            );
          }

          log.info("Version restored", {
            proposalId,
            restoredFrom: version.versionNumber,
            newVersionNumber: restoreVersion.versionNumber,
          });

          return Response.json({
            success: true,
            data: {
              version: restoreVersion,
              restoredFrom: version.versionNumber,
            },
          });
        } catch (error) {
          if (error instanceof AppError) {
            return Response.json(
              { success: false, error: error.message },
              { status: error.code === "UNAUTHENTICATED" ? 401 : 500 }
            );
          }
          log.error("Failed to restore version", error instanceof Error ? error : new Error(String(error)));
          return Response.json(
            { success: false, error: "Failed to restore version" },
            { status: 500 }
          );
        }
      },
    },
  },
});
