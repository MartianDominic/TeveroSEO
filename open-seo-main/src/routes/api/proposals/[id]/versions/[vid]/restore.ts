/**
 * API endpoint for restoring a proposal version.
 * Phase 57-06: Auto-Save + Version History
 *
 * POST /api/proposals/:id/versions/:vid/restore
 * Restores the proposal to a previous version.
 *
 * Security:
 * - Requires authentication via API key or Clerk JWT
 * - Verifies proposal belongs to user's workspace (HIGH-04 fix)
 */
import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { proposals } from "@/db/proposal-schema";
import { createLogger } from "@/server/lib/logger";
import { VersionService } from "@/server/features/proposals/services/VersionService";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { AppError } from "@/server/lib/errors";

const log = createLogger({ module: "api/proposals/versions/restore" });

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

          // HIGH-04 FIX: Verify proposal exists and belongs to user's workspace
          const [proposal] = await db
            .select({ id: proposals.id, workspaceId: proposals.workspaceId })
            .from(proposals)
            .where(eq(proposals.id, proposalId))
            .limit(1);

          if (!proposal) {
            throw new AppError("NOT_FOUND", "Proposal not found");
          }

          if (proposal.workspaceId !== auth.organizationId) {
            log.warn("Version restore forbidden - workspace mismatch", {
              proposalId,
              proposalWorkspaceId: proposal.workspaceId,
              userOrgId: auth.organizationId,
              userId: auth.userId,
            });
            throw new AppError("FORBIDDEN", "Access denied to this proposal");
          }

          // Verify version exists and belongs to this proposal
          const version = await VersionService.getVersion(versionId);

          if (!version) {
            throw new AppError("NOT_FOUND", "Version not found");
          }

          if (version.proposalId !== proposalId) {
            throw new AppError("VALIDATION_ERROR", "Version does not belong to this proposal");
          }

          // Restore the version
          const restoreVersion = await VersionService.restoreVersion(
            versionId,
            auth.userId
          );

          if (!restoreVersion) {
            throw new AppError("INTERNAL_ERROR", "Failed to restore version");
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
            const statusMap: Record<string, number> = {
              UNAUTHENTICATED: 401,
              FORBIDDEN: 403,
              NOT_FOUND: 404,
              VALIDATION_ERROR: 400,
            };
            const status = statusMap[error.code] ?? 500;
            return Response.json(
              { success: false, error: error.message },
              { status }
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
