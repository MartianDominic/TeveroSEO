-- Migration: Convert client_id columns from TEXT to UUID
-- Phase 40: H-DB-01 fix - Align client_id type between open-seo-main and AI-Writer
--
-- AI-Writer uses UUID (GUID class) for clients.id
-- open-seo-main was using TEXT, causing potential type mismatch in cross-system queries
--
-- This migration converts all client_id columns to native PostgreSQL UUID type
-- Existing data is cast using ::uuid which works for valid UUID string formats

-- Step 1: Convert clients.id primary key from TEXT to UUID
-- Must drop and recreate FK constraints that reference clients.id

-- Drop all foreign key constraints referencing clients.id
ALTER TABLE IF EXISTS client_dashboard_metrics DROP CONSTRAINT IF EXISTS client_dashboard_metrics_client_id_clients_id_fk;
ALTER TABLE IF EXISTS portfolio_activity DROP CONSTRAINT IF EXISTS portfolio_activity_client_id_clients_id_fk;
ALTER TABLE IF EXISTS seo_gsc_snapshots DROP CONSTRAINT IF EXISTS seo_gsc_snapshots_client_id_clients_id_fk;
ALTER TABLE IF EXISTS gsc_query_snapshots DROP CONSTRAINT IF EXISTS gsc_query_snapshots_client_id_clients_id_fk;
ALTER TABLE IF EXISTS ga4_snapshots DROP CONSTRAINT IF EXISTS ga4_snapshots_client_id_clients_id_fk;
ALTER TABLE IF EXISTS site_changes DROP CONSTRAINT IF EXISTS site_changes_client_id_clients_id_fk;
ALTER TABLE IF EXISTS change_backups DROP CONSTRAINT IF EXISTS change_backups_client_id_clients_id_fk;
ALTER TABLE IF EXISTS rollback_triggers DROP CONSTRAINT IF EXISTS rollback_triggers_client_id_clients_id_fk;
ALTER TABLE IF EXISTS site_connections DROP CONSTRAINT IF EXISTS site_connections_client_id_clients_id_fk;
ALTER TABLE IF EXISTS voice_profiles DROP CONSTRAINT IF EXISTS voice_profiles_client_id_clients_id_fk;
ALTER TABLE IF EXISTS reports DROP CONSTRAINT IF EXISTS reports_client_id_clients_id_fk;
ALTER TABLE IF EXISTS api_keys DROP CONSTRAINT IF EXISTS api_keys_client_id_clients_id_fk;
ALTER TABLE IF EXISTS alert_rules DROP CONSTRAINT IF EXISTS alert_rules_client_id_clients_id_fk;
ALTER TABLE IF EXISTS alerts DROP CONSTRAINT IF EXISTS alerts_client_id_clients_id_fk;
ALTER TABLE IF EXISTS link_graph DROP CONSTRAINT IF EXISTS link_graph_client_id_clients_id_fk;
ALTER TABLE IF EXISTS page_links DROP CONSTRAINT IF EXISTS page_links_client_id_clients_id_fk;
ALTER TABLE IF EXISTS orphan_pages DROP CONSTRAINT IF EXISTS orphan_pages_client_id_clients_id_fk;
ALTER TABLE IF EXISTS link_opportunities DROP CONSTRAINT IF EXISTS link_opportunities_client_id_clients_id_fk;
ALTER TABLE IF EXISTS link_suggestions DROP CONSTRAINT IF EXISTS link_suggestions_client_id_clients_id_fk;
ALTER TABLE IF EXISTS keyword_cannibalization DROP CONSTRAINT IF EXISTS keyword_cannibalization_client_id_clients_id_fk;
ALTER TABLE IF EXISTS client_branding DROP CONSTRAINT IF EXISTS client_branding_client_id_clients_id_fk;
ALTER TABLE IF EXISTS client_goals DROP CONSTRAINT IF EXISTS client_goals_client_id_clients_id_fk;

-- Step 2: Convert clients.id from TEXT to UUID
ALTER TABLE clients ALTER COLUMN id TYPE uuid USING id::uuid;

-- Step 3: Convert all client_id foreign key columns from TEXT to UUID
ALTER TABLE IF EXISTS client_dashboard_metrics ALTER COLUMN client_id TYPE uuid USING client_id::uuid;
ALTER TABLE IF EXISTS portfolio_activity ALTER COLUMN client_id TYPE uuid USING client_id::uuid;
ALTER TABLE IF EXISTS seo_gsc_snapshots ALTER COLUMN client_id TYPE uuid USING client_id::uuid;
ALTER TABLE IF EXISTS gsc_query_snapshots ALTER COLUMN client_id TYPE uuid USING client_id::uuid;
ALTER TABLE IF EXISTS ga4_snapshots ALTER COLUMN client_id TYPE uuid USING client_id::uuid;
ALTER TABLE IF EXISTS site_changes ALTER COLUMN client_id TYPE uuid USING client_id::uuid;
ALTER TABLE IF EXISTS change_backups ALTER COLUMN client_id TYPE uuid USING client_id::uuid;
ALTER TABLE IF EXISTS rollback_triggers ALTER COLUMN client_id TYPE uuid USING client_id::uuid;
ALTER TABLE IF EXISTS site_connections ALTER COLUMN client_id TYPE uuid USING client_id::uuid;
ALTER TABLE IF EXISTS voice_profiles ALTER COLUMN client_id TYPE uuid USING client_id::uuid;
ALTER TABLE IF EXISTS reports ALTER COLUMN client_id TYPE uuid USING client_id::uuid;
ALTER TABLE IF EXISTS api_keys ALTER COLUMN client_id TYPE uuid USING client_id::uuid;
ALTER TABLE IF EXISTS alert_rules ALTER COLUMN client_id TYPE uuid USING client_id::uuid;
ALTER TABLE IF EXISTS alerts ALTER COLUMN client_id TYPE uuid USING client_id::uuid;
ALTER TABLE IF EXISTS link_graph ALTER COLUMN client_id TYPE uuid USING client_id::uuid;
ALTER TABLE IF EXISTS page_links ALTER COLUMN client_id TYPE uuid USING client_id::uuid;
ALTER TABLE IF EXISTS orphan_pages ALTER COLUMN client_id TYPE uuid USING client_id::uuid;
ALTER TABLE IF EXISTS link_opportunities ALTER COLUMN client_id TYPE uuid USING client_id::uuid;
ALTER TABLE IF EXISTS link_suggestions ALTER COLUMN client_id TYPE uuid USING client_id::uuid;
ALTER TABLE IF EXISTS keyword_cannibalization ALTER COLUMN client_id TYPE uuid USING client_id::uuid;
ALTER TABLE IF EXISTS client_branding ALTER COLUMN client_id TYPE uuid USING client_id::uuid;
ALTER TABLE IF EXISTS client_goals ALTER COLUMN client_id TYPE uuid USING client_id::uuid;
ALTER TABLE IF EXISTS audits ALTER COLUMN client_id TYPE uuid USING client_id::uuid;
ALTER TABLE IF EXISTS rank_drop_events ALTER COLUMN client_id TYPE uuid USING client_id::uuid;
ALTER TABLE IF EXISTS report_schedules ALTER COLUMN client_id TYPE uuid USING client_id::uuid;

-- Step 4: Re-add foreign key constraints
ALTER TABLE client_dashboard_metrics ADD CONSTRAINT client_dashboard_metrics_client_id_clients_id_fk
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE portfolio_activity ADD CONSTRAINT portfolio_activity_client_id_clients_id_fk
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE seo_gsc_snapshots ADD CONSTRAINT seo_gsc_snapshots_client_id_clients_id_fk
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE gsc_query_snapshots ADD CONSTRAINT gsc_query_snapshots_client_id_clients_id_fk
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE ga4_snapshots ADD CONSTRAINT ga4_snapshots_client_id_clients_id_fk
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE site_changes ADD CONSTRAINT site_changes_client_id_clients_id_fk
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE change_backups ADD CONSTRAINT change_backups_client_id_clients_id_fk
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE rollback_triggers ADD CONSTRAINT rollback_triggers_client_id_clients_id_fk
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE site_connections ADD CONSTRAINT site_connections_client_id_clients_id_fk
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE voice_profiles ADD CONSTRAINT voice_profiles_client_id_clients_id_fk
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE reports ADD CONSTRAINT reports_client_id_clients_id_fk
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE api_keys ADD CONSTRAINT api_keys_client_id_clients_id_fk
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE alert_rules ADD CONSTRAINT alert_rules_client_id_clients_id_fk
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE alerts ADD CONSTRAINT alerts_client_id_clients_id_fk
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE link_graph ADD CONSTRAINT link_graph_client_id_clients_id_fk
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE page_links ADD CONSTRAINT page_links_client_id_clients_id_fk
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE orphan_pages ADD CONSTRAINT orphan_pages_client_id_clients_id_fk
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE link_opportunities ADD CONSTRAINT link_opportunities_client_id_clients_id_fk
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE link_suggestions ADD CONSTRAINT link_suggestions_client_id_clients_id_fk
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE keyword_cannibalization ADD CONSTRAINT keyword_cannibalization_client_id_clients_id_fk
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE client_branding ADD CONSTRAINT client_branding_client_id_clients_id_fk
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE client_goals ADD CONSTRAINT client_goals_client_id_clients_id_fk
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

-- Note: audits.client_id, rank_drop_events.client_id, and report_schedules.client_id
-- intentionally do not have FK constraints due to cross-database design or backwards compatibility
