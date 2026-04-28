/**
 * Schedule detail API routes.
 * Phase 16: Get, update, and delete individual schedules.
 *
 * GET /api/schedules/:id - Get schedule by ID
 * PUT /api/schedules/:id - Update schedule
 * DELETE /api/schedules/:id - Delete schedule
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { db } from "@/db";
import { reportSchedules } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createLogger } from "@/server/lib/logger";
import { AppError } from "@/server/lib/errors";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { requireClientAccess, AuthorizationError } from "@/server/middleware/authz";
import CronParser from "cron-parser";

const log = createLogger({ module: "api/schedules/:id" });

/**
 * Validate cron expression using cron-parser.
 */
function isValidCronExpression(cron: string): boolean {
  try {
    CronParser.parse(cron);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate timezone using Intl API.
 */
function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate email format.
 */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Calculate the next run time based on cron expression and timezone.
 */
function calculateNextRun(cronExpression: string, timezone: string): Date {
  const interval = CronParser.parse(cronExpression, {
    tz: timezone,
    currentDate: new Date(),
  });
  return interval.next().toDate();
}

const updateScheduleSchema = z.object({
  cronExpression: z.string().min(9).max(100).optional(),
  timezone: z.string().min(1).max(50).optional(),
  reportType: z.enum(["monthly-seo", "weekly-summary"]).optional(),
  locale: z.string().optional(),
  recipients: z.array(z.string()).min(1).max(10).optional(),
  enabled: z.boolean().optional(),
});

export const Route = createFileRoute("/api/schedules/$id")({
  server: {
    handlers: {
      // GET /api/schedules/:id - Get schedule by ID
      GET: async ({
        request,
        params,
      }: {
        request: Request;
        params: { id: string };
      }) => {
        try {
          const authContext = await requireApiAuth(request);

          const { id } = params;

          const [schedule] = await db
            .select()
            .from(reportSchedules)
            .where(eq(reportSchedules.id, id))
            .limit(1);

          if (!schedule) {
            return Response.json({ error: "Schedule not found" }, { status: 404 });
          }

          // SECURITY: Validate user has access to this schedule's client
          await requireClientAccess(authContext.userId, schedule.clientId);

          return Response.json({
            id: schedule.id,
            clientId: schedule.clientId,
            cronExpression: schedule.cronExpression,
            timezone: schedule.timezone,
            reportType: schedule.reportType,
            locale: schedule.locale,
            recipients: schedule.recipients,
            enabled: schedule.enabled,
            lastRun: schedule.lastRun?.toISOString() ?? null,
            nextRun: schedule.nextRun.toISOString(),
            createdAt: schedule.createdAt.toISOString(),
            updatedAt: schedule.updatedAt.toISOString(),
          });
        } catch (err) {
          if (err instanceof AuthorizationError) {
            return Response.json({ error: "Access denied" }, { status: 403 });
          }
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
            "Get schedule failed",
            err instanceof Error ? err : new Error(String(err)),
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },

      // PUT /api/schedules/:id - Update schedule
      PUT: async ({
        request,
        params,
      }: {
        request: Request;
        params: { id: string };
      }) => {
        try {
          const authContext = await requireApiAuth(request);

          const { id } = params;
          const body = (await request.json()) as Record<string, unknown>;
          const parsed = updateScheduleSchema.safeParse(body);

          if (!parsed.success) {
            return Response.json(
              { error: "Invalid request", details: parsed.error.issues },
              { status: 400 },
            );
          }

          // Fetch existing schedule
          const [existing] = await db
            .select()
            .from(reportSchedules)
            .where(eq(reportSchedules.id, id))
            .limit(1);

          if (!existing) {
            return Response.json({ error: "Schedule not found" }, { status: 404 });
          }

          // SECURITY: Validate user has access to this schedule's client
          await requireClientAccess(authContext.userId, existing.clientId);

          const updates = parsed.data;

          // Validate cron expression if provided
          if (updates.cronExpression && !isValidCronExpression(updates.cronExpression)) {
            return Response.json(
              { error: "Invalid cron expression" },
              { status: 400 },
            );
          }

          // Validate timezone if provided
          if (updates.timezone && !isValidTimezone(updates.timezone)) {
            return Response.json(
              { error: "Invalid timezone" },
              { status: 400 },
            );
          }

          // Validate recipients if provided
          if (updates.recipients) {
            for (const email of updates.recipients) {
              if (!isValidEmail(email)) {
                return Response.json(
                  { error: `Invalid email: ${email}` },
                  { status: 400 },
                );
              }
            }
          }

          // T-16-05: Minimum interval validation
          const cronToCheck = updates.cronExpression ?? existing.cronExpression;
          const tzToCheck = updates.timezone ?? existing.timezone;

          try {
            const interval = CronParser.parse(cronToCheck, { tz: tzToCheck });
            const firstRun = interval.next().toDate();
            const secondRun = interval.next().toDate();
            const intervalMs = secondRun.getTime() - firstRun.getTime();
            const minIntervalMs = 24 * 60 * 60 * 1000; // 24 hours

            if (intervalMs < minIntervalMs) {
              return Response.json(
                { error: "Schedule frequency cannot be more than once per day" },
                { status: 400 },
              );
            }
          } catch {
            return Response.json(
              { error: "Invalid cron expression" },
              { status: 400 },
            );
          }

          // Calculate new nextRun if cron or timezone changed
          let nextRun = existing.nextRun;
          if (updates.cronExpression || updates.timezone) {
            nextRun = calculateNextRun(cronToCheck, tzToCheck);
          }

          // Build update object
          const updateValues: Partial<typeof existing> = {
            ...updates,
            nextRun,
            updatedAt: new Date(),
          };

          const [updated] = await db
            .update(reportSchedules)
            .set(updateValues)
            .where(eq(reportSchedules.id, id))
            .returning();

          log.info("Schedule updated", {
            scheduleId: id,
            clientId: updated.clientId,
          });

          return Response.json({
            id: updated.id,
            clientId: updated.clientId,
            cronExpression: updated.cronExpression,
            timezone: updated.timezone,
            reportType: updated.reportType,
            locale: updated.locale,
            recipients: updated.recipients,
            enabled: updated.enabled,
            lastRun: updated.lastRun?.toISOString() ?? null,
            nextRun: updated.nextRun.toISOString(),
            createdAt: updated.createdAt.toISOString(),
            updatedAt: updated.updatedAt.toISOString(),
          });
        } catch (err) {
          if (err instanceof AuthorizationError) {
            return Response.json({ error: "Access denied" }, { status: 403 });
          }
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
            "Update schedule failed",
            err instanceof Error ? err : new Error(String(err)),
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },

      // DELETE /api/schedules/:id - Delete schedule
      DELETE: async ({
        request,
        params,
      }: {
        request: Request;
        params: { id: string };
      }) => {
        try {
          const authContext = await requireApiAuth(request);

          const { id } = params;

          // First fetch the schedule to check ownership before deleting
          const [existing] = await db
            .select()
            .from(reportSchedules)
            .where(eq(reportSchedules.id, id))
            .limit(1);

          if (!existing) {
            return Response.json({ error: "Schedule not found" }, { status: 404 });
          }

          // SECURITY: Validate user has access to this schedule's client
          await requireClientAccess(authContext.userId, existing.clientId);

          const [deleted] = await db
            .delete(reportSchedules)
            .where(eq(reportSchedules.id, id))
            .returning();

          if (!deleted) {
            return Response.json({ error: "Schedule not found" }, { status: 404 });
          }

          log.info("Schedule deleted", {
            scheduleId: id,
            clientId: deleted.clientId,
          });

          return Response.json({ success: true }, { status: 200 });
        } catch (err) {
          if (err instanceof AuthorizationError) {
            return Response.json({ error: "Access denied" }, { status: 403 });
          }
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
            "Delete schedule failed",
            err instanceof Error ? err : new Error(String(err)),
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },
    },
  },
});
