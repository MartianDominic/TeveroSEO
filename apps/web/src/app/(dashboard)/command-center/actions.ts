/**
 * Command Center Server Actions
 * Phase 62-06: Quick Actions
 *
 * Server Actions for quick operations from the Needs Attention list:
 * - sendReminder: Send a reminder email to the entity's contact
 * - snoozeFollowUp: Snooze a follow-up until a specific date
 * - markAsLost: Mark a prospect or proposal as lost with reason
 * - addNote: Add a note to an entity
 * - dismissAlert: Dismiss a smart alert
 *
 * All actions validate input via Zod schemas and revalidate the
 * command center path after successful execution.
 *
 * Security:
 * - T-62-06-01: Workspace validation in backend API
 * - T-62-06-02: Rate limiting in backend API
 */
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

const OPEN_SEO_API_URL = process.env.OPEN_SEO_API_URL || "http://localhost:3001";

/**
 * Send Reminder Action
 *
 * Sends a reminder email to the contact associated with an entity.
 */
const sendReminderSchema = z.object({
  entityType: z.enum(["prospect", "proposal", "contract", "invoice"]),
  entityId: z.string().min(1),
  message: z.string().optional(),
});

export type SendReminderInput = z.infer<typeof sendReminderSchema>;

export async function sendReminder(data: SendReminderInput) {
  const validated = sendReminderSchema.parse(data);

  const response = await fetch(
    `${OPEN_SEO_API_URL}/api/command-center/actions/send-reminder`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validated),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Failed to send reminder");
  }

  revalidatePath("/command-center");
  return { success: true };
}

/**
 * Snooze Follow-up Action
 *
 * Snoozes a follow-up or workflow until a specific date.
 * Used for "follow up on May 27th" functionality.
 */
const snoozeSchema = z.object({
  entityType: z.enum([
    "prospect",
    "proposal",
    "contract",
    "invoice",
    "follow_up",
  ]),
  entityId: z.string().min(1),
  snoozedUntil: z.string().datetime(),
  reason: z.string().optional(),
});

export type SnoozeFollowUpInput = z.infer<typeof snoozeSchema>;

export async function snoozeFollowUp(data: SnoozeFollowUpInput) {
  const validated = snoozeSchema.parse(data);

  const response = await fetch(
    `${OPEN_SEO_API_URL}/api/command-center/actions/snooze`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validated),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to snooze");
  }

  revalidatePath("/command-center");
  return { success: true };
}

/**
 * Mark as Lost Action
 *
 * Marks a prospect or proposal as lost with a reason.
 * Creates a deal_outcome record and cancels active workflows.
 */
const markLostSchema = z.object({
  entityType: z.enum(["prospect", "proposal"]),
  entityId: z.string().min(1),
  reason: z.enum([
    "too_expensive",
    "budget_cut",
    "competitor_cheaper",
    "bad_timing",
    "project_delayed",
    "internal_changes",
    "wrong_fit",
    "scope_mismatch",
    "different_direction",
    "chose_competitor",
    "went_internal",
    "found_alternative",
    "unresponsive",
    "ghosted",
    "decision_maker_left",
    "unknown",
    "other",
  ]),
  notes: z.string().optional(),
  competitorName: z.string().optional(),
});

export type MarkAsLostInput = z.infer<typeof markLostSchema>;

export async function markAsLost(data: MarkAsLostInput) {
  const validated = markLostSchema.parse(data);

  const response = await fetch(
    `${OPEN_SEO_API_URL}/api/command-center/actions/mark-lost`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validated),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to mark as lost");
  }

  revalidatePath("/command-center");
  return { success: true };
}

/**
 * Add Note Action
 *
 * Adds a note to an entity's activity log.
 */
const addNoteSchema = z.object({
  entityType: z.enum([
    "prospect",
    "proposal",
    "contract",
    "invoice",
    "client",
  ]),
  entityId: z.string().min(1),
  note: z.string().min(1),
});

export type AddNoteInput = z.infer<typeof addNoteSchema>;

export async function addNote(data: AddNoteInput) {
  const validated = addNoteSchema.parse(data);

  const response = await fetch(
    `${OPEN_SEO_API_URL}/api/command-center/actions/add-note`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validated),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to add note");
  }

  revalidatePath("/command-center");
  return { success: true };
}

/**
 * Dismiss Alert Action
 *
 * Dismisses a smart alert from the dashboard.
 */
export async function dismissAlert(alertId: string) {
  if (!alertId) {
    throw new Error("Alert ID is required");
  }

  const response = await fetch(
    `${OPEN_SEO_API_URL}/api/command-center/alerts/${alertId}/dismiss`,
    {
      method: "POST",
    }
  );

  if (!response.ok) {
    throw new Error("Failed to dismiss alert");
  }

  revalidatePath("/command-center");
  return { success: true };
}
