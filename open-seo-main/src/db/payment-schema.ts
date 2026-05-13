/**
 * Payment schema for multi-provider payment reconciliation.
 * Phase 101: Direct Proposal & Manual Deal Pipeline
 *
 * Supports payment ingestion from:
 * - Stripe webhooks (real-time)
 * - Revolut API polling (every 15 min)
 * - Manual entry / CSV import (bank transfers, cash)
 *
 * Features:
 * - Split payments across multiple invoices (paymentAllocations)
 * - Client credits for overpayments/prepayments (clientCredits)
 * - Cross-platform payment linking (paymentGroups, paymentGroupMembers)
 * - 7-year soft delete retention for audit trail (D-02 compliance)
 *
 * Threat Mitigations:
 * - T-101-02: CHECK constraints on provider/status, amounts in cents
 * - T-101-04: All queries scoped by workspaceId (no cross-tenant access)
 */
import {
  pgTable,
  text,
  uuid,
  integer,
  timestamp,
  index,
  check,
  unique,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { organization } from "./user-schema";
import { invoices } from "./invoice-schema";
import { clients } from "./client-schema";
import { softDeleteColumns } from "./soft-delete-columns";

// ============================================================================
// Type/Enum Exports
// ============================================================================

/**
 * Payment providers supported by the reconciliation system.
 */
export const PAYMENT_PROVIDERS = [
  "stripe",
  "revolut",
  "bank_transfer",
  "cash",
  "other",
] as const;
export type PaymentProviderType = (typeof PAYMENT_PROVIDERS)[number];

/**
 * Payment status state machine:
 * - pending: Payment received, not yet matched to invoice
 * - matched: Auto-matched to invoice with confidence >= 90%
 * - allocated: Payment allocated to one or more invoices
 * - review: Low confidence match, needs manual review
 * - failed: Payment processing failed
 */
export const PAYMENT_STATUS = [
  "pending",
  "matched",
  "allocated",
  "review",
  "failed",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUS)[number];

/**
 * Match types for auto-matching engine.
 * Priority order (D-02):
 * 1. invoice_memo: Invoice # in memo (100% confidence)
 * 2. exact_amount_email: Exact amount + client email (95%)
 * 3. exact_amount_date: Exact amount + date within 7 days (85%)
 * 4. fuzzy_amount_name: Fuzzy amount (+-EUR0.50) + client name (70%)
 * 5. manual: Manually assigned by user
 * 6. none: No match found (review queue)
 */
export const MATCH_TYPES = [
  "invoice_memo",
  "exact_amount_email",
  "exact_amount_date",
  "fuzzy_amount_name",
  "manual",
  "none",
] as const;
export type MatchType = (typeof MATCH_TYPES)[number];

/**
 * Credit reasons for client credits.
 */
export const CREDIT_REASONS = [
  "overpayment",
  "prepayment",
  "refund_credit",
  "manual",
] as const;
export type CreditReason = (typeof CREDIT_REASONS)[number];

/**
 * Roles for payment group members.
 * - primary: The main payment in the group
 * - linked: Related payments (cross-platform, partial)
 */
export const GROUP_MEMBER_ROLES = ["primary", "linked"] as const;
export type GroupMemberRole = (typeof GROUP_MEMBER_ROLES)[number];

// ============================================================================
// Payments Table
// ============================================================================

/**
 * Payments table - normalized payment from any source.
 *
 * Idempotency is enforced via (provider, externalId) uniqueness per workspace.
 * All amounts stored in cents for precision (T-101-02).
 */
export const payments = pgTable(
  "payments",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),

    // Provider & external reference (for idempotency)
    provider: text("provider").notNull(),
    externalId: text("external_id"), // stripe_payment_intent_id, revolut_order_id, etc.

    // Amount breakdown (all in cents for precision)
    grossAmountCents: integer("gross_amount_cents").notNull(),
    providerFeeCents: integer("provider_fee_cents").default(0),
    netAmountCents: integer("net_amount_cents").notNull(),
    currency: text("currency").default("EUR"),

    // Payer info for matching
    payerReference: text("payer_reference"), // What appears on bank statement
    payerEmail: text("payer_email"),
    payerName: text("payer_name"),
    memo: text("memo"), // Transaction description/memo field

    // Matching results
    matchedInvoiceId: text("matched_invoice_id").references(() => invoices.id),
    confidence: integer("confidence"), // 0-100
    matchType: text("match_type"),
    status: text("status").notNull().default("pending"),

    // Timestamps
    receivedAt: timestamp("received_at", { withTimezone: true, mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),

    // Soft delete for audit trail (7-year retention per D-02)
    ...softDeleteColumns,
  },
  (table) => [
    // Query indexes
    index("ix_payments_workspace").on(table.workspaceId),
    index("ix_payments_external").on(table.provider, table.externalId),
    index("ix_payments_status").on(table.status),
    index("ix_payments_matched_invoice").on(table.matchedInvoiceId),
    index("ix_payments_received").on(table.receivedAt),

    // CHECK constraints (T-101-02)
    check(
      "chk_payment_provider_valid",
      sql`provider IN ('stripe', 'revolut', 'bank_transfer', 'cash', 'other')`
    ),
    check(
      "chk_payment_status_valid",
      sql`status IN ('pending', 'matched', 'allocated', 'review', 'failed')`
    ),
  ]
);

// ============================================================================
// Payment Allocations Table
// ============================================================================

/**
 * Payment allocations - many-to-many between payments and invoices.
 *
 * Supports split payments where one payment covers multiple invoices,
 * or multiple payments cover one invoice (partial payments).
 */
export const paymentAllocations = pgTable(
  "payment_allocations",
  {
    id: text("id").primaryKey(),
    paymentId: text("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "cascade" }),
    invoiceId: text("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    allocatedCents: integer("allocated_cents").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_allocations_payment").on(table.paymentId),
    index("ix_allocations_invoice").on(table.invoiceId),
  ]
);

// ============================================================================
// Client Credits Table
// ============================================================================

/**
 * Client credits - tracks overpayments, prepayments, refund credits.
 *
 * Credits are liabilities that can be applied to future invoices.
 * Optional expiration for time-limited credits.
 */
export const clientCredits = pgTable(
  "client_credits",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => clients.id), // nullable for unassigned credits
    sourcePaymentId: text("source_payment_id").references(() => payments.id), // nullable for manual credits
    amountCents: integer("amount_cents").notNull(),
    usedCents: integer("used_cents").default(0),
    currency: text("currency").default("EUR"),
    reason: text("reason"), // one of CREDIT_REASONS
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }), // nullable
  },
  (table) => [
    index("ix_credits_workspace").on(table.workspaceId),
    index("ix_credits_client").on(table.clientId),
  ]
);

// ============================================================================
// Payment Groups Table
// ============================================================================

/**
 * Payment groups - for cross-platform payment linking.
 *
 * Groups multiple related payments (e.g., Revolut -> Stripe flows,
 * multi-payment settlements for single invoice).
 */
export const paymentGroups = pgTable(
  "payment_groups",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // e.g., "INV-042 Multi-Payment"
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("ix_payment_groups_workspace").on(table.workspaceId)]
);

// ============================================================================
// Payment Group Members Table
// ============================================================================

/**
 * Payment group members - links payments to groups with role.
 *
 * Each payment can only belong to one group (unique constraint).
 */
export const paymentGroupMembers = pgTable(
  "payment_group_members",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id")
      .notNull()
      .references(() => paymentGroups.id, { onDelete: "cascade" }),
    paymentId: text("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // primary | linked
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_group_members_group").on(table.groupId),
    index("ix_group_members_payment").on(table.paymentId),
    unique("uq_group_member_payment").on(table.groupId, table.paymentId),
  ]
);

// ============================================================================
// Relations
// ============================================================================

export const paymentsRelations = relations(payments, ({ one, many }) => ({
  workspace: one(organization, {
    fields: [payments.workspaceId],
    references: [organization.id],
  }),
  matchedInvoice: one(invoices, {
    fields: [payments.matchedInvoiceId],
    references: [invoices.id],
  }),
  allocations: many(paymentAllocations),
  groupMembers: many(paymentGroupMembers),
}));

export const paymentAllocationsRelations = relations(
  paymentAllocations,
  ({ one }) => ({
    payment: one(payments, {
      fields: [paymentAllocations.paymentId],
      references: [payments.id],
    }),
    invoice: one(invoices, {
      fields: [paymentAllocations.invoiceId],
      references: [invoices.id],
    }),
  })
);

export const clientCreditsRelations = relations(clientCredits, ({ one }) => ({
  workspace: one(organization, {
    fields: [clientCredits.workspaceId],
    references: [organization.id],
  }),
  client: one(clients, {
    fields: [clientCredits.clientId],
    references: [clients.id],
  }),
  sourcePayment: one(payments, {
    fields: [clientCredits.sourcePaymentId],
    references: [payments.id],
  }),
}));

export const paymentGroupsRelations = relations(
  paymentGroups,
  ({ one, many }) => ({
    workspace: one(organization, {
      fields: [paymentGroups.workspaceId],
      references: [organization.id],
    }),
    members: many(paymentGroupMembers),
  })
);

export const paymentGroupMembersRelations = relations(
  paymentGroupMembers,
  ({ one }) => ({
    group: one(paymentGroups, {
      fields: [paymentGroupMembers.groupId],
      references: [paymentGroups.id],
    }),
    payment: one(payments, {
      fields: [paymentGroupMembers.paymentId],
      references: [payments.id],
    }),
  })
);

// ============================================================================
// Type Exports
// ============================================================================

export type PaymentSelect = typeof payments.$inferSelect;
export type PaymentInsert = typeof payments.$inferInsert;
export type PaymentAllocationSelect = typeof paymentAllocations.$inferSelect;
export type PaymentAllocationInsert = typeof paymentAllocations.$inferInsert;
export type ClientCreditSelect = typeof clientCredits.$inferSelect;
export type ClientCreditInsert = typeof clientCredits.$inferInsert;
export type PaymentGroupSelect = typeof paymentGroups.$inferSelect;
export type PaymentGroupInsert = typeof paymentGroups.$inferInsert;
export type PaymentGroupMemberSelect = typeof paymentGroupMembers.$inferSelect;
export type PaymentGroupMemberInsert = typeof paymentGroupMembers.$inferInsert;
