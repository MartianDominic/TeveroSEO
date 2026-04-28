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

      // Create report record in pending status
      const [newReport] = await db
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

      // Enqueue report generation
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

      // Update schedule: lastRun = now, nextRun = calculateNextRun()
      const nextRun = calculateNextRun(schedule.cronExpression, schedule.timezone);

      await db
        .update(reportSchedules)
        .set({
          lastRun: now,
          nextRun,
          updatedAt: now,
        })
        .where(eq(reportSchedules.id, schedule.id));

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
