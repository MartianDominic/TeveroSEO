/**
 * REST API wrapper for audit serverFunctions.
 * Phase 10: Exposed for Next.js server actions to call.
 */
import { createFileRoute } from "@tanstack/react-router";
import { AuditService } from "@/server/features/audit/services/AuditService";
import { resolveClientId } from "@/server/lib/client-context";
import { AppError } from "@/server/lib/errors";
import {
  deleteAuditSchema,
  getAuditHistorySchema,
  startAuditSchema,
} from "@/types/schemas/audit";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { createLogger } from "@/server/lib/logger";
import { rateLimit, RATE_LIMITS, rateLimitExceededResponse } from "@/server/middleware/rate-limit";

const log = createLogger({ module: "api/seo/audits" });

/** Rate limit config for audit operations: 3 audits per hour per user */
const AUDIT_RATE_LIMIT = {
  limit: 3,
  window: 3600, // 1 hour in seconds
};

// Helper to extract project context from request
async function getProjectContext(request: Request) {
  const auth = await requireApiAuth(request);
  const url = new URL(request.url);
  const projectId = url.searchParams.get("project_id");
  const clientId = await resolveClientId(request.headers, request.url);

  if (!projectId) {
    throw new AppError("VALIDATION_ERROR", "project_id query parameter required");
  }

  return { ...auth, projectId, clientId };
}

export const Route = createFileRoute("/api/seo/audits")({
  server: {
    handlers: {
      // GET /api/seo/audits - Get audit history
      GET: async ({ request }: { request: Request }) => {
        try {
          const ctx = await getProjectContext(request);
          const url = new URL(request.url);
          const auditId = url.searchParams.get("audit_id");

          // If audit_id is provided, get status or results
          if (auditId) {
            const action = url.searchParams.get("action") ?? "status";
            if (action === "results") {
              const results = await AuditService.getResults(auditId, ctx.projectId);
              return Response.json({ success: true, data: results });
            }
            if (action === "progress") {
              const progress = await AuditService.getCrawlProgress(auditId, ctx.projectId);
              return Response.json({ success: true, data: progress });
            }
            // Default: status
            const status = await AuditService.getStatus(auditId, ctx.projectId);
            return Response.json({ success: true, data: status });
          }

          // No audit_id: get history
          const parsed = getAuditHistorySchema.safeParse({ clientId: ctx.clientId });
          if (!parsed.success) {
            return Response.json({ success: false, error: { message: parsed.error.message, code: "VALIDATION_ERROR" } }, { status: 400 });
          }
          const history = await AuditService.getHistory(ctx.projectId, { clientId: ctx.clientId });
          return Response.json({ success: true, data: history });
        } catch (error) {
          if (error instanceof AppError) {
            const status = error.code === "NOT_FOUND" ? 404 : error.code === "FORBIDDEN" ? 403 : 400;
            return Response.json({ success: false, error: { message: error.message, code: error.code } }, { status });
          }
          log.error("GET error", error instanceof Error ? error : new Error(String(error)));
          return Response.json({ success: false, error: { message: "Internal server error", code: "INTERNAL_ERROR" } }, { status: 500 });
        }
      },

      // POST /api/seo/audits - Start audit
      // FIX HIGH-API-01: Use consistent response envelope
      POST: async ({ request }: { request: Request }) => {
        try {
          const ctx = await getProjectContext(request);
          const body = (await request.json()) as Record<string, unknown>;

          // Rate limit audit start operations (heavy operation)
          const rateLimitResult = await rateLimit({
            key: `audit:start:${ctx.userId}`,
            ...AUDIT_RATE_LIMIT,
          });
          if (!rateLimitResult.allowed) {
            return rateLimitExceededResponse(rateLimitResult);
          }

          // Validate input
          const parsed = startAuditSchema.safeParse(body);
          if (!parsed.success) {
            return Response.json({ success: false, error: { message: parsed.error.message, code: "VALIDATION_ERROR" } }, { status: 400 });
          }

          const result = await AuditService.startAudit({
            actorUserId: ctx.userId,
            billingCustomer: {
              organizationId: ctx.organizationId,
              userEmail: ctx.userEmail,
              userId: ctx.userId,
            },
            projectId: ctx.projectId,
            startUrl: parsed.data.startUrl,
            maxPages: parsed.data.maxPages,
            lighthouseStrategy: parsed.data.lighthouseStrategy,
            clientId: ctx.clientId,
          });

          return Response.json({ success: true, data: result }, { status: 201 });
        } catch (error) {
          if (error instanceof AppError) {
            const status = error.code === "NOT_FOUND" ? 404 : error.code === "FORBIDDEN" ? 403 : 400;
            return Response.json({ success: false, error: { message: error.message, code: error.code } }, { status });
          }
          log.error("POST error", error instanceof Error ? error : new Error(String(error)));
          return Response.json({ success: false, error: { message: "Internal server error", code: "INTERNAL_ERROR" } }, { status: 500 });
        }
      },

      // FIX HIGH-API-02: Use proper HTTP DELETE method instead of POST with action=delete
      DELETE: async ({ request }: { request: Request }) => {
        try {
          const ctx = await getProjectContext(request);
          const url = new URL(request.url);
          const auditId = url.searchParams.get("audit_id");

          if (!auditId) {
            return Response.json({ success: false, error: { message: "audit_id query parameter required", code: "VALIDATION_ERROR" } }, { status: 400 });
          }

          const parsed = deleteAuditSchema.safeParse({ projectId: ctx.projectId, auditId });
          if (!parsed.success) {
            return Response.json({ success: false, error: { message: parsed.error.message, code: "VALIDATION_ERROR" } }, { status: 400 });
          }

          await AuditService.remove(parsed.data.auditId, ctx.projectId);
          return Response.json({ success: true }, { status: 200 });
        } catch (error) {
          if (error instanceof AppError) {
            const status = error.code === "NOT_FOUND" ? 404 : error.code === "FORBIDDEN" ? 403 : 400;
            return Response.json({ success: false, error: { message: error.message, code: error.code } }, { status });
          }
          log.error("DELETE error", error instanceof Error ? error : new Error(String(error)));
          return Response.json({ success: false, error: { message: "Internal server error", code: "INTERNAL_ERROR" } }, { status: 500 });
        }
      },
    },
  },
});
