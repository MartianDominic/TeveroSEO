-- Phase 30: Interactive Proposals - Schema & Builder
-- Creates tables for proposals, views, signatures, and payments

-- Proposals table - main proposal entity
CREATE TABLE IF NOT EXISTS "proposals" (
  "id" text PRIMARY KEY NOT NULL,
  "prospect_id" text REFERENCES "prospects"("id") ON DELETE SET NULL,
  "workspace_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "template" text DEFAULT 'standard',
  "content" jsonb NOT NULL,
  "brand_config" jsonb,
  "setup_fee_cents" integer,
  "monthly_fee_cents" integer,
  "currency" text DEFAULT 'EUR',
  "status" text NOT NULL DEFAULT 'draft',
  "token" text UNIQUE NOT NULL,
  "expires_at" timestamp with time zone,
  "sent_at" timestamp with time zone,
  "first_viewed_at" timestamp with time zone,
  "accepted_at" timestamp with time zone,
  "signed_at" timestamp with time zone,
  "paid_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Proposal views table - tracks engagement
CREATE TABLE IF NOT EXISTS "proposal_views" (
  "id" text PRIMARY KEY NOT NULL,
  "proposal_id" text NOT NULL REFERENCES "proposals"("id") ON DELETE CASCADE,
  "viewed_at" timestamp with time zone NOT NULL DEFAULT now(),
  "duration_seconds" integer,
  "sections_viewed" text[],
  "roi_calculator_used" boolean DEFAULT false,
  "device_type" text,
  "ip_hash" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Proposal signatures table - tracks e-signatures via Dokobit
CREATE TABLE IF NOT EXISTS "proposal_signatures" (
  "id" text PRIMARY KEY NOT NULL,
  "proposal_id" text NOT NULL REFERENCES "proposals"("id") ON DELETE CASCADE,
  "signer_name" text NOT NULL,
  "signer_personal_code_hash" text,
  "signing_method" text,
  "dokobit_session_id" text,
  "signed_pdf_url" text,
  "signed_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Proposal payments table - tracks payments via Stripe
CREATE TABLE IF NOT EXISTS "proposal_payments" (
  "id" text PRIMARY KEY NOT NULL,
  "proposal_id" text NOT NULL REFERENCES "proposals"("id") ON DELETE CASCADE,
  "provider" text DEFAULT 'stripe',
  "stripe_session_id" text,
  "stripe_payment_intent_id" text,
  "stripe_subscription_id" text,
  "amount_cents" integer,
  "currency" text DEFAULT 'EUR',
  "status" text NOT NULL DEFAULT 'pending',
  "paid_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS "ix_proposals_workspace" ON "proposals" ("workspace_id");
CREATE INDEX IF NOT EXISTS "ix_proposals_prospect" ON "proposals" ("prospect_id");
CREATE INDEX IF NOT EXISTS "ix_proposals_status" ON "proposals" ("status");
CREATE INDEX IF NOT EXISTS "ix_proposals_token" ON "proposals" ("token");
CREATE INDEX IF NOT EXISTS "ix_proposal_views_proposal" ON "proposal_views" ("proposal_id");
CREATE INDEX IF NOT EXISTS "ix_proposal_signatures_proposal" ON "proposal_signatures" ("proposal_id");
CREATE INDEX IF NOT EXISTS "ix_proposal_payments_proposal" ON "proposal_payments" ("proposal_id");
CREATE INDEX IF NOT EXISTS "ix_proposal_payments_stripe_session" ON "proposal_payments" ("stripe_session_id");
