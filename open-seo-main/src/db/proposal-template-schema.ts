/**
 * Schema for proposal templates and template sections.
 * Phase 57-01: Proposal Editor Revolution - Template System Foundation
 *
 * Three-layer template hierarchy:
 * 1. System templates (workspaceId = null) - pre-built defaults
 * 2. Workspace templates - organization-specific customizations
 * 3. Instance templates - per-proposal customizations (handled via proposals table)
 *
 * Each template contains sections with localized content (en/lt).
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

// Template types
export const PROPOSAL_TEMPLATE_TYPES = [
  "proposal",
  "case_study",
  "report",
] as const;
export type ProposalTemplateType = (typeof PROPOSAL_TEMPLATE_TYPES)[number];

// Template categories
export const PROPOSAL_TEMPLATE_CATEGORIES = [
  "seo",
  "local_seo",
  "ecommerce",
  "enterprise",
  "custom",
] as const;
export type ProposalTemplateCategory =
  (typeof PROPOSAL_TEMPLATE_CATEGORIES)[number];

// Section types
export const TEMPLATE_SECTION_TYPES = [
  "hero",
  "introduction",
  "current_state",
  "opportunities",
  "methodology",
  "timeline",
  "pricing",
  "case_studies",
  "team",
  "next_steps",
  "terms",
  "custom",
] as const;
export type TemplateSectionType = (typeof TEMPLATE_SECTION_TYPES)[number];

/**
 * VariableDefinition - defines a substitution variable in the template.
 */
export interface VariableDefinition {
  key: string;
  label: string;
  labelEn?: string;
  labelLt?: string;
  category: "client" | "provider" | "pricing" | "audit" | "dates" | "custom";
  type: "text" | "number" | "currency" | "date" | "list" | "rich_text";
  required: boolean;
  defaultValue?: string | number | string[];
  validation?: {
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: string;
  };
}

/**
 * BrandingSettings - branding customization for the template.
 */
export interface BrandingSettings {
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  fontFamily?: string;
  headerStyle?: "centered" | "left-aligned" | "minimal";
  footerText?: string;
}

/**
 * SectionCondition - conditional display logic for sections.
 */
export interface SectionCondition {
  field: string;
  operator: "equals" | "not_equals" | "exists" | "not_exists" | "gt" | "lt";
  value?: string | number | boolean;
}

/**
 * Proposal templates table - reusable template definitions.
 * System templates have workspaceId = null and are available to all workspaces.
 */
export const proposalTemplates = pgTable(
  "proposal_templates",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").references(() => organization.id, {
      onDelete: "cascade",
    }),

    // Localized template metadata
    name: text("name").notNull(),
    nameEn: text("name_en"),
    nameLt: text("name_lt"),
    description: text("description"),
    descriptionEn: text("description_en"),
    descriptionLt: text("description_lt"),

    // Template classification
    type: text("type").notNull().default("proposal"),
    category: text("category").notNull().default("seo"),

    // Section order (array of section IDs)
    sectionOrder: jsonb("section_order").$type<string[]>().notNull().default([]),

    // Variable definitions for this template
    variables: jsonb("variables")
      .$type<VariableDefinition[]>()
      .notNull()
      .default([]),

    // Branding settings
    brandingSettings: jsonb("branding_settings").$type<BrandingSettings>(),

    // Versioning
    version: integer("version").notNull().default(1),
    isPublished: boolean("is_published").notNull().default(false),
    isDefault: boolean("is_default").notNull().default(false),
    isArchived: boolean("is_archived").notNull().default(false),

    // Audit fields
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    createdBy: text("created_by"),
  },
  (table) => [
    index("ix_proposal_templates_workspace").on(table.workspaceId),
    index("ix_proposal_templates_type").on(table.type),
    index("ix_proposal_templates_category").on(table.category),
    index("ix_proposal_templates_published").on(table.isPublished),
    index("ix_proposal_templates_default").on(table.isDefault),
    check(
      "chk_proposal_template_type",
      sql`type IN ('proposal', 'case_study', 'report')`
    ),
    check(
      "chk_proposal_template_category",
      sql`category IN ('seo', 'local_seo', 'ecommerce', 'enterprise', 'custom')`
    ),
  ]
);

/**
 * Template sections table - individual sections within a template.
 * Sections have localized title and content for multi-language support.
 */
export const templateSections = pgTable(
  "template_sections",
  {
    id: text("id").primaryKey(),
    templateId: text("template_id")
      .notNull()
      .references(() => proposalTemplates.id, { onDelete: "cascade" }),

    // Section identifier (used for ordering and variable scoping)
    key: text("key").notNull(),

    // Localized title
    title: text("title").notNull(),
    titleEn: text("title_en"),
    titleLt: text("title_lt"),

    // Localized content (rich text with variable placeholders)
    content: text("content").notNull().default(""),
    contentEn: text("content_en"),
    contentLt: text("content_lt"),

    // Section type and configuration
    sectionType: text("section_type").notNull().default("custom"),
    isRequired: boolean("is_required").notNull().default(false),
    isEditable: boolean("is_editable").notNull().default(true),
    position: integer("position").notNull().default(0),

    // Conditional display logic
    conditions: jsonb("conditions").$type<SectionCondition[]>(),

    // AI generation hint for content generation
    aiPromptHint: text("ai_prompt_hint"),

    // Audit fields
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_template_sections_template").on(table.templateId),
    index("ix_template_sections_key").on(table.key),
    index("ix_template_sections_position").on(table.position),
    check(
      "chk_template_section_type",
      sql`section_type IN ('hero', 'introduction', 'current_state', 'opportunities', 'methodology', 'timeline', 'pricing', 'case_studies', 'team', 'next_steps', 'terms', 'custom')`
    ),
  ]
);

/**
 * Relations for proposal templates
 */
export const proposalTemplatesRelations = relations(
  proposalTemplates,
  ({ one, many }) => ({
    workspace: one(organization, {
      fields: [proposalTemplates.workspaceId],
      references: [organization.id],
    }),
    sections: many(templateSections),
  })
);

/**
 * Relations for template sections
 */
export const templateSectionsRelations = relations(
  templateSections,
  ({ one }) => ({
    template: one(proposalTemplates, {
      fields: [templateSections.templateId],
      references: [proposalTemplates.id],
    }),
  })
);

// Type exports for database operations
export type ProposalTemplateSelect = typeof proposalTemplates.$inferSelect;
export type ProposalTemplateInsert = typeof proposalTemplates.$inferInsert;
export type TemplateSectionSelect = typeof templateSections.$inferSelect;
export type TemplateSectionInsert = typeof templateSections.$inferInsert;
