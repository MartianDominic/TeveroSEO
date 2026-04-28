/**
 * Schema for brand voice management.
 * Phase 37: Brand Voice Management
 *
 * Three modes:
 * - preservation: Protect brand text from SEO changes
 * - application: Write in client's learned voice
 * - best_practices: Use industry defaults
 */
import {
  pgTable,
  text,
  integer,
  jsonb,
  timestamp,
  index,
  boolean,
  real,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { clients } from "./client-schema";
import { VOICE_MODES, type VoiceMode } from "./brief-schema";

// Re-export for convenience
export { VOICE_MODES, type VoiceMode };

// Voice status enum (draft → active → archived)
export const voiceStatusEnum = pgEnum("voice_status", ["draft", "active", "archived"]);

// Primary tone enum (11 values from design doc)
export const primaryToneEnum = pgEnum("primary_tone", [
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

// Protection level enum
export const protectionLevelEnum = pgEnum("protection_level", ["full", "partial", "none"]);

// Brand archetype options
export const ARCHETYPES = [
  "professional",
  "casual",
  "technical",
  "friendly",
  "authoritative",
] as const;
export type Archetype = (typeof ARCHETYPES)[number];

// Contraction usage frequency
export const CONTRACTION_USAGE = [
  "never",
  "sometimes",
  "frequently",
] as const;
export type ContractionUsage = (typeof CONTRACTION_USAGE)[number];

// Heading capitalization style
export const HEADING_STYLES = [
  "title_case",
  "sentence_case",
  "all_caps",
] as const;
export type HeadingStyle = (typeof HEADING_STYLES)[number];

// Protection rule types
export const PROTECTION_RULE_TYPES = [
  "page",
  "section",
  "pattern",
] as const;
export type ProtectionRuleType = (typeof PROTECTION_RULE_TYPES)[number];

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

// JSONB type for voice audit issues
export interface VoiceAuditIssue {
  type: string;
  severity: "critical" | "warning" | "info";
  location: string;
  expected: string;
  actual: string;
  suggestion: string;
}

// JSONB type for voice profile configuration (used in templates)
export interface VoiceProfileConfig {
  tonePrimary?: string;
  toneSecondary?: string;
  formalityLevel?: number;
  personalityTraits?: string[];
  archetype?: string;
  emotionalRange?: string;
  requiredPhrases?: string[];
  forbiddenPhrases?: string[];
  jargonLevel?: string;
  industryTerms?: string[];
  acronymPolicy?: string;
  contractionUsage?: string;
  sentenceLengthTarget?: string;
  paragraphLengthTarget?: string;
  listPreference?: string;
  headingStyle?: string;
  ctaTemplate?: string;
  keywordDensityTolerance?: number;
  keywordPlacementRules?: string[];
  seoVsVoicePriority?: number;
  protectedSections?: string[];
}

/**
 * Voice profiles table - stores the 40+ voice dimensions per client.
 * One profile per client (can be extended for multi-brand clients later).
 */
export const voiceProfiles = pgTable(
  "voice_profiles",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),

    // Profile Basics
    voiceName: text("voice_name"),
    voiceStatus: voiceStatusEnum("voice_status").notNull().default("draft"),
    mode: text("mode").notNull().default("best_practices"),
    industryTemplate: text("industry_template"),

    // Tone & Personality
    primaryTone: primaryToneEnum("primary_tone").notNull().default("professional"),
    tonePrimary: text("tone_primary"), // Keep for backward compatibility
    toneSecondary: text("tone_secondary"),
    secondaryTones: jsonb("secondary_tones").$type<string[]>().default([]),
    formalityLevel: integer("formality_level").default(6),
    personalityTraits: jsonb("personality_traits").$type<string[]>().default([]),
    archetype: text("archetype"),
    emotionalRange: text("emotional_range").default("moderate"),

    // Language Constraints
    requiredPhrases: jsonb("required_phrases").$type<string[]>().default([]),
    forbiddenPhrases: jsonb("forbidden_phrases").$type<string[]>().default([]),
    jargonLevel: text("jargon_level").default("moderate"),
    industryTerms: jsonb("industry_terms").$type<string[]>().default([]),
    acronymPolicy: text("acronym_policy").default("first_use"),
    contractionUsage: text("contraction_usage").default("sometimes"),

    // Writing Mechanics
    sentenceLengthAvg: integer("sentence_length_avg"), // Keep for learned data
    paragraphLengthAvg: integer("paragraph_length_avg"), // Keep for learned data
    sentenceLengthTarget: text("sentence_length_target").default("varied"),
    paragraphLengthTarget: text("paragraph_length_target").default("short"),
    listPreference: text("list_preference").default("mixed"),
    headingStyle: text("heading_style").default("action"),
    ctaTemplate: text("cta_template"),

    // Vocabulary patterns (keep for backward compatibility)
    vocabularyPatterns: jsonb("vocabulary_patterns").$type<VocabularyPatterns>(),
    signaturePhrases: jsonb("signature_phrases").$type<string[]>().default([]),

    // SEO Integration
    keywordDensityTolerance: integer("keyword_density_tolerance").default(3),
    keywordPlacementRules: jsonb("keyword_placement_rules").$type<string[]>()
      .default(["title", "h1", "first_paragraph", "throughout"]),
    seoVsVoicePriority: integer("seo_vs_voice_priority").default(6),
    protectedSections: jsonb("protected_sections").$type<string[]>().default([]),

    // Voice Blending
    voiceBlendEnabled: boolean("voice_blend_enabled").default(false),
    voiceBlendWeight: real("voice_blend_weight").default(0.5),
    voiceTemplateId: text("voice_template_id"),
    customInstructions: text("custom_instructions"),

    // Metadata
    confidenceScore: integer("confidence_score"),
    lastModifiedBy: text("last_modified_by"),
    analyzedAt: timestamp("analyzed_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_voice_profiles_client").on(table.clientId),
  ],
);

/**
 * Voice analysis table - stores per-page analysis results.
 * Multiple analyses per profile (one per scraped page).
 */
export const voiceAnalysis = pgTable(
  "voice_analysis",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => voiceProfiles.id, { onDelete: "cascade" }),

    // Page analyzed
    url: text("url").notNull(),

    // Full AI response for debugging/audit
    rawAnalysis: jsonb("raw_analysis").$type<RawVoiceAnalysis>(),

    // Extracted voice attributes from this page
    extractedTone: text("extracted_tone"),
    extractedFormality: integer("extracted_formality"),
    sampleSentences: jsonb("sample_sentences").$type<string[]>(),

    // Timestamp
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_voice_analysis_profile").on(table.profileId),
    index("ix_voice_analysis_url").on(table.url),
  ],
);

/**
 * Content protection rules - pages/sections/patterns to preserve.
 * Used in preservation mode to exclude content from SEO changes.
 */
export const contentProtectionRules = pgTable(
  "content_protection_rules",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => voiceProfiles.id, { onDelete: "cascade" }),

    // Rule type determines how target is interpreted
    ruleType: text("rule_type").notNull(),

    // Target: URL path (page), CSS selector (section), or regex (pattern)
    target: text("target").notNull(),

    // Optional expiration for temporary rules
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),

    // Documentation
    reason: text("reason"),
    createdBy: text("created_by").notNull(),

    // Timestamp
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_protection_rules_profile").on(table.profileId),
    index("ix_protection_rules_type").on(table.ruleType),
  ],
);

/**
 * Voice templates table - industry and custom templates.
 * System templates (isSystem=true) are pre-populated, custom templates are agency-created.
 */
export const voiceTemplates = pgTable(
  "voice_templates",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    industry: text("industry"),
    isSystem: boolean("is_system").notNull().default(false),
    templateConfig: jsonb("template_config").$type<Partial<VoiceProfileConfig>>().notNull(),
    usageCount: integer("usage_count").default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    createdBy: text("created_by"),
  },
  (table) => [
    index("idx_voice_templates_industry").on(table.industry),
  ],
);

/**
 * Voice audit log - tracks compliance scores for every content generation.
 * Used to monitor voice consistency over time and identify drift.
 */
export const voiceAuditLog = pgTable(
  "voice_audit_log",
  {
    id: text("id").primaryKey(),
    voiceProfileId: text("voice_profile_id")
      .notNull()
      .references(() => voiceProfiles.id, { onDelete: "cascade" }),

    // Content being audited
    contentId: text("content_id"),
    contentType: text("content_type"),
    contentUrl: text("content_url"),

    // Compliance scores (0.0-1.0)
    voiceConsistencyScore: real("voice_consistency_score"),
    toneConsistencyScore: real("tone_consistency_score"),
    vocabularyAlignmentScore: real("vocabulary_alignment_score"),
    structureComplianceScore: real("structure_compliance_score"),

    // Issues found
    issues: jsonb("issues").$type<VoiceAuditIssue[]>().default([]),

    // Timestamp
    auditedAt: timestamp("audited_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_voice_audit_profile").on(table.voiceProfileId),
    index("idx_voice_audit_content").on(table.contentId),
  ],
);

// Relations
export const voiceProfilesRelations = relations(voiceProfiles, ({ one, many }) => ({
  client: one(clients, {
    fields: [voiceProfiles.clientId],
    references: [clients.id],
  }),
  analyses: many(voiceAnalysis),
  protectionRules: many(contentProtectionRules),
  auditLogs: many(voiceAuditLog),
}));

export const voiceAnalysisRelations = relations(voiceAnalysis, ({ one }) => ({
  profile: one(voiceProfiles, {
    fields: [voiceAnalysis.profileId],
    references: [voiceProfiles.id],
  }),
}));

export const contentProtectionRulesRelations = relations(contentProtectionRules, ({ one }) => ({
  profile: one(voiceProfiles, {
    fields: [contentProtectionRules.profileId],
    references: [voiceProfiles.id],
  }),
}));

export const voiceAuditLogRelations = relations(voiceAuditLog, ({ one }) => ({
  profile: one(voiceProfiles, {
    fields: [voiceAuditLog.voiceProfileId],
    references: [voiceProfiles.id],
  }),
}));

// Type exports
export type VoiceProfileSelect = typeof voiceProfiles.$inferSelect;
export type VoiceProfileInsert = typeof voiceProfiles.$inferInsert;
export type VoiceAnalysisSelect = typeof voiceAnalysis.$inferSelect;
export type VoiceAnalysisInsert = typeof voiceAnalysis.$inferInsert;
export type ContentProtectionRuleSelect = typeof contentProtectionRules.$inferSelect;
export type ContentProtectionRuleInsert = typeof contentProtectionRules.$inferInsert;
export type VoiceTemplateSelect = typeof voiceTemplates.$inferSelect;
export type VoiceTemplateInsert = typeof voiceTemplates.$inferInsert;
export type VoiceAuditLogSelect = typeof voiceAuditLog.$inferSelect;
export type VoiceAuditLogInsert = typeof voiceAuditLog.$inferInsert;
