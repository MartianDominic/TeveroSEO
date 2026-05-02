/**
 * Payment Schedule Schema
 * Phase 60-01: Payment Flexibility & Split Payments
 *
 * Enables split payments (2-3 installments) for invoices.
 * Tracks each installment's status, due date, and payment details.
 *
 * Plan Types:
 * - full: Single payment, 100% today
 * - split_2: 50% today, 50% in 30 days
 * - split_3: 40% today, 30% in 30 days, 30% in 60 days
 *
 * Installment Status Flow:
 * pending -> processing -> paid
 *        \-> overdue (if dueAt passed without payment)
 *        \-> failed (if payment attempt failed)
 */
import {
  pgTable,
  text,
  integer,
  timestamp,
  index,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { invoices } from "./invoice-schema";

/**
 * Valid plan types for payment schedules.
 * - full: 1 installment, 100% today
 * - split_2: 2 installments, 50/50
 * - split_3: 3 installments, 40/30/30
 */
export const PLAN_TYPES = ["full", "split_2", "split_3"] as const;
export type PlanType = (typeof PLAN_TYPES)[number];

/**
 * Valid installment statuses.
 * - pending: Awaiting payment
 * - processing: Payment in progress
 * - paid: Payment completed
 * - overdue: Due date passed without payment
 * - failed: Payment attempt failed
 */
export const INSTALLMENT_STATUS = [
  "pending",
  "processing",
  "paid",
  "overdue",
  "failed",
] as const;
export type InstallmentStatus = (typeof INSTALLMENT_STATUS)[number];

/**
 * Payment schedules table.
 * One schedule per invoice, tracks the overall payment plan.
 *
 * Design decisions:
 * - D-01: planType determines split configuration (full/split_2/split_3)
 * - totalInstallments derived from planType but stored for efficiency
 *
 * Threat mitigations:
 * - T-60-01: CHECK constraint validates planType values at DB level
 */
export const paymentSchedules = pgTable(
  "payment_schedules",
  {
    // Primary key
    id: text("id").primaryKey(),

    // Invoice reference (one schedule per invoice)
    invoiceId: text("invoice_id")
      .notNull()
      .unique()
      .references(() => invoices.id, { onDelete: "cascade" }),

    // Schedule configuration
    planType: text("plan_type").notNull(), // 'full' | 'split_2' | 'split_3'
    totalInstallments: integer("total_installments").notNull(),

    // Standard timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Index for invoice lookups
    index("ix_payment_schedules_invoice").on(table.invoiceId),

    // T-60-01: Validate plan_type is a known type
    check(
      "chk_schedule_plan_type_valid",
      sql`plan_type IN ('full', 'split_2', 'split_3')`
    ),
  ]
);

/**
 * Payment installments table.
 * One installment per payment in the schedule.
 *
 * Design decisions:
 * - D-02: Status enum tracks payment lifecycle
 * - D-03: Index on (status, due_at) for efficient overdue queries
 * - D-08: Each installment stores its own paymentUrl for checkout
 *
 * Threat mitigations:
 * - T-60-02: Amounts calculated server-side only, never from client input
 * - T-60-04: Index ensures performant overdue detection queries
 */
export const paymentInstallments = pgTable(
  "payment_installments",
  {
    // Primary key
    id: text("id").primaryKey(),

    // Schedule reference
    scheduleId: text("schedule_id")
      .notNull()
      .references(() => paymentSchedules.id, { onDelete: "cascade" }),

    // Installment details
    installmentNumber: integer("installment_number").notNull(), // 1, 2, 3...
    amountCents: integer("amount_cents").notNull(),
    dueAt: timestamp("due_at", { withTimezone: true, mode: "date" }).notNull(),

    // Status
    status: text("status").notNull().default("pending"), // 'pending' | 'processing' | 'paid' | 'overdue' | 'failed'
    paidAt: timestamp("paid_at", { withTimezone: true, mode: "date" }),

    // Payment provider reference
    paymentId: text("payment_id"), // Stripe/Revolut payment ID
    paymentProvider: text("payment_provider"), // 'stripe' | 'revolut'
    paymentUrl: text("payment_url"), // Checkout URL for this installment

    // Reminders
    reminderSentAt: timestamp("reminder_sent_at", {
      withTimezone: true,
      mode: "date",
    }),

    // Standard timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Index for schedule lookups
    index("ix_installments_schedule").on(table.scheduleId),

    // D-03: Index for finding overdue installments efficiently
    index("idx_installments_status_due").on(table.status, table.dueAt),

    // Validate status is a known value
    check(
      "chk_installment_status_valid",
      sql`status IN ('pending', 'processing', 'paid', 'overdue', 'failed')`
    ),

    // Validate payment_provider if set
    check(
      "chk_installment_provider_valid",
      sql`payment_provider IS NULL OR payment_provider IN ('stripe', 'revolut')`
    ),
  ]
);

/**
 * Relations for type-safe queries with Drizzle.
 */
export const paymentSchedulesRelations = relations(
  paymentSchedules,
  ({ one, many }) => ({
    invoice: one(invoices, {
      fields: [paymentSchedules.invoiceId],
      references: [invoices.id],
    }),
    installments: many(paymentInstallments),
  })
);

export const paymentInstallmentsRelations = relations(
  paymentInstallments,
  ({ one }) => ({
    schedule: one(paymentSchedules, {
      fields: [paymentInstallments.scheduleId],
      references: [paymentSchedules.id],
    }),
  })
);

// Type exports for type-safe operations
export type PaymentScheduleSelect = typeof paymentSchedules.$inferSelect;
export type PaymentScheduleInsert = typeof paymentSchedules.$inferInsert;
export type PaymentInstallmentSelect = typeof paymentInstallments.$inferSelect;
export type PaymentInstallmentInsert = typeof paymentInstallments.$inferInsert;
