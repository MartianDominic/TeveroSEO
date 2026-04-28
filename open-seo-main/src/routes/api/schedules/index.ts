/**
 * Schedule API routes.
 * Phase 16: Report scheduling CRUD operations.
 *
 * GET /api/schedules?client_id={id} - List schedules for client
 * POST /api/schedules - Create a new schedule
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { db } from "@/db";
import { reportSchedules } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createLogger } from "@/server/lib/logger";
import { AppError } from "@/server/lib/errors";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { resolveClientId } from "@/server/lib/client-context";
import CronParser from "cron-parser";

const log = createLogger({ module: "api/schedules" });

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

const createScheduleSchema = z.object({
  clientId: z.string().uuid(),
  cronExpression: z.string().min(9).max(100), // e.g., "0 6 * * 1"
  timezone: z.string().min(1).max(50), // e.g., "Europe/Vilnius"
  reportType: z.enum(["monthly-seo", "weekly-summary"]),
  locale: z.string().default("en"),
  recipients: z.array(z.string()).min(1).max(10),
  enabled: z.boolean().default(true),
});

export const Route = createFileRoute("/api/schedules/")({
  server: {
    handlers: {
      // GET /api/schedules?client_id={id} - List schedules for client
      GET: async ({ request }: { request: Request }) => {
        try {
          await requireApiAuth(request);

          // Validate client ownership - resolveClientId checks UUID format,
          // verifies client exists, and is not archived (AUTH-03)
          const clientId = await resolveClientId(request.headers, request.url);

          if (!clientId) {
            return Response.json(
              { error: "client_id query parameter is required" },
              { status: 400 },
            );
          }

          const schedules = await db
            .select()
            .from(reportSchedules)
            .where(eq(reportSchedules.clientId, clientId));

          return Response.json({
            schedules: schedules.map((s) => ({
              id: s.id,
              clientId: s.clientId,
              cronExpression: s.cronExpression,
              timezone: s.timezone,
              reportType: s.reportType,
              locale: s.locale,
              recipients: s.recipients,
              enabled: s.enabled,
              lastRun: s.lastRun?.toISOString() ?? null,
              nextRun: s.nextRun.toISOString(),
              createdAt: s.createdAt.toISOString(),
              updatedAt: s.updatedAt.toISOString(),
            })),
          });
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
            "List schedules failed",
            err instanceof Error ? err : new Error(String(err)),
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },

      // POST /api/schedules - Create a new schedule
      POST: async ({ request }: { request: Request }) => {
        try {
          await requireApiAuth(request);

          const body = (await request.json()) as Record<string, unknown>;
          const parsed = createScheduleSchema.safeParse(body);

          if (!parsed.success) {
            return Response.json(
              { error: "Invalid request", details: parsed.error.issues },
              { status: 400 },
            );
          }

          const { clientId: requestedClientId, cronExpression, timezone, reportType, locale, recipients, enabled } =
            parsed.data;

          // Validate client ownership - resolveClientId checks UUID format,
          // verifies client exists, and is not archived (AUTH-03)
          // We pass the clientId from the body via a custom header for validation
          const validatedClientId = await resolveClientId(
            new Headers({ "x-client-id": requestedClientId }),
            undefined,
          );

          if (!validatedClientId) {
            return Response.json(
              { error: "Invalid or unauthorized client_id" },
              { status: 403 },
            );
          }

          const clientId = validatedClientId;

          // Validate cron expression
          if (!isValidCronExpression(cronExpression)) {
            return Response.json(
              { error: "Invalid cron expression" },
              { status: 400 },
            );
          }

          // Validate timezone
          if (!isValidTimezone(timezone)) {
            return Response.json(
              { error: "Invalid timezone" },
              { status: 400 },
            );
          }

          // Validate recipients (all must be valid emails)
          for (const email of recipients) {
            if (!isValidEmail(email)) {
              return Response.json(
                { error: `Invalid email: ${email}` },
                { status: 400 },
              );
            }
          }

          // T-16-05: Minimum interval validation (no more frequent than daily)
          // Check if cron runs more than once per day
          try {
            const interval = CronParser.parse(cronExpression, { tz: timezone });
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

          // Calculate next run
          const nextRun = calculateNextRun(cronExpression, timezone);

          // Create schedule
          const [newSchedule] = await db
            .insert(reportSchedules)
            .values({
              clientId,
              cronExpression,
              timezone,
              reportType,
              locale,
              recipients,
              enabled,
              nextRun,
            })
            .returning();

          log.info("Schedule created", {
            scheduleId: newSchedule.id,
            clientId,
            reportType,
          });

          return Response.json(
            {
              id: newSchedule.id,
              clientId: newSchedule.clientId,
              cronExpression: newSchedule.cronExpression,
              timezone: newSchedule.timezone,
              reportType: newSchedule.reportType,
              locale: newSchedule.locale,
              recipients: newSchedule.recipients,
              enabled: newSchedule.enabled,
              lastRun: newSchedule.lastRun?.toISOString() ?? null,
              nextRun: newSchedule.nextRun.toISOString(),
              createdAt: newSchedule.createdAt.toISOString(),
              updatedAt: newSchedule.updatedAt.toISOString(),
            },
            { status: 201 },
          );
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

          // Handle unique constraint violation
          if (
            err instanceof Error &&
            err.message.includes("unique constraint")
          ) {
            return Response.json(
              { error: "A schedule with this report type already exists for this client" },
              { status: 409 },
            );
          }

          log.error(
            "Create schedule failed",
            err instanceof Error ? err : new Error(String(err)),
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },
    },
  },
});
