/**
 * REST API for content briefs.
 * Phase 36: Content Brief Generation
 *
 * Security: All endpoints require authentication and validate ownership
 * via the brief -> mapping -> project -> organization chain.
 *
 * HIGH-06-01 FIX: Added rate limiting to all endpoints
 * HIGH-06-03 FIX: Standardized API response envelope pattern
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
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
import {
  rateLimit,
  rateLimitExceededResponse,
  addRateLimitHeaders,
  RATE_LIMITS,
} from "@/server/middleware/rate-limit";

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

/**
 * Zod schemas for request validation (MEDIUM-06-02 FIX).
 */
const createBriefBodySchema = z.object({
  mappingId: z.string().min(1, "mappingId is required"),
  voiceMode: z.enum(VOICE_MODES as unknown as [string, ...string[]]),
  locationCode: z.number().int().positive().optional(),
});

const updateStatusBodySchema = z.object({
  status: z.enum(BRIEF_STATUSES as unknown as [string, ...string[]]),
});

interface CreateBriefBody {
  mappingId: string;
  voiceMode: VoiceMode;
  locationCode?: number;
}

interface UpdateStatusBody {
  status: BriefStatus;
}

/**
 * Standard API response envelope (HIGH-06-03 FIX).
 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    rateLimitRemaining?: number;
    rateLimitReset?: number;
  };
}

function successResponse<T>(data: T, meta?: ApiResponse<T>["meta"]): ApiResponse<T> {
  return { success: true, data, meta };
}

function errorResponse(error: string): ApiResponse<never> {
  return { success: false, error };
}

/**
 * Extract client ID for rate limiting.
 */
async function extractRateLimitKey(request: Request): Promise<string> {
  const clientId = request.headers.get("X-Client-ID");
  if (clientId) return clientId;

  const url = new URL(request.url);
  const queryClientId = url.searchParams.get("clientId");
  if (queryClientId) return queryClientId;

  // Fallback to IP
  const forwarded = request.headers.get("X-Forwarded-For");
  if (forwarded) return `ip:${forwarded.split(",")[0].trim()}`;

  return "anonymous";
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
       * HIGH-06-01 FIX: Added rate limiting (60 req/min per client)
       * HIGH-06-03 FIX: Standardized response envelope
       */
      GET: async ({ request }: { request: Request }) => {
        try {
          // HIGH-06-01: Apply rate limiting
          const rateLimitKey = await extractRateLimitKey(request);
          const rateLimitResult = await rateLimit({
            key: `${RATE_LIMITS.DEFAULT.keyPrefix}briefs:get:${rateLimitKey}`,
            limit: RATE_LIMITS.DEFAULT.limit,
            window: RATE_LIMITS.DEFAULT.window,
          });

          if (!rateLimitResult.allowed) {
            return rateLimitExceededResponse(rateLimitResult);
          }

          const auth = await requireApiAuth(request);
          const url = new URL(request.url);
          const projectId = url.searchParams.get("projectId");
          const briefId = url.searchParams.get("id");

          if (briefId) {
            const brief = await repository.findById(briefId);
            if (!brief) {
              return Response.json(errorResponse("Brief not found"), { status: 404 });
            }
            // Verify ownership before returning
            await verifyBriefOwnership(brief, auth);
            return addRateLimitHeaders(
              Response.json(successResponse(brief)),
              rateLimitResult
            );
          }

          if (!projectId) {
            return Response.json(
              errorResponse("projectId query parameter required"),
              { status: 400 }
            );
          }

          // Verify user owns this project before listing briefs
          await verifyProjectOwnership(projectId, auth);

          const briefs = await repository.findByProjectId(projectId);
          return addRateLimitHeaders(
            Response.json(successResponse(briefs)),
            rateLimitResult
          );
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
            return Response.json(errorResponse(error.message), { status });
          }
          log.error(
            "GET error",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json(errorResponse("Internal server error"), { status: 500 });
        }
      },

      /**
       * POST /api/seo/briefs
       * Creates a new brief from a mapping.
       *
       * Body: { mappingId, voiceMode, locationCode? }
       *
       * HIGH-06-01 FIX: Added rate limiting (10 req/min for brief generation)
       * HIGH-06-03 FIX: Standardized response envelope
       * MEDIUM-06-02 FIX: Added Zod validation
       */
      POST: async ({ request }: { request: Request }) => {
        try {
          // HIGH-06-01: Apply rate limiting for brief generation
          const rateLimitKey = await extractRateLimitKey(request);
          const rateLimitResult = await rateLimit({
            key: `${RATE_LIMITS.BRIEF_GENERATE.keyPrefix}${rateLimitKey}`,
            limit: RATE_LIMITS.BRIEF_GENERATE.limit,
            window: RATE_LIMITS.BRIEF_GENERATE.window,
          });

          if (!rateLimitResult.allowed) {
            return rateLimitExceededResponse(rateLimitResult);
          }

          await requireApiAuth(request);

          // Validate client ownership
          const clientId = await resolveClientId(request.headers, request.url);
          if (!clientId) {
            return Response.json(
              errorResponse("client_id header or query parameter is required"),
              { status: 400 },
            );
          }

          // MEDIUM-06-02: Parse and validate with Zod
          let rawBody: unknown;
          try {
            rawBody = await request.json();
          } catch {
            return Response.json(errorResponse("Invalid JSON body"), { status: 400 });
          }

          const validation = createBriefBodySchema.safeParse(rawBody);
          if (!validation.success) {
            return Response.json(
              errorResponse(validation.error.issues.map(i => i.message).join(", ")),
              { status: 400 }
            );
          }

          const body = validation.data;

          const result = await generateBrief(
            {
              mappingId: body.mappingId,
              voiceMode: body.voiceMode as VoiceMode,
              locationCode: body.locationCode,
              clientId,
            },
            repository
          );

          return addRateLimitHeaders(
            Response.json(successResponse(result), { status: 201 }),
            rateLimitResult
          );
        } catch (error) {
          if (error instanceof AppError) {
            const status =
              error.code === "NOT_FOUND"
                ? 404
                : error.code === "FORBIDDEN"
                  ? 403
                  : 400;
            return Response.json(errorResponse(error.message), { status });
          }
          log.error(
            "POST error",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json(errorResponse("Internal server error"), { status: 500 });
        }
      },

      /**
       * PATCH /api/seo/briefs?id=xxx
       * Updates a brief's status.
       *
       * Body: { status }
       *
       * Security: Validates ownership via brief -> mapping -> project -> organization chain.
       * HIGH-06-01 FIX: Added rate limiting
       * HIGH-06-03 FIX: Standardized response envelope
       * MEDIUM-06-02 FIX: Added Zod validation
       */
      PATCH: async ({ request }: { request: Request }) => {
        try {
          // HIGH-06-01: Apply rate limiting
          const rateLimitKey = await extractRateLimitKey(request);
          const rateLimitResult = await rateLimit({
            key: `${RATE_LIMITS.DEFAULT.keyPrefix}briefs:patch:${rateLimitKey}`,
            limit: RATE_LIMITS.DEFAULT.limit,
            window: RATE_LIMITS.DEFAULT.window,
          });

          if (!rateLimitResult.allowed) {
            return rateLimitExceededResponse(rateLimitResult);
          }

          const auth = await requireApiAuth(request);
          const url = new URL(request.url);
          const briefId = url.searchParams.get("id");

          if (!briefId) {
            return Response.json(
              errorResponse("id query parameter required"),
              { status: 400 }
            );
          }

          // Fetch brief first to verify ownership
          const existingBrief = await repository.findById(briefId);
          if (!existingBrief) {
            return Response.json(errorResponse("Brief not found"), { status: 404 });
          }

          // Verify ownership before allowing update
          await verifyBriefOwnership(existingBrief, auth);

          // MEDIUM-06-02: Parse and validate with Zod
          let rawBody: unknown;
          try {
            rawBody = await request.json();
          } catch {
            return Response.json(errorResponse("Invalid JSON body"), { status: 400 });
          }

          const validation = updateStatusBodySchema.safeParse(rawBody);
          if (!validation.success) {
            return Response.json(
              errorResponse(`status must be one of: ${BRIEF_STATUSES.join(", ")}`),
              { status: 400 }
            );
          }

          const body = validation.data;

          const updated = await repository.updateStatus(briefId, body.status as BriefStatus);
          if (!updated) {
            return Response.json(errorResponse("Brief not found"), { status: 404 });
          }

          return addRateLimitHeaders(
            Response.json(successResponse(updated)),
            rateLimitResult
          );
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
            return Response.json(errorResponse(error.message), { status });
          }
          log.error(
            "PATCH error",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json(errorResponse("Internal server error"), { status: 500 });
        }
      },

      /**
       * DELETE /api/seo/briefs?id=xxx
       * Deletes a brief.
       *
       * Security: Validates ownership via brief -> mapping -> project -> organization chain.
       * HIGH-06-01 FIX: Added rate limiting
       * HIGH-06-03 FIX: Standardized response envelope
       */
      DELETE: async ({ request }: { request: Request }) => {
        try {
          // HIGH-06-01: Apply rate limiting
          const rateLimitKey = await extractRateLimitKey(request);
          const rateLimitResult = await rateLimit({
            key: `${RATE_LIMITS.DEFAULT.keyPrefix}briefs:delete:${rateLimitKey}`,
            limit: RATE_LIMITS.DEFAULT.limit,
            window: RATE_LIMITS.DEFAULT.window,
          });

          if (!rateLimitResult.allowed) {
            return rateLimitExceededResponse(rateLimitResult);
          }

          const auth = await requireApiAuth(request);
          const url = new URL(request.url);
          const briefId = url.searchParams.get("id");

          if (!briefId) {
            return Response.json(
              errorResponse("id query parameter required"),
              { status: 400 }
            );
          }

          // Fetch brief first to verify ownership
          const existingBrief = await repository.findById(briefId);
          if (!existingBrief) {
            return Response.json(errorResponse("Brief not found"), { status: 404 });
          }

          // Verify ownership before allowing delete
          await verifyBriefOwnership(existingBrief, auth);

          const deleted = await repository.delete(briefId);
          if (!deleted) {
            return Response.json(errorResponse("Brief not found"), { status: 404 });
          }

          return addRateLimitHeaders(
            Response.json(successResponse({ deleted: true })),
            rateLimitResult
          );
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
            return Response.json(errorResponse(error.message), { status });
          }
          log.error(
            "DELETE error",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json(errorResponse("Internal server error"), { status: 500 });
        }
      },
    },
  },
});
