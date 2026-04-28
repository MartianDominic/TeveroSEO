/**
 * REST API for content briefs.
 * Phase 36: Content Brief Generation
 *
 * Security: All endpoints require authentication and validate ownership
 * via the brief -> mapping -> project -> organization chain.
 */
import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { keywordPageMapping } from "@/db/mapping-schema";
import { projects } from "@/db/app.schema";
import { BriefRepository } from "@/server/features/briefs/services/BriefRepository";
import { generateBrief } from "@/server/features/briefs/services/BriefGenerator";
import { VOICE_MODES, BRIEF_STATUSES } from "@/db/brief-schema";
import type { VoiceMode, BriefStatus, ContentBriefSelect } from "@/db/brief-schema";
import { requireApiAuth, type ApiAuthContext } from "@/routes/api/seo/-middleware";
import { resolveClientId } from "@/server/lib/client-context";
import { AppError } from "@/server/lib/errors";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api/seo/briefs" });
const repository = new BriefRepository();

/**
 * Verify user has access to a brief via ownership chain:
 * brief -> mapping -> project -> organization
 *
 * @param brief - The brief to check ownership for
 * @param auth - Authenticated user context
 * @throws AppError("FORBIDDEN") if user does not own the brief
 */
async function verifyBriefOwnership(
  brief: ContentBriefSelect,
  auth: ApiAuthContext
): Promise<void> {
  // Get the mapping to find the project
  const [mapping] = await db
    .select({ projectId: keywordPageMapping.projectId })
    .from(keywordPageMapping)
    .where(eq(keywordPageMapping.id, brief.mappingId))
    .limit(1);

  if (!mapping) {
    throw new AppError("NOT_FOUND", "Brief mapping not found");
  }

  // Get the project to find the organization
  const [project] = await db
    .select({ organizationId: projects.organizationId })
    .from(projects)
    .where(eq(projects.id, mapping.projectId))
    .limit(1);

  if (!project) {
    throw new AppError("NOT_FOUND", "Brief project not found");
  }

  // Verify the user's organization matches
  if (project.organizationId !== auth.organizationId) {
    log.warn("Unauthorized brief access attempt", {
      briefId: brief.id,
      userOrgId: auth.organizationId,
      briefOrgId: project.organizationId,
      userId: auth.userId,
    });
    throw new AppError("FORBIDDEN", "Access denied to this brief");
  }
}

/**
 * Verify user has access to a project via ownership.
 *
 * @param projectId - The project ID to check
 * @param auth - Authenticated user context
 * @throws AppError("FORBIDDEN") if user does not own the project
 */
async function verifyProjectOwnership(
  projectId: string,
  auth: ApiAuthContext
): Promise<void> {
  const [project] = await db
    .select({ organizationId: projects.organizationId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    throw new AppError("NOT_FOUND", "Project not found");
  }

  if (project.organizationId !== auth.organizationId) {
    log.warn("Unauthorized project access attempt", {
      projectId,
      userOrgId: auth.organizationId,
      projectOrgId: project.organizationId,
      userId: auth.userId,
    });
    throw new AppError("FORBIDDEN", "Access denied to this project");
  }
}

interface CreateBriefBody {
  mappingId: string;
  voiceMode: VoiceMode;
  locationCode?: number;
}

interface UpdateStatusBody {
  status: BriefStatus;
}

function isValidVoiceMode(mode: string): mode is VoiceMode {
  return VOICE_MODES.includes(mode as VoiceMode);
}

function isValidBriefStatus(status: string): status is BriefStatus {
  return BRIEF_STATUSES.includes(status as BriefStatus);
}

export const Route = createFileRoute("/api/seo/briefs")({
  server: {
    handlers: {
      /**
       * GET /api/seo/briefs?projectId=xxx
       * Returns all briefs for a project.
       *
       * GET /api/seo/briefs?id=xxx
       * Returns a single brief by ID.
       *
       * Security: Validates ownership via brief/project -> organization chain.
       */
      GET: async ({ request }: { request: Request }) => {
        try {
          const auth = await requireApiAuth(request);
          const url = new URL(request.url);
          const projectId = url.searchParams.get("projectId");
          const briefId = url.searchParams.get("id");

          if (briefId) {
            const brief = await repository.findById(briefId);
            if (!brief) {
              return Response.json({ error: "Brief not found" }, { status: 404 });
            }
            // Verify ownership before returning
            await verifyBriefOwnership(brief, auth);
            return Response.json({ data: brief });
          }

          if (!projectId) {
            return Response.json(
              { error: "projectId query parameter required" },
              { status: 400 }
            );
          }

          // Verify user owns this project before listing briefs
          await verifyProjectOwnership(projectId, auth);

          const briefs = await repository.findByProjectId(projectId);
          return Response.json({ data: briefs });
        } catch (error) {
          if (error instanceof AppError) {
            const status =
              error.code === "NOT_FOUND"
                ? 404
                : error.code === "FORBIDDEN"
                  ? 403
                  : error.code === "UNAUTHENTICATED"
                    ? 401
                    : 400;
            return Response.json({ error: error.message }, { status });
          }
          log.error(
            "GET error",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json({ error: "Internal server error" }, { status: 500 });
        }
      },

      /**
       * POST /api/seo/briefs
       * Creates a new brief from a mapping.
       *
       * Body: { mappingId, voiceMode, locationCode? }
       */
      POST: async ({ request }: { request: Request }) => {
        try {
          await requireApiAuth(request);

          // Validate client ownership
          const clientId = await resolveClientId(request.headers, request.url);
          if (!clientId) {
            return Response.json(
              { error: "client_id header or query parameter is required" },
              { status: 400 },
            );
          }

          const body = (await request.json()) as CreateBriefBody;

          if (!body.mappingId) {
            return Response.json(
              { error: "mappingId is required" },
              { status: 400 }
            );
          }

          if (!body.voiceMode || !isValidVoiceMode(body.voiceMode)) {
            return Response.json(
              { error: `voiceMode must be one of: ${VOICE_MODES.join(", ")}` },
              { status: 400 }
            );
          }

          const result = await generateBrief(
            {
              mappingId: body.mappingId,
              voiceMode: body.voiceMode,
              locationCode: body.locationCode,
              clientId,
            },
            repository
          );

          return Response.json({ data: result }, { status: 201 });
        } catch (error) {
          if (error instanceof AppError) {
            const status =
              error.code === "NOT_FOUND"
                ? 404
                : error.code === "FORBIDDEN"
                  ? 403
                  : 400;
            return Response.json({ error: error.message }, { status });
          }
          log.error(
            "POST error",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json({ error: "Internal server error" }, { status: 500 });
        }
      },

      /**
       * PATCH /api/seo/briefs?id=xxx
       * Updates a brief's status.
       *
       * Body: { status }
       *
       * Security: Validates ownership via brief -> mapping -> project -> organization chain.
       */
      PATCH: async ({ request }: { request: Request }) => {
        try {
          const auth = await requireApiAuth(request);
          const url = new URL(request.url);
          const briefId = url.searchParams.get("id");

          if (!briefId) {
            return Response.json(
              { error: "id query parameter required" },
              { status: 400 }
            );
          }

          // Fetch brief first to verify ownership
          const existingBrief = await repository.findById(briefId);
          if (!existingBrief) {
            return Response.json({ error: "Brief not found" }, { status: 404 });
          }

          // Verify ownership before allowing update
          await verifyBriefOwnership(existingBrief, auth);

          const body = (await request.json()) as UpdateStatusBody;

          if (!body.status || !isValidBriefStatus(body.status)) {
            return Response.json(
              { error: `status must be one of: ${BRIEF_STATUSES.join(", ")}` },
              { status: 400 }
            );
          }

          const updated = await repository.updateStatus(briefId, body.status);
          if (!updated) {
            return Response.json({ error: "Brief not found" }, { status: 404 });
          }

          return Response.json({ data: updated });
        } catch (error) {
          if (error instanceof AppError) {
            const status =
              error.code === "NOT_FOUND"
                ? 404
                : error.code === "FORBIDDEN"
                  ? 403
                  : error.code === "UNAUTHENTICATED"
                    ? 401
                    : 400;
            return Response.json({ error: error.message }, { status });
          }
          log.error(
            "PATCH error",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json({ error: "Internal server error" }, { status: 500 });
        }
      },

      /**
       * DELETE /api/seo/briefs?id=xxx
       * Deletes a brief.
       *
       * Security: Validates ownership via brief -> mapping -> project -> organization chain.
       */
      DELETE: async ({ request }: { request: Request }) => {
        try {
          const auth = await requireApiAuth(request);
          const url = new URL(request.url);
          const briefId = url.searchParams.get("id");

          if (!briefId) {
            return Response.json(
              { error: "id query parameter required" },
              { status: 400 }
            );
          }

          // Fetch brief first to verify ownership
          const existingBrief = await repository.findById(briefId);
          if (!existingBrief) {
            return Response.json({ error: "Brief not found" }, { status: 404 });
          }

          // Verify ownership before allowing delete
          await verifyBriefOwnership(existingBrief, auth);

          const deleted = await repository.delete(briefId);
          if (!deleted) {
            return Response.json({ error: "Brief not found" }, { status: 404 });
          }

          return Response.json({ success: true });
        } catch (error) {
          if (error instanceof AppError) {
            const status =
              error.code === "NOT_FOUND"
                ? 404
                : error.code === "FORBIDDEN"
                  ? 403
                  : error.code === "UNAUTHENTICATED"
                    ? 401
                    : 400;
            return Response.json({ error: error.message }, { status });
          }
          log.error(
            "DELETE error",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json({ error: "Internal server error" }, { status: 500 });
        }
      },
    },
  },
});
