/**
 * Sandboxed BullMQ processor for report generation jobs.
 *
 * Steps:
 * 1. Fetch report data from database
 * 2. Check cache (content hash match)
 * 3. Render to HTML
 * 4. Generate PDF via Puppeteer
 * 5. Write PDF to filesystem
 * 6. Update database with path and status
 * 7. Send email to recipients (if scheduled report)
 */
import type { Job } from "bullmq";
import type { ReportJobData } from "@/server/queues/reportQueue";
import { createLogger } from "@/server/lib/logger";
import { sendReportEmail } from "@/server/lib/email";
import { reportDeliveryTemplate } from "@/server/lib/email-templates";
import { db } from "@/db";
import {
  reports,
  gscSnapshots,
  gscQuerySnapshots,
  ga4Snapshots,
  reportSchedules,
  clientBranding,
} from "@/db/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { generatePDF } from "@/server/services/report/pdf-generator";
import {
  renderReportToHTML,
  type ReportRenderData,
  type ReportLabels,
  type ReportBranding,
} from "@/server/services/report/report-renderer";
import { writeFile, mkdir, unlink, access } from "node:fs/promises";
import path from "node:path";
import { REPORTS_DIR, sanitizePathComponent } from "../lib/storage";

/**
 * Check if a partial PDF exists from a previous attempt.
 * Returns the path if found, null otherwise.
 */
async function checkExistingPdf(
  clientId: string,
  reportType: string,
  dateEnd: string,
): Promise<string | null> {
  // SECURITY: Sanitize clientId to prevent path traversal
  const safeClientId = sanitizePathComponent(clientId);
  const dateStr = dateEnd.replace(/-/g, "");
  const filename = `${dateStr}_${reportType}.pdf`;
  const pdfPath = path.join(REPORTS_DIR, safeClientId, filename);

  try {
    await access(pdfPath);
    return pdfPath;
  } catch {
    return null;
  }
}

/**
 * Main processor function - exported as default for BullMQ sandboxed worker.
 */
export default async function processReportJob(
  job: Job<ReportJobData>,
): Promise<void> {
  const { reportId, clientId, reportType, dateRange, locale, contentHash } =
    job.data;

  const logger = createLogger({
    module: "report-processor",
    jobId: job.id,
    reportId,
    clientId,
  });

  logger.info("Starting report generation", { reportType, dateRange, attempt: job.attemptsMade + 1 });

  try {
    // Clean up partial PDF from previous attempt if this is a retry
    if (job.attemptsMade > 0) {
      const existingPdf = await checkExistingPdf(clientId, reportType, dateRange.end);
      if (existingPdf) {
        logger.info("Cleaning up partial PDF from previous attempt", { pdfPath: existingPdf });
        await unlink(existingPdf).catch((err) => {
          logger.warn("Failed to clean up partial PDF", { error: (err as Error).message });
        });
      }
    }

    // Reset status to pending at start of each attempt for clean state
    await db
      .update(reports)
      .set({ status: "pending", errorMessage: null })
      .where(eq(reports.id, reportId));

    // Update status to generating
    await db
      .update(reports)
      .set({ status: "generating" })
      .where(eq(reports.id, reportId));

    // Step 1: Fetch report data
    const [gscDaily, ga4Daily, topQueries] = await Promise.all([
      db
        .select()
        .from(gscSnapshots)
        .where(
          and(
            eq(gscSnapshots.clientId, clientId),
            gte(gscSnapshots.date, dateRange.start),
            lte(gscSnapshots.date, dateRange.end),
          ),
        )
        .orderBy(gscSnapshots.date),
      db
        .select()
        .from(ga4Snapshots)
        .where(
          and(
            eq(ga4Snapshots.clientId, clientId),
            gte(ga4Snapshots.date, dateRange.start),
            lte(ga4Snapshots.date, dateRange.end),
          ),
        )
        .orderBy(ga4Snapshots.date),
      db
        .select()
        .from(gscQuerySnapshots)
        .where(
          and(
            eq(gscQuerySnapshots.clientId, clientId),
            gte(gscQuerySnapshots.date, dateRange.start),
            lte(gscQuerySnapshots.date, dateRange.end),
          ),
        )
        .orderBy(desc(gscQuerySnapshots.clicks))
        .limit(20),
    ]);

    logger.info("Data fetched", {
      gscDays: gscDaily.length,
      ga4Days: ga4Daily.length,
      queries: topQueries.length,
    });

    // Step 2: Compute summaries
    const gscSummary = computeGSCSummary(gscDaily);
    const ga4Summary = computeGA4Summary(ga4Daily);

    // Step 3: Get client name (from AI-Writer DB via ALWRITY_DATABASE_URL)
    // For now, we use a placeholder - will be wired when internal API is ready
    const clientName = await getClientName(clientId);

    // Step 3b: Fetch client branding for white-label reports (Phase 16)
    const brandingData = await db.query.clientBranding.findFirst({
      where: eq(clientBranding.clientId, clientId),
    });

    // Build branding object (null values mean use Tevero defaults)
    const branding = brandingData
      ? {
          logoUrl: brandingData.logoUrl,
          primaryColor: brandingData.primaryColor,
          secondaryColor: brandingData.secondaryColor,
          footerText: brandingData.footerText,
        }
      : undefined;

    logger.info("Branding fetched", {
      hasBranding: !!brandingData,
      hasLogo: !!brandingData?.logoUrl,
    });

    // Step 4: Build report data
    const reportData: ReportRenderData = {
      metadata: {
        id: reportId,
        clientId,
        clientName,
        reportType,
        dateRange,
        locale,
        generatedAt: new Date().toISOString(),
        contentHash,
      },
      gscDaily: gscDaily.map((row) => ({
        date: row.date,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      })),
      gscSummary,
      ga4Daily: ga4Daily.map((row) => ({
        date: row.date,
        sessions: row.sessions ?? 0,
        users: row.users ?? 0,
        bounce_rate: row.bounceRate ?? 0,
      })),
      ga4Summary,
      topQueries: topQueries.map((row) => ({
        query: row.query,
        clicks: row.clicks ?? 0,
        impressions: row.impressions ?? 0,
        ctr: row.ctr ?? 0,
        position: row.position ?? 0,
        position_delta: 0, // TODO: Compute from previous period
      })),
    };

    // Step 5: Get localized labels
    const labels = getDefaultLabels(locale);

    // Step 6: Render to HTML with branding
    const html = renderReportToHTML(reportData, labels, branding);
    logger.info("HTML rendered", { htmlLength: html.length });

    // Step 7: Generate PDF
    const pdfBuffer = await generatePDF(html);
    logger.info("PDF generated", { pdfSize: pdfBuffer.byteLength });

    // Step 8: Write to filesystem
    // File naming: {client_id}/{YYYY-MM-DD}_{report_type}.pdf per CONTEXT.md
    // SECURITY: Sanitize clientId to prevent path traversal
    const safeClientId = sanitizePathComponent(clientId);
    const dateStr = dateRange.end.replace(/-/g, "");
    const filename = `${dateStr}_${reportType}.pdf`;
    const clientDir = path.join(REPORTS_DIR, safeClientId);
    const pdfPath = path.join(clientDir, filename);

    await mkdir(clientDir, { recursive: true });
    await writeFile(pdfPath, pdfBuffer);
    logger.info("PDF written", { pdfPath });

    // Step 9: Update database
    await db
      .update(reports)
      .set({
        status: "complete",
        pdfPath,
        generatedAt: new Date(),
      })
      .where(eq(reports.id, reportId));

    logger.info("Report generation complete");

    // Step 10: Send email to recipients (if schedule exists with recipients)
    await sendReportEmailIfScheduled({
      clientId,
      clientName,
      reportType,
      dateRange,
      locale,
      pdfPath,
      reportId,
      logger,
    });
  } catch (error) {
    logger.error("Report generation failed", error as Error);

    // Update status to failed
    await db
      .update(reports)
      .set({
        status: "failed",
        errorMessage: (error as Error).message,
      })
      .where(eq(reports.id, reportId));

    throw error; // Re-throw for BullMQ retry
  }
}

/**
 * Compute GSC summary from daily data.
 */
function computeGSCSummary(
  data: Array<{
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>,
): { clicks: number; impressions: number; ctr: number; position: number } {
  if (data.length === 0) {
    return { clicks: 0, impressions: 0, ctr: 0, position: 0 };
  }
  const clicks = data.reduce((sum, d) => sum + d.clicks, 0);
  const impressions = data.reduce((sum, d) => sum + d.impressions, 0);
  const ctr = impressions > 0 ? clicks / impressions : 0;
  const position = data.reduce((sum, d) => sum + d.position, 0) / data.length;
  return { clicks, impressions, ctr, position };
}

/**
 * Compute GA4 summary from daily data.
 */
function computeGA4Summary(
  data: Array<{
    sessions: number | null;
    users: number | null;
    bounceRate: number | null;
    conversions: number | null;
  }>,
): { sessions: number; users: number; conversions: number; bounce_rate: number } {
  if (data.length === 0) {
    return { sessions: 0, users: 0, conversions: 0, bounce_rate: 0 };
  }
  const sessions = data.reduce((sum, d) => sum + (d.sessions ?? 0), 0);
  const users = data.reduce((sum, d) => sum + (d.users ?? 0), 0);
  const conversions = data.reduce((sum, d) => sum + (d.conversions ?? 0), 0);
  const bounce_rate =
    data.reduce((sum, d) => sum + (d.bounceRate ?? 0), 0) / data.length;
  return { sessions, users, conversions, bounce_rate };
}

/**
 * Get client name from AI-Writer database.
 * Falls back to "Client" if not found.
 */
async function getClientName(clientId: string): Promise<string> {
  // TODO: Query AI-Writer's clients table via ALWRITY_DATABASE_URL
  // For now, return a placeholder
  return "Client";
}

/**
 * Get default English labels.
 * TODO: Load from i18n system based on locale.
 */
function getDefaultLabels(locale: string): ReportLabels {
  // TODO: Implement locale-based label loading
  return {
    title: "Monthly SEO Report",
    subtitle: "Performance Overview",
    dateRange: "Date Range",
    clicks: "Clicks",
    impressions: "Impressions",
    ctr: "CTR",
    position: "Avg Position",
    sessions: "Sessions",
    users: "Users",
    conversions: "Conversions",
    bounceRate: "Bounce Rate",
    topQueries: "Top Search Queries",
    query: "Query",
    wow: "WoW",
    generatedBy: "Generated by Tevero",
    generatedAt: "Generated at",
  };
}

/**
 * Parameters for sending report email after generation.
 */
interface SendReportEmailParams {
  clientId: string;
  clientName: string;
  reportType: string;
  dateRange: { start: string; end: string };
  locale: string;
  pdfPath: string;
  reportId: string;
  logger: ReturnType<typeof createLogger>;
}

/**
 * Sends email to recipients if a schedule exists with configured recipients.
 *
 * Email failures are logged but do not fail the report generation job.
 * The report is already generated and saved at this point.
 */
async function sendReportEmailIfScheduled(
  params: SendReportEmailParams,
): Promise<void> {
  const { clientId, clientName, reportType, dateRange, locale, pdfPath, reportId, logger } =
    params;

  try {
    // Find schedule with recipients for this client and report type
    const schedule = await db.query.reportSchedules.findFirst({
      where: and(
        eq(reportSchedules.clientId, clientId),
        eq(reportSchedules.reportType, reportType),
      ),
    });

    // No schedule or no recipients configured
    if (!schedule?.recipients?.length) {
      logger.debug("No recipients configured, skipping email", { clientId, reportType });
      return;
    }

    // Build download URL for large file fallback
    const appUrl = process.env.APP_URL ?? "https://app.tevero.io";
    const downloadUrl = `${appUrl}/api/reports/${reportId}/download`;

    // Generate email template
    const { subject, html } = reportDeliveryTemplate({
      clientName,
      reportType,
      dateRange,
      downloadUrl, // Always provide; sendReportEmail decides based on file size
      locale,
    });

    // Send email
    await sendReportEmail({
      to: schedule.recipients,
      subject,
      html,
      pdfPath,
      downloadUrl,
    });

    logger.info("Report email sent", {
      recipients: schedule.recipients.length,
      reportId,
    });
  } catch (emailErr) {
    // Log but don't fail the job - report is generated successfully
    logger.error("Failed to send report email", emailErr as Error, {
      clientId,
      reportId,
    });
    // Note: Could enqueue to a retry queue for email delivery in future
  }
}
