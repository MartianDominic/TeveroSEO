/**
 * Email service for sending report delivery emails via Resend.
 *
 * Features:
 * - PDF attachment for files < 10MB
 * - Download link fallback for larger files
 * - Multiple recipients support
 * - Structured logging
 *
 * Environment variables:
 * - RESEND_API_KEY: Required Resend API key
 * - EMAIL_FROM: Optional sender address (default: reports@tevero.io)
 */
import { Resend } from "resend";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { createLogger } from "./logger";
import { REPORTS_DIR } from "./storage";

const log = createLogger({ module: "email" });

/** Maximum file size for email attachments (10MB) */
export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

/** Default sender email address */
const DEFAULT_FROM = "reports@tevero.io";

/**
 * Configuration for email sending.
 */
export interface EmailConfig {
  from: string;
  replyTo?: string;
}

/**
 * Parameters for sending a report email.
 */
export interface ReportEmailParams {
  /** Recipient email addresses */
  to: string[];
  /** Email subject line */
  subject: string;
  /** HTML email body */
  html: string;
  /** Path to PDF file on filesystem */
  pdfPath: string;
  /** Fallback URL for large file downloads */
  downloadUrl?: string;
}

/**
 * Sends a report email with optional PDF attachment.
 *
 * If the PDF file is smaller than MAX_ATTACHMENT_SIZE (10MB), it will be
 * attached to the email. For larger files, the email body should include
 * a download link (provided in the HTML template).
 *
 * @param params - Email parameters including recipients, subject, HTML body, and PDF path
 * @throws Error if RESEND_API_KEY is not configured
 * @throws Error if Resend API returns an error
 *
 * @example
 * await sendReportEmail({
 *   to: ["client@example.com"],
 *   subject: "Monthly SEO Report - Client Name",
 *   html: reportDeliveryTemplate(data).html,
 *   pdfPath: "/data/reports/client1/2026-04-01_monthly-seo.pdf",
 *   downloadUrl: "https://app.tevero.io/reports/123/download",
 * });
 */
export async function sendReportEmail(params: ReportEmailParams): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY not configured");
  }

  const resend = new Resend(apiKey);
  const fromAddress = process.env.EMAIL_FROM ?? DEFAULT_FROM;

  // SECURITY: Validate path is within expected reports directory
  // Uses REPORTS_DIR from storage.ts for consistency
  const resolvedReportsDir = path.resolve(REPORTS_DIR);
  const resolvedPath = path.resolve(params.pdfPath);

  if (!resolvedPath.startsWith(resolvedReportsDir + path.sep) && resolvedPath !== resolvedReportsDir) {
    log.error("Path traversal attempt in email attachment", undefined, {
      attemptedPath: params.pdfPath,
    });
    throw new Error("Invalid report path for email attachment");
  }

  // Check file size to determine attachment strategy
  const fileStats = await stat(resolvedPath);
  const fileSize = fileStats.size;

  // Build email payload
  const emailPayload: Parameters<typeof resend.emails.send>[0] = {
    from: fromAddress,
    to: params.to,
    subject: params.subject,
    html: params.html,
  };

  // Attach PDF only if under size limit
  if (fileSize < MAX_ATTACHMENT_SIZE) {
    const content = await readFile(resolvedPath);
    const filename = path.basename(resolvedPath);

    emailPayload.attachments = [
      {
        filename,
        content: content.toString("base64"),
      },
    ];

    log.debug("Adding PDF attachment", { filename, size: fileSize });
  } else {
    log.info("PDF too large for attachment, using download link", {
      size: fileSize,
      limit: MAX_ATTACHMENT_SIZE,
      downloadUrl: params.downloadUrl,
    });
  }

  // Send the email
  const { error } = await resend.emails.send(emailPayload);

  if (error) {
    log.error("Email send failed", new Error(error.message), {
      to: params.to,
      subject: params.subject,
    });
    throw new Error(`Email delivery failed: ${error.message}`);
  }

  log.info("Report email sent", {
    to: params.to,
    subject: params.subject,
    attached: fileSize < MAX_ATTACHMENT_SIZE,
  });
}
