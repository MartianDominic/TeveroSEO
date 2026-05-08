/**
 * Portal Audit Middleware
 * Phase 96: CPR-006
 *
 * Middleware for automatically logging portal client activities.
 * Designed for minimal performance impact (async, non-blocking).
 *
 * Usage:
 * ```ts
 * import { auditPortalAction, withPortalAudit } from '@/server/middleware/portal-audit';
 *
 * // Option 1: Manual audit in handler
 * export async function handleDashboard(request: Request) {
 *   const auth = await validatePortalAuth(request);
 *   if (!auth.success) return portalAuthErrorResponse(auth);
 *
 *   // ... handle request ...
 *
 *   auditPortalAction({
 *     clientId: auth.data.clientId,
 *     workspaceId: auth.data.workspaceId,
 *     action: 'view_dashboard',
 *     request,
 *   });
 *
 *   return response;
 * }
 *
 * // Option 2: Wrapper function (auto-audits on success)
 * export const handleDashboard = withPortalAudit('view_dashboard', async (request, auth) => {
 *   // ... handle request ...
 *   return response;
 * });
 * ```
 */
import {
  portalAuditService,
  type PortalAuditLogParams,
} from "@/server/services/PortalAuditService";
import {
  validatePortalAuth,
  portalAuthErrorResponse,
  type PortalAuthSuccess,
} from "./portal-auth";
import type { PortalAction, PortalResource } from "@/db/portal-audit-log-schema";

// ============================================================================
// Types
// ============================================================================

/**
 * Simplified audit params for middleware use.
 */
export interface AuditActionParams {
  clientId: string;
  workspaceId: string;
  action: PortalAction;
  resourceType?: PortalResource;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  request?: Request;
}

/**
 * Handler function type for withPortalAudit wrapper.
 */
export type PortalHandler = (
  request: Request,
  auth: PortalAuthSuccess["data"]
) => Promise<Response>;

// ============================================================================
// Manual Audit Function
// ============================================================================

/**
 * Log a portal action (fire-and-forget).
 *
 * Call this at the end of successful portal handlers to track client activity.
 * Non-blocking - will not delay the response.
 *
 * @param params - Audit parameters
 */
export function auditPortalAction(params: AuditActionParams): void {
  portalAuditService.logAsync({
    clientId: params.clientId,
    workspaceId: params.workspaceId,
    action: params.action,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    metadata: params.metadata,
    request: params.request,
  });
}

// ============================================================================
// Wrapper Function
// ============================================================================

/**
 * Wrap a portal handler with automatic audit logging.
 *
 * Handles authentication and logs the action on successful responses (2xx/3xx).
 *
 * @param action - The portal action to log
 * @param handler - The handler function
 * @param options - Additional audit options
 * @returns Wrapped handler function
 *
 * @example
 * export const GET = withPortalAudit('view_dashboard', async (request, auth) => {
 *   const data = await getDashboardData(auth.clientId);
 *   return Response.json({ success: true, data });
 * });
 */
export function withPortalAudit(
  action: PortalAction,
  handler: PortalHandler,
  options?: {
    resourceType?: PortalResource;
    getResourceId?: (request: Request) => string | undefined;
    getMetadata?: (request: Request, response: Response) => Record<string, unknown>;
  }
): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    // Validate portal authentication
    const authResult = await validatePortalAuth(request);

    if (!authResult.success) {
      return portalAuthErrorResponse(authResult);
    }

    // Call the actual handler
    const response = await handler(request, authResult.data);

    // Log audit on successful responses (2xx, 3xx)
    if (response.status >= 200 && response.status < 400) {
      auditPortalAction({
        clientId: authResult.data.clientId,
        workspaceId: authResult.data.workspaceId,
        action,
        resourceType: options?.resourceType,
        resourceId: options?.getResourceId?.(request),
        metadata: options?.getMetadata?.(request, response),
        request,
      });
    }

    return response;
  };
}

// ============================================================================
// Action-Specific Helpers
// ============================================================================

/**
 * Log a dashboard view action.
 */
export function auditDashboardView(
  clientId: string,
  workspaceId: string,
  request?: Request
): void {
  auditPortalAction({
    clientId,
    workspaceId,
    action: "view_dashboard",
    resourceType: "dashboard",
    request,
  });
}

/**
 * Log an export action.
 */
export function auditExport(
  clientId: string,
  workspaceId: string,
  format: "csv" | "sheets" | "pdf",
  rowCount?: number,
  request?: Request
): void {
  const actionMap = {
    csv: "export_csv" as const,
    sheets: "export_sheets" as const,
    pdf: "export_pdf" as const,
  };

  auditPortalAction({
    clientId,
    workspaceId,
    action: actionMap[format],
    resourceType: "export",
    metadata: {
      exportFormat: format,
      exportRowCount: rowCount,
    },
    request,
  });
}

/**
 * Log a keyword view action.
 */
export function auditKeywordView(
  clientId: string,
  workspaceId: string,
  keywordId?: string,
  request?: Request
): void {
  auditPortalAction({
    clientId,
    workspaceId,
    action: keywordId ? "view_keyword_details" : "view_keywords",
    resourceType: "keyword",
    resourceId: keywordId,
    request,
  });
}

/**
 * Log a report view action.
 */
export function auditReportView(
  clientId: string,
  workspaceId: string,
  reportType: string,
  request?: Request
): void {
  auditPortalAction({
    clientId,
    workspaceId,
    action: "view_report",
    resourceType: "report",
    metadata: { reportType },
    request,
  });
}

/**
 * Log a portal login action.
 */
export function auditPortalLogin(
  clientId: string,
  workspaceId: string,
  tokenId: string,
  request?: Request
): void {
  auditPortalAction({
    clientId,
    workspaceId,
    action: "portal_login",
    resourceType: "session",
    metadata: { tokenId },
    request,
  });
}
