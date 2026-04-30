-- Phase 55-04: Language Settings
-- Add language preference columns to organization, prospects, and clients tables

-- Organization language settings (workspace level)
ALTER TABLE "organization" ADD COLUMN "default_language" text DEFAULT 'en';
ALTER TABLE "organization" ADD COLUMN "supported_languages" text[] DEFAULT ARRAY['en'];
ALTER TABLE "organization" ADD COLUMN "country" text;
ALTER TABLE "organization" ADD COLUMN "formality" text DEFAULT 'formal';

-- Prospect language preferences (null = inherit from workspace)
ALTER TABLE "prospects" ADD COLUMN "preferred_language" text;
ALTER TABLE "prospects" ADD COLUMN "country" text;

-- Client language preferences (null = inherit from workspace)
ALTER TABLE "clients" ADD COLUMN "preferred_language" text;
ALTER TABLE "clients" ADD COLUMN "country" text;

-- Check constraint for formality
ALTER TABLE "organization" ADD CONSTRAINT "chk_formality_valid" CHECK (formality IS NULL OR formality IN ('formal', 'informal'));

-- Check constraint for supported locales
ALTER TABLE "organization" ADD CONSTRAINT "chk_default_language_valid" CHECK (default_language IS NULL OR default_language IN ('en', 'lt'));
ALTER TABLE "prospects" ADD CONSTRAINT "chk_prospect_preferred_language_valid" CHECK (preferred_language IS NULL OR preferred_language IN ('en', 'lt'));
ALTER TABLE "clients" ADD CONSTRAINT "chk_client_preferred_language_valid" CHECK (preferred_language IS NULL OR preferred_language IN ('en', 'lt'));
