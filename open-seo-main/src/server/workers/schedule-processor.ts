/**
 * BullMQ sandboxed processor for scheduled report generation.
 *
 * Finds due schedules (nextRun <= now, enabled=true) and:
 * 1. Creates a report record in pending status
 * 2. Enqueues report generation job
 * 3. Updates schedule: lastRun = now, nextRun = calculateNextRun()
 */
import type { Job } from "bullmq";
import type { ScheduleJobData } from "@/server/queues/scheduleQueue";
import { createLogger } from "@/server/lib/logger";
import { db } from "@/db";
import { reportSchedules, reports } from "@/db/schema";
import { eq, and, lte } from "drizzle-orm";
import { enqueueReportGeneration } from "@/server/queues/reportQueue";
import { computeReportHash } from "@/server/services/report/content-hasher";
import CronParser from "cron-parser";

/**
 * Calculate the next run time based on cron expression and timezone.
 *
 * @param cronExpression - Cron expression (e.g., "0 6 * * 1")
 * @param timezone - IANA timezone (e.g., "Europe/Vilnius")
 * @returns Next run date in UTC
 */
function calculateNextRun(cronExpression: string, timezone: string): Date {
  const interval = CronParser.parse(cronExpression, {
    tz: timezone,
    currentDate: new Date(),
  });
  return interval.next().toDate();
}

/**
 * Generate a content hash for scheduled reports.
 * Uses current date range (last 30 days by default).
 */
function generateScheduleContentHash(
  clientId: string,
  reportType: string,
  locale: string,
): string {
  const end = new Date().toISOString().slice(0, 10);
  const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  return computeReportHash({
    clientId,
    dateRange: { start, end },
    gscDataCount: 0, // Placeholder - actual count computed by report processor
    gscLastDate: end,
    ga4DataCount: 0,
    queriesCount: 0,
    locale,
  });
}

/**
 * Process a schedule check job.
 * Finds all due schedules and enqueues report generation for each.
 */
export default async function processScheduleJob(
  job: Job<ScheduleJobData>,
): Promise<void> {
  const logger = createLogger({
    module: "schedule-processor",
    jobId: job.id,
  });

  logger.info("Starting schedule check", {
    triggeredAt: job.data.triggeredAt,
  });

  const now = new Date();

  // Find all due schedules: nextRun <= now AND enabled = true
  const dueSchedules = await db
    .select()
    .from(reportSchedules)
    .where(and(lte(reportSchedules.nextRun, now), eq(reportSchedules.enabled, true)))
    .limit(100); // Process max 100 schedules per run

  logger.info("Found due schedules", { count: dueSchedules.length });

  for (const schedule of dueSchedules) {
    const scheduleLogger = createLogger({
      module: "schedule-processor",
      jobId: job.id,
      scheduleId: schedule.id,
      clientId: schedule.clientId,
    });

    try {
      // Calculate date range (last 30 days)
      const dateRange = {
        end: new Date().toISOString().slice(0, 10),
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10),
      };

      // Generate content hash for cache check
      const contentHash = generateScheduleContentHash(
        schedule.clientId,
        schedule.reportType,
        schedule.locale,
      );

      // Calculate next run time
      const nextRun = calculateNextRun(schedule.cronExpression, schedule.timezone);

      // CRITICAL-TXN-001 FIX: Wrap report creation + schedule update in transaction
      // This ensures atomicity - either both succeed or both rollback
      const [newReport] = await db.transaction(async (tx) => {
        // Create report record in pending status
        const [report] = await tx
          .insert(reports)
          .values({
            clientId: schedule.clientId,
            reportType: schedule.reportType,
            dateRangeStart: dateRange.start,
            dateRangeEnd: dateRange.end,
            locale: schedule.locale,
            contentHash,
            status: "pending",
          })
          .returning();

        // Update schedule: lastRun = now, nextRun = calculateNextRun()
        await tx
          .update(reportSchedules)
          .set({
            lastRun: now,
            nextRun,
            updatedAt: now,
          })
          .where(eq(reportSchedules.id, schedule.id));

        return [report];
      });

      // Enqueue AFTER transaction commits successfully
      // If enqueue fails, report exists but job won't run - recoverable state
      await enqueueReportGeneration(newReport.id, {
        clientId: schedule.clientId,
        reportType: schedule.reportType,
        dateRange,
        locale: schedule.locale,
        contentHash,
      });

      scheduleLogger.info("Report generation enqueued", {
        reportId: newReport.id,
        reportType: schedule.reportType,
      });

      scheduleLogger.info("Schedule updated", {
        lastRun: now.toISOString(),
        nextRun: nextRun.toISOString(),
      });
    } catch (err) {
      scheduleLogger.error(
        "Failed to process schedule",
        err instanceof Error ? err : new Error(String(err)),
      );
      // Continue with next schedule - don't fail the entire job
    }
  }

  logger.info("Schedule check complete", {
    processed: dueSchedules.length,
  });
}
