/**
 * Invoice schema for agency billing pipeline
 * Phase 45-02: Invoice lifecycle tracking with Stripe integration
 *
 * Supports invoice states: draft -> sent -> paid/overdue -> cancelled/refunded
 * Line items stored as JSONB for flexibility
 * Amounts in cents for precision (no floating point errors)
 */
import {
  pgTable,
  text,
  uuid,
  integer,
  timestamp,
  jsonb,
  index,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { organization } from "./user-schema";
import { clients } from "./client-schema";

/**
 * Invoice status state machine:
 * - draft: Invoice created, not yet sent to client
 * - sent: Invoice sent to client, awaiting payment
 * - paid: Payment received and confirmed
 * - overdue: Payment deadline passed without payment
 * - cancelled: Invoice cancelled (before payment)
 * - refunded: Payment was refunded after being paid
 */
export const INVOICE_STATUS = [
  "draft",
  "sent",
  "paid",
  "overdue",
  "cancelled",
  "refunded",
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUS)[number];

/**
 * Line item structure for invoice JSONB storage
 * Each line item represents a billable service or product
 */
export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}

/**
 * Invoices table - tracks billing lifecycle with Stripe integration
 *
 * Threat mitigations:
 * - T-45-04: CHECK constraint enforces valid status values at DB level
 * - T-45-05: Integer cents prevents rounding manipulation
 * - T-45-07: createdAt/updatedAt provide audit trail
 */
export const invoices = pgTable(
  "invoices",
  {
    // Primary key
    id: text("id").primaryKey(),

    // Workspace/tenant scoping
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),

    // Client reference (uuid to match clients.id type)
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),

    // Optional contract reference (will reference contracts table from Plan 45-01)
    contractId: text("contract_id"),

    // Invoice identification
    invoiceNumber: text("invoice_number").notNull(),

    // Line items as JSONB for flexibility
    lineItems: jsonb("line_items").$type<InvoiceLineItem[]>().notNull(),

    // Amounts in cents for precision (T-45-05)
    subtotalCents: integer("subtotal_cents").notNull(),
    taxCents: integer("tax_cents").default(0),
    totalCents: integer("total_cents").notNull(),
    currency: text("currency").default("EUR"),

    // Stripe integration (T-45-06: not secrets, access control at repo layer)
    stripeInvoiceId: text("stripe_invoice_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    stripePaymentUrl: text("stripe_payment_url"),

    // Status with CHECK constraint (T-45-04)
    status: text("status").notNull().default("draft"),

    // Lifecycle timestamps
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }),
    paidAt: timestamp("paid_at", { withTimezone: true, mode: "date" }),
    dueAt: timestamp("due_at", { withTimezone: true, mode: "date" }),

    // Audit timestamps (T-45-07)
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Indexes for common queries
    index("ix_invoices_workspace").on(table.workspaceId),
    index("ix_invoices_client").on(table.clientId),
    index("ix_invoices_contract").on(table.contractId),
    index("ix_invoices_status").on(table.status),
    index("ix_invoices_stripe").on(table.stripeInvoiceId),

    // T-45-04: Database-level constraint for valid status values
    check(
      "chk_invoice_status_valid",
      sql`status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled', 'refunded')`
    ),
  ]
);

/**
 * Relations for type-safe queries with Drizzle
 */
export const invoicesRelations = relations(invoices, ({ one }) => ({
  workspace: one(organization, {
    fields: [invoices.workspaceId],
    references: [organization.id],
  }),
  client: one(clients, {
    fields: [invoices.clientId],
    references: [clients.id],
  }),
}));

// Type exports for type-safe operations
export type InvoiceSelect = typeof invoices.$inferSelect;
export type InvoiceInsert = typeof invoices.$inferInsert;
