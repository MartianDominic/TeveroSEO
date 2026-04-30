/**
 * BullMQ sandboxed processor for scheduled report generation.
 *
 * Two-phase process:
 * 1. Finds due schedules (nextRun <= now, enabled=true) and:
 *    - Creates a report record in pending status with scheduleId link
 *    - Enqueues report generation job
 *    - Updates schedule: lastRun = now, nextRun = calculateNextRun()
 * 2. Polls for completed scheduled reports and sends delivery emails
 */
import type { Job } from "bullmq";
import type { ScheduleJobData } from "@/server/queues/scheduleQueue";
import { createLogger } from "@/server/lib/logger";
import { db } from "@/db";
import { reportSchedules, reports, clients } from "@/db/schema";
import { eq, and, lte, isNotNull, isNull } from "drizzle-orm";
import { enqueueReportGeneration } from "@/server/queues/reportQueue";
import { computeReportHash } from "@/server/services/report/content-hasher";
import { sendReportEmail } from "@/server/lib/email";
import { reportDeliveryTemplate } from "@/server/lib/email-templates";
import CronParser from "cron-parser";

/** T-53-09: Rate limit for email sends per schedule check cycle */
const MAX_EMAILS_PER_RUN = 50;

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
        // Create report record in pending status with schedule link
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
            scheduleId: schedule.id, // Link to schedule for email delivery
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

  // Phase 2: Send emails for completed scheduled reports
  await sendCompletedReportEmails(logger);
}

/**
 * Find completed scheduled reports and send delivery emails.
 * T-53-09: Limited to MAX_EMAILS_PER_RUN per cycle to prevent email floods.
 */
async function sendCompletedReportEmails(
  parentLogger: ReturnType<typeof createLogger>,
): Promise<void> {
  const logger = createLogger({ module: "schedule-processor-email" });

  // Find reports that:
  // - Have a scheduleId (are scheduled, not manual)
  // - Status is "complete"
  // - Have a pdfPath
  // - Haven't been emailed yet (emailSentAt is null)
  const completedReports = await db
    .select({
      report: reports,
      schedule: reportSchedules,
      clientName: clients.name,
    })
    .from(reports)
    .innerJoin(reportSchedules, eq(reportSchedules.id, reports.scheduleId))
    .innerJoin(clients, eq(clients.id, reports.clientId))
    .where(
      and(
        isNotNull(reports.scheduleId),
        eq(reports.status, "complete"),
        isNotNull(reports.pdfPath),
        isNull(reports.emailSentAt),
      ),
    )
    .limit(MAX_EMAILS_PER_RUN);

  if (completedReports.length === 0) {
    logger.debug("No completed reports pending email delivery");
    return;
  }

  logger.info("Found completed reports for email delivery", {
    count: completedReports.length,
  });

  let successCount = 0;
  let failCount = 0;

  for (const { report, schedule, clientName } of completedReports) {
    const reportLogger = createLogger({
      module: "schedule-processor-email",
      reportId: report.id,
      clientId: report.clientId,
    });

    try {
      // T-53-08: Recipients are stored in schedule and validated as email format
      if (!schedule.recipients || schedule.recipients.length === 0) {
        reportLogger.warn("No recipients configured for schedule", {
          scheduleId: schedule.id,
        });
        continue;
      }

      const downloadUrl = `${process.env.APP_URL ?? "https://app.tevero.io"}/api/reports/${report.id}/download`;

      const { subject, html } = reportDeliveryTemplate({
        clientName,
        reportType: report.reportType,
        dateRange: { start: report.dateRangeStart, end: report.dateRangeEnd },
        downloadUrl,
        locale: report.locale,
      });

      await sendReportEmail({
        to: schedule.recipients,
        subject,
        html,
        pdfPath: report.pdfPath!,
        downloadUrl,
      });

      // Mark as emailed
      await db
        .update(reports)
        .set({ emailSentAt: new Date() })
        .where(eq(reports.id, report.id));

      reportLogger.info("Report email sent", {
        recipients: schedule.recipients.length,
      });
      successCount++;
    } catch (err) {
      reportLogger.error(
        "Failed to send report email",
        err instanceof Error ? err : new Error(String(err)),
      );
      failCount++;
      // Continue with next report - don't fail the entire job
    }
  }

  logger.info("Email delivery phase complete", {
    success: successCount,
    failed: failCount,
  });
}
