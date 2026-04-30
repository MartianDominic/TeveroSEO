/**
 * Translation Cache Schema
 * Phase 55: Full Platform Internationalization (i18n)
 *
 * Drizzle ORM schema for caching translations from Gemini API.
 * Provides aggressive caching to reduce API costs and ensure consistency.
 *
 * Features:
 * - Unique constraint on (sourceHash, targetLang, contextType, formality)
 * - Quality scoring for review prioritization
 * - Usage tracking for cache optimization
 * - Workspace-specific translation overrides
 */

import {
  pgTable,
  text,
  timestamp,
  index,
  uniqueIndex,
  integer,
  real,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organization } from "./user-schema";

/**
 * Translation cache table.
 *
 * Stores translations from Gemini API with quality metadata.
 * Cache key is composite: (sourceHash, targetLang, contextType, formality)
 */
export const translationCache = pgTable(
  "translation_cache",
  {
    /** Unique identifier (UUID or nanoid) */
    id: text("id").primaryKey(),

    /** SHA256 hash of source text for lookup */
    sourceHash: text("source_hash").notNull(),

    /** Original source text */
    sourceText: text("source_text").notNull(),

    /** Source language code (e.g., 'en') */
    sourceLang: text("source_lang").notNull().default("en"),

    /** Target language code (e.g., 'lt') */
    targetLang: text("target_lang").notNull(),

    /** Translated text result */
    translatedText: text("translated_text").notNull(),

    /** Content context type (ui, proposal, agreement, email, report) */
    contextType: text("context_type").notNull(),

    /** Formality level (formal, informal) */
    formality: text("formality").notNull().default("formal"),

    /** Translator identifier (e.g., 'gemini-1.5-pro', 'human') */
    translator: text("translator").notNull(),

    /** Model version for cache invalidation on model updates */
    modelVersion: text("model_version"),

    /** Quality score (0-1) for review prioritization */
    qualityScore: real("quality_score"),

    /** User ID of human reviewer (if reviewed) */
    reviewedBy: text("reviewed_by"),

    /** Timestamp of human review */
    reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "date" }),

    /** Creation timestamp */
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),

    /** Last update timestamp */
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),

    /** Last access timestamp for cache optimization */
    lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),

    /** Usage count for popularity tracking */
    useCount: integer("use_count").notNull().default(1),
  },
  (table) => [
    // Unique constraint for cache deduplication
    uniqueIndex("ix_translation_cache_unique").on(
      table.sourceHash,
      table.targetLang,
      table.contextType,
      table.formality
    ),
    // Fast lookup index
    index("ix_translation_cache_lookup").on(
      table.sourceHash,
      table.targetLang,
      table.contextType
    ),
    // Review queue: unreviewed translations sorted by quality score
    index("ix_translation_cache_review_queue").on(table.qualityScore),
    // Target language filter
    index("ix_translation_cache_target_lang").on(table.targetLang),
    // Last used for cache eviction
    index("ix_translation_cache_last_used").on(table.lastUsedAt),
  ]
);

/**
 * Workspace-specific translation overrides.
 *
 * Agencies can override specific translations for their branding.
 * Overrides take precedence over cached Gemini translations.
 */
export const workspaceTranslationOverrides = pgTable(
  "workspace_translation_overrides",
  {
    /** Unique identifier */
    id: text("id").primaryKey(),

    /** Workspace/organization ID */
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),

    /** Message key (e.g., 'proposals.hero.title', 'nav.dashboard') */
    messageKey: text("message_key").notNull(),

    /** Target language code */
    language: text("language").notNull(),

    /** Custom translated value */
    customValue: text("custom_value").notNull(),

    /** User ID who created the override */
    createdBy: text("created_by"),

    /** Creation timestamp */
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Unique constraint: one override per workspace+key+language
    uniqueIndex("ix_workspace_translation_unique").on(
      table.workspaceId,
      table.messageKey,
      table.language
    ),
    // Lookup by workspace
    index("ix_workspace_translation_workspace").on(table.workspaceId),
    // Lookup by message key (for bulk export)
    index("ix_workspace_translation_key").on(table.messageKey),
  ]
);

/**
 * Relations for workspace translation overrides.
 */
export const workspaceTranslationOverridesRelations = relations(
  workspaceTranslationOverrides,
  ({ one }) => ({
    organization: one(organization, {
      fields: [workspaceTranslationOverrides.workspaceId],
      references: [organization.id],
    }),
  })
);

/**
 * Inferred types for database operations.
 */
export type TranslationCacheSelect = typeof translationCache.$inferSelect;
export type TranslationCacheInsert = typeof translationCache.$inferInsert;
export type WorkspaceTranslationOverrideSelect =
  typeof workspaceTranslationOverrides.$inferSelect;
export type WorkspaceTranslationOverrideInsert =
  typeof workspaceTranslationOverrides.$inferInsert;
