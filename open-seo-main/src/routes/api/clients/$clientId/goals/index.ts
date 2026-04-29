/**
 * Client goals API routes.
 * Phase 22: Goal-Based Metrics System
 *
 * GET /api/clients/:clientId/goals - List goals for client
 * POST /api/clients/:clientId/goals - Create goal(s) for client
 */
import { createFileRoute } from "@tanstack/react-router";
import { GoalService } from "@/server/features/goals/service";
import {
  createGoalSchema,
  bulkCreateGoalsSchema,
} from "@/server/features/goals/types";
import { createLogger } from "@/server/lib/logger";
import { AppError } from "@/server/lib/errors";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { requireClientAccess } from "@/server/middleware/authz";

const log = createLogger({ module: "api/clients/goals" });

export const Route = createFileRoute("/api/clients/$clientId/goals/")({
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

          const goals = await GoalService.listClientGoals(params.clientId);

          return Response.json({ goals });
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
            "List client goals failed",
            err instanceof Error ? err : new Error(String(err)),
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },

      POST: async ({
        request,
        params,
      }: {
        request: Request;
        params: { clientId: string };
      }) => {
        try {
          const authContext = await requireApiAuth(request);
          await requireClientAccess(authContext.userId, params.clientId);

          const body = (await request.json()) as Record<string, unknown>;

          // Check if bulk create (has 'goals' array)
          if (body.goals && Array.isArray(body.goals)) {
            const parsed = bulkCreateGoalsSchema.safeParse(body);
            if (!parsed.success) {
              return Response.json(
                { error: "Invalid request", details: parsed.error.issues },
                { status: 400 },
              );
            }

            const workspaceId = body.workspaceId as string;
            if (!workspaceId) {
              return Response.json(
                { error: "workspaceId is required" },
                { status: 400 },
              );
            }

            const results = await GoalService.bulkCreateGoals(
              params.clientId,
              workspaceId,
              parsed.data.goals,
            );

            return Response.json({ results }, { status: 201 });
          }

          // Single create
          const parsed = createGoalSchema.safeParse(body);
          if (!parsed.success) {
            return Response.json(
              { error: "Invalid request", details: parsed.error.issues },
              { status: 400 },
            );
          }

          const workspaceId = body.workspaceId as string;
          if (!workspaceId) {
            return Response.json(
              { error: "workspaceId is required" },
              { status: 400 },
            );
          }

          const result = await GoalService.createGoal(
            params.clientId,
            workspaceId,
            parsed.data,
          );

          log.info("Goal created", {
            goalId: result.id,
            clientId: params.clientId,
          });

          return Response.json(result, { status: 201 });
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

          // Handle duplicate goal error
          if (err instanceof Error && err.message.includes("already exists")) {
            return Response.json({ error: err.message }, { status: 409 });
          }

          log.error(
            "Create goal failed",
            err instanceof Error ? err : new Error(String(err)),
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },
    },
  },
});
