-- Migration: Expand voice_profiles schema and add voice_templates, voice_audit_log tables
-- Phase 37-01: Brand Voice Management

-- Create enums
DO $$ BEGIN
 CREATE TYPE "public"."voice_status" AS ENUM('draft', 'active', 'archived');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."primary_tone" AS ENUM('professional', 'casual', 'friendly', 'authoritative', 'playful', 'inspirational', 'empathetic', 'urgent', 'conversational', 'academic', 'innovative');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."protection_level" AS ENUM('full', 'partial', 'none');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Add new columns to voice_profiles table
ALTER TABLE "voice_profiles" ADD COLUMN IF NOT EXISTS "voice_name" text;
ALTER TABLE "voice_profiles" ADD COLUMN IF NOT EXISTS "voice_status" "voice_status" DEFAULT 'draft' NOT NULL;
ALTER TABLE "voice_profiles" ADD COLUMN IF NOT EXISTS "industry_template" text;
ALTER TABLE "voice_profiles" ADD COLUMN IF NOT EXISTS "primary_tone" "primary_tone" DEFAULT 'professional' NOT NULL;
ALTER TABLE "voice_profiles" ADD COLUMN IF NOT EXISTS "secondary_tones" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "voice_profiles" ADD COLUMN IF NOT EXISTS "emotional_range" text DEFAULT 'moderate';
ALTER TABLE "voice_profiles" ADD COLUMN IF NOT EXISTS "required_phrases" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "voice_profiles" ADD COLUMN IF NOT EXISTS "jargon_level" text DEFAULT 'moderate';
ALTER TABLE "voice_profiles" ADD COLUMN IF NOT EXISTS "industry_terms" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "voice_profiles" ADD COLUMN IF NOT EXISTS "acronym_policy" text DEFAULT 'first_use';
ALTER TABLE "voice_profiles" ADD COLUMN IF NOT EXISTS "sentence_length_target" text DEFAULT 'varied';
ALTER TABLE "voice_profiles" ADD COLUMN IF NOT EXISTS "paragraph_length_target" text DEFAULT 'short';
ALTER TABLE "voice_profiles" ADD COLUMN IF NOT EXISTS "list_preference" text DEFAULT 'mixed';
ALTER TABLE "voice_profiles" ADD COLUMN IF NOT EXISTS "cta_template" text;
ALTER TABLE "voice_profiles" ADD COLUMN IF NOT EXISTS "keyword_density_tolerance" integer DEFAULT 3;
ALTER TABLE "voice_profiles" ADD COLUMN IF NOT EXISTS "keyword_placement_rules" jsonb DEFAULT '["title", "h1", "first_paragraph", "throughout"]'::jsonb;
ALTER TABLE "voice_profiles" ADD COLUMN IF NOT EXISTS "seo_vs_voice_priority" integer DEFAULT 6;
ALTER TABLE "voice_profiles" ADD COLUMN IF NOT EXISTS "protected_sections" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "voice_profiles" ADD COLUMN IF NOT EXISTS "voice_blend_enabled" boolean DEFAULT false;
ALTER TABLE "voice_profiles" ADD COLUMN IF NOT EXISTS "voice_blend_weight" real DEFAULT 0.5;
ALTER TABLE "voice_profiles" ADD COLUMN IF NOT EXISTS "voice_template_id" text;
ALTER TABLE "voice_profiles" ADD COLUMN IF NOT EXISTS "custom_instructions" text;
ALTER TABLE "voice_profiles" ADD COLUMN IF NOT EXISTS "last_modified_by" text;

-- Update existing columns with defaults if they're NULL
ALTER TABLE "voice_profiles" ALTER COLUMN "formality_level" SET DEFAULT 6;
ALTER TABLE "voice_profiles" ALTER COLUMN "personality_traits" SET DEFAULT '[]'::jsonb;
ALTER TABLE "voice_profiles" ALTER COLUMN "signature_phrases" SET DEFAULT '[]'::jsonb;
ALTER TABLE "voice_profiles" ALTER COLUMN "forbidden_phrases" SET DEFAULT '[]'::jsonb;
ALTER TABLE "voice_profiles" ALTER COLUMN "contraction_usage" SET DEFAULT 'sometimes';
ALTER TABLE "voice_profiles" ALTER COLUMN "heading_style" SET DEFAULT 'action';

-- Create voice_templates table
CREATE TABLE IF NOT EXISTS "voice_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"industry" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"template_config" jsonb NOT NULL,
	"usage_count" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text
);

-- Create voice_audit_log table
CREATE TABLE IF NOT EXISTS "voice_audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"voice_profile_id" text NOT NULL,
	"content_id" text,
	"content_type" text,
	"content_url" text,
	"voice_consistency_score" real,
	"tone_consistency_score" real,
	"vocabulary_alignment_score" real,
	"structure_compliance_score" real,
	"issues" jsonb DEFAULT '[]'::jsonb,
	"audited_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Add foreign key for voice_audit_log
DO $$ BEGIN
 ALTER TABLE "voice_audit_log" ADD CONSTRAINT "voice_audit_log_voice_profile_id_voice_profiles_id_fk" FOREIGN KEY ("voice_profile_id") REFERENCES "public"."voice_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS "idx_voice_templates_industry" ON "voice_templates" USING btree ("industry");
CREATE INDEX IF NOT EXISTS "idx_voice_audit_profile" ON "voice_audit_log" USING btree ("voice_profile_id");
CREATE INDEX IF NOT EXISTS "idx_voice_audit_content" ON "voice_audit_log" USING btree ("content_id");
