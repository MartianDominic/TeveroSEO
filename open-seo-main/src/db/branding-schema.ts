/**
 * Drizzle ORM schema for client branding configuration.
 *
 * Phase 16 Plan 03: White-label branding for reports.
 * Phase 96: CSV white-label support (csv_header_template, csv_column_labels).
 *
 * Stores logo URL, primary/secondary colors, footer text, and CSV export
 * configuration per client.
 */
import {
  pgTable,
  uuid,
  text,
  timestamp,
  uniqueIndex,
  jsonb,
} from "drizzle-orm/pg-core";
import { clients } from "./client-schema";

/**
 * CSV column label overrides.
 * Keys are internal column identifiers, values are display labels.
 */
export interface CsvColumnLabels {
  keyword?: string;
  position?: string;
  impressions?: string;
  clicks?: string;
  ctr?: string;
  url?: string;
  pageUrl?: string;
  date?: string;
  change?: string;
  trend?: string;
  severity?: string;
  coverage?: string;
  [key: string]: string | undefined;
}

/**
 * Default CSV column labels.
 */
export const DEFAULT_CSV_COLUMN_LABELS: CsvColumnLabels = {
  keyword: "Keyword",
  position: "Position",
  impressions: "Impressions",
  clicks: "Clicks",
  ctr: "CTR",
  url: "Landing Page",
  pageUrl: "Page URL",
  date: "Date",
  change: "Change",
  trend: "Trend",
  severity: "Severity",
  coverage: "Coverage",
};

/**
 * Client branding configuration for white-label reports.
 * One record per client. Falls back to Tevero defaults when not set.
 */
export const clientBranding = pgTable(
  "client_branding",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    // Logo stored at /data/branding/{clientId}/logo.{ext}
    // This stores the relative path or full URL
    logoUrl: text("logo_url"),
    // Colors as hex values (e.g., "#1a73e8")
    primaryColor: text("primary_color").notNull().default("#3b82f6"), // Tevero blue
    secondaryColor: text("secondary_color").notNull().default("#10b981"), // Tevero green
    // Optional custom footer HTML
    footerText: text("footer_text"),
    // Phase 96: CSV white-label configuration
    // Template for CSV header line. Supports placeholders: {brand_name}, {report_type}
    // Example: "# {brand_name} {report_type} Report"
    csvHeaderTemplate: text("csv_header_template"),
    // Custom column labels for CSV exports (JSON object)
    // If null, uses DEFAULT_CSV_COLUMN_LABELS
    csvColumnLabels: jsonb("csv_column_labels").$type<CsvColumnLabels>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_branding_client_id").on(table.clientId),
  ],
);

// Type exports for use in queries
export type ClientBrandingSelect = typeof clientBranding.$inferSelect;
export type ClientBrandingInsert = typeof clientBranding.$inferInsert;
