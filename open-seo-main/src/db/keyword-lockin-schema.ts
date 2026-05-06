/**
 * Keyword Lock-in Schema
 * Phase 89-01: Contracted Keywords
 * Phase 89-02: Contract Goals, Out-of-Scope Requests, Change Orders
 *
 * Tracks keywords locked at contract signing with baseline positions,
 * goal achievement, and scope modifications.
 */
import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  decimal,
  index,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { contracts } from "./contract-schema";
import { clients } from "./client-schema";

// =============================================================================
// ENUMS
// =============================================================================

// Keyword lock status enum
export const KEYWORD_LOCK_STATUS = ["active", "completed", "replaced"] as const;
export type KeywordLockStatus = (typeof KEYWORD_LOCK_STATUS)[number];

// Funnel stage enum
export const FUNNEL_STAGES = ["BOFU", "MOFU", "TOFU"] as const;
export type FunnelStage = (typeof FUNNEL_STAGES)[number];

// Goal metric types
export const GOAL_METRICS = [
  "keywords_in_top_10",
  "traffic_increase",
  "ranking_improvement",
] as const;
export type GoalMetric = (typeof GOAL_METRICS)[number];

// Goal status enum
export const GOAL_STATUS = ["in_progress", "achieved", "missed"] as const;
export type GoalStatus = (typeof GOAL_STATUS)[number];

// Out-of-scope request status
export const OUT_OF_SCOPE_STATUS = [
  "pending",
  "approved",
  "rejected",
  "change_order",
] as const;
export type OutOfScopeStatus = (typeof OUT_OF_SCOPE_STATUS)[number];

// Change order status
export const CHANGE_ORDER_STATUS = [
  "draft",
  "sent",
  "approved",
  "rejected",
] as const;
export type ChangeOrderStatus = (typeof CHANGE_ORDER_STATUS)[number];

// Fee type enum
export const FEE_TYPES = ["one_time", "monthly"] as const;
export type FeeType = (typeof FEE_TYPES)[number];

// =============================================================================
// TABLES
// =============================================================================

/**
 * Contracted Keywords table
 * Keywords locked at contract signing with baseline snapshot.
 */
export const contractedKeywords = pgTable(
  "contracted_keywords",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contractId: text("contract_id")
      .notNull()
      .references(() => contracts.id, { onDelete: "cascade" }),

    // Original keyword reference (nullable - may not exist in prospect_keywords)
    keywordId: uuid("keyword_id"),

    // Keyword data (denormalized for historical accuracy)
    keywordText: text("keyword_text").notNull(),
    searchVolume: integer("search_volume"),
    difficulty: integer("difficulty"),
    funnelStage: text("funnel_stage"), // BOFU, MOFU, TOFU

    // Baseline (captured at lock time)
    baselinePosition: integer("baseline_position"), // NULL if not ranking
    lockedAt: timestamp("locked_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),

    // Current state
    status: text("status").notNull().default("active"),

    // Replacement tracking
    replacedBy: uuid("replaced_by"),
    replacedAt: timestamp("replaced_at", { withTimezone: true, mode: "date" }),
    replacementReason: text("replacement_reason"),

    // Change order (if added after contract)
    changeOrderId: uuid("change_order_id"),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_contracted_keywords_contract").on(table.contractId),
    index("ix_contracted_keywords_text").on(table.keywordText),
    index("ix_contracted_keywords_status").on(table.status),
    // Status must be valid enum value
    check(
      "chk_contracted_keyword_status",
      sql`status IN ('active', 'completed', 'replaced')`
    ),
  ]
);

// Self-reference for replacement chain
export const contractedKeywordsRelations = relations(
  contractedKeywords,
  ({ one }) => ({
    contract: one(contracts, {
      fields: [contractedKeywords.contractId],
      references: [contracts.id],
    }),
    replacedByKeyword: one(contractedKeywords, {
      fields: [contractedKeywords.replacedBy],
      references: [contractedKeywords.id],
    }),
  })
);

// Type exports
export type ContractedKeywordSelect = typeof contractedKeywords.$inferSelect;
export type ContractedKeywordInsert = typeof contractedKeywords.$inferInsert;

/**
 * Contract Goals table
 * Tracks goal achievement (delivered / target x 100).
 */
export const contractGoals = pgTable(
  "contract_goals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contractId: text("contract_id")
      .notNull()
      .references(() => contracts.id, { onDelete: "cascade" }),

    // Goal definition
    metric: text("metric").notNull().default("keywords_in_top_10"),
    targetValue: integer("target_value").notNull(), // e.g., 10 (keywords)
    targetDeadline: timestamp("target_deadline", {
      withTimezone: true,
      mode: "date",
    }).notNull(),

    // Current progress
    currentValue: integer("current_value").default(0),
    achievementPercent: decimal("achievement_percent", {
      precision: 6,
      scale: 2,
    }).default("0"), // 400.00 = 400%

    // Status
    status: text("status").default("in_progress"),
    achievedAt: timestamp("achieved_at", { withTimezone: true, mode: "date" }),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_contract_goals_contract").on(table.contractId),
    check(
      "chk_contract_goal_status",
      sql`status IN ('in_progress', 'achieved', 'missed')`
    ),
  ]
);

export const contractGoalsRelations = relations(contractGoals, ({ one }) => ({
  contract: one(contracts, {
    fields: [contractGoals.contractId],
    references: [contracts.id],
  }),
}));

export type ContractGoalSelect = typeof contractGoals.$inferSelect;
export type ContractGoalInsert = typeof contractGoals.$inferInsert;

/**
 * Change Orders table
 * Auditable scope modifications to contracts.
 * Defined before out_of_scope_requests for FK reference.
 */
export const changeOrders = pgTable(
  "change_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contractId: text("contract_id")
      .notNull()
      .references(() => contracts.id, { onDelete: "cascade" }),

    // Change details
    description: text("description").notNull(),
    keywordsAdded: text("keywords_added").array().default(sql`'{}'::text[]`),
    keywordsRemoved: text("keywords_removed").array().default(sql`'{}'::text[]`),

    // Pricing
    additionalFee: decimal("additional_fee", { precision: 10, scale: 2 }).default(
      "0"
    ),
    feeType: text("fee_type").default("one_time"), // one_time, monthly

    // Status
    status: text("status").default("draft"),
    approvedAt: timestamp("approved_at", { withTimezone: true, mode: "date" }),
    approvedBy: text("approved_by"),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_change_orders_contract").on(table.contractId),
    check(
      "chk_change_order_status",
      sql`status IN ('draft', 'sent', 'approved', 'rejected')`
    ),
  ]
);

export const changeOrdersRelations = relations(changeOrders, ({ one }) => ({
  contract: one(contracts, {
    fields: [changeOrders.contractId],
    references: [contracts.id],
  }),
}));

export type ChangeOrderSelect = typeof changeOrders.$inferSelect;
export type ChangeOrderInsert = typeof changeOrders.$inferInsert;

/**
 * Out-of-Scope Requests table
 * Tracks keywords requested outside original contract.
 */
export const outOfScopeRequests = pgTable(
  "out_of_scope_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    contractId: text("contract_id")
      .notNull()
      .references(() => contracts.id, { onDelete: "cascade" }),

    // Request details
    keywordText: text("keyword_text").notNull(),
    requestedAt: timestamp("requested_at", {
      withTimezone: true,
      mode: "date",
    }).defaultNow(),
    requestedBy: text("requested_by"), // email or name

    // Resolution
    status: text("status").default("pending"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: "date" }),
    resolutionNotes: text("resolution_notes"),

    // If approved via change order
    changeOrderId: uuid("change_order_id").references(() => changeOrders.id, {
      onDelete: "set null",
    }),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_out_of_scope_client").on(table.clientId),
    index("ix_out_of_scope_status").on(table.status),
    check(
      "chk_out_of_scope_status",
      sql`status IN ('pending', 'approved', 'rejected', 'change_order')`
    ),
  ]
);

export const outOfScopeRequestsRelations = relations(
  outOfScopeRequests,
  ({ one }) => ({
    client: one(clients, {
      fields: [outOfScopeRequests.clientId],
      references: [clients.id],
    }),
    contract: one(contracts, {
      fields: [outOfScopeRequests.contractId],
      references: [contracts.id],
    }),
    changeOrder: one(changeOrders, {
      fields: [outOfScopeRequests.changeOrderId],
      references: [changeOrders.id],
    }),
  })
);

export type OutOfScopeRequestSelect = typeof outOfScopeRequests.$inferSelect;
export type OutOfScopeRequestInsert = typeof outOfScopeRequests.$inferInsert;
