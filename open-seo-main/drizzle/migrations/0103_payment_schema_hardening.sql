-- Phase 101: Payment Schema Hardening
-- Migration 0103
--
-- Adds database-level constraints for data integrity:
-- - C-01: Unique constraint for payment idempotency (workspace_id, provider, external_id)
-- - C-03: CHECK constraint for positive allocation amounts
-- - H-16: CHECK constraint for valid credit reasons
-- - H-17: CHECK constraint for valid payment group member roles
-- - M-DB-05: CHECK constraint for used_cents <= amount_cents

-- ============================================================================
-- C-01: Payment Idempotency - Unique Constraint
-- ============================================================================
-- Remove old non-unique index (it will be replaced by unique constraint)
DROP INDEX IF EXISTS "ix_payments_external";

-- Add unique constraint (partial - only where external_id is not null)
-- Manual payments have NULL external_id and should not be subject to uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS "uq_payments_workspace_provider_external"
  ON "payments"("workspace_id", "provider", "external_id")
  WHERE "external_id" IS NOT NULL;

-- ============================================================================
-- C-03: Allocation Amount Constraint
-- ============================================================================
ALTER TABLE "payment_allocations"
  ADD CONSTRAINT "chk_allocation_positive" CHECK (allocated_cents > 0);

-- ============================================================================
-- H-16: Client Credits Reason Constraint
-- ============================================================================
ALTER TABLE "client_credits"
  ADD CONSTRAINT "chk_credit_reason_valid"
  CHECK (reason IS NULL OR reason IN ('overpayment', 'prepayment', 'refund_credit', 'manual'));

-- ============================================================================
-- H-17: Payment Group Member Role Constraint
-- ============================================================================
ALTER TABLE "payment_group_members"
  ADD CONSTRAINT "chk_group_member_role_valid"
  CHECK (role IN ('primary', 'linked'));

-- ============================================================================
-- M-DB-05: Credit Used Not Exceeds Amount Constraint
-- ============================================================================
ALTER TABLE "client_credits"
  ADD CONSTRAINT "chk_credit_used_not_exceeds_amount"
  CHECK (used_cents <= amount_cents);
