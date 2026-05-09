-- Migration: Add foreign key on page_quality_scores.audit_id -> audits.id
-- Phase: Schema integrity fix
-- Description: Fix missing FK reference for pageQualityScores.auditId
--              Also fixes column type from uuid to text to match audits.id

-- Step 1: Drop any existing index that references audit_id (if exists)
DROP INDEX IF EXISTS ix_page_quality_scores_audit;
DROP INDEX IF EXISTS ix_page_quality_client_audit;
DROP INDEX IF EXISTS ix_page_quality_unique;

-- Step 2: Alter column type from uuid to text
-- Cast existing uuid values to text format
ALTER TABLE "page_quality_scores"
  ALTER COLUMN "audit_id" TYPE text USING "audit_id"::text;

-- Step 3: Add foreign key constraint
-- Using SET NULL on delete to preserve quality score data when audit is deleted
ALTER TABLE "page_quality_scores"
  ADD CONSTRAINT "page_quality_scores_audit_id_audits_id_fk"
  FOREIGN KEY ("audit_id") REFERENCES "audits"("id")
  ON DELETE SET NULL;

-- Step 4: Recreate indexes with proper types
CREATE INDEX IF NOT EXISTS "ix_page_quality_client_audit"
  ON "page_quality_scores" ("client_id", "audit_id");

CREATE UNIQUE INDEX IF NOT EXISTS "ix_page_quality_unique"
  ON "page_quality_scores" ("page_id", "audit_id");
