/**
 * Discount Code Schema
 * Phase 60-04: Payment Flexibility - Discount Codes
 *
 * Stores discount/coupon codes for invoice payments.
 * Supports percentage and fixed amount discounts.
 *
 * Features:
 * - Percentage discounts (e.g., 20% off)
 * - Fixed amount discounts (e.g., 50 EUR off)
 * - Usage limits (max uses, per-customer limits)
 * - Minimum order amounts
 * - Date-based validity windows
 * - Workspace scoping for multi-tenant support
 */
import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  index,
  check,
  unique,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { organization } from "./user-schema";

/**
 * Discount types.
 * - percentage: Discount as percentage of total (value = percentage * 100, e.g., 2000 = 20%)
 * - fixed: Discount as fixed amount in cents (value = amount in cents)
 */
export const DISCOUNT_TYPES = ["percentage", "fixed"] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

/**
 * Discount codes table.
 *
 * Design decisions:
 * - discountValue stored as integer for precision:
 *   - For percentage: value * 100 (e.g., 20% = 2000, 5.5% = 550)
 *   - For fixed: amount in cents (e.g., 50 EUR = 5000)
 * - Code uniqueness scoped to workspace (different workspaces can have same code)
 * - Optional validity window (validFrom/validUntil)
 * - Optional usage limits (maxUses, maxUsesPerCustomer)
 *
 * Threat mitigations:
 * - CHECK constraint for valid discount types
 * - CHECK constraint for positive discount values
 * - Workspace scoping prevents cross-tenant access
 */
export const discountCodes = pgTable(
  "discount_codes",
  {
    // Primary key
    id: text("id").primaryKey(),

    // Workspace/tenant scoping
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),

    // Code identifier (case-insensitive matching recommended at application layer)
    code: text("code").notNull(),

    // Discount configuration
    discountType: text("discount_type").notNull(), // 'percentage' | 'fixed'
    discountValue: integer("discount_value").notNull(), // See design decisions above

    // Optional description for internal use
    description: text("description"),

    // Usage limits
    maxUses: integer("max_uses"), // null = unlimited
    maxUsesPerCustomer: integer("max_uses_per_customer"), // null = unlimited
    usedCount: integer("used_count").notNull().default(0),

    // Minimum order requirement
    minAmountCents: integer("min_amount_cents"), // null = no minimum

    // Maximum discount cap (for percentage discounts)
    maxDiscountCents: integer("max_discount_cents"), // null = no cap

    // Validity window
    validFrom: timestamp("valid_from", { withTimezone: true, mode: "date" }),
    validUntil: timestamp("valid_until", { withTimezone: true, mode: "date" }),

    // Active flag (can be manually disabled)
    isActive: boolean("is_active").notNull().default(true),

    // Audit timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Unique code per workspace
    unique("uq_discount_code_workspace").on(table.workspaceId, table.code),

    // Indexes for common queries
    index("ix_discount_codes_workspace").on(table.workspaceId),
    index("ix_discount_codes_code").on(table.code),
    index("ix_discount_codes_active").on(table.workspaceId, table.isActive),

    // Validate discount type
    check(
      "chk_discount_type_valid",
      sql`discount_type IN ('percentage', 'fixed')`
    ),

    // Validate discount value is positive
    check("chk_discount_value_positive", sql`discount_value > 0`),

    // Validate percentage is <= 100% (10000 basis points)
    check(
      "chk_percentage_max",
      sql`discount_type != 'percentage' OR discount_value <= 10000`
    ),

    // Validate used_count is non-negative
    check("chk_used_count_non_negative", sql`used_count >= 0`),

    // Validate min_amount_cents is positive if set
    check(
      "chk_min_amount_positive",
      sql`min_amount_cents IS NULL OR min_amount_cents > 0`
    ),
  ]
);

/**
 * Discount code usage tracking.
 * Records each application of a discount code.
 */
export const discountCodeUsages = pgTable(
  "discount_code_usages",
  {
    // Primary key
    id: text("id").primaryKey(),

    // References
    discountCodeId: text("discount_code_id")
      .notNull()
      .references(() => discountCodes.id, { onDelete: "cascade" }),
    invoiceId: text("invoice_id").notNull(), // References invoices table
    clientId: text("client_id"), // For per-customer limit tracking (UUID as text)

    // Discount applied
    discountAmountCents: integer("discount_amount_cents").notNull(),

    // Timestamp
    appliedAt: timestamp("applied_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Index for looking up usages by discount code
    index("ix_discount_code_usages_code").on(table.discountCodeId),

    // Index for looking up usages by invoice
    index("ix_discount_code_usages_invoice").on(table.invoiceId),

    // Index for per-customer usage counts
    index("ix_discount_code_usages_customer").on(
      table.discountCodeId,
      table.clientId
    ),

    // Prevent double-application to same invoice
    unique("uq_discount_code_usage_invoice").on(
      table.discountCodeId,
      table.invoiceId
    ),
  ]
);

/**
 * Relations for type-safe queries with Drizzle
 */
export const discountCodesRelations = relations(discountCodes, ({ one, many }) => ({
  workspace: one(organization, {
    fields: [discountCodes.workspaceId],
    references: [organization.id],
  }),
  usages: many(discountCodeUsages),
}));

export const discountCodeUsagesRelations = relations(
  discountCodeUsages,
  ({ one }) => ({
    discountCode: one(discountCodes, {
      fields: [discountCodeUsages.discountCodeId],
      references: [discountCodes.id],
    }),
  })
);

// Type exports for type-safe operations
export type DiscountCodeSelect = typeof discountCodes.$inferSelect;
export type DiscountCodeInsert = typeof discountCodes.$inferInsert;
export type DiscountCodeUsageSelect = typeof discountCodeUsages.$inferSelect;
export type DiscountCodeUsageInsert = typeof discountCodeUsages.$inferInsert;
