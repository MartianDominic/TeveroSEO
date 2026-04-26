/**
 * Crawl Schema
 *
 * Page snapshot schema for delta sync change detection.
 * Stores hashes for change detection without full content.
 */

import { pgTable, text, timestamp, bigint, index } from "drizzle-orm/pg-core";

/**
 * Page snapshot for delta sync.
 * Stores hashes for change detection without full content.
 */
export const pageSnapshots = pgTable(
  "page_snapshots",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    tenantId: text("tenant_id").notNull(),
    url: text("url").notNull(),
    urlHash: text("url_hash").notNull(), // SHA256[:16] of normalized URL
    seoContentHash: text("seo_content_hash").notNull(), // name + description + categories
    inventoryHash: text("inventory_hash"), // price + stock (optional)
    etag: text("etag"), // HTTP ETag for conditional GET
    lastModified: timestamp("last_modified", { withTimezone: true }),
    lastCrawled: timestamp("last_crawled", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("page_snapshots_tenant_url_idx").on(table.tenantId, table.urlHash),
    index("page_snapshots_last_crawled_idx").on(
      table.tenantId,
      table.lastCrawled
    ),
  ]
);

export type PageSnapshot = typeof pageSnapshots.$inferSelect;
export type NewPageSnapshot = typeof pageSnapshots.$inferInsert;
