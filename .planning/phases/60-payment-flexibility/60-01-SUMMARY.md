---
phase: 60-payment-flexibility
plan: 01
subsystem: payments
tags:
  - schema
  - split-payments
  - payment-schedule
  - discount-codes
dependency_graph:
  requires:
    - invoices table (invoice-schema.ts)
    - organization table (user-schema.ts)
    - workspace_payment_settings table
  provides:
    - paymentSchedules table
    - paymentInstallments table
    - discountCodes table
    - PaymentScheduleService
    - PaymentScheduleRepository
    - calculatePlan function
  affects:
    - workspace_payment_settings (extended with split payment fields)
tech_stack:
  added:
    - Drizzle pgTable for payment_schedules
    - Drizzle pgTable for payment_installments
    - Drizzle pgTable for discount_codes
  patterns:
    - Repository pattern for data access
    - Pure function extraction for testability
    - CHECK constraints for enum validation
    - JSONB for flexible plan configuration
key_files:
  created:
    - open-seo-main/src/db/payment-schedule-schema.ts
    - open-seo-main/src/db/discount-code-schema.ts
    - open-seo-main/src/server/features/payments/repositories/PaymentScheduleRepository.ts
    - open-seo-main/src/server/features/payments/services/PaymentScheduleService.ts
    - open-seo-main/src/server/features/payments/services/calculatePlan.ts
    - open-seo-main/src/server/features/payments/services/PaymentScheduleService.test.ts
    - open-seo-main/src/db/migrations/0060_payment_schedules.sql
  modified:
    - open-seo-main/src/db/workspace-payment-settings-schema.ts
    - open-seo-main/src/db/schema.ts
decisions:
  - Extracted calculatePlan to pure module to avoid db dependencies in tests
  - Used Math.ceil for first installments to ensure totals are exact
  - Created composite index on (status, due_at) for efficient overdue queries
metrics:
  duration: 10m 20s
  completed: 2026-05-02T15:47:00Z
  tasks_completed: 3
  tests_added: 14
  files_created: 7
  files_modified: 2
---

# Phase 60 Plan 01: Schema + Payment Schedule Service Summary

Payment schedule schema and service with installment calculation logic for split payments.

## One-liner

Drizzle schema for payment_schedules/installments/discount_codes tables with calculatePlan service (50/50 and 40/30/30 splits using Math.ceil).

## Completed Tasks

| Task | Name | Status | Files |
|------|------|--------|-------|
| 1 | Create payment schedule and discount code schemas | Done | payment-schedule-schema.ts, discount-code-schema.ts, workspace-payment-settings-schema.ts |
| 2 | Create PaymentScheduleRepository and Service | Done | PaymentScheduleRepository.ts, PaymentScheduleService.ts, calculatePlan.ts, PaymentScheduleService.test.ts |
| 3 | Generate Drizzle migration | Done | 0060_payment_schedules.sql |

## Key Implementation Details

### Payment Schedule Schema (Task 1)

Created two core tables:

1. **paymentSchedules**: One per invoice, stores planType (full/split_2/split_3) and totalInstallments
2. **paymentInstallments**: One per payment, stores amountCents, dueAt, status, paymentProvider reference

Key features:
- CHECK constraints on planType and status for DB-level validation
- Index on (status, due_at) for efficient overdue detection queries (D-03)
- FK cascade deletes for data integrity

### Discount Codes Schema

Created discountCodes table with:
- Workspace scoping with unique constraint on (workspace_id, code)
- Support for percentage and fixed discount types
- Usage tracking (maxUses, usedCount)
- Validity period (validFrom, validUntil)

### Extended Workspace Payment Settings

Added three columns:
- `split_payments_enabled` (boolean, default false)
- `available_plans` (JSONB array, default ['full', 'split_2', 'split_3'])
- `default_plan` (text, default 'full')

### Payment Schedule Service (Task 2)

Created calculatePlan pure function with:
- **full**: 1 installment, 100% today
- **split_2**: 50/50 split (Math.ceil for first, remainder for second)
- **split_3**: 40/30/30 split (Math.ceil for first two, remainder for third)

Key design decision: Extracted calculatePlan to a separate pure module (calculatePlan.ts) to allow testing without database dependencies.

### Repository Pattern

PaymentScheduleRepository provides:
- `insertSchedule`, `insertInstallments` for creation
- `getScheduleByInvoiceId`, `getScheduleWithInstallments` for retrieval
- `getUpcomingInstallments(daysAhead)` for reminder worker
- `getOverdueInstallments()` for status updates
- `updateInstallmentStatus` for payment transitions

### Migration (Task 3)

Created 0060_payment_schedules.sql with:
- CREATE TABLE for payment_schedules, payment_installments, discount_codes
- ALTER TABLE for workspace_payment_settings extensions
- All CHECK constraints and indexes
- Comments for documentation

## Test Coverage

14 tests for calculatePlan function covering:
- Full plan calculations
- Split_2 (50/50) calculations with Math.ceil verification
- Split_3 (40/30/30) calculations with remainder handling
- Edge cases (small amounts, odd amounts, zero/negative validation)
- Date calculations (30/60 day offsets, month-end handling)

All tests pass.

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- [x] payment-schedule-schema.ts exists with paymentSchedules and paymentInstallments tables
- [x] discount-code-schema.ts exists with discountCodes table
- [x] workspace-payment-settings-schema.ts extended with splitPaymentsEnabled
- [x] PaymentScheduleService.ts exists with calculatePlan function
- [x] PaymentScheduleRepository.ts exists with insertSchedule function
- [x] PaymentScheduleService.test.ts exists with 14 passing tests
- [x] 0060_payment_schedules.sql migration exists with all required tables
- [x] TypeScript compiles without errors in new files
