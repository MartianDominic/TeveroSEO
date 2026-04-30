/**
 * Schema for contracts table.
 * Phase 45-01: Contract schema with state machine
 *
 * Contracts track the lifecycle from draft through execution,
 * with e-signature integration fields for Dokobit.
 */
import {
  pgTable,
  text,
  uuid,
  timestamp,
  jsonb,
  index,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { organization } from "./user-schema";
import { proposals } from "./proposal-schema";
import { clients } from "./client-schema";

// Contract status enum values - follows a state machine flow
export const CONTRACT_STATUS = [
  "draft",
  "sent",
  "signed",
  "executed",
  "expired",
  "cancelled",
] as const;
export type ContractStatus = (typeof CONTRACT_STATUS)[number];

/**
 * ContractContent JSONB type - the main content of the contract.
 * This is the data that populates the contract document.
 */
export interface ContractContent {
  sections: Array<{
    title: string;
    body: string;
  }>;
  terms: string;
  signatures: Array<{
    role: string;
    name?: string;
  }>;
}

/**
 * Contracts table - the main contract entity.
 * Each contract is generated from a proposal and tracks its lifecycle.
 */
export const contracts = pgTable(
  "contracts",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    proposalId: text("proposal_id").references(() => proposals.id, {
      onDelete: "set null",
    }),
    clientId: uuid("client_id").references(() => clients.id, {
      onDelete: "set null",
    }),

    // Contract content
    title: text("title").notNull(),
    content: jsonb("content").$type<ContractContent>().notNull(),

    // E-signature integration (Dokobit)
    dokobitSessionId: text("dokobit_session_id"),
    signedPdfUrl: text("signed_pdf_url"),
    signedAt: timestamp("signed_at", { withTimezone: true, mode: "date" }),
    signerName: text("signer_name"),

    // Status
    status: text("status").notNull().default("draft"),

    // Lifecycle timestamps
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }),
    executedAt: timestamp("executed_at", { withTimezone: true, mode: "date" }),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),

    // Standard timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_contracts_workspace").on(table.workspaceId),
    index("ix_contracts_proposal").on(table.proposalId),
    index("ix_contracts_client").on(table.clientId),
    index("ix_contracts_status").on(table.status),
    // T-45-01: CHECK constraint enforces valid status values at database level
    check(
      "chk_contract_status_valid",
      sql`status IN ('draft', 'sent', 'signed', 'executed', 'expired', 'cancelled')`
    ),
  ]
);

/**
 * Contract relations for query joins
 */
export const contractsRelations = relations(contracts, ({ one }) => ({
  workspace: one(organization, {
    fields: [contracts.workspaceId],
    references: [organization.id],
  }),
  client: one(clients, {
    fields: [contracts.clientId],
    references: [clients.id],
  }),
  proposal: one(proposals, {
    fields: [contracts.proposalId],
    references: [proposals.id],
  }),
}));

// Type exports for use in repositories and services
export type ContractSelect = typeof contracts.$inferSelect;
export type ContractInsert = typeof contracts.$inferInsert;
