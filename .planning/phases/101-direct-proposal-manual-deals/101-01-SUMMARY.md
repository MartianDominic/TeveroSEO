---
phase: 101-direct-proposal-manual-deals
plan: 01
subsystem: payments, content-library, document-tracking
tags: [database, schema, drizzle, payments, reconciliation, content-library, TDD]
dependency_graph:
  requires: []
  provides:
    - payments table with multi-provider support
    - paymentAllocations for split payments
    - clientCredits for overpayments/prepayments
    - paymentGroups for cross-platform linking
    - contentBlocks for reusable content
    - blockUsage for content analytics
    - documentSectionViews for engagement tracking
    - PaymentIngestionService for Stripe/Revolut/manual normalization
    - PaymentRepository for CRUD operations
  affects:
    - open-seo-main/src/db/schema.ts
tech_stack:
  added: []
  patterns:
    - Drizzle ORM pgTable definitions with CHECK constraints
    - Soft delete via softDeleteColumns mixin
    - TDD with vitest mocks
    - Workspace-scoped queries for tenant isolation
key_files:
  created:
    - open-seo-main/src/db/payment-schema.ts
    - open-seo-main/src/db/content-library-schema.ts
    - open-seo-main/src/db/document-tracking-schema.ts
    - open-seo-main/drizzle/migrations/0101_payments_and_content_library.sql
    - open-seo-main/src/server/features/payments/repositories/PaymentRepository.ts
    - open-seo-main/src/server/features/payments/services/PaymentIngestionService.ts
    - open-seo-main/src/server/features/payments/services/PaymentIngestionService.test.ts
  modified:
    - open-seo-main/src/db/schema.ts
decisions:
  - Renamed PAYMENT_PROVIDERS to RECONCILIATION_PROVIDERS to avoid collision with workspace-payment-settings-schema
  - Renamed PAYMENT_STATUS to RECONCILIATION_STATUS to avoid collision with proposal-schema
  - Used text IDs (nanoid) instead of UUID for payments to match existing patterns
metrics:
  duration: 11 minutes
  tasks: 4
  files_created: 7
  files_modified: 1
  tests: 8
  completed: 2026-05-13T22:26:00Z
---

# Phase 101 Plan 01: Foundation Database Schemas Summary

Multi-provider payment reconciliation schemas with content library and document tracking for world-class agency management.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Create payment-schema.ts | 75b337dc2 | payment-schema.ts (5 tables, 19 columns) |
| 2 | Create content-library and document-tracking schemas | 7d7b93680 | content-library-schema.ts, document-tracking-schema.ts |
| 3 | Update exports and create migration | 8bd3d5cdc | schema.ts, 0101_payments_and_content_library.sql |
| 4 | PaymentIngestionService with TDD | 29daf306c, 8064a2cca | PaymentRepository.ts, PaymentIngestionService.ts, tests |

## What Was Built

### Payment Reconciliation Schema (5 tables)

1. **payments** - Normalized payment from any provider
   - Providers: stripe, revolut, bank_transfer, cash, other
   - Amounts in cents: grossAmountCents, providerFeeCents, netAmountCents
   - Matching: matchedInvoiceId, confidence (0-100), matchType
   - Status: pending, matched, allocated, review, failed
   - 7-year soft delete retention for audit compliance

2. **paymentAllocations** - Split payments across invoices
   - Many-to-many between payments and invoices
   - Supports partial payments and multi-invoice coverage

3. **clientCredits** - Overpayment/prepayment tracking
   - Tracks amountCents, usedCents, optional expiresAt
   - Links to source payment or manual credit

4. **paymentGroups** + **paymentGroupMembers** - Cross-platform linking
   - Groups related payments (Revolut -> Stripe flows)
   - Members have role: primary or linked

### Content Library Schema (2 tables)

1. **contentBlocks** - Reusable content snippets
   - 8 categories: case_study, testimonial, pricing_table, legal_clause, team_bio, methodology, faq, custom
   - Localization: content, contentEn, contentLt
   - Usage tracking: usageCount, lastUsedAt

2. **blockUsage** - Tracks where blocks are used
   - Polymorphic: entityType (proposal, contract, document) + entityId

### Document Tracking Schema (1 table)

1. **documentSectionViews** - Section-level engagement analytics
   - Links to proposals and proposalViews
   - Metrics: timeSpentMs, scrollDepth (0-100), enteredAt, exitedAt

### Payment Ingestion Service

- **PaymentRepository**: CRUD with workspace scoping (T-101-04)
- **PaymentIngestionService**:
  - `ingestFromStripe(intent, workspaceId)` - Normalize Stripe PaymentIntent
  - `ingestFromRevolut(tx, workspaceId)` - Normalize Revolut Transaction
  - `ingestManual(input, workspaceId)` - Handle bank transfer, cash
  - All methods idempotent via externalId uniqueness

### Migration

- 0101_payments_and_content_library.sql creates all 8 tables
- Includes CHECK constraints, indexes, and foreign keys

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript compilation error in PaymentRepository**
- **Found during:** Task 4 verification
- **Issue:** Chained `.where()` calls not supported in Drizzle query builder
- **Fix:** Refactored to build conditions array and spread into single `and()`
- **Files modified:** PaymentRepository.ts
- **Commit:** 8064a2cca (amended)

**2. [Rule 3 - Blocking] Renamed exports to avoid collisions**
- **Found during:** Task 3 verification
- **Issue:** PAYMENT_PROVIDERS and PAYMENT_STATUS already exported from other schemas
- **Fix:** Renamed to RECONCILIATION_PROVIDERS and RECONCILIATION_STATUS
- **Files modified:** payment-schema.ts
- **Commit:** 8bd3d5cdc

## TDD Gate Compliance

- RED gate: 29daf306c (test commit with failing tests)
- GREEN gate: 8064a2cca (implementation makes tests pass)
- 8 tests passing

## Threat Mitigations Applied

| Threat ID | Mitigation |
|-----------|------------|
| T-101-02 | CHECK constraints on provider/status, amounts in cents (integer) |
| T-101-04 | All PaymentRepository queries scoped by workspaceId |
| T-101-03 | Soft delete with softDeletedAt for 7-year audit trail |

## Self-Check: PASSED

- [x] open-seo-main/src/db/payment-schema.ts exists
- [x] open-seo-main/src/db/content-library-schema.ts exists
- [x] open-seo-main/src/db/document-tracking-schema.ts exists
- [x] open-seo-main/drizzle/migrations/0101_payments_and_content_library.sql exists
- [x] open-seo-main/src/server/features/payments/repositories/PaymentRepository.ts exists
- [x] open-seo-main/src/server/features/payments/services/PaymentIngestionService.ts exists
- [x] open-seo-main/src/server/features/payments/services/PaymentIngestionService.test.ts exists
- [x] All commits exist in git log
- [x] TypeScript compiles without errors in src/db/
- [x] 8 tests pass
