import { createServerFn } from "@tanstack/react-start";
import { AuditService } from "@/server/features/audit/services/AuditService";
import { captureServerEvent } from "@/server/lib/posthog";
import { requireProjectContext } from "@/serverFunctions/middleware";
import { AppError } from "@/server/lib/errors";
import { createLogger } from "@/server/lib/logger";
import {
  deleteAuditSchema,
  getAuditHistorySchema,
  getAuditResultsSchema,
  getAuditStatusSchema,
  getCrawlProgressSchema,
  startAuditSchema,
} from "@/types/schemas/audit";

const log = createLogger({ module: "serverFunctions/audit" });

export const startAudit = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .inputValidator((data: unknown) => startAuditSchema.parse(data))
  .handler(async ({ data, context }) => {
    const result = await AuditService.startAudit({
      actorUserId: context.userId,
      billingCustomer: {
        organizationId: context.organizationId,
        userEmail: context.userEmail,
        userId: context.userId,
      },
      projectId: context.projectId,
      startUrl: data.startUrl,
      maxPages: data.maxPages,
      lighthouseStrategy: data.lighthouseStrategy,
      clientId: context.clientId,
    });

    void captureServerEvent({
      distinctId: context.userId,
      event: "site_audit:start",
      organizationId: context.organizationId,
      properties: {
        project_id: context.projectId,
        max_pages: data.maxPages ?? 50,
        run_lighthouse: data.lighthouseStrategy !== "none",
      },
    }).catch((err) => {
      log.error("PostHog captureServerEvent failed", err instanceof Error ? err : new Error(String(err)));
    });

    return result;
  });

export const getAuditStatus = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .inputValidator((data: unknown) => getAuditStatusSchema.parse(data))
  .handler(async ({ data, context }) => {
    return AuditService.getStatus(data.auditId, context.projectId);
  });

export const getAuditResults = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .inputValidator((data: unknown) => getAuditResultsSchema.parse(data))
  .handler(async ({ data, context }) => {
    return AuditService.getResults(data.auditId, context.projectId);
  });

export const getAuditHistory = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .inputValidator((data: unknown) => getAuditHistorySchema.parse(data))
  .handler(async ({ data, context }) => {
    // AUTH-03 mismatch guard: a caller cannot ask for one client's data
    // while presenting a different client_id in the header.
    if (data.clientId && context.clientId && data.clientId !== context.clientId) {
      throw new AppError("FORBIDDEN", "clientId mismatch between query and X-Client-ID header");
    }
    // Prefer the query-supplied clientId, fall back to the header-resolved one.
    const effectiveClientId = data.clientId ?? context.clientId ?? null;
    return AuditService.getHistory(context.projectId, { clientId: effectiveClientId });
  });

export const getCrawlProgress = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .inputValidator((data: unknown) => getCrawlProgressSchema.parse(data))
  .handler(async ({ data, context }) => {
    return AuditService.getCrawlProgress(data.auditId, context.projectId);
  });

export const deleteAudit = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .inputValidator((data: unknown) => deleteAuditSchema.parse(data))
  .handler(async ({ data, context }) => {
    await AuditService.remove(data.auditId, context.projectId);
    return { success: true };
  });
