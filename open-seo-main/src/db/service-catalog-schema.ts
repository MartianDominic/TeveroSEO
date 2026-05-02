/**
 * Schema for service catalog - service templates and proposal services.
 * Phase 58-01: Service Catalog & Extra Services - Schema Foundation
 *
 * Two tables:
 * 1. serviceTemplates - Workspace-level reusable service definitions
 * 2. proposalServices - Services selected for a specific proposal
 *
 * System templates (workspaceId = null) provide default services.
 * Workspace templates allow customization per agency.
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
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { organization } from "./user-schema";
import { proposals } from "./proposal-schema";

// Service categories
export const SERVICE_CATEGORIES = ["seo_package", "addon", "one_time"] as const;
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

// Pricing types
export const PRICING_TYPES = ["monthly", "one_time", "per_unit"] as const;
export type PricingType = (typeof PRICING_TYPES)[number];

/**
 * Service templates table - reusable service definitions.
 * System templates have workspaceId = null and are available to all workspaces.
 */
export const serviceTemplates = pgTable(
  "service_templates",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").references(() => organization.id, {
      onDelete: "cascade",
    }),

    // Classification
    category: text("category").notNull(), // 'seo_package' | 'addon' | 'one_time'

    // Localized name
    name: text("name").notNull(),
    nameEn: text("name_en"),
    nameLt: text("name_lt"),

    // Localized description
    description: text("description"),
    descriptionEn: text("description_en"),
    descriptionLt: text("description_lt"),

    // Pricing
    pricingType: text("pricing_type").notNull(), // 'monthly' | 'one_time' | 'per_unit'
    basePriceCents: integer("base_price_cents"),
    setupFeeCents: integer("setup_fee_cents"),
    currency: text("currency").default("EUR"),
    unitLabel: text("unit_label"), // e.g., "per article", "per hour"

    // Deliverables
    inclusions: jsonb("inclusions").$type<string[]>(),

    // Agreement terms (localized)
    termsTemplate: text("terms_template"),
    termsTemplateEn: text("terms_template_en"),
    termsTemplateLt: text("terms_template_lt"),

    // Display
    icon: text("icon"), // Lucide icon name
    displayOrder: integer("display_order"),
    isActive: boolean("is_active").notNull().default(true),

    // Audit fields
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_service_templates_workspace").on(table.workspaceId),
    index("ix_service_templates_category").on(table.category),
    index("ix_service_templates_active").on(table.isActive),
    check(
      "chk_service_category",
      sql`category IN ('seo_package', 'addon', 'one_time')`
    ),
    check(
      "chk_pricing_type",
      sql`pricing_type IN ('monthly', 'one_time', 'per_unit')`
    ),
  ]
);

/**
 * Proposal services table - services selected for a specific proposal.
 * Links proposals to service templates with optional price overrides.
 */
export const proposalServices = pgTable(
  "proposal_services",
  {
    id: text("id").primaryKey(),
    proposalId: text("proposal_id")
      .notNull()
      .references(() => proposals.id, { onDelete: "cascade" }),
    serviceTemplateId: text("service_template_id").references(
      () => serviceTemplates.id,
      { onDelete: "set null" }
    ),

    // Customized pricing (can override template)
    customPriceCents: integer("custom_price_cents"),
    customSetupCents: integer("custom_setup_cents"),
    quantity: integer("quantity").notNull().default(1),

    // Custom description override
    customDescription: text("custom_description"),

    // Scheduling
    startMonth: integer("start_month"), // 0 = immediate, 1 = month 2, etc.
    durationMonths: integer("duration_months"), // null = ongoing

    // Status
    isIncluded: boolean("is_included").notNull().default(true),
    displayOrder: integer("display_order"),

    // Audit fields
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_proposal_services_proposal").on(table.proposalId),
    index("ix_proposal_services_template").on(table.serviceTemplateId),
  ]
);

/**
 * Relations for service templates
 */
export const serviceTemplatesRelations = relations(
  serviceTemplates,
  ({ one, many }) => ({
    workspace: one(organization, {
      fields: [serviceTemplates.workspaceId],
      references: [organization.id],
    }),
    proposalServices: many(proposalServices),
  })
);

/**
 * Relations for proposal services
 */
export const proposalServicesRelations = relations(
  proposalServices,
  ({ one }) => ({
    proposal: one(proposals, {
      fields: [proposalServices.proposalId],
      references: [proposals.id],
    }),
    serviceTemplate: one(serviceTemplates, {
      fields: [proposalServices.serviceTemplateId],
      references: [serviceTemplates.id],
    }),
  })
);

// Type exports for database operations
export type ServiceTemplateSelect = typeof serviceTemplates.$inferSelect;
export type ServiceTemplateInsert = typeof serviceTemplates.$inferInsert;
export type ProposalServiceSelect = typeof proposalServices.$inferSelect;
export type ProposalServiceInsert = typeof proposalServices.$inferInsert;
