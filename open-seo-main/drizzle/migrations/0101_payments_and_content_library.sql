-- Phase 101: Payment Reconciliation & Content Library
-- Migration 0101
--
-- Creates tables for:
-- - Multi-provider payment reconciliation (payments, payment_allocations, client_credits)
-- - Cross-platform payment linking (payment_groups, payment_group_members)
-- - Content library (content_blocks, block_usage)
-- - Section-level document tracking (document_section_views)

-- ============================================================================
-- payments table
-- ============================================================================
CREATE TABLE IF NOT EXISTS "payments" (
  "id" text PRIMARY KEY,
  "workspace_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "provider" text NOT NULL,
  "external_id" text,
  "gross_amount_cents" integer NOT NULL,
  "provider_fee_cents" integer DEFAULT 0,
  "net_amount_cents" integer NOT NULL,
  "currency" text DEFAULT 'EUR',
  "payer_reference" text,
  "payer_email" text,
  "payer_name" text,
  "memo" text,
  "matched_invoice_id" text REFERENCES "invoices"("id"),
  "confidence" integer,
  "match_type" text,
  "status" text NOT NULL DEFAULT 'pending',
  "received_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "soft_deleted_at" timestamp with time zone,
  CONSTRAINT "chk_payment_provider_valid" CHECK (provider IN ('stripe', 'revolut', 'bank_transfer', 'cash', 'other')),
  CONSTRAINT "chk_payment_status_valid" CHECK (status IN ('pending', 'matched', 'allocated', 'review', 'failed'))
);

CREATE INDEX IF NOT EXISTS "ix_payments_workspace" ON "payments"("workspace_id");
CREATE INDEX IF NOT EXISTS "ix_payments_external" ON "payments"("provider", "external_id");
CREATE INDEX IF NOT EXISTS "ix_payments_status" ON "payments"("status");
CREATE INDEX IF NOT EXISTS "ix_payments_matched_invoice" ON "payments"("matched_invoice_id");
CREATE INDEX IF NOT EXISTS "ix_payments_received" ON "payments"("received_at");

-- ============================================================================
-- payment_allocations table
-- ============================================================================
CREATE TABLE IF NOT EXISTS "payment_allocations" (
  "id" text PRIMARY KEY,
  "payment_id" text NOT NULL REFERENCES "payments"("id") ON DELETE CASCADE,
  "invoice_id" text NOT NULL REFERENCES "invoices"("id") ON DELETE CASCADE,
  "allocated_cents" integer NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "ix_allocations_payment" ON "payment_allocations"("payment_id");
CREATE INDEX IF NOT EXISTS "ix_allocations_invoice" ON "payment_allocations"("invoice_id");

-- ============================================================================
-- client_credits table
-- ============================================================================
CREATE TABLE IF NOT EXISTS "client_credits" (
  "id" text PRIMARY KEY,
  "workspace_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "client_id" uuid REFERENCES "clients"("id"),
  "source_payment_id" text REFERENCES "payments"("id"),
  "amount_cents" integer NOT NULL,
  "used_cents" integer DEFAULT 0,
  "currency" text DEFAULT 'EUR',
  "reason" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "expires_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "ix_credits_workspace" ON "client_credits"("workspace_id");
CREATE INDEX IF NOT EXISTS "ix_credits_client" ON "client_credits"("client_id");

-- ============================================================================
-- payment_groups table
-- ============================================================================
CREATE TABLE IF NOT EXISTS "payment_groups" (
  "id" text PRIMARY KEY,
  "workspace_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "ix_payment_groups_workspace" ON "payment_groups"("workspace_id");

-- ============================================================================
-- payment_group_members table
-- ============================================================================
CREATE TABLE IF NOT EXISTS "payment_group_members" (
  "id" text PRIMARY KEY,
  "group_id" text NOT NULL REFERENCES "payment_groups"("id") ON DELETE CASCADE,
  "payment_id" text NOT NULL REFERENCES "payments"("id") ON DELETE CASCADE,
  "role" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "uq_group_member_payment" UNIQUE ("group_id", "payment_id")
);

CREATE INDEX IF NOT EXISTS "ix_group_members_group" ON "payment_group_members"("group_id");
CREATE INDEX IF NOT EXISTS "ix_group_members_payment" ON "payment_group_members"("payment_id");

-- ============================================================================
-- content_blocks table
-- ============================================================================
CREATE TABLE IF NOT EXISTS "content_blocks" (
  "id" text PRIMARY KEY,
  "workspace_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "category" text NOT NULL,
  "tags" jsonb DEFAULT '[]',
  "content" text NOT NULL,
  "content_en" text,
  "content_lt" text,
  "usage_count" integer DEFAULT 0,
  "last_used_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "created_by" text,
  "soft_deleted_at" timestamp with time zone,
  CONSTRAINT "chk_content_block_category" CHECK (category IN ('case_study', 'testimonial', 'pricing_table', 'legal_clause', 'team_bio', 'methodology', 'faq', 'custom'))
);

CREATE INDEX IF NOT EXISTS "ix_content_blocks_workspace" ON "content_blocks"("workspace_id");
CREATE INDEX IF NOT EXISTS "ix_content_blocks_category" ON "content_blocks"("category");

-- ============================================================================
-- block_usage table
-- ============================================================================
CREATE TABLE IF NOT EXISTS "block_usage" (
  "id" text PRIMARY KEY,
  "block_id" text NOT NULL REFERENCES "content_blocks"("id") ON DELETE CASCADE,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "inserted_at" timestamp with time zone NOT NULL DEFAULT now(),
  "inserted_by" text
);

CREATE INDEX IF NOT EXISTS "ix_block_usage_block" ON "block_usage"("block_id");
CREATE INDEX IF NOT EXISTS "ix_block_usage_entity" ON "block_usage"("entity_type", "entity_id");

-- ============================================================================
-- document_section_views table
-- ============================================================================
CREATE TABLE IF NOT EXISTS "document_section_views" (
  "id" text PRIMARY KEY,
  "proposal_id" text NOT NULL REFERENCES "proposals"("id") ON DELETE CASCADE,
  "view_id" text NOT NULL REFERENCES "proposal_views"("id") ON DELETE CASCADE,
  "section_id" text NOT NULL,
  "section_name" text NOT NULL,
  "time_spent_ms" integer NOT NULL,
  "scroll_depth" integer,
  "entered_at" timestamp with time zone NOT NULL,
  "exited_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "ix_section_views_proposal" ON "document_section_views"("proposal_id");
CREATE INDEX IF NOT EXISTS "ix_section_views_view" ON "document_section_views"("view_id");
CREATE INDEX IF NOT EXISTS "ix_section_views_section" ON "document_section_views"("section_id");
