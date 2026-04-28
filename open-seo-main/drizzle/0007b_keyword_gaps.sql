-- Phase 28: Keyword Gap Analysis
-- Add keyword_gaps field to prospect_analyses table

ALTER TABLE "prospect_analyses" ADD COLUMN "keyword_gaps" jsonb;
