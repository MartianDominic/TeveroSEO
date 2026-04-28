-- Migration: Add scraped_content column to prospect_analyses
-- Phase 27-03: AI Business Extractor

ALTER TABLE "prospect_analyses" ADD COLUMN "scraped_content" jsonb;
