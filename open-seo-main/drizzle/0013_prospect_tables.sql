-- Phase 26: Prospect Data Model
-- Migration 0013: prospects and prospect_analyses tables

-- Prospects table - potential clients stored by domain
CREATE TABLE IF NOT EXISTS prospects (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  company_name TEXT,
  contact_email TEXT,
  contact_name TEXT,
  industry TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  source TEXT,
  assigned_to TEXT,
  converted_client_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for prospects table
CREATE INDEX IF NOT EXISTS ix_prospects_workspace ON prospects (workspace_id);
CREATE INDEX IF NOT EXISTS ix_prospects_status ON prospects (status);
CREATE UNIQUE INDEX IF NOT EXISTS ix_prospects_workspace_domain ON prospects (workspace_id, domain);

-- Prospect analyses table - stores DataForSEO analysis results
CREATE TABLE IF NOT EXISTS prospect_analyses (
  id TEXT PRIMARY KEY,
  prospect_id TEXT NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  analysis_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  target_region TEXT,
  target_language TEXT,
  competitor_domains JSONB,
  domain_metrics JSONB,
  organic_keywords JSONB,
  competitor_keywords JSONB,
  cost_cents INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Indexes for prospect_analyses table
CREATE INDEX IF NOT EXISTS ix_analyses_prospect ON prospect_analyses (prospect_id);
CREATE INDEX IF NOT EXISTS ix_analyses_status ON prospect_analyses (status);
