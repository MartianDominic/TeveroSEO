/**
 * Schema for variable definitions.
 * Phase 57-02: Variable System + Resolution Service
 *
 * Variables are placeholders like {{client.name}} that get resolved
 * to actual values when rendering proposals, agreements, and templates.
 *
 * 6 Categories:
 * - client (Blue): Prospect/client data
 * - provider (Green): Workspace/agency data
 * - pricing (Orange): Proposal services and totals
 * - audit (Purple): Website audit results
 * - dates (Gray): Computed date values
 * - custom (Teal): User-defined workspace variables
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

// Variable categories with associated colors
export const VARIABLE_CATEGORIES = [
  "client",
  "provider",
  "pricing",
  "audit",
  "dates",
  "custom",
] as const;
export type VariableCategory = (typeof VARIABLE_CATEGORIES)[number];

// Category colors for UI rendering
export const CATEGORY_COLORS: Record<VariableCategory, string> = {
  client: "#3B82F6", // Blue
  provider: "#22C55E", // Green
  pricing: "#F97316", // Orange
  audit: "#A855F7", // Purple
  dates: "#6B7280", // Gray
  custom: "#14B8A6", // Teal
};

// Source types for variable resolution
export const SOURCE_TYPES = [
  "entity", // Extract from entity path (e.g., prospect.companyName)
  "computed", // Run a computation function
  "custom", // Stored custom value
  "input", // Prompt user for value
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

// Format types for variable display
export const FORMAT_TYPES = [
  "text", // Plain text
  "currency", // Format as currency (e.g., EUR 1,500.00)
  "date", // Format as date
  "number", // Format as number with thousand separators
  "percentage", // Format as percentage
  "list", // Format as bulleted list
] as const;
export type FormatType = (typeof FORMAT_TYPES)[number];

// Format options for fine-grained control
export interface FormatOptions {
  // Currency
  currency?: string; // EUR, USD, etc.
  locale?: string; // en-LT, lt-LT, etc.

  // Date
  dateFormat?: "short" | "long" | "iso"; // Apr 30, 2026 | April 30, 2026 | 2026-04-30

  // Number
  decimals?: number;
  thousandSeparator?: string;
  decimalSeparator?: string;

  // List
  listStyle?: "bullet" | "numbered" | "comma"; // - item, 1. item, item, item

  // Percentage
  percentDecimals?: number;
}

// Validation rules for input variables
export interface ValidationRules {
  minLength?: number;
  maxLength?: number;
  pattern?: string; // Regex pattern
  required?: boolean;
}

/**
 * Variable definitions table.
 * Stores both system variables (workspaceId = null) and workspace-specific custom variables.
 */
export const variableDefinitions = pgTable(
  "variable_definitions",
  {
    id: text("id").primaryKey(),

    // null = system variable (available to all workspaces)
    // non-null = workspace custom variable
    workspaceId: text("workspace_id").references(() => organization.id, {
      onDelete: "cascade",
    }),

    // Optional template scope (if only available in specific template)
    templateId: text("template_id"),

    // Variable key - unique within scope (workspace + template)
    // Format: category.name (e.g., client.name, totals.monthly)
    key: text("key").notNull(),

    // Display labels (localized)
    label: text("label").notNull(), // Default label
    labelEn: text("label_en"), // English label
    labelLt: text("label_lt"), // Lithuanian label

    // Description (localized)
    description: text("description"),
    descriptionEn: text("description_en"),
    descriptionLt: text("description_lt"),

    // Categorization
    category: text("category").notNull(),

    // Resolution configuration
    sourceType: text("source_type").notNull().default("entity"),
    sourcePath: text("source_path"), // Path for entity (e.g., "prospect.companyName")
    computation: text("computation"), // Function name for computed values

    // Formatting
    format: text("format").notNull().default("text"),
    formatOptions: jsonb("format_options").$type<FormatOptions>(),
    defaultValue: text("default_value"),

    // Validation (for input variables)
    isRequired: boolean("is_required").notNull().default(false),
    validationRules: jsonb("validation_rules").$type<ValidationRules>(),

    // Display
    icon: text("icon"), // Lucide icon name
    displayOrder: integer("display_order").notNull().default(0),

    // Standard timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_variable_definitions_workspace").on(table.workspaceId),
    index("ix_variable_definitions_category").on(table.category),
    index("ix_variable_definitions_key").on(table.key),
    // Constraint: category must be valid
    check(
      "chk_variable_category",
      sql`category IN ('client', 'provider', 'pricing', 'audit', 'dates', 'custom')`
    ),
    // Constraint: source_type must be valid
    check(
      "chk_variable_source_type",
      sql`source_type IN ('entity', 'computed', 'custom', 'input')`
    ),
    // Constraint: format must be valid
    check(
      "chk_variable_format",
      sql`format IN ('text', 'currency', 'date', 'number', 'percentage', 'list')`
    ),
  ]
);

// Relations
export const variableDefinitionsRelations = relations(
  variableDefinitions,
  ({ one }) => ({
    workspace: one(organization, {
      fields: [variableDefinitions.workspaceId],
      references: [organization.id],
    }),
  })
);

// Type exports
export type VariableDefinitionSelect = typeof variableDefinitions.$inferSelect;
export type VariableDefinitionInsert = typeof variableDefinitions.$inferInsert;

/**
 * System variable seeds - default variables available to all workspaces.
 * These are inserted via migration or seed script.
 */
export const SYSTEM_VARIABLES: Omit<
  VariableDefinitionInsert,
  "id" | "createdAt" | "updatedAt"
>[] = [
  // Client category (Blue)
  {
    workspaceId: null,
    key: "client.name",
    label: "Client Name",
    labelEn: "Client Name",
    labelLt: "Kliento pavadinimas",
    description: "The name of the client or prospect company",
    category: "client",
    sourceType: "entity",
    sourcePath: "prospect.companyName",
    format: "text",
    icon: "Building2",
    displayOrder: 1,
    isRequired: false,
  },
  {
    workspaceId: null,
    key: "client.website",
    label: "Client Website",
    labelEn: "Client Website",
    labelLt: "Kliento svetaine",
    description: "The client's domain/website URL",
    category: "client",
    sourceType: "entity",
    sourcePath: "prospect.domain",
    format: "text",
    icon: "Globe",
    displayOrder: 2,
    isRequired: false,
  },
  {
    workspaceId: null,
    key: "client.contactName",
    label: "Contact Name",
    labelEn: "Contact Name",
    labelLt: "Kontaktinis asmuo",
    description: "Primary contact person's name",
    category: "client",
    sourceType: "entity",
    sourcePath: "prospect.contactName",
    format: "text",
    icon: "User",
    displayOrder: 3,
    isRequired: false,
  },
  {
    workspaceId: null,
    key: "client.contactEmail",
    label: "Contact Email",
    labelEn: "Contact Email",
    labelLt: "Kontaktinis el. pastas",
    description: "Primary contact person's email",
    category: "client",
    sourceType: "entity",
    sourcePath: "prospect.contactEmail",
    format: "text",
    icon: "Mail",
    displayOrder: 4,
    isRequired: false,
  },
  {
    workspaceId: null,
    key: "client.industry",
    label: "Industry",
    labelEn: "Industry",
    labelLt: "Industrija",
    description: "The client's industry or sector",
    category: "client",
    sourceType: "entity",
    sourcePath: "prospect.industry",
    format: "text",
    icon: "Factory",
    displayOrder: 5,
    isRequired: false,
  },

  // Provider category (Green)
  {
    workspaceId: null,
    key: "provider.name",
    label: "Agency Name",
    labelEn: "Agency Name",
    labelLt: "Agenturos pavadinimas",
    description: "Your agency/company name",
    category: "provider",
    sourceType: "entity",
    sourcePath: "workspace.name",
    format: "text",
    icon: "Building",
    displayOrder: 1,
    isRequired: false,
  },
  {
    workspaceId: null,
    key: "provider.email",
    label: "Agency Email",
    labelEn: "Agency Email",
    labelLt: "Agenturos el. pastas",
    description: "Your agency's contact email",
    category: "provider",
    sourceType: "entity",
    sourcePath: "workspace.contactEmail",
    format: "text",
    icon: "Mail",
    displayOrder: 2,
    isRequired: false,
  },
  {
    workspaceId: null,
    key: "provider.phone",
    label: "Agency Phone",
    labelEn: "Agency Phone",
    labelLt: "Agenturos telefonas",
    description: "Your agency's phone number",
    category: "provider",
    sourceType: "entity",
    sourcePath: "workspace.contactPhone",
    format: "text",
    icon: "Phone",
    displayOrder: 3,
    isRequired: false,
  },
  {
    workspaceId: null,
    key: "provider.vatNumber",
    label: "VAT Number",
    labelEn: "VAT Number",
    labelLt: "PVM kodas",
    description: "Your agency's VAT registration number",
    category: "provider",
    sourceType: "entity",
    sourcePath: "workspace.vatNumber",
    format: "text",
    icon: "Receipt",
    displayOrder: 4,
    isRequired: false,
  },
  {
    workspaceId: null,
    key: "provider.address",
    label: "Agency Address",
    labelEn: "Agency Address",
    labelLt: "Agenturos adresas",
    description: "Your agency's physical address",
    category: "provider",
    sourceType: "entity",
    sourcePath: "workspace.address",
    format: "text",
    icon: "MapPin",
    displayOrder: 5,
    isRequired: false,
  },

  // Pricing category (Orange)
  {
    workspaceId: null,
    key: "totals.monthly",
    label: "Monthly Fee",
    labelEn: "Monthly Fee",
    labelLt: "Menesine kaina",
    description: "Monthly recurring fee",
    category: "pricing",
    sourceType: "entity",
    sourcePath: "proposal.monthlyFeeCents",
    format: "currency",
    formatOptions: { currency: "EUR" },
    icon: "Wallet",
    displayOrder: 1,
    isRequired: false,
  },
  {
    workspaceId: null,
    key: "totals.setup",
    label: "Setup Fee",
    labelEn: "Setup Fee",
    labelLt: "Pradzios mokestis",
    description: "One-time setup fee",
    category: "pricing",
    sourceType: "entity",
    sourcePath: "proposal.setupFeeCents",
    format: "currency",
    formatOptions: { currency: "EUR" },
    icon: "Banknote",
    displayOrder: 2,
    isRequired: false,
  },
  {
    workspaceId: null,
    key: "totals.annual",
    label: "Annual Total",
    labelEn: "Annual Total",
    labelLt: "Metine suma",
    description: "Total annual investment (setup + 12 months)",
    category: "pricing",
    sourceType: "computed",
    computation: "calculateAnnualTotal",
    format: "currency",
    formatOptions: { currency: "EUR" },
    icon: "Calculator",
    displayOrder: 3,
    isRequired: false,
  },
  {
    workspaceId: null,
    key: "services.list",
    label: "Services List",
    labelEn: "Services List",
    labelLt: "Paslaugu sarasas",
    description: "List of included services",
    category: "pricing",
    sourceType: "entity",
    sourcePath: "proposal.content.investment.inclusions",
    format: "list",
    formatOptions: { listStyle: "bullet" },
    icon: "List",
    displayOrder: 4,
    isRequired: false,
  },
  {
    workspaceId: null,
    key: "services.count",
    label: "Services Count",
    labelEn: "Services Count",
    labelLt: "Paslaugu skaicius",
    description: "Number of included services",
    category: "pricing",
    sourceType: "computed",
    computation: "countServices",
    format: "number",
    icon: "Hash",
    displayOrder: 5,
    isRequired: false,
  },

  // Audit category (Purple)
  {
    workspaceId: null,
    key: "audit.score",
    label: "SEO Score",
    labelEn: "SEO Score",
    labelLt: "SEO balas",
    description: "Overall SEO audit score (0-100)",
    category: "audit",
    sourceType: "entity",
    sourcePath: "audit.score",
    format: "number",
    icon: "Target",
    displayOrder: 1,
    isRequired: false,
  },
  {
    workspaceId: null,
    key: "audit.issues",
    label: "Issues Count",
    labelEn: "Issues Count",
    labelLt: "Problemu skaicius",
    description: "Number of SEO issues found",
    category: "audit",
    sourceType: "entity",
    sourcePath: "audit.issuesCount",
    format: "number",
    icon: "AlertTriangle",
    displayOrder: 2,
    isRequired: false,
  },
  {
    workspaceId: null,
    key: "audit.traffic",
    label: "Current Traffic",
    labelEn: "Current Traffic",
    labelLt: "Dabartinis srautas",
    description: "Current monthly organic traffic",
    category: "audit",
    sourceType: "entity",
    sourcePath: "analysis.domainMetrics.organicTraffic",
    format: "number",
    icon: "TrendingUp",
    displayOrder: 3,
    isRequired: false,
  },
  {
    workspaceId: null,
    key: "audit.keywords",
    label: "Keywords Count",
    labelEn: "Keywords Count",
    labelLt: "Raktazodziuskaicius",
    description: "Number of ranking keywords",
    category: "audit",
    sourceType: "entity",
    sourcePath: "analysis.domainMetrics.organicKeywords",
    format: "number",
    icon: "Key",
    displayOrder: 4,
    isRequired: false,
  },
  {
    workspaceId: null,
    key: "audit.opportunities",
    label: "Opportunities",
    labelEn: "Opportunities",
    labelLt: "Galimybes",
    description: "Number of keyword opportunities found",
    category: "audit",
    sourceType: "computed",
    computation: "countOpportunities",
    format: "number",
    icon: "Lightbulb",
    displayOrder: 5,
    isRequired: false,
  },

  // Dates category (Gray)
  {
    workspaceId: null,
    key: "today",
    label: "Today's Date",
    labelEn: "Today's Date",
    labelLt: "Siandien",
    description: "Current date",
    category: "dates",
    sourceType: "computed",
    computation: "getCurrentDate",
    format: "date",
    formatOptions: { dateFormat: "long" },
    icon: "Calendar",
    displayOrder: 1,
    isRequired: false,
  },
  {
    workspaceId: null,
    key: "proposal.createdAt",
    label: "Proposal Date",
    labelEn: "Proposal Date",
    labelLt: "Pasiulymo data",
    description: "Date the proposal was created",
    category: "dates",
    sourceType: "entity",
    sourcePath: "proposal.createdAt",
    format: "date",
    formatOptions: { dateFormat: "long" },
    icon: "FileText",
    displayOrder: 2,
    isRequired: false,
  },
  {
    workspaceId: null,
    key: "proposal.validUntil",
    label: "Valid Until",
    labelEn: "Valid Until",
    labelLt: "Galioja iki",
    description: "Proposal expiration date",
    category: "dates",
    sourceType: "entity",
    sourcePath: "proposal.expiresAt",
    format: "date",
    formatOptions: { dateFormat: "long" },
    icon: "Clock",
    displayOrder: 3,
    isRequired: false,
  },
  {
    workspaceId: null,
    key: "dates.startDate",
    label: "Project Start",
    labelEn: "Project Start",
    labelLt: "Projekto pradzia",
    description: "Estimated project start date",
    category: "dates",
    sourceType: "computed",
    computation: "calculateStartDate",
    format: "date",
    formatOptions: { dateFormat: "long" },
    icon: "Play",
    displayOrder: 4,
    isRequired: false,
  },
  {
    workspaceId: null,
    key: "dates.year",
    label: "Current Year",
    labelEn: "Current Year",
    labelLt: "Einamieji metai",
    description: "Current year (e.g., 2026)",
    category: "dates",
    sourceType: "computed",
    computation: "getCurrentYear",
    format: "text",
    icon: "Calendar",
    displayOrder: 5,
    isRequired: false,
  },

  // Custom category (Teal) - these are examples, real ones are workspace-specific
  {
    workspaceId: null,
    key: "custom.projectCode",
    label: "Project Code",
    labelEn: "Project Code",
    labelLt: "Projekto kodas",
    description: "Custom project reference code",
    category: "custom",
    sourceType: "input",
    format: "text",
    icon: "Hash",
    displayOrder: 1,
    isRequired: false,
    validationRules: { maxLength: 20 },
  },
  {
    workspaceId: null,
    key: "custom.specialOffer",
    label: "Special Offer",
    labelEn: "Special Offer",
    labelLt: "Speciali akcija",
    description: "Custom promotional text",
    category: "custom",
    sourceType: "input",
    format: "text",
    icon: "Gift",
    displayOrder: 2,
    isRequired: false,
  },
];
