-- Phase 35-04: Auto-Insert + Velocity Control
-- Add columns to link_suggestions for auto-insert functionality

ALTER TABLE "link_suggestions"
ADD COLUMN IF NOT EXISTS "opportunity_id" text REFERENCES "link_opportunities"("id") ON DELETE SET NULL;

ALTER TABLE "link_suggestions"
ADD COLUMN IF NOT EXISTS "insertion_method" text NOT NULL DEFAULT 'wrap_existing';

ALTER TABLE "link_suggestions"
ADD COLUMN IF NOT EXISTS "replacement_text" text;

ALTER TABLE "link_suggestions"
ADD COLUMN IF NOT EXISTS "new_sentence" text;

ALTER TABLE "link_suggestions"
ADD COLUMN IF NOT EXISTS "is_auto_applicable" boolean NOT NULL DEFAULT false;

ALTER TABLE "link_suggestions"
ADD COLUMN IF NOT EXISTS "failure_reason" text;

-- Add index for auto-applicable suggestions
CREATE INDEX IF NOT EXISTS "ix_link_suggestions_auto_applicable"
ON "link_suggestions" ("is_auto_applicable")
WHERE "status" = 'pending' AND "is_auto_applicable" = true;

-- Add index for opportunity relationship
CREATE INDEX IF NOT EXISTS "ix_link_suggestions_opportunity"
ON "link_suggestions" ("opportunity_id");
