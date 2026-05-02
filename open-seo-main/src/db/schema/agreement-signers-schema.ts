/**
 * Schema for agreement signers and signature requirements.
 * Phase 59: Agreement & Signing Excellence - Multi-Signer Support
 */
import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { generatedAgreements, agreementTemplates } from "../agreement-template-schema";

// Signer status enum per D-05
export const SIGNER_STATUS = [
  "pending",
  "invited",
  "viewed",
  "signing",
  "signed",
  "declined",
] as const;
export type SignerStatus = (typeof SIGNER_STATUS)[number];

// Signer role enum per D-05
export const SIGNER_ROLE = ["provider", "client"] as const;
export type SignerRole = (typeof SIGNER_ROLE)[number];

// Signature data structure
export interface SignerSignatureData {
  method: "smart_id" | "mobile_id" | "id_card";
  certificateInfo?: string;
  timestamp: string;
  dokobitSessionId?: string;
  signedDocumentUrl?: string;
}

// Signature requirements - template level config per DESIGN.md
export const signatureRequirements = pgTable(
  "signature_requirements",
  {
    id: text("id").primaryKey(),
    templateId: text("template_id")
      .notNull()
      .references(() => agreementTemplates.id, { onDelete: "cascade" }),

    // Requirement definition
    role: text("role").notNull(), // 'provider' | 'client'

    // Localized labels
    label: text("label").notNull(),
    labelEn: text("label_en"),
    labelLt: text("label_lt"),

    // Default titles
    defaultTitle: text("default_title"),
    defaultTitleEn: text("default_title_en"),
    defaultTitleLt: text("default_title_lt"),

    // Signing behavior per D-07, D-08
    signingOrder: integer("signing_order").notNull(), // 0 = any order, 1/2/3 = sequential
    isRequired: boolean("is_required").default(true),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("ix_signature_requirements_template").on(table.templateId)]
);

// Actual signers assigned to an agreement per D-05, D-06
export const agreementSigners = pgTable(
  "agreement_signers",
  {
    id: text("id").primaryKey(),
    agreementId: text("agreement_id")
      .notNull()
      .references(() => generatedAgreements.id, { onDelete: "cascade" }),
    requirementId: text("requirement_id").references(
      () => signatureRequirements.id,
      { onDelete: "set null" }
    ),

    // Signer details
    role: text("role").notNull(), // 'provider' | 'client'
    name: text("name").notNull(),
    email: text("email").notNull(),
    title: text("title"), // Job title
    companyName: text("company_name"),

    // Signing order per D-07
    signingOrder: integer("signing_order").notNull(),

    // Status tracking per D-05
    status: text("status").notNull().default("pending"),

    // Timestamps
    invitedAt: timestamp("invited_at", { withTimezone: true, mode: "date" }),
    viewedAt: timestamp("viewed_at", { withTimezone: true, mode: "date" }),
    signedAt: timestamp("signed_at", { withTimezone: true, mode: "date" }),
    declinedAt: timestamp("declined_at", { withTimezone: true, mode: "date" }),
    declineReason: text("decline_reason"),

    // Signing access per D-06
    accessToken: text("access_token").unique(),
    tokenExpiresAt: timestamp("token_expires_at", {
      withTimezone: true,
      mode: "date",
    }),

    // Dokobit signature reference
    dokobitSessionId: text("dokobit_session_id"),
    signatureData: jsonb("signature_data").$type<SignerSignatureData>(),

    // IP tracking for audit
    signedFromIp: text("signed_from_ip"),
    signedUserAgent: text("signed_user_agent"),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_agreement_signers_agreement").on(table.agreementId),
    index("ix_agreement_signers_token").on(table.accessToken),
    index("ix_agreement_signers_status").on(table.status),
    index("ix_agreement_signers_dokobit_session").on(table.dokobitSessionId),
  ]
);

// Relations
export const signatureRequirementsRelations = relations(
  signatureRequirements,
  ({ one }) => ({
    template: one(agreementTemplates, {
      fields: [signatureRequirements.templateId],
      references: [agreementTemplates.id],
    }),
  })
);

export const agreementSignersRelations = relations(
  agreementSigners,
  ({ one }) => ({
    agreement: one(generatedAgreements, {
      fields: [agreementSigners.agreementId],
      references: [generatedAgreements.id],
    }),
    requirement: one(signatureRequirements, {
      fields: [agreementSigners.requirementId],
      references: [signatureRequirements.id],
    }),
  })
);

// Type exports
export type SignatureRequirementSelect =
  typeof signatureRequirements.$inferSelect;
export type SignatureRequirementInsert =
  typeof signatureRequirements.$inferInsert;
export type SignerSelect = typeof agreementSigners.$inferSelect;
export type SignerInsert = typeof agreementSigners.$inferInsert;
