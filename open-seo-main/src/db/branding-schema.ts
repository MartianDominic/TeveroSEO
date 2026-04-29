/**
 * Drizzle ORM schema for client branding configuration.
 *
 * Phase 16 Plan 03: White-label branding for reports.
 * Stores logo URL, primary/secondary colors, and footer text per client.
 */
import {
  pgTable,
  uuid,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { clients } from "./client-schema";

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
