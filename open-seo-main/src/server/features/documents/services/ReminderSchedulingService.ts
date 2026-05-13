/**
 * Reminder Scheduling Service
 * Phase 101: Document Management (D-04)
 *
 * Manages smart automation for document reminders:
 * - Unopened document reminders (configurable days)
 * - Document expiration handling
 * - Scheduled follow-up reminders
 * - Re-engagement alerts (opened after dormant period)
 */
import { db } from "@/db";
import { documents, documentReminders } from "@/db/document-schema";
import { eq, and, lt, isNull, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { createLogger } from "@/server/lib/logger";
import {
  scheduleDocumentReminder,
  cancelDocumentReminder,
} from "@/server/queues/documentReminderQueue";
import type { ReminderType, ReminderStatus } from "@/db/document-schema";

const log = createLogger({ module: "ReminderSchedulingService" });

// ============================================================================
// Types
// ============================================================================

export interface ReminderConfig {
  /** Days to wait before sending unopened reminder */
  unopenedDays?: number;
  /** Days before expiration to send warning */
  expirationWarningDays?: number;
  /** Enable re-engagement alerts */
  enableReEngagement?: boolean;
}

export interface ScheduleReminderInput {
  documentId: string;
  reminderType: ReminderType;
  scheduledFor: Date;
  metadata?: Record<string, unknown>;
}

export interface ReminderResult {
  id: string;
  documentId: string;
  reminderType: ReminderType;
  scheduledFor: Date;
  status: ReminderStatus;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: Required<ReminderConfig> = {
  unopenedDays: 3,
  expirationWarningDays: 7,
  enableReEngagement: true,
};

// ============================================================================
// Service Implementation
// ============================================================================

export const ReminderSchedulingService = {
  /**
   * Schedule a reminder for a document.
   */
  async scheduleReminder(input: ScheduleReminderInput): Promise<ReminderResult> {
    const reminderId = nanoid();

    // Insert reminder record
    await db.insert(documentReminders).values({
      id: reminderId,
      documentId: input.documentId,
      reminderType: input.reminderType,
      scheduledFor: input.scheduledFor,
      status: "pending",
      metadata: input.metadata ?? {},
    });

    // Schedule BullMQ job
    await scheduleDocumentReminder(
      input.documentId,
      reminderId,
      input.reminderType,
      input.scheduledFor
    );

    log.info("Scheduled reminder", {
      reminderId,
      documentId: input.documentId,
      reminderType: input.reminderType,
      scheduledFor: input.scheduledFor.toISOString(),
    });

    return {
      id: reminderId,
      documentId: input.documentId,
      reminderType: input.reminderType,
      scheduledFor: input.scheduledFor,
      status: "pending",
    };
  },

  /**
   * Cancel a pending reminder.
   */
  async cancelReminder(reminderId: string): Promise<boolean> {
    // Update DB status
    const result = await db
      .update(documentReminders)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(documentReminders.id, reminderId),
          eq(documentReminders.status, "pending")
        )
      )
      .returning({ id: documentReminders.id });

    if (result.length === 0) {
      return false;
    }

    // Cancel BullMQ job
    await cancelDocumentReminder(reminderId);

    log.info("Cancelled reminder", { reminderId });
    return true;
  },

  /**
   * Mark a reminder as sent.
   */
  async markReminderSent(reminderId: string): Promise<void> {
    await db
      .update(documentReminders)
      .set({
        status: "sent",
        sentAt: new Date(),
      })
      .where(eq(documentReminders.id, reminderId));

    log.info("Marked reminder as sent", { reminderId });
  },

  /**
   * Get pending reminders for a document.
   */
  async getPendingReminders(documentId: string): Promise<ReminderResult[]> {
    const reminders = await db
      .select({
        id: documentReminders.id,
        documentId: documentReminders.documentId,
        reminderType: documentReminders.reminderType,
        scheduledFor: documentReminders.scheduledFor,
        status: documentReminders.status,
      })
      .from(documentReminders)
      .where(
        and(
          eq(documentReminders.documentId, documentId),
          eq(documentReminders.status, "pending")
        )
      );

    return reminders.map((r) => ({
      id: r.id,
      documentId: r.documentId,
      reminderType: r.reminderType as ReminderType,
      scheduledFor: r.scheduledFor,
      status: r.status as ReminderStatus,
    }));
  },

  /**
   * Schedule unopened document reminders for a workspace.
   * Called by the daily cron job.
   */
  async scheduleUnopenedReminders(
    workspaceId: string,
    config: ReminderConfig = {}
  ): Promise<number> {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - cfg.unopenedDays);

    // Find documents that:
    // 1. Were created more than X days ago
    // 2. Have never been viewed
    // 3. Don't already have an unopened reminder pending
    const unopenedDocs = await db
      .select({
        id: documents.id,
        name: documents.name,
      })
      .from(documents)
      .where(
        and(
          eq(documents.workspaceId, workspaceId),
          lt(documents.createdAt, cutoffDate),
          eq(documents.viewCount, 0),
          isNull(documents.softDeletedAt)
        )
      );

    let scheduledCount = 0;

    for (const doc of unopenedDocs) {
      // Check if there's already a pending unopened reminder
      const existingReminder = await db
        .select({ id: documentReminders.id })
        .from(documentReminders)
        .where(
          and(
            eq(documentReminders.documentId, doc.id),
            eq(documentReminders.reminderType, "unopened"),
            eq(documentReminders.status, "pending")
          )
        )
        .limit(1);

      if (existingReminder.length > 0) {
        continue;
      }

      // Schedule reminder for next business day
      const scheduledFor = this.getNextBusinessDay();

      await this.scheduleReminder({
        documentId: doc.id,
        reminderType: "unopened",
        scheduledFor,
        metadata: {
          unopenedDays: cfg.unopenedDays,
          documentName: doc.name,
        },
      });

      scheduledCount++;
    }

    log.info("Scheduled unopened reminders", {
      workspaceId,
      scheduledCount,
      unopenedDays: cfg.unopenedDays,
    });

    return scheduledCount;
  },

  /**
   * Check and trigger re-engagement alerts.
   * Called when a document is viewed after being dormant.
   */
  async checkReEngagement(
    documentId: string,
    workspaceId: string,
    config: ReminderConfig = {}
  ): Promise<boolean> {
    const cfg = { ...DEFAULT_CONFIG, ...config };

    if (!cfg.enableReEngagement) {
      return false;
    }

    const [doc] = await db
      .select({
        lastViewedAt: documents.lastViewedAt,
        viewCount: documents.viewCount,
      })
      .from(documents)
      .where(
        and(eq(documents.id, documentId), eq(documents.workspaceId, workspaceId))
      );

    if (!doc || !doc.lastViewedAt) {
      return false;
    }

    // Check if this is a re-engagement (not first view, gap > 7 days)
    const dormantDays = 7;
    const gapMs = Date.now() - doc.lastViewedAt.getTime();
    const gapDays = gapMs / (1000 * 60 * 60 * 24);

    if (doc.viewCount > 1 && gapDays > dormantDays) {
      // Schedule immediate notification
      await this.scheduleReminder({
        documentId,
        reminderType: "re_engagement",
        scheduledFor: new Date(), // Immediate
        metadata: {
          dormantDays: Math.floor(gapDays),
          previousViewCount: doc.viewCount - 1,
        },
      });

      log.info("Triggered re-engagement alert", {
        documentId,
        dormantDays: Math.floor(gapDays),
      });

      return true;
    }

    return false;
  },

  /**
   * Process due reminders.
   * Called by the hourly cron job.
   */
  async processDueReminders(): Promise<number> {
    const now = new Date();

    // Find reminders that are due
    const dueReminders = await db
      .select({
        id: documentReminders.id,
        documentId: documentReminders.documentId,
        reminderType: documentReminders.reminderType,
        metadata: documentReminders.metadata,
      })
      .from(documentReminders)
      .where(
        and(
          eq(documentReminders.status, "pending"),
          lt(documentReminders.scheduledFor, now)
        )
      )
      .limit(100); // Process in batches

    let processedCount = 0;

    for (const reminder of dueReminders) {
      try {
        // Here you would integrate with notification system
        // For now, just mark as sent
        await this.markReminderSent(reminder.id);
        processedCount++;
      } catch (err) {
        log.error(
          "Failed to process reminder",
          err instanceof Error ? err : new Error(String(err)),
          { reminderId: reminder.id }
        );
      }
    }

    if (processedCount > 0) {
      log.info("Processed due reminders", { processedCount });
    }

    return processedCount;
  },

  /**
   * Get the next business day (Mon-Fri, 9 AM local).
   */
  getNextBusinessDay(): Date {
    const now = new Date();
    const next = new Date(now);

    // Set to 9 AM
    next.setHours(9, 0, 0, 0);

    // If it's past 9 AM today, start from tomorrow
    if (now.getHours() >= 9) {
      next.setDate(next.getDate() + 1);
    }

    // Skip weekends
    const day = next.getDay();
    if (day === 0) {
      // Sunday
      next.setDate(next.getDate() + 1);
    } else if (day === 6) {
      // Saturday
      next.setDate(next.getDate() + 2);
    }

    return next;
  },
};
