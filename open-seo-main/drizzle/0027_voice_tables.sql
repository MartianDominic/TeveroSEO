-- Phase 37: Brand Voice Management
-- Creates voice_profiles, voice_analysis, and content_protection_rules tables

-- Voice profiles table - stores the 12 voice dimensions per client
CREATE TABLE IF NOT EXISTS "voice_profiles" (
  "id" text PRIMARY KEY NOT NULL,
  "client_id" text NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
  "mode" text NOT NULL DEFAULT 'best_practices',
  "tone_primary" text,
  "tone_secondary" text,
  "formality_level" integer,
  "personality_traits" jsonb,
  "archetype" text,
  "sentence_length_avg" integer,
  "paragraph_length_avg" integer,
  "contraction_usage" text,
  "vocabulary_patterns" jsonb,
  "signature_phrases" jsonb,
  "forbidden_phrases" jsonb,
  "heading_style" text,
  "confidence_score" integer,
  "analyzed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Voice analysis table - stores per-page analysis results
CREATE TABLE IF NOT EXISTS "voice_analysis" (
  "id" text PRIMARY KEY NOT NULL,
  "profile_id" text NOT NULL REFERENCES "voice_profiles"("id") ON DELETE CASCADE,
  "url" text NOT NULL,
  "raw_analysis" jsonb,
  "extracted_tone" text,
  "extracted_formality" integer,
  "sample_sentences" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Content protection rules table - pages/sections/patterns to preserve
CREATE TABLE IF NOT EXISTS "content_protection_rules" (
  "id" text PRIMARY KEY NOT NULL,
  "profile_id" text NOT NULL REFERENCES "voice_profiles"("id") ON DELETE CASCADE,
  "rule_type" text NOT NULL,
  "target" text NOT NULL,
  "expires_at" timestamp with time zone,
  "reason" text,
  "created_by" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS "ix_voice_profiles_client" ON "voice_profiles" ("client_id");
CREATE INDEX IF NOT EXISTS "ix_voice_analysis_profile" ON "voice_analysis" ("profile_id");
CREATE INDEX IF NOT EXISTS "ix_voice_analysis_url" ON "voice_analysis" ("url");
CREATE INDEX IF NOT EXISTS "ix_protection_rules_profile" ON "content_protection_rules" ("profile_id");
CREATE INDEX IF NOT EXISTS "ix_protection_rules_type" ON "content_protection_rules" ("rule_type");
