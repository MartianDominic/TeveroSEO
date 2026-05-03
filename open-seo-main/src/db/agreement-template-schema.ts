/**
 * Schema for agreement templates and generated agreements.
 * Phase 55-06: Legal Agreement Templates with Variable Substitution
 *
 * Pre-approved legal templates with safe variable substitution.
 * Legal sections (isLegal: true) are NEVER AI-translated.
 */
import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
  integer,
  boolean,
  check,
  uuid,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { organization } from "./user-schema";
import { prospects } from "./prospect-schema";
import { clients } from "./client-schema";
import { proposals } from "./proposal-schema";

/**
 * AgreementSection - a single section of an agreement template.
 * isLegal: true means the section should NOT be AI-translated.
 */
export interface AgreementSection {
  id: string;
  title: string;
  content: string;
  isLegal: boolean;
  order: number;
}

/**
 * TemplateVariable - defines a substitution variable in the template.
 * translateValue: whether the substituted value should be translated.
 */
export interface TemplateVariable {
  key: string;
  label: string;
  type: "text" | "date" | "currency" | "number" | "list";
  required: boolean;
  translateValue: boolean;
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  };
}

// Template types
export const AGREEMENT_TEMPLATE_TYPES = [
  "seo-services",
  "consulting",
  "custom",
] as const;
export type AgreementTemplateType = (typeof AGREEMENT_TEMPLATE_TYPES)[number];

// Supported languages
export const AGREEMENT_LANGUAGES = ["en", "lt"] as const;
export type AgreementLanguage = (typeof AGREEMENT_LANGUAGES)[number];

// Generated agreement statuses
export const AGREEMENT_STATUS = [
  "draft",
  "sent",
  "signed",
  "expired",
  "cancelled",
] as const;
export type AgreementStatus = (typeof AGREEMENT_STATUS)[number];

/**
 * SignatureData - stored signature information
 */
export interface SignatureData {
  method: "e-signature" | "manual" | "dokobit";
  signedDocumentUrl?: string;
  signatureImageUrl?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}

/**
 * Agreement templates table - pre-approved legal templates.
 * Templates are versioned and require legal approval.
 */
export const agreementTemplates = pgTable(
  "agreement_templates",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    language: text("language").notNull().default("en"),
    type: text("type").notNull().default("seo-services"),

    // Template content
    sections: jsonb("sections").$type<AgreementSection[]>().notNull(),
    variables: jsonb("variables").$type<TemplateVariable[]>().notNull(),

    // Versioning and approval
    version: integer("version").notNull().default(1),
    isActive: boolean("is_active").notNull().default(true),
    approvedAt: timestamp("approved_at", { withTimezone: true, mode: "date" }),
    approvedBy: text("approved_by"),

    // Standard timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    createdBy: text("created_by"),
  },
  (table) => [
    index("ix_agreement_templates_language").on(table.language),
    index("ix_agreement_templates_type").on(table.type),
    index("ix_agreement_templates_active").on(table.isActive),
    check(
      "chk_agreement_template_language",
      sql`language IN ('en', 'lt')`
    ),
    check(
      "chk_agreement_template_type",
      sql`type IN ('seo-services', 'consulting', 'custom')`
    ),
  ]
);

/**
 * Generated agreements table - agreements rendered from templates.
 * Tracks the full lifecycle from draft to signed.
 */
export const generatedAgreements = pgTable(
  "generated_agreements",
  {
    id: text("id").primaryKey(),
    templateId: text("template_id")
      .notNull()
      .references(() => agreementTemplates.id, { onDelete: "restrict" }),
    templateVersion: integer("template_version").notNull(),

    // Entity references
    prospectId: text("prospect_id").references(() => prospects.id, {
      onDelete: "set null",
    }),
    clientId: uuid("client_id").references(() => clients.id, {
      onDelete: "set null",
    }),
    proposalId: text("proposal_id").references(() => proposals.id, {
      onDelete: "set null",
    }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),

    // Rendered content
    language: text("language").notNull(),
    renderedContent: text("rendered_content").notNull(),
    variableValues: jsonb("variable_values")
      .$type<Record<string, string | number | string[]>>()
      .notNull(),

    // Status and lifecycle
    status: text("status").notNull().default("draft"),
    signedAt: timestamp("signed_at", { withTimezone: true, mode: "date" }),
    signedBy: text("signed_by"),
    signatureData: jsonb("signature_data").$type<SignatureData>(),

    // Standard timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    index("ix_generated_agreements_template").on(table.templateId),
    index("ix_generated_agreements_prospect").on(table.prospectId),
    index("ix_generated_agreements_client").on(table.clientId),
    index("ix_generated_agreements_workspace").on(table.workspaceId),
    index("ix_generated_agreements_status").on(table.status),
    check(
      "chk_generated_agreement_status",
      sql`status IN ('draft', 'sent', 'signed', 'expired', 'cancelled')`
    ),
    check(
      "chk_generated_agreement_language",
      sql`language IN ('en', 'lt')`
    ),
  ]
);

/**
 * Relations for agreement templates
 */
export const agreementTemplatesRelations = relations(
  agreementTemplates,
  ({ many }) => ({
    generatedAgreements: many(generatedAgreements),
  })
);

/**
 * Relations for generated agreements
 */
export const generatedAgreementsRelations = relations(
  generatedAgreements,
  ({ one }) => ({
    template: one(agreementTemplates, {
      fields: [generatedAgreements.templateId],
      references: [agreementTemplates.id],
    }),
    prospect: one(prospects, {
      fields: [generatedAgreements.prospectId],
      references: [prospects.id],
    }),
    client: one(clients, {
      fields: [generatedAgreements.clientId],
      references: [clients.id],
    }),
    proposal: one(proposals, {
      fields: [generatedAgreements.proposalId],
      references: [proposals.id],
    }),
    workspace: one(organization, {
      fields: [generatedAgreements.workspaceId],
      references: [organization.id],
    }),
  })
);

// Type exports
export type AgreementTemplateSelect = typeof agreementTemplates.$inferSelect;
export type AgreementTemplateInsert = typeof agreementTemplates.$inferInsert;
export type GeneratedAgreementSelect = typeof generatedAgreements.$inferSelect;
export type GeneratedAgreementInsert = typeof generatedAgreements.$inferInsert;
