/**
 * Single goal API routes.
 * Phase 22: Goal-Based Metrics System
 *
 * GET /api/clients/:clientId/goals/:goalId - Get goal details
 * PUT /api/clients/:clientId/goals/:goalId - Update goal
 * DELETE /api/clients/:clientId/goals/:goalId - Delete goal
 */
import { createFileRoute } from "@tanstack/react-router";
import { GoalService } from "@/server/features/goals/service";
import { updateGoalSchema } from "@/server/features/goals/types";
import { createLogger } from "@/server/lib/logger";
import { AppError } from "@/server/lib/errors";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { requireClientAccess } from "@/server/middleware/authz";

const log = createLogger({ module: "api/clients/goals/goalId" });

export const Route = createFileRoute("/api/clients/$clientId/goals/$goalId")({
  server: {
    handlers: {
      GET: async ({
        request,
        params,
      }: {
        request: Request;
        params: { clientId: string; goalId: string };
      }) => {
        try {
          const authContext = await requireApiAuth(request);
          await requireClientAccess(authContext.userId, params.clientId);

          const goal = await GoalService.getGoal(params.goalId);

          if (!goal) {
            return Response.json({ error: "Goal not found" }, { status: 404 });
          }

          // Verify goal belongs to client
          if (goal.goal.clientId !== params.clientId) {
            return Response.json({ error: "Goal not found" }, { status: 404 });
          }

          return Response.json({ goal });
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
            "Get goal failed",
            err instanceof Error ? err : new Error(String(err)),
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },

      PUT: async ({
        request,
        params,
      }: {
        request: Request;
        params: { clientId: string; goalId: string };
      }) => {
        try {
          const authContext = await requireApiAuth(request);
          await requireClientAccess(authContext.userId, params.clientId);

          const body = (await request.json()) as Record<string, unknown>;
          const parsed = updateGoalSchema.safeParse(body);

          if (!parsed.success) {
            return Response.json(
              { error: "Invalid request", details: parsed.error.issues },
              { status: 400 },
            );
          }

          // Verify goal exists and belongs to client
          const existing = await GoalService.getGoal(params.goalId);
          if (!existing || existing.goal.clientId !== params.clientId) {
            return Response.json({ error: "Goal not found" }, { status: 404 });
          }

          const result = await GoalService.updateGoal(
            params.goalId,
            parsed.data,
          );

          log.info("Goal updated", {
            goalId: params.goalId,
            clientId: params.clientId,
          });

          return Response.json(result);
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
            "Update goal failed",
            err instanceof Error ? err : new Error(String(err)),
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },

      DELETE: async ({
        request,
        params,
      }: {
        request: Request;
        params: { clientId: string; goalId: string };
      }) => {
        try {
          const authContext = await requireApiAuth(request);
          await requireClientAccess(authContext.userId, params.clientId);

          // Verify goal exists and belongs to client
          const existing = await GoalService.getGoal(params.goalId);
          if (!existing || existing.goal.clientId !== params.clientId) {
            return Response.json({ error: "Goal not found" }, { status: 404 });
          }

          await GoalService.deleteGoal(params.goalId);

          log.info("Goal deleted", {
            goalId: params.goalId,
            clientId: params.clientId,
          });

          return Response.json({ success: true });
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
            "Delete goal failed",
            err instanceof Error ? err : new Error(String(err)),
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },
    },
  },
});
