/**
 * Batch goal snapshots API route.
 * M-10 FIX: Prevents N+1 queries by fetching snapshots for multiple goals at once.
 *
 * GET /api/clients/:clientId/goals/snapshots/batch?goalIds=id1,id2,id3&days=30
 *
 * Returns snapshots grouped by goalId for efficient goal projection calculations.
 */
import { createFileRoute } from "@tanstack/react-router";
import { db } from "@/db";
import { goalSnapshots, clientGoals } from "@/db/goals-schema";
import { eq, and, inArray, gte } from "drizzle-orm";
import { createLogger } from "@/server/lib/logger";
import { AppError } from "@/server/lib/errors";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { requireClientAccess } from "@/server/middleware/authz";
import { z } from "zod";

const log = createLogger({ module: "api/clients/goals/snapshots-batch" });

/** Maximum number of goal IDs allowed per batch request */
const MAX_GOAL_IDS = 50;

/** Maximum days allowed for snapshot history */
const MAX_DAYS = 90;

const querySchema = z.object({
  goalIds: z
    .string()
    .min(1)
    .transform((val) => val.split(",").filter(Boolean))
    .refine((arr) => arr.length > 0, "At least one goalId required")
    .refine(
      (arr) => arr.length <= MAX_GOAL_IDS,
      `Maximum ${MAX_GOAL_IDS} goal IDs allowed per request`
    ),
  days: z
    .string()
    .optional()
    .default("30")
    .transform((val) => Math.min(Math.max(parseInt(val, 10) || 30, 1), MAX_DAYS)),
});

export const Route = createFileRoute(
  "/api/clients/$clientId/goals/snapshots/batch"
)({
  server: {
    handlers: {
      GET: async ({
        request,
        params,
      }: {
        request: Request;
        params: { clientId: string };
      }) => {
        try {
          const authContext = await requireApiAuth(request);
          await requireClientAccess(authContext.userId, params.clientId);

          const url = new URL(request.url);
          const parsed = querySchema.safeParse({
            goalIds: url.searchParams.get("goalIds") ?? "",
            days: url.searchParams.get("days") ?? "30",
          });

          if (!parsed.success) {
            return Response.json(
              {
                error: "Invalid request parameters",
                code: "INVALID_PARAMS",
                details: parsed.error.issues,
              },
              { status: 400 }
            );
          }

          const { goalIds, days } = parsed.data;
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - days);
          const cutoffDateStr = cutoffDate.toISOString().split("T")[0];

          // First verify all goal IDs belong to this client (security check)
          const validGoals = await db
            .select({ id: clientGoals.id })
            .from(clientGoals)
            .where(
              and(
                eq(clientGoals.clientId, params.clientId),
                inArray(clientGoals.id, goalIds)
              )
            );

          const validGoalIds = new Set(validGoals.map((g) => g.id));
          const requestedGoalIds = goalIds.filter((id) => validGoalIds.has(id));

          if (requestedGoalIds.length === 0) {
            return Response.json({ snapshots: [] });
          }

          // Fetch all snapshots in a single query
          const snapshots = await db
            .select({
              goalId: goalSnapshots.goalId,
              snapshotDate: goalSnapshots.snapshotDate,
              currentValue: goalSnapshots.currentValue,
              attainmentPct: goalSnapshots.attainmentPct,
            })
            .from(goalSnapshots)
            .where(
              and(
                inArray(goalSnapshots.goalId, requestedGoalIds),
                gte(goalSnapshots.snapshotDate, new Date(cutoffDateStr))
              )
            );

          // Format response - snapshots array with goalId for client-side grouping
          const formattedSnapshots = snapshots.map((s) => ({
            goalId: s.goalId,
            snapshotDate:
              s.snapshotDate instanceof Date
                ? s.snapshotDate.toISOString().split("T")[0]
                : s.snapshotDate,
            currentValue: s.currentValue,
            attainmentPct: s.attainmentPct,
          }));

          return Response.json({
            snapshots: formattedSnapshots,
            meta: {
              requestedGoalIds: goalIds.length,
              validGoalIds: requestedGoalIds.length,
              snapshotCount: formattedSnapshots.length,
              days,
            },
          });
        } catch (err) {
          if (err instanceof AppError) {
            const status =
              err.code === "UNAUTHENTICATED"
                ? 401
                : err.code === "FORBIDDEN"
                  ? 403
                  : 400;
            return Response.json(
              { error: err.message, code: err.code },
              { status }
            );
          }
          log.error(
            "Batch goal snapshots failed",
            err instanceof Error ? err : new Error(String(err))
          );
          return Response.json(
            { error: "Internal error", code: "INTERNAL_ERROR" },
            { status: 500 }
          );
        }
      },
    },
  },
});
