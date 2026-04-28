/**
 * Schema for proposals and related tables.
 * Phase 30: Interactive Proposals - Schema & Builder
 *
 * Proposals are generated from prospects to convert them into paying clients.
 * Includes tracking for views, signatures, and payments.
 */
import {
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  index,
  boolean,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organization } from "./user-schema";
import { prospects } from "./prospect-schema";

// Proposal status enum values - follows a state machine flow
export const PROPOSAL_STATUS = [
  "draft",
  "sent",
  "viewed",
  "accepted",
  "signed",
  "paid",
  "onboarded",
  "expired",
  "declined",
] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUS)[number];

// Payment status enum values
export const PAYMENT_STATUS = ["pending", "completed", "failed"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUS)[number];

// Proposal template types
export const PROPOSAL_TEMPLATES = ["standard", "premium", "enterprise"] as const;
export type ProposalTemplate = (typeof PROPOSAL_TEMPLATES)[number];

// Opportunity difficulty levels
export type OpportunityDifficulty = "easy" | "medium" | "hard";

/**
 * ProposalContent JSONB type - the main content of the proposal.
 * This is the data that populates the proposal template.
 */
export interface ProposalContent {
  hero: {
    headline: string;
    subheadline: string;
    trafficValue: number;
  };
  currentState: {
    traffic: number;
    keywords: number;
    value: number;
    chartData: Array<{ month: string; traffic: number }>;
  };
  opportunities: Array<{
    keyword: string;
    volume: number;
    difficulty: OpportunityDifficulty;
    potential: number;
  }>;
  roi: {
    projectedTrafficGain: number;
    trafficValue: number;
    defaultConversionRate: number;
    defaultAov: number;
  };
  investment: {
    setupFee: number;
    monthlyFee: number;
    inclusions: string[];
  };
  nextSteps: string[];
}

/**
 * BrandConfig JSONB type - branding customization for the proposal.
 */
export interface BrandConfig {
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
}

/**
 * Proposals table - the main proposal entity.
 * Each proposal is generated from a prospect and tracks its lifecycle.
 */
export const proposals = pgTable(
  "proposals",
  {
    id: text("id").primaryKey(),
    prospectId: text("prospect_id").references(() => prospects.id, {
      onDelete: "set null",
    }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),

    // Template & content
    template: text("template").default("standard"),
    content: jsonb("content").$type<ProposalContent>().notNull(),
    brandConfig: jsonb("brand_config").$type<BrandConfig>(),

    // Pricing (in cents for precision)
    setupFeeCents: integer("setup_fee_cents"),
    monthlyFeeCents: integer("monthly_fee_cents"),
    currency: text("currency").default("EUR"),

    // Status
    status: text("status").notNull().default("draft"),

    // Access - token for public viewing without auth
    token: text("token").unique().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),

    // Lifecycle timestamps
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }),
    firstViewedAt: timestamp("first_viewed_at", {
      withTimezone: true,
      mode: "date",
    }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true, mode: "date" }),
    signedAt: timestamp("signed_at", { withTimezone: true, mode: "date" }),
    paidAt: timestamp("paid_at", { withTimezone: true, mode: "date" }),

    // Loss tracking (Phase 30-08)
    declinedReason: text("declined_reason"),
    declinedNotes: text("declined_notes"),

    // Standard timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_proposals_workspace").on(table.workspaceId),
    index("ix_proposals_prospect").on(table.prospectId),
    index("ix_proposals_status").on(table.status),
    index("ix_proposals_token").on(table.token),
  ],
);

/**
 * Proposal views table - tracks engagement with the proposal.
 * Records each view with duration and interaction data.
 */
export const proposalViews = pgTable(
  "proposal_views",
  {
    id: text("id").primaryKey(),
    proposalId: text("proposal_id")
      .notNull()
      .references(() => proposals.id, { onDelete: "cascade" }),

    // View data
    viewedAt: timestamp("viewed_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    durationSeconds: integer("duration_seconds"),
    sectionsViewed: text("sections_viewed").array(),
    roiCalculatorUsed: boolean("roi_calculator_used").default(false),
    deviceType: text("device_type"),
    ipHash: text("ip_hash"),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("ix_proposal_views_proposal").on(table.proposalId)],
);

/**
 * Proposal signatures table - tracks e-signature via Dokobit.
 * Records signing method, session, and resulting signed PDF.
 */
export const proposalSignatures = pgTable(
  "proposal_signatures",
  {
    id: text("id").primaryKey(),
    proposalId: text("proposal_id")
      .notNull()
      .references(() => proposals.id, { onDelete: "cascade" }),

    // Signer information
    signerName: text("signer_name").notNull(),
    signerPersonalCodeHash: text("signer_personal_code_hash"),

    // Dokobit integration
    signingMethod: text("signing_method"), // 'smart_id', 'mobile_id'
    dokobitSessionId: text("dokobit_session_id"),
    signedPdfUrl: text("signed_pdf_url"),

    // Timestamps
    signedAt: timestamp("signed_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("ix_proposal_signatures_proposal").on(table.proposalId)],
);

/**
 * Proposal payments table - tracks payment via Stripe.
 * Records Stripe session, payment intent, and subscription IDs.
 */
export const proposalPayments = pgTable(
  "proposal_payments",
  {
    id: text("id").primaryKey(),
    proposalId: text("proposal_id")
      .notNull()
      .references(() => proposals.id, { onDelete: "cascade" }),

    // Stripe integration
    provider: text("provider").default("stripe"),
    stripeSessionId: text("stripe_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),

    // Payment details
    amountCents: integer("amount_cents"),
    currency: text("currency").default("EUR"),
    status: text("status").notNull().default("pending"),

    // Timestamps
    paidAt: timestamp("paid_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_proposal_payments_proposal").on(table.proposalId),
    index("ix_proposal_payments_stripe_session").on(table.stripeSessionId),
  ],
);

// Relations
export const proposalsRelations = relations(proposals, ({ one, many }) => ({
  prospect: one(prospects, {
    fields: [proposals.prospectId],
    references: [prospects.id],
  }),
  workspace: one(organization, {
    fields: [proposals.workspaceId],
    references: [organization.id],
  }),
  views: many(proposalViews),
  signatures: many(proposalSignatures),
  payments: many(proposalPayments),
}));

export const proposalViewsRelations = relations(proposalViews, ({ one }) => ({
  proposal: one(proposals, {
    fields: [proposalViews.proposalId],
    references: [proposals.id],
  }),
}));

export const proposalSignaturesRelations = relations(
  proposalSignatures,
  ({ one }) => ({
    proposal: one(proposals, {
      fields: [proposalSignatures.proposalId],
      references: [proposals.id],
    }),
  }),
);

export const proposalPaymentsRelations = relations(
  proposalPayments,
  ({ one }) => ({
    proposal: one(proposals, {
      fields: [proposalPayments.proposalId],
      references: [proposals.id],
    }),
  }),
);

// Inferred types for database operations
export type ProposalSelect = typeof proposals.$inferSelect;
export type ProposalInsert = typeof proposals.$inferInsert;
export type ProposalViewSelect = typeof proposalViews.$inferSelect;
export type ProposalViewInsert = typeof proposalViews.$inferInsert;
export type ProposalSignatureSelect = typeof proposalSignatures.$inferSelect;
export type ProposalSignatureInsert = typeof proposalSignatures.$inferInsert;
export type ProposalPaymentSelect = typeof proposalPayments.$inferSelect;
export type ProposalPaymentInsert = typeof proposalPayments.$inferInsert;
