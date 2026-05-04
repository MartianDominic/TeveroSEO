-- Migration: 0071_add_updated_at_triggers.sql
-- Date: 2026-05-04
-- Phase: FIX-19 Database Schema & Migration Fixes
-- Purpose: Add database-level triggers for updated_at columns
--
-- This migration addresses:
--   H-SCHEMA-01: Timestamp updated_at uses application-level triggers only
--                Direct SQL updates bypass audit timestamps
--
-- Solution:
--   Create a reusable trigger function and apply it to all tables with updated_at
--   This ensures updated_at is set automatically even for direct SQL updates
--
-- Note: Drizzle's $onUpdate() is client-side only - bypassed by raw SQL

BEGIN;

-- ============================================================================
-- 1. Create reusable trigger function for updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_updated_at_column() IS
  'Automatically sets updated_at to current timestamp on row UPDATE. '
  'Applied to all tables with updated_at column to ensure database-level enforcement. '
  'Fixes H-SCHEMA-01: Direct SQL updates now properly set audit timestamps.';


-- ============================================================================
-- 2. Apply trigger to all tables with updated_at columns
-- Using DO block to handle cases where trigger already exists
-- ============================================================================

-- Helper function to create trigger if not exists
CREATE OR REPLACE FUNCTION create_updated_at_trigger_if_not_exists(table_name TEXT)
RETURNS VOID AS $$
DECLARE
    trigger_name TEXT := 'trg_' || table_name || '_updated_at';
BEGIN
    -- Check if trigger already exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = trigger_name
    ) THEN
        EXECUTE format(
            'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
            trigger_name,
            table_name
        );
        RAISE NOTICE 'Created trigger % on table %', trigger_name, table_name;
    ELSE
        RAISE NOTICE 'Trigger % already exists on table %, skipping', trigger_name, table_name;
    END IF;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- 3. Apply triggers to all tables with updated_at
-- Tables identified from open-seo-main/src/db/*.ts schemas
-- ============================================================================

-- user-schema.ts
SELECT create_updated_at_trigger_if_not_exists('user');

-- client-schema.ts
SELECT create_updated_at_trigger_if_not_exists('clients');

-- prospect-schema.ts
SELECT create_updated_at_trigger_if_not_exists('prospects');

-- prospect-keyword-schema.ts
SELECT create_updated_at_trigger_if_not_exists('prospect_keywords');

-- pipeline-config-schema.ts
SELECT create_updated_at_trigger_if_not_exists('pipeline_configs');

-- invoice-schema.ts
SELECT create_updated_at_trigger_if_not_exists('invoices');

-- contract-schema.ts
SELECT create_updated_at_trigger_if_not_exists('contracts');

-- brief-schema.ts
SELECT create_updated_at_trigger_if_not_exists('content_briefs');

-- proposal-template-schema.ts
SELECT create_updated_at_trigger_if_not_exists('proposal_templates');
SELECT create_updated_at_trigger_if_not_exists('proposal_template_sections');

-- agreement-template-schema.ts
SELECT create_updated_at_trigger_if_not_exists('agreement_templates');

-- service-catalog-schema.ts
SELECT create_updated_at_trigger_if_not_exists('service_catalog');

-- workspace-payment-settings-schema.ts
SELECT create_updated_at_trigger_if_not_exists('workspace_payment_settings');

-- platform-connection-schema.ts
SELECT create_updated_at_trigger_if_not_exists('platform_connections');

-- platform-data-cache-schema.ts
SELECT create_updated_at_trigger_if_not_exists('platform_data_cache');

-- api-key-schema.ts
SELECT create_updated_at_trigger_if_not_exists('api_keys');

-- connection-schema.ts
SELECT create_updated_at_trigger_if_not_exists('site_connections');

-- mapping-schema.ts
SELECT create_updated_at_trigger_if_not_exists('keyword_page_mappings');

-- embedding-schema.ts
SELECT create_updated_at_trigger_if_not_exists('page_embeddings');

-- discount-code-schema.ts
SELECT create_updated_at_trigger_if_not_exists('discount_codes');

-- tasks-schema.ts
SELECT create_updated_at_trigger_if_not_exists('tasks');

-- follow-up-schema.ts
SELECT create_updated_at_trigger_if_not_exists('follow_ups');
SELECT create_updated_at_trigger_if_not_exists('follow_up_rules');

-- pixel-schema.ts
SELECT create_updated_at_trigger_if_not_exists('pixel_installations');
SELECT create_updated_at_trigger_if_not_exists('pixel_events');

-- branding-schema.ts
SELECT create_updated_at_trigger_if_not_exists('branding_profiles');

-- goals-schema.ts
SELECT create_updated_at_trigger_if_not_exists('goals');

-- alert-schema.ts
SELECT create_updated_at_trigger_if_not_exists('alerts');

-- dashboard-schema.ts
SELECT create_updated_at_trigger_if_not_exists('dashboard_metrics');

-- change-schema.ts
SELECT create_updated_at_trigger_if_not_exists('monitored_changes');

-- prospect-scrape-config-schema.ts
SELECT create_updated_at_trigger_if_not_exists('prospect_scrape_configs');


-- ============================================================================
-- 4. Drop helper function (cleanup)
-- ============================================================================

DROP FUNCTION create_updated_at_trigger_if_not_exists(TEXT);


-- ============================================================================
-- 5. Document the pattern
-- ============================================================================

COMMENT ON TRIGGER trg_clients_updated_at ON clients IS
  'Database-level trigger for updated_at. '
  'Ensures timestamp is updated even for direct SQL operations. '
  'Fixes H-SCHEMA-01 from code review FIX-19.';


COMMIT;

-- ============================================================================
-- ROLLBACK SCRIPT (run manually if needed)
-- ============================================================================
-- BEGIN;
-- DROP TRIGGER IF EXISTS trg_user_updated_at ON "user";
-- DROP TRIGGER IF EXISTS trg_clients_updated_at ON clients;
-- DROP TRIGGER IF EXISTS trg_prospects_updated_at ON prospects;
-- -- ... repeat for all tables ...
-- DROP FUNCTION IF EXISTS update_updated_at_column();
-- COMMIT;
