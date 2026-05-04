-- Phase 54-01: Multi-Provider Payments Schema
-- Creates workspace_payment_settings table and extends invoices
-- Transaction wrapper added for atomic execution (FIX-13: HIGH-02-01)

BEGIN;

-- Create workspace_payment_settings table for encrypted provider credentials
CREATE TABLE IF NOT EXISTS "workspace_payment_settings" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL UNIQUE REFERENCES "organization"("id") ON DELETE CASCADE,
  "default_provider" text NOT NULL DEFAULT 'stripe',
  "stripe_enabled" boolean NOT NULL DEFAULT false,
  "stripe_secret_key" text,
  "stripe_webhook_secret" text,
  "stripe_publishable_key" text,
  "revolut_enabled" boolean NOT NULL DEFAULT false,
  "revolut_api_key" text,
  "revolut_webhook_secret" text,
  "revolut_merchant_id" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "chk_default_provider_valid" CHECK (default_provider IN ('stripe', 'revolut'))
);

-- Index for workspace lookups
CREATE INDEX IF NOT EXISTS "ix_workspace_payment_settings_workspace" ON "workspace_payment_settings" ("workspace_id");

-- Add payment provider columns to invoices table
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "payment_provider" text DEFAULT 'stripe';
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "revolut_order_id" text;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "revolut_checkout_url" text;

-- Index for Revolut order lookups
CREATE INDEX IF NOT EXISTS "ix_invoices_revolut" ON "invoices" ("revolut_order_id");

-- Add CHECK constraint for payment_provider (only if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_invoice_payment_provider_valid'
  ) THEN
    ALTER TABLE "invoices" ADD CONSTRAINT "chk_invoice_payment_provider_valid"
      CHECK (payment_provider IS NULL OR payment_provider IN ('stripe', 'revolut'));
  END IF;
END $$;

COMMIT;
