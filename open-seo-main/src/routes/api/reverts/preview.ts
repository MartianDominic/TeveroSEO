/**
 * Revert Preview API Route
 * Phase 33: Auto-Fix System Gap Closure
 *
 * POST /api/reverts/preview - Preview a revert operation
 *
 * Security: Requires authentication and validates client ownership.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  previewRevert,
  type RevertScope,
  type CascadeMode,
} from "@/server/features/changes/services/RevertService";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { resolveClientId } from "@/server/lib/client-context";
import { AppError } from "@/server/lib/errors";
import { getChangeById } from "@/server/features/changes/repositories/ChangeRepository";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api/reverts/preview" });

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

const PreviewSchema = z.object({
  scope: ScopeSchema,
  cascadeMode: z.enum(["warn", "cascade", "force"]).default("warn"),
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

export const Route = createFileRoute("/api/reverts/preview")({
  server: {
    handlers: {
      // POST /api/reverts/preview
      POST: async ({ request }: { request: Request }) => {
        try {
          // 1. Authenticate request
          await requireApiAuth(request);

          const body = (await request.json()) as Record<string, unknown>;
          const parsed = PreviewSchema.safeParse(body);

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

          const { scope, cascadeMode } = parsed.data;

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

          const preview = await previewRevert(
            resolvedScope,
            cascadeMode as CascadeMode
          );

          return Response.json({ success: true, data: preview });
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
            "Failed to preview revert",
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
