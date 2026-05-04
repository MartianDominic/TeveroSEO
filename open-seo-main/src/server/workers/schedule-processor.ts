/**
 * BullMQ sandboxed processor for scheduled report generation.
 *
 * Two-phase process:
 * 1. Finds due schedules (nextRun <= now, enabled=true) and:
 *    - Creates a report record in pending status with scheduleId link
 *    - Enqueues report generation job
 *    - Updates schedule: lastRun = now, nextRun = calculateNextRun()
 * 2. Polls for completed scheduled reports and sends delivery emails
 *
 * JOB-CRIT-02: Implements checkpoint-based processing for crash recovery.
 * Stores last processed schedule ID in Redis to resume from checkpoint on restart.
 */
import type { Job } from "bullmq";
import type { ScheduleJobData } from "@/server/queues/scheduleQueue";
import { createLogger } from "@/server/lib/logger";
import { db } from "@/db";
import { reportSchedules, reports, clients } from "@/db/schema";
import { eq, and, lte, isNotNull, isNull, gt } from "drizzle-orm";
import { enqueueReportGeneration } from "@/server/queues/reportQueue";
import { computeReportHash } from "@/server/services/report/content-hasher";
import { sendReportEmail } from "@/server/lib/email";
import { reportDeliveryTemplate } from "@/server/lib/email-templates";
import { redis } from "@/server/lib/redis";
import CronParser from "cron-parser";

const log = createLogger({ module: "schedule-processor" });

/** Redis key for storing checkpoint state */
const CHECKPOINT_KEY = "schedule-processor:checkpoint";

/** Checkpoint TTL - expire after 1 hour (covers multiple schedule runs) */
const CHECKPOINT_TTL_SECONDS = 3600;

/**
 * JOB-CRIT-02: Checkpoint state for crash recovery.
 */
interface ScheduleCheckpoint {
  jobId: string;
  lastProcessedScheduleId: string | null;
  processedCount: number;
  startedAt: string;
}

/**
 * JOB-CRIT-02: Save checkpoint to Redis.
 */
async function saveCheckpoint(checkpoint: ScheduleCheckpoint): Promise<void> {
  try {
    await redis.setex(
      CHECKPOINT_KEY,
      CHECKPOINT_TTL_SECONDS,
      JSON.stringify(checkpoint)
    );
  } catch (err) {
    // Log but don't fail - checkpoint is for crash recovery, not critical path
    const log = createLogger({ module: "schedule-processor" });
    log.warn("Failed to save checkpoint", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * JOB-CRIT-02: Load checkpoint from Redis.
 */
async function loadCheckpoint(jobId: string): Promise<ScheduleCheckpoint | null> {
  try {
    const data = await redis.get(CHECKPOINT_KEY);
    if (!data) return null;

    const checkpoint = JSON.parse(data) as ScheduleCheckpoint;
    // Only use checkpoint if it's for the same job (prevents stale checkpoints)
    if (checkpoint.jobId === jobId) {
      return checkpoint;
    }
    return null;
  } catch (error) {
    // Log checkpoint load errors for debugging - return null to start fresh
    log.debug("Failed to load checkpoint", {
      jobId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * JOB-CRIT-02: Clear checkpoint after successful completion.
 */
async function clearCheckpoint(): Promise<void> {
  try {
    await redis.del(CHECKPOINT_KEY);
  } catch (error) {
    // Log at debug level - TTL will handle cleanup anyway
    log.debug("Failed to clear checkpoint", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

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
 *
 * JOB-CRIT-02: Uses checkpoint-based processing for crash recovery.
 * If the processor crashes mid-batch, it resumes from the last checkpoint.
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
  const jobId = job.id ?? `schedule-${Date.now()}`;

  // JOB-CRIT-02: Check for existing checkpoint (crash recovery)
  const existingCheckpoint = await loadCheckpoint(jobId);
  let lastProcessedId: string | null = null;
  let processedCount = 0;

  if (existingCheckpoint) {
    lastProcessedId = existingCheckpoint.lastProcessedScheduleId;
    processedCount = existingCheckpoint.processedCount;
    logger.info("Resuming from checkpoint", {
      lastProcessedId,
      processedCount,
      checkpointStartedAt: existingCheckpoint.startedAt,
    });
  }

  // Build query with checkpoint support - order by ID for deterministic processing
  const whereClause = lastProcessedId
    ? and(
        lte(reportSchedules.nextRun, now),
        eq(reportSchedules.enabled, true),
        gt(reportSchedules.id, lastProcessedId)
      )
    : and(lte(reportSchedules.nextRun, now), eq(reportSchedules.enabled, true));

  // Find all due schedules: nextRun <= now AND enabled = true
  // Order by ID for deterministic checkpoint-based processing
  const dueSchedules = await db
    .select()
    .from(reportSchedules)
    .where(whereClause)
    .orderBy(reportSchedules.id)
    .limit(100); // Process max 100 schedules per run

  logger.info("Found due schedules", {
    count: dueSchedules.length,
    resumedFrom: lastProcessedId,
  });

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

      // JOB-CRIT-02: Save checkpoint after each successful schedule processing
      processedCount++;
      await saveCheckpoint({
        jobId,
        lastProcessedScheduleId: schedule.id,
        processedCount,
        startedAt: existingCheckpoint?.startedAt ?? now.toISOString(),
      });
    } catch (err) {
      scheduleLogger.error(
        "Failed to process schedule",
        err instanceof Error ? err : new Error(String(err)),
      );
      // Continue with next schedule - don't fail the entire job
      // Checkpoint is NOT updated on failure, so this schedule will be retried
    }
  }

  // JOB-CRIT-02: Clear checkpoint after successful completion
  await clearCheckpoint();

  logger.info("Schedule check complete", {
    processed: processedCount,
    total: dueSchedules.length,
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

      // H-CONC-03 FIX: Atomic check-and-mark to prevent duplicate emails
      // Only one process can succeed - others will get 0 rows updated
      const claimResult = await db
        .update(reports)
        .set({ emailSentAt: new Date() })
        .where(
          and(
            eq(reports.id, report.id),
            isNull(reports.emailSentAt) // Only if not already claimed
          )
        )
        .returning({ id: reports.id });

      // If no rows returned, another process already claimed this report
      if (claimResult.length === 0) {
        reportLogger.debug("Report email already claimed by another process", {
          reportId: report.id,
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

      reportLogger.info("Report email sent", {
        recipients: schedule.recipients.length,
      });
      successCount++;
    } catch (err) {
      reportLogger.error(
        "Failed to send report email",
        err instanceof Error ? err : new Error(String(err)),
      );
      // Note: emailSentAt is already set, so we don't retry sending
      // The email failure should be handled via a separate retry mechanism
      failCount++;
      // Continue with next report - don't fail the entire job
    }
  }

  logger.info("Email delivery phase complete", {
    success: successCount,
    failed: failCount,
  });
}
