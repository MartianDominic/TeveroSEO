---
phase: 60
plan: 04
subsystem: payments
tags: [discount-codes, invoices, checkout]
dependency-graph:
  requires: [60-01-schema]
  provides: [discount-validation, discount-calculation, discount-ui-api]
  affects: [invoice-checkout, payment-flow]
tech-stack:
  added: []
  patterns: [service-pattern, drizzle-schema, vitest-mocking]
key-files:
  created:
    - open-seo-main/src/db/discount-code-schema.ts
    - open-seo-main/src/db/discount-code-schema.test.ts
    - open-seo-main/src/server/features/discounts/index.ts
    - open-seo-main/src/server/features/discounts/services/DiscountCodeService.ts
    - open-seo-main/src/server/features/discounts/services/DiscountCodeService.test.ts
  modified:
    - open-seo-main/src/db/schema.ts
decisions:
  - D-60-04-01: Discount values stored as integers (basis points for percentage, cents for fixed)
  - D-60-04-02: Per-customer usage limits tracked via discountCodeUsages join table
  - D-60-04-03: Codes normalized to uppercase for case-insensitive matching
metrics:
  duration: ~45min
  completed: 2025-05-02
---

# Phase 60 Plan 04: Discount Code System Summary

Discount code validation, calculation, and usage tracking with percentage/fixed discount support and multi-constraint enforcement.

## Implementation Overview

### 1. Discount Code Schema (`discount-code-schema.ts`)

Created two tables for the discount code system:

**`discount_codes` table:**
- Core fields: `id`, `workspaceId`, `code`, `discountType`, `discountValue`
- Usage limits: `maxUses`, `maxUsesPerCustomer`, `usedCount`
- Validity window: `validFrom`, `validUntil`
- Order constraints: `minAmountCents`, `maxDiscountCents`
- Audit: `isActive`, `createdAt`, `updatedAt`

**`discount_code_usages` table:**
- Tracks each application of a discount code
- Fields: `discountCodeId`, `invoiceId`, `clientId`, `discountAmountCents`, `appliedAt`
- Unique constraint prevents double-application to same invoice

**Database constraints:**
- CHECK constraint validates discount type (percentage/fixed)
- CHECK constraint ensures discount value is positive
- CHECK constraint caps percentage at 100% (10000 basis points)
- Unique constraint on (workspaceId, code) prevents duplicate codes per workspace

### 2. DiscountCodeService

Comprehensive service for discount code lifecycle:

**Validation (`validateCode`):**
- Code existence check
- Active status check
- Validity window enforcement
- Global usage limit check
- Per-customer usage limit check
- Minimum order amount check

**Calculation (`calculateDiscount`):**
- Percentage discount: `(amount * discountValue) / 10000`
- Fixed discount: direct subtraction
- Max discount cap enforcement for percentage discounts
- Cannot discount below zero

**Combined flow (`validateAndCalculate`):**
- Single-call convenience method for checkout
- Returns validation result with calculation included

**Usage tracking (`applyToInvoice`):**
- Records usage in `discount_code_usages` table
- Increments `usedCount` atomically

**CRUD operations:**
- `createDiscountCode`: Creates with uppercase normalization
- `getById`: Single code retrieval with workspace scoping
- `listByWorkspace`: List codes with optional inactive filter
- `updateDiscountCode`: Partial updates with workspace authorization
- `deactivateCode`: Soft delete via `isActive` flag
- `getUsageStats`: Aggregate usage statistics

### 3. Test Coverage

**Schema tests (22 tests):**
- Table structure verification
- Column defaults and constraints
- Type exports validation
- Discount calculation examples

**Service tests (20 tests):**
- Validation scenarios (all error codes)
- Percentage and fixed discount calculations
- Max discount cap application
- Fractional percentage handling
- Per-customer usage limits
- Code creation with normalization
- Deactivation flow

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all functionality is complete and wired.

## Self-Check: PASSED

Files verified:
- FOUND: open-seo-main/src/db/discount-code-schema.ts
- FOUND: open-seo-main/src/db/discount-code-schema.test.ts
- FOUND: open-seo-main/src/server/features/discounts/index.ts
- FOUND: open-seo-main/src/server/features/discounts/services/DiscountCodeService.ts
- FOUND: open-seo-main/src/server/features/discounts/services/DiscountCodeService.test.ts

Tests verified:
- Schema tests: 22/22 passed
- Service tests: 20/20 passed

## Next Steps

1. **60-05**: Add discount code UI components for checkout
2. **60-05**: Integrate DiscountCodeService with invoice payment flow
3. **60-05**: Add admin UI for managing discount codes
