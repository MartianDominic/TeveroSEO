/**
 * Analytics Tags Schema
 * Phase 96-02: Master Dashboard tag-based filtering
 *
 * Site tags enable grouping by project, region, or custom categories.
 * Client tags enable agency-level organization across multiple clients.
 */
import { pgTable, uuid, text, timestamp, unique, index } from "drizzle-orm/pg-core";
import { siteConnections } from "./connection-schema";
import { clients } from "./client-schema";

export const siteTags = pgTable(
  "site_tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: text("site_id").notNull().references(() => siteConnections.id, { onDelete: "cascade" }),
    tagName: text("tag_name").notNull(),
    tagColor: text("tag_color"), // Hex color for UI badge (e.g., "#1B6E45")
    tagCategory: text("tag_category"), // Optional: "project", "region", "custom"
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    softDeletedAt: timestamp("soft_deleted_at", { withTimezone: true }),
  },
  (table) => [
    unique("uq_site_tags_site_name").on(table.siteId, table.tagName),
    index("idx_site_tags_site_id").on(table.siteId), // DBS-002: Fast lookup by site
    index("idx_site_tags_name").on(table.tagName),
    index("idx_site_tags_category").on(table.tagCategory),
    index("idx_site_tags_soft_deleted").on(table.softDeletedAt),
  ]
);

export const clientTags = pgTable(
  "client_tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    tagName: text("tag_name").notNull(),
    tagColor: text("tag_color"),
    tagCategory: text("tag_category"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    softDeletedAt: timestamp("soft_deleted_at", { withTimezone: true }),
  },
  (table) => [
    unique("uq_client_tags_client_name").on(table.clientId, table.tagName),
    index("idx_client_tags_client_id").on(table.clientId), // DBS-003: Fast lookup by client
    index("idx_client_tags_name").on(table.tagName),
    index("idx_client_tags_soft_deleted").on(table.softDeletedAt),
  ]
);

export type SiteTag = typeof siteTags.$inferSelect;
export type SiteTagInsert = typeof siteTags.$inferInsert;
export type ClientTag = typeof clientTags.$inferSelect;
export type ClientTagInsert = typeof clientTags.$inferInsert;
