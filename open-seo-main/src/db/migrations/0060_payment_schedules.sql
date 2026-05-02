-- Phase 60: Payment Flexibility & Split Payments
-- Creates payment schedule infrastructure for split payments (2-3 installments)

-- ============================================================================
-- 1. Create payment_schedules table
-- ============================================================================
-- One schedule per invoice, tracks the overall payment plan configuration

CREATE TABLE payment_schedules (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL UNIQUE REFERENCES invoices(id) ON DELETE CASCADE,

  -- Schedule configuration
  plan_type TEXT NOT NULL,
  total_installments INTEGER NOT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraint: valid plan types only
  CONSTRAINT chk_schedule_plan_type_valid CHECK (plan_type IN ('full', 'split_2', 'split_3'))
);

-- Index for invoice lookups
CREATE INDEX ix_payment_schedules_invoice ON payment_schedules(invoice_id);

COMMENT ON TABLE payment_schedules IS 'Payment schedules for split payment plans on invoices';
COMMENT ON COLUMN payment_schedules.plan_type IS 'Plan type: full (1 payment), split_2 (50/50), split_3 (40/30/30)';

-- ============================================================================
-- 2. Create payment_installments table
-- ============================================================================
-- One installment per payment in the schedule

CREATE TABLE payment_installments (
  id TEXT PRIMARY KEY,
  schedule_id TEXT NOT NULL REFERENCES payment_schedules(id) ON DELETE CASCADE,

  -- Installment details
  installment_number INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  due_at TIMESTAMPTZ NOT NULL,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,

  -- Payment provider reference
  payment_id TEXT,
  payment_provider TEXT,
  payment_url TEXT,

  -- Reminders
  reminder_sent_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT chk_installment_status_valid CHECK (status IN ('pending', 'processing', 'paid', 'overdue', 'failed')),
  CONSTRAINT chk_installment_provider_valid CHECK (payment_provider IS NULL OR payment_provider IN ('stripe', 'revolut'))
);

-- Index for schedule lookups
CREATE INDEX ix_installments_schedule ON payment_installments(schedule_id);

-- D-03: Index for finding overdue installments efficiently
CREATE INDEX idx_installments_status_due ON payment_installments(status, due_at);

COMMENT ON TABLE payment_installments IS 'Individual installments within a payment schedule';
COMMENT ON COLUMN payment_installments.status IS 'Installment status: pending -> processing -> paid | overdue | failed';
COMMENT ON COLUMN payment_installments.payment_url IS 'Checkout URL for this specific installment';

-- ============================================================================
-- 3. Create discount_codes table
-- ============================================================================
-- Discount/coupon codes per workspace

CREATE TABLE discount_codes (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,

  -- Code details
  code TEXT NOT NULL,
  discount_type TEXT NOT NULL,
  discount_value INTEGER NOT NULL,

  -- Usage limits
  max_uses INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  min_amount_cents INTEGER,

  -- Validity period
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,

  -- Active status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT chk_discount_type_valid CHECK (discount_type IN ('percentage', 'fixed')),
  CONSTRAINT chk_discount_value_positive CHECK (discount_value > 0),
  CONSTRAINT chk_discount_percentage_valid CHECK (discount_type != 'percentage' OR discount_value <= 100)
);

-- Index for workspace lookups
CREATE INDEX ix_discount_codes_workspace ON discount_codes(workspace_id);

-- Index for code lookups
CREATE INDEX ix_discount_codes_code ON discount_codes(code);

-- Unique constraint: one code per workspace
CREATE UNIQUE INDEX uq_discount_codes_workspace_code ON discount_codes(workspace_id, code);

COMMENT ON TABLE discount_codes IS 'Discount/coupon codes for invoices, scoped per workspace';
COMMENT ON COLUMN discount_codes.discount_type IS 'Type: percentage (1-100%) or fixed (cents)';
COMMENT ON COLUMN discount_codes.discount_value IS 'Value: percentage (1-100) or cents for fixed';

-- ============================================================================
-- 4. Extend workspace_payment_settings table
-- ============================================================================
-- Add split payment configuration columns

ALTER TABLE workspace_payment_settings
  ADD COLUMN split_payments_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE workspace_payment_settings
  ADD COLUMN available_plans JSONB NOT NULL DEFAULT '["full", "split_2", "split_3"]'::jsonb;

ALTER TABLE workspace_payment_settings
  ADD COLUMN default_plan TEXT NOT NULL DEFAULT 'full';

-- Add check constraint for default_plan
ALTER TABLE workspace_payment_settings
  ADD CONSTRAINT chk_default_plan_valid CHECK (default_plan IN ('full', 'split_2', 'split_3'));

COMMENT ON COLUMN workspace_payment_settings.split_payments_enabled IS 'Whether split payment options are offered to clients';
COMMENT ON COLUMN workspace_payment_settings.available_plans IS 'Array of plan types available for this workspace';
COMMENT ON COLUMN workspace_payment_settings.default_plan IS 'Default plan shown to clients: full, split_2, or split_3';
