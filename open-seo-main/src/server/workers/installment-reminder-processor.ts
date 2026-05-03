/**
 * BullMQ sandboxed processor for installment payment reminders.
 * Phase 60-05: Automated reminder emails for split payments.
 *
 * Per D-17 to D-20:
 * - 3 days before due: installment-reminder
 * - Day of (if not paid): installment-due-today
 * - 1 day overdue: installment-overdue
 * - 7 days overdue: installment-overdue-urgent
 *
 * Per D-19: Uses reminderSentAt to prevent duplicate sends.
 * Per T-60-18: MAX_EMAILS_PER_RUN = 50 to prevent DoS.
 */
import type { Job } from "bullmq";
import type { InstallmentReminderJobData } from "@/server/queues/installmentReminderQueue";
import { createLogger } from "@/server/lib/logger";
import { db } from "@/db";
import {
  paymentInstallments,
  paymentSchedules,
  type PaymentInstallmentSelect,
} from "@/db/payment-schedule-schema";
import { invoices } from "@/db/invoice-schema";
import { clients } from "@/db/client-schema";
import { organization } from "@/db/user-schema";
import { eq, and, lte, lt, gte, isNull, sql } from "drizzle-orm";
import { getEmailService } from "@/server/services/email/EmailService";
import type { EmailTemplateId } from "@/server/services/email/templates";

const log = createLogger({ module: "installment-reminder-processor" });

/** T-60-18: Rate limit for email sends per run */
const MAX_EMAILS_PER_RUN = 50;

/** Reminder types for tracking */
type ReminderType =
  | "reminder"
  | "due_today"
  | "overdue_1"
  | "overdue_7";

/**
 * Installment with context for email sending.
 */
interface InstallmentWithContext {
  installment: PaymentInstallmentSelect;
  scheduleId: string;
  invoiceId: string;
  totalInstallments: number;
  clientName: string;
  clientEmail: string;
  workspaceId: string;
  companyName: string;
  totalRemainingCents: number;
  currency: string;
}

/**
 * Format amount in cents to currency string.
 */
function formatAmount(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "EUR",
  }).format(cents / 100);
}

/**
 * Format date for display.
 */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

/**
 * Get installments due in exactly N days.
 */
async function getInstallmentsDueIn(
  days: number
): Promise<InstallmentWithContext[]> {
  const targetDate = new Date();
  targetDate.setHours(0, 0, 0, 0);
  targetDate.setDate(targetDate.getDate() + days);

  const nextDay = new Date(targetDate);
  nextDay.setDate(nextDay.getDate() + 1);

  const results = await db
    .select({
      installment: paymentInstallments,
      schedule: paymentSchedules,
      invoice: invoices,
      client: clients,
      workspace: organization,
    })
    .from(paymentInstallments)
    .innerJoin(
      paymentSchedules,
      eq(paymentInstallments.scheduleId, paymentSchedules.id)
    )
    .innerJoin(invoices, eq(paymentSchedules.invoiceId, invoices.id))
    .innerJoin(clients, eq(invoices.clientId, clients.id))
    .innerJoin(organization, eq(invoices.workspaceId, organization.id))
    .where(
      and(
        eq(paymentInstallments.status, "pending"),
        gte(paymentInstallments.dueAt, targetDate),
        lt(paymentInstallments.dueAt, nextDay)
      )
    )
    .limit(MAX_EMAILS_PER_RUN);

  return results.map((r) => ({
    installment: r.installment,
    scheduleId: r.schedule.id,
    invoiceId: r.invoice.id,
    totalInstallments: r.schedule.totalInstallments,
    clientName: r.client.name,
    clientEmail: r.client.contactEmail || "",
    workspaceId: r.invoice.workspaceId,
    companyName: r.workspace.name || "Our Company",
    totalRemainingCents: 0, // Calculated below
    currency: r.invoice.currency || "EUR",
  }));
}

/**
 * Get overdue installments (N days past due).
 */
async function getOverdueInstallmentsByDays(
  daysOverdue: number
): Promise<InstallmentWithContext[]> {
  const targetDate = new Date();
  targetDate.setHours(0, 0, 0, 0);
  targetDate.setDate(targetDate.getDate() - daysOverdue);

  const nextDay = new Date(targetDate);
  nextDay.setDate(nextDay.getDate() + 1);

  const results = await db
    .select({
      installment: paymentInstallments,
      schedule: paymentSchedules,
      invoice: invoices,
      client: clients,
      workspace: organization,
    })
    .from(paymentInstallments)
    .innerJoin(
      paymentSchedules,
      eq(paymentInstallments.scheduleId, paymentSchedules.id)
    )
    .innerJoin(invoices, eq(paymentSchedules.invoiceId, invoices.id))
    .innerJoin(clients, eq(invoices.clientId, clients.id))
    .innerJoin(organization, eq(invoices.workspaceId, organization.id))
    .where(
      and(
        sql`${paymentInstallments.status} IN ('pending', 'overdue')`,
        gte(paymentInstallments.dueAt, targetDate),
        lt(paymentInstallments.dueAt, nextDay)
      )
    )
    .limit(MAX_EMAILS_PER_RUN);

  return results.map((r) => ({
    installment: r.installment,
    scheduleId: r.schedule.id,
    invoiceId: r.invoice.id,
    totalInstallments: r.schedule.totalInstallments,
    clientName: r.client.name,
    clientEmail: r.client.contactEmail || "",
    workspaceId: r.invoice.workspaceId,
    companyName: r.workspace.name || "Our Company",
    totalRemainingCents: 0,
    currency: r.invoice.currency || "EUR",
  }));
}

/**
 * Calculate remaining amount for a schedule.
 */
async function calculateRemainingAmount(scheduleId: string): Promise<number> {
  const installments = await db
    .select()
    .from(paymentInstallments)
    .where(eq(paymentInstallments.scheduleId, scheduleId));

  return installments
    .filter((i) => i.status !== "paid")
    .reduce((sum, i) => sum + i.amountCents, 0);
}

/**
 * Send reminder email for an installment.
 */
async function sendReminder(
  ctx: InstallmentWithContext,
  templateId: EmailTemplateId
): Promise<boolean> {
  if (!ctx.clientEmail) {
    log.warn("No email for client", { clientName: ctx.clientName });
    return false;
  }

  const emailService = getEmailService();
  const remaining = await calculateRemainingAmount(ctx.scheduleId);

  const result = await emailService.sendEmail({
    templateId,
    to: ctx.clientEmail,
    workspaceId: ctx.workspaceId,
    variables: {
      recipientName: ctx.clientName,
      businessName: ctx.clientName,
      companyName: ctx.companyName,
      installmentNumber: String(ctx.installment.installmentNumber),
      totalInstallments: String(ctx.totalInstallments),
      installmentAmount: formatAmount(ctx.installment.amountCents, ctx.currency),
      dueDate: formatDate(ctx.installment.dueAt),
      remainingAmount: formatAmount(remaining, ctx.currency),
      paymentLink: ctx.installment.paymentUrl || "",
      senderName: ctx.companyName,
    },
  });

  return result.success;
}

/**
 * Mark reminder as sent and update status if needed.
 */
async function markReminderSent(
  installmentId: string,
  reminderType: ReminderType
): Promise<void> {
  const updateData: Partial<PaymentInstallmentSelect> = {
    reminderSentAt: new Date(),
    updatedAt: new Date(),
  };

  // Mark as overdue if sending overdue reminder
  if (reminderType === "overdue_1" || reminderType === "overdue_7") {
    updateData.status = "overdue";
  }

  await db
    .update(paymentInstallments)
    .set(updateData)
    .where(eq(paymentInstallments.id, installmentId));
}

/**
 * In-memory tracking of reminders sent this run.
 * P60-H03: Track per-installment, per-type to prevent duplicates within a single run.
 * Format: `${installmentId}:${reminderType}`
 */
const remindersSentThisRun = new Set<string>();

/**
 * Clear tracking set - call at start of each job run.
 */
function clearReminderTracking(): void {
  remindersSentThisRun.clear();
}

/**
 * Generate a unique key for tracking reminders.
 */
function getReminderKey(installmentId: string, reminderType: ReminderType): string {
  return `${installmentId}:${reminderType}`;
}

/**
 * Check if a specific reminder type was already sent for this installment today.
 * P60-H03: Enhanced idempotency - checks both database and in-memory tracking.
 *
 * @param installment - The installment to check
 * @param reminderType - The type of reminder to check
 * @returns true if this specific reminder type was already sent today
 */
function wasReminderSentToday(
  installment: PaymentInstallmentSelect,
  reminderType: ReminderType
): boolean {
  const key = getReminderKey(installment.id, reminderType);

  // Check in-memory tracking first (for current run)
  if (remindersSentThisRun.has(key)) {
    return true;
  }

  // Check database for previous runs today
  if (!installment.reminderSentAt) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sentAt = new Date(installment.reminderSentAt);
  sentAt.setHours(0, 0, 0, 0);

  // Note: This still has the limitation that we only track the last reminder date,
  // not which type was sent. For full idempotency, we'd need a separate
  // reminder_history table. This is a pragmatic compromise that prevents
  // the most common duplicate scenario (worker restart within same day).
  return sentAt.getTime() === today.getTime();
}

/**
 * Mark a reminder as sent (both in-memory and database).
 */
function markReminderSentInMemory(installmentId: string, reminderType: ReminderType): void {
  const key = getReminderKey(installmentId, reminderType);
  remindersSentThisRun.add(key);
}

/**
 * Process installment reminder job.
 * Per D-17 to D-20: Find and send all reminder types.
 * Per P60-H03: Enhanced idempotency with per-type tracking.
 */
export default async function processInstallmentReminderJob(
  job: Job<InstallmentReminderJobData>
): Promise<void> {
  const logger = createLogger({
    module: "installment-reminder-processor",
    jobId: job.id,
  });

  logger.info("Starting installment reminder check", {
    triggeredAt: job.data.triggeredAt,
  });

  // P60-H03: Clear in-memory tracking at start of each run
  clearReminderTracking();

  let emailsSent = 0;
  const maxEmails = MAX_EMAILS_PER_RUN;

  // 1. Installments due in 3 days (reminder)
  if (emailsSent < maxEmails) {
    const upcoming = await getInstallmentsDueIn(3);
    for (const ctx of upcoming) {
      if (emailsSent >= maxEmails) break;
      // P60-H03: Pass reminder type for per-type idempotency check
      if (wasReminderSentToday(ctx.installment, "reminder")) continue;

      const sent = await sendReminder(ctx, "installment-reminder");
      if (sent) {
        await markReminderSent(ctx.installment.id, "reminder");
        markReminderSentInMemory(ctx.installment.id, "reminder");
        emailsSent++;
        logger.info("Sent 3-day reminder", {
          installmentId: ctx.installment.id,
          clientName: ctx.clientName,
        });
      }
    }
  }

  // 2. Installments due today (if not paid)
  if (emailsSent < maxEmails) {
    const dueToday = await getInstallmentsDueIn(0);
    for (const ctx of dueToday) {
      if (emailsSent >= maxEmails) break;
      if (wasReminderSentToday(ctx.installment, "due_today")) continue;

      const sent = await sendReminder(ctx, "installment-due-today");
      if (sent) {
        await markReminderSent(ctx.installment.id, "due_today");
        markReminderSentInMemory(ctx.installment.id, "due_today");
        emailsSent++;
        logger.info("Sent due-today reminder", {
          installmentId: ctx.installment.id,
          clientName: ctx.clientName,
        });
      }
    }
  }

  // 3. Overdue installments (1 day)
  if (emailsSent < maxEmails) {
    const overdue1 = await getOverdueInstallmentsByDays(1);
    for (const ctx of overdue1) {
      if (emailsSent >= maxEmails) break;
      if (wasReminderSentToday(ctx.installment, "overdue_1")) continue;

      const sent = await sendReminder(ctx, "installment-overdue");
      if (sent) {
        await markReminderSent(ctx.installment.id, "overdue_1");
        markReminderSentInMemory(ctx.installment.id, "overdue_1");
        emailsSent++;
        logger.info("Sent 1-day overdue reminder", {
          installmentId: ctx.installment.id,
          clientName: ctx.clientName,
        });
      }
    }
  }

  // 4. Overdue installments (7 days)
  if (emailsSent < maxEmails) {
    const overdue7 = await getOverdueInstallmentsByDays(7);
    for (const ctx of overdue7) {
      if (emailsSent >= maxEmails) break;
      if (wasReminderSentToday(ctx.installment, "overdue_7")) continue;

      const sent = await sendReminder(ctx, "installment-overdue-urgent");
      if (sent) {
        await markReminderSent(ctx.installment.id, "overdue_7");
        markReminderSentInMemory(ctx.installment.id, "overdue_7");
        emailsSent++;
        logger.info("Sent 7-day overdue reminder", {
          installmentId: ctx.installment.id,
          clientName: ctx.clientName,
        });
      }
    }
  }

  logger.info("Installment reminder check complete", {
    emailsSent,
    maxEmails,
  });
}
