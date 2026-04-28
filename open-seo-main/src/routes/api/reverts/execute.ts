/**
 * Revert Execute API Route
 * Phase 33: Auto-Fix System Gap Closure
 *
 * POST /api/reverts/execute - Execute a revert operation
 *
 * Security: Requires authentication and validates client ownership.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  revertByScope,
  type RevertScope,
  type CascadeMode,
} from "@/server/features/changes/services/RevertService";
import { connectionService } from "@/server/features/connections/services/ConnectionService";
import { isWriteAdapter } from "@/server/features/connections/adapters/BaseAdapter";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { resolveClientId } from "@/server/lib/client-context";
import { AppError } from "@/server/lib/errors";
import { getChangeById } from "@/server/features/changes/repositories/ChangeRepository";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api/reverts/execute" });

const ScopeSchema = z.object({
  type: z.enum([
    "single",
    "field",
    "resource",
    "category",
    "batch",
    "date_range",
    "audit",
    "full",
  ]),
  changeId: z.string().optional(),
  resourceId: z.string().optional(),
  field: z.string().optional(),
  clientId: z.string().optional(),
  category: z.string().optional(),
  batchId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  auditId: z.string().optional(),
});

const ExecuteSchema = z.object({
  scope: ScopeSchema,
  connectionId: z.string().min(1, "connectionId is required"),
  cascadeMode: z.enum(["warn", "cascade", "force"]).default("warn"),
  userId: z.string().optional(),
});

/**
 * Extract client ID from scope for ownership validation.
 * Returns the clientId to validate, or null if not determinable from scope.
 */
async function extractClientIdFromScope(scope: z.infer<typeof ScopeSchema>): Promise<string | null> {
  // Direct clientId in scope
  if (scope.clientId) {
    return scope.clientId;
  }

  // Single change scope - look up the change to get its clientId
  if (scope.type === "single" && scope.changeId) {
    const change = await getChangeById(scope.changeId);
    return change?.clientId ?? null;
  }

  return null;
}

export const Route = createFileRoute("/api/reverts/execute")({
  server: {
    handlers: {
      // POST /api/reverts/execute
      POST: async ({ request }: { request: Request }) => {
        try {
          // 1. Authenticate request
          const authContext = await requireApiAuth(request);

          const body = (await request.json()) as Record<string, unknown>;
          const parsed = ExecuteSchema.safeParse(body);

          if (!parsed.success) {
            return Response.json(
              {
                success: false,
                error: "Invalid input",
                details: parsed.error.issues,
              },
              { status: 400 }
            );
          }

          const { scope, connectionId, cascadeMode, userId } = parsed.data;

          // 2. Validate client ownership
          const clientIdToValidate = await extractClientIdFromScope(scope);
          if (clientIdToValidate) {
            const headers = new Headers(request.headers);
            headers.set("x-client-id", clientIdToValidate);
            await resolveClientId(headers, request.url);
          } else if (scope.type !== "single" || !scope.changeId) {
            // For non-single scopes without clientId, require clientId
            return Response.json(
              { success: false, error: "clientId is required in scope for this operation" },
              { status: 400 }
            );
          }

          // Get adapter for the connection
          const adapter = await connectionService.getConnectionWithAdapter(connectionId);

          if (!adapter) {
            return Response.json(
              { success: false, error: "Connection not found or inactive" },
              { status: 404 }
            );
          }

          // Verify adapter supports write operations
          if (!isWriteAdapter(adapter)) {
            return Response.json(
              { success: false, error: "Connection does not support write operations" },
              { status: 400 }
            );
          }

          // Convert date strings to Date objects for date_range scope
          let resolvedScope: RevertScope;
          if (scope.type === "date_range" && scope.from && scope.to && scope.clientId) {
            resolvedScope = {
              type: "date_range",
              from: new Date(scope.from),
              to: new Date(scope.to),
              clientId: scope.clientId,
            };
          } else {
            resolvedScope = scope as RevertScope;
          }

          const result = await revertByScope(
            adapter,
            resolvedScope,
            cascadeMode as CascadeMode,
            userId ?? authContext.userId
          );

          return Response.json({ success: true, data: result });
        } catch (error) {
          if (error instanceof AppError) {
            const status =
              error.code === "UNAUTHENTICATED"
                ? 401
                : error.code === "FORBIDDEN"
                  ? 403
                  : 400;
            return Response.json(
              { success: false, error: error.message },
              { status }
            );
          }
          log.error(
            "Failed to execute revert",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json(
            { success: false, error: "Internal error" },
            { status: 500 }
          );
        }
      },
    },
  },
});
