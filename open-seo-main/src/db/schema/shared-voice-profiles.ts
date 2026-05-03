/**
 * Unified shared_voice_profiles schema for database consolidation.
 * Phase 67-01: Schema Design (Database Consolidation)
 *
 * This schema merges columns from:
 *   - open-seo-main voice_profiles table (voice-schema.ts)
 *   - AI-Writer writing_personas table (persona_models.py)
 *
 * Namespace: shared_*
 * ORM Owner: Drizzle
 *
 * Requirements:
 *   - CRITICAL-DB-002: Single source of truth for voice/persona data
 *   - MED-DB-006: TIMESTAMPTZ for all timestamp columns
 */
import {
  pgTable,
  text,
  uuid,
  integer,
  jsonb,
  timestamp,
  index,
  boolean,
  real,
  pgEnum,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { sharedClients } from "./shared-clients";
import { organization } from "../user-schema";

// Voice status enum (draft -> active -> archived)
export const voiceStatusEnum = pgEnum("shared_voice_status", [
  "draft",
  "active",
  "archived",
]);

// Primary tone enum (11 values from design doc)
export const primaryToneEnum = pgEnum("shared_primary_tone", [
  "professional",
  "casual",
  "friendly",
  "authoritative",
  "playful",
  "inspirational",
  "empathetic",
  "urgent",
  "conversational",
  "academic",
  "innovative",
]);

// Voice modes
export const VOICE_MODES = [
  "preservation",
  "application",
  "best_practices",
] as const;
export type VoiceMode = (typeof VOICE_MODES)[number];

// JSONB type for vocabulary patterns
export interface VocabularyPatterns {
  preferred: string[];
  avoided: string[];
}

// JSONB type for raw AI analysis response
export interface RawVoiceAnalysis {
  model: string;
  prompt: string;
  response: string;
  tokens_used: number;
  analyzed_at: string;
}

// JSONB type for linguistic fingerprint (from AI-Writer)
export interface LinguisticFingerprint {
  sentenceStructure?: {
    avgLength?: number;
    complexity?: string;
  };
  vocabulary?: {
    formalityLevel?: number;
    jargonUsage?: string;
  };
  rhetoricalDevices?: string[];
  tonalPatterns?: string[];
}

// JSONB type for platform adaptations (from AI-Writer)
export interface PlatformAdaptation {
  platformType: string;
  sentenceMetrics?: Record<string, unknown>;
  lexicalFeatures?: Record<string, unknown>;
  rhetoricalDevices?: Record<string, unknown>;
  tonalRange?: Record<string, unknown>;
  stylisticConstraints?: Record<string, unknown>;
}

/**
 * Unified shared_voice_profiles table.
 *
 * Merges:
 *   - open-seo-main: voice_profiles (40+ voice dimensions, SEO integration)
 *   - AI-Writer: writing_personas (linguistic fingerprint, platform adaptations)
 *
 * Features:
 *   - client_id (FK to sharedClients, nullable) - for client-level profiles
 *   - user_id (FK to organization, nullable) - for user-level profiles
 *   - CHECK constraint: at least one of client_id or user_id must be set
 *
 * All timestamps use TIMESTAMPTZ (MED-DB-006).
 */
export const sharedVoiceProfiles = pgTable(
  "shared_voice_profiles",
  {
    // Primary key - text for compatibility with existing systems using nanoid
    id: text("id").primaryKey(),

    // === Ownership (one or both must be set) ===
    clientId: uuid("client_id").references(() => sharedClients.id, {
      onDelete: "set null",
    }),
    userId: text("user_id").references(() => organization.id, {
      onDelete: "set null",
    }),

    // === Profile Basics ===
    voiceName: text("voice_name"),
    personaName: text("persona_name"), // AI-Writer naming
    voiceStatus: voiceStatusEnum("voice_status").notNull().default("draft"),
    mode: text("mode").notNull().default("best_practices"),
    industryTemplate: text("industry_template"),

    // === Core Identity (from AI-Writer) ===
    archetype: text("archetype"), // e.g., "The Pragmatic Futurist"
    coreBelief: text("core_belief"), // Central philosophy
    brandVoiceDescription: text("brand_voice_description"),

    // === Tone & Personality ===
    primaryTone: primaryToneEnum("primary_tone")
      .notNull()
      .default("professional"),
    tonePrimary: text("tone_primary"), // Backward compatibility
    toneSecondary: text("tone_secondary"),
    secondaryTones: jsonb("secondary_tones").$type<string[]>().default([]),
    formalityLevel: integer("formality_level").default(6),
    personalityTraits: jsonb("personality_traits").$type<string[]>().default([]),
    emotionalRange: text("emotional_range").default("moderate"),

    // === Language Constraints ===
    requiredPhrases: jsonb("required_phrases").$type<string[]>().default([]),
    forbiddenPhrases: jsonb("forbidden_phrases").$type<string[]>().default([]),
    jargonLevel: text("jargon_level").default("moderate"),
    industryTerms: jsonb("industry_terms").$type<string[]>().default([]),
    acronymPolicy: text("acronym_policy").default("first_use"),
    contractionUsage: text("contraction_usage").default("sometimes"),

    // === Writing Mechanics ===
    sentenceLengthAvg: integer("sentence_length_avg"),
    paragraphLengthAvg: integer("paragraph_length_avg"),
    sentenceLengthTarget: text("sentence_length_target").default("varied"),
    paragraphLengthTarget: text("paragraph_length_target").default("short"),
    listPreference: text("list_preference").default("mixed"),
    headingStyle: text("heading_style").default("action"),
    ctaTemplate: text("cta_template"),

    // === Vocabulary patterns ===
    vocabularyPatterns: jsonb("vocabulary_patterns").$type<VocabularyPatterns>(),
    signaturePhrases: jsonb("signature_phrases").$type<string[]>().default([]),

    // === SEO Integration (from open-seo-main) ===
    keywordDensityTolerance: integer("keyword_density_tolerance").default(3),
    keywordPlacementRules: jsonb("keyword_placement_rules")
      .$type<string[]>()
      .default(["title", "h1", "first_paragraph", "throughout"]),
    seoVsVoicePriority: integer("seo_vs_voice_priority").default(6),
    protectedSections: jsonb("protected_sections").$type<string[]>().default([]),

    // === Voice Blending ===
    voiceBlendEnabled: boolean("voice_blend_enabled").default(false),
    voiceBlendWeight: real("voice_blend_weight").default(0.5),
    voiceTemplateId: text("voice_template_id"),
    customInstructions: text("custom_instructions"),

    // === Linguistic Fingerprint (from AI-Writer) ===
    linguisticFingerprint: jsonb(
      "linguistic_fingerprint"
    ).$type<LinguisticFingerprint>(),

    // === Platform Adaptations (from AI-Writer) ===
    platformAdaptations: jsonb("platform_adaptations").$type<
      PlatformAdaptation[]
    >(),

    // === AI Analysis metadata ===
    aiAnalysisVersion: text("ai_analysis_version"),
    confidenceScore: integer("confidence_score"),
    lastModifiedBy: text("last_modified_by"),
    analyzedAt: timestamp("analyzed_at", { withTimezone: true, mode: "date" }),

    // === Source data tracking (from AI-Writer) ===
    onboardingSessionId: integer("onboarding_session_id"),
    sourceWebsiteAnalysis: jsonb("source_website_analysis").$type<
      Record<string, unknown>
    >(),
    sourceResearchPreferences: jsonb("source_research_preferences").$type<
      Record<string, unknown>
    >(),

    // === Standard timestamps - TIMESTAMPTZ (MED-DB-006) ===
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),

    // === Soft delete / Archive ===
    isArchived: boolean("is_archived").notNull().default(false),
    archivedAt: timestamp("archived_at", { withTimezone: true, mode: "date" }),
    isActive: boolean("is_active").notNull().default(true), // AI-Writer compatibility
  },
  (table) => [
    // Indexes
    index("ix_shared_voice_profiles_client").on(table.clientId),
    index("ix_shared_voice_profiles_user").on(table.userId),
    index("ix_shared_voice_profiles_archived").on(table.isArchived),
    index("ix_shared_voice_profiles_active").on(table.isActive),

    // Check constraints
    // At least one of client_id or user_id must be set
    check(
      "chk_shared_voice_profile_ownership",
      sql`client_id IS NOT NULL OR user_id IS NOT NULL`
    ),
    // Voice blend weight must be 0.0-1.0
    check(
      "chk_shared_voice_blend_weight_range",
      sql`voice_blend_weight IS NULL OR (voice_blend_weight >= 0 AND voice_blend_weight <= 1)`
    ),
    // Formality level 1-10
    check(
      "chk_shared_formality_level_range",
      sql`formality_level IS NULL OR (formality_level >= 1 AND formality_level <= 10)`
    ),
    // Keyword density tolerance 1-20 percent
    check(
      "chk_shared_keyword_density_range",
      sql`keyword_density_tolerance IS NULL OR (keyword_density_tolerance >= 1 AND keyword_density_tolerance <= 20)`
    ),
    // SEO vs voice priority 1-10
    check(
      "chk_shared_seo_voice_priority_range",
      sql`seo_vs_voice_priority IS NULL OR (seo_vs_voice_priority >= 1 AND seo_vs_voice_priority <= 10)`
    ),
  ]
);

// Relations
export const sharedVoiceProfilesRelations = relations(
  sharedVoiceProfiles,
  ({ one }) => ({
    client: one(sharedClients, {
      fields: [sharedVoiceProfiles.clientId],
      references: [sharedClients.id],
    }),
    user: one(organization, {
      fields: [sharedVoiceProfiles.userId],
      references: [organization.id],
    }),
  })
);

// Inferred types for database operations
export type SharedVoiceProfileSelect = typeof sharedVoiceProfiles.$inferSelect;
export type SharedVoiceProfileInsert = typeof sharedVoiceProfiles.$inferInsert;
