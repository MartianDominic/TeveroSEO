/**
 * Goal templates API route.
 * Phase 22: Goal-Based Metrics System
 *
 * GET /api/goal-templates - List all active goal templates
 */
import { createFileRoute } from "@tanstack/react-router";
import { GoalService } from "@/server/features/goals/service";
import { createLogger } from "@/server/lib/logger";
import { AppError } from "@/server/lib/errors";
import { requireApiAuth } from "@/routes/api/seo/-middleware";

const log = createLogger({ module: "api/goal-templates" });

export const Route = createFileRoute("/api/goal-templates/")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        try {
          await requireApiAuth(request);

          const templates = await GoalService.listTemplates();

          return Response.json({ templates });
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
            "List templates failed",
            err instanceof Error ? err : new Error(String(err)),
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },
    },
  },
});
