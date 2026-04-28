/**
 * Schema for prospect scrape configurations.
 * Phase 43: Prospect Keyword Pipeline - AI Selector Discovery
 *
 * Stores custom scraping configuration per prospect including:
 * - Platform detection (Shopify, WooCommerce, etc.)
 * - Extraction rules for product/category/brand pages
 * - AI-discovered CSS selectors with confidence scores
 * - Crawl settings (max pages, depth, rate limits)
 */
import {
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { prospects } from "./prospect-schema";

// Platform types
export const DETECTED_PLATFORMS = [
  "shopify",
  "woocommerce",
  "magento",
  "prestashop",
  "opencart",
  "custom",
] as const;
export type DetectedPlatform = (typeof DETECTED_PLATFORMS)[number];

// Site types
export const SITE_TYPES = [
  "ecommerce",
  "service",
  "blog",
  "corporate",
  "portfolio",
] as const;
export type SiteType = (typeof SITE_TYPES)[number];

// Extraction rule field definition
export interface ExtractionField {
  name: string;
  selectors: string[]; // Primary + fallbacks
  type: "text" | "attribute" | "html";
  attribute?: string; // For attribute type (e.g., "href", "src")
  transform?: "trim" | "lowercase" | "number" | "price"; // Post-processing
}

// Full extraction rule
export interface ExtractionRule {
  id: string;
  name: string;
  urlPattern: string; // Glob pattern (e.g., "/products/*")
  pageType: "product" | "category" | "brand" | "other";
  fields: ExtractionField[];
  enabled: boolean;
}

// AI-discovered selector
export interface AiSelector {
  field: string;
  selector: string;
  fallback: string | null;
  confidence: number;
  sampleValue: string;
  discoveredAt: string;
}

/**
 * ProspectScrapeConfigs table - stores custom scraping configuration per prospect.
 */
export const prospectScrapeConfigs = pgTable(
  "prospect_scrape_configs",
  {
    id: text("id").primaryKey(),
    prospectId: text("prospect_id")
      .notNull()
      .references(() => prospects.id, { onDelete: "cascade" }),

    // Site detection
    detectedPlatform: text("detected_platform"), // DetectedPlatform
    detectedSiteType: text("detected_site_type"), // SiteType
    platformVersion: text("platform_version"),

    // Extraction rules (user-defined or AI-generated)
    extractionRules: jsonb("extraction_rules").$type<ExtractionRule[]>(),

    // AI-discovered selectors (before user confirmation)
    aiSelectors: jsonb("ai_selectors").$type<AiSelector[]>(),

    // Crawl settings
    maxPages: integer("max_pages").default(500),
    maxDepth: integer("max_depth").default(3),
    rateLimit: integer("rate_limit").default(2), // Requests per second
    includePatterns: jsonb("include_patterns").$type<string[]>(),
    excludePatterns: jsonb("exclude_patterns").$type<string[]>(),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("ix_prospect_scrape_configs_prospect").on(table.prospectId),
  ],
);

// Relations
export const prospectScrapeConfigsRelations = relations(
  prospectScrapeConfigs,
  ({ one }) => ({
    prospect: one(prospects, {
      fields: [prospectScrapeConfigs.prospectId],
      references: [prospects.id],
    }),
  }),
);

// Inferred types
export type ProspectScrapeConfigSelect =
  typeof prospectScrapeConfigs.$inferSelect;
export type ProspectScrapeConfigInsert =
  typeof prospectScrapeConfigs.$inferInsert;
