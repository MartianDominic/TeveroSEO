-- Phase 30.5: Pipeline Stage Tracking
-- Adds pipeline_stage column for sales funnel progression

-- Add pipeline_stage column with default 'new'
ALTER TABLE "prospects" ADD COLUMN IF NOT EXISTS "pipeline_stage" text NOT NULL DEFAULT 'new';

-- Create index for filtering by stage
CREATE INDEX IF NOT EXISTS "ix_prospects_pipeline_stage" ON "prospects" ("pipeline_stage");

-- Migrate existing prospects: map status to pipeline_stage
-- new -> new, analyzing -> analyzing, analyzed -> scored, converted -> converted, archived -> archived
UPDATE "prospects" SET "pipeline_stage" =
  CASE
    WHEN "status" = 'analyzed' THEN 'scored'
    ELSE "status"
  END
WHERE "pipeline_stage" = 'new' AND "status" != 'new';
