/**
 * Workspace membership API endpoint.
 * Phase 40: Critical API endpoint for multi-tenant isolation validation.
 *
 * GET /api/workspaces/{workspaceId}/membership
 * Returns membership status for the authenticated user in the specified workspace.
 *
 * This endpoint is called by validateWorkspaceMembership() in the frontend to
 * verify workspace access before executing workspace-scoped actions like:
 * - getTeamMetrics
 * - getWorkspacePredictions
 * - getSavedViewsWithConfig
 * - And many more workspace-scoped operations
 */
import { createFileRoute } from "@tanstack/react-router";
import { db } from "@/db";
import { member, organization } from "@/db/user-schema";
import { eq, and } from "drizzle-orm";
import { createLogger } from "@/server/lib/logger";
import { AppError } from "@/server/lib/errors";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { z } from "zod";

const log = createLogger({ module: "api/workspaces/membership" });

/**
 * Response schema for membership endpoint.
 */
const membershipResponseSchema = z.object({
  isMember: z.boolean(),
  role: z.enum(["owner", "admin", "member"]).optional(),
  organizationName: z.string().optional(),
});

type MembershipResponse = z.infer<typeof membershipResponseSchema>;

/**
 * Validate that the workspaceId is a valid UUID.
 */
function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

export const Route = createFileRoute("/api/workspaces/$workspaceId/membership")({
  server: {
    handlers: {
      GET: async ({
        request,
        params,
      }: {
        request: Request;
        params: { workspaceId: string };
      }) => {
        try {
          const { userId } = await requireApiAuth(request);

          const { workspaceId } = params;

          if (!workspaceId) {
            return Response.json(
              { error: "workspaceId is required" },
              { status: 400 }
            );
          }

          // Validate workspaceId format - return isMember: false for invalid UUIDs
          if (!isValidUUID(workspaceId)) {
            log.debug("Invalid workspace ID format", {
              workspaceId,
              userId,
            });
            const response: MembershipResponse = { isMember: false };
            return Response.json(response);
          }

          // Query membership with organization details
          const membershipResult = await db
            .select({
              memberId: member.id,
              role: member.role,
              organizationId: organization.id,
              organizationName: organization.name,
            })
            .from(member)
            .innerJoin(organization, eq(member.organizationId, organization.id))
            .where(
              and(
                eq(member.userId, userId),
                eq(member.organizationId, workspaceId)
              )
            )
            .limit(1);

          if (membershipResult.length === 0) {
            log.debug("User is not a member of workspace", {
              userId,
              workspaceId,
            });
            const response: MembershipResponse = { isMember: false };
            return Response.json(response);
          }

          const membershipData = membershipResult[0];

          log.debug("Membership verified", {
            userId,
            workspaceId,
            role: membershipData.role,
          });

          const response: MembershipResponse = {
            isMember: true,
            role: membershipData.role as "owner" | "admin" | "member",
            organizationName: membershipData.organizationName,
          };

          return Response.json(response);
        } catch (err) {
          if (err instanceof AppError) {
            const status =
              err.code === "UNAUTHENTICATED"
                ? 401
                : err.code === "FORBIDDEN"
                  ? 403
                  : 400;
            return Response.json({ error: err.message }, { status });
          }
          log.error(
            "Failed to check workspace membership",
            err instanceof Error ? err : new Error(String(err))
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },
    },
  },
});
