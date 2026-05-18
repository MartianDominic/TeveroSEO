# Phase 101: Comprehensive Self-Review Report

**Generated:** 2026-05-13
**Review Method:** 4 Opus subagents in parallel (Architecture, Security, Database, Code Quality)
**Total Issues:** 52 findings across all categories

---

## Executive Summary

Phase 101 implements a well-designed multi-feature architecture with **120 passing tests**. The core functionality is sound, but the review identified **3 CRITICAL**, **18 HIGH**, and **27 MEDIUM** issues that require attention before production deployment.

| Category | CRITICAL | HIGH | MEDIUM | LOW |
|----------|----------|------|--------|-----|
| Database | 3 | 5 | 8 | 0 |
| Architecture | 0 | 3 | 5 | 3 |
| Security | 0 | 5 | 7 | 0 |
| Code Quality | 0 | 5 | 7 | 4 |
| **Total** | **3** | **18** | **27** | **7** |

---

## CRITICAL Issues (Must Fix Before Deploy)

### C-01: Missing Unique Constraint for Payment Idempotency
**Source:** Database Review
**Location:** `payment-schema.ts:163-180`, migration `0101_payments_and_content_library.sql:39`

The `(provider, external_id)` index does NOT enforce uniqueness. Concurrent webhook deliveries can create duplicate payment records.

```sql
-- Current (index only)
CREATE INDEX IF NOT EXISTS "ix_payments_external" ON "payments"("provider", "external_id");

-- Required (unique constraint per workspace)
CREATE UNIQUE INDEX IF NOT EXISTS "uq_payments_workspace_provider_external"
  ON "payments"("workspace_id", "provider", "external_id")
  WHERE "external_id" IS NOT NULL;
```

### C-02: Type Mismatch on documents.client_id
**Source:** Database Review
**Location:** `document-schema.ts:85`, migration `0102_documents_and_drive.sql:20`

`clients.id` is UUID but `documents.client_id` is TEXT. This breaks FK integrity.

```typescript
// Current (wrong)
clientId: text("client_id").references(() => clients.id)

// Should be
clientId: uuid("client_id").references(() => clients.id)
```

### C-03: Missing Allocation Amount Constraints
**Source:** Database Review
**Location:** `payment-schema.ts:193-212`

No database constraint prevents:
- Allocations with negative/zero amounts
- Allocations exceeding payment amounts

```sql
CONSTRAINT "chk_allocation_positive" CHECK (allocated_cents > 0)
```

---

## HIGH Priority Issues (Fix Before Ship)

### Integration Gaps

| ID | Issue | Location | Fix |
|----|-------|----------|-----|
| H-01 | **Webhook doesn't call PaymentIngestionService** | `webhooks/revolut.ts`, `webhooks/stripe.ts` | Route webhooks through `PaymentIngestionService.ingestFrom{Stripe|Revolut}()` → `AutoMatchEngine.processPayment()` |
| H-02 | **Missing Revolut polling worker** | `src/server/queues/` (missing) | Implement per `101-RESEARCH.md` spec - 15-min polling catches missed webhooks |
| H-03 | **DocumentRepository missing methods** | `DocumentRepository.ts` | Add `incrementViewCount`, `updateLastViewedAt` - services bypass repository |

### Security Issues

| ID | Issue | Location | Fix |
|----|-------|----------|-----|
| H-04 | **Document tracking lacks ownership verification** | `api/documents/$documentId/track.ts` | Verify `proposalId` matches document, verify `viewId` belongs to proposal |
| H-05 | **PaymentAllocationRepository no workspace scoping** | `PaymentAllocationRepository.ts` | Add `workspaceId` parameter to all methods, join with payments table |
| H-06 | **LIKE wildcard injection in search** | `ContentBlockRepository.ts:124` | Escape `%`, `_`, `\` in search queries |
| H-07 | **Empty API key fails silently** | `AIProposalGenerator.ts:17` | Throw error if `GOOGLE_AI_API_KEY` not set |
| H-08 | **Double allocation race condition** | `PaymentAllocationService.ts:52-99` | Use `FOR UPDATE` lock in transaction |

### Code Quality Issues

| ID | Issue | Location | Fix |
|----|-------|----------|-----|
| H-09 | **SQL pattern injection in memo parsing** | `AutoMatchEngine.ts:211` | Escape SQL LIKE characters in `invoiceNumberPart` |
| H-10 | **QuickCaptureService missing transaction** | `QuickCaptureService.ts:81-163` | Wrap prospect/proposal/contract inserts in `db.transaction()` |
| H-11 | **Query injection in Drive folder creation** | `GoogleDriveService.ts:203-206` | Escape single quotes in `clientName` |
| H-12 | **Non-null assertion on undefined invoiceId** | `PaymentReviewService.ts:111` | Add explicit validation before using `decision.invoiceId!` |
| H-13 | **Missing AI JSON structure validation** | `AIProposalGenerator.ts:107-112` | Validate parsed JSON has required fields |

### Database Issues

| ID | Issue | Location | Fix |
|----|-------|----------|-----|
| H-14 | **Missing index on documents.prospect_id** | Migration `0102` | Add `ix_documents_prospect` index |
| H-15 | **Missing soft delete filter in allocations** | `PaymentAllocationRepository.ts` | Filter by `payments.softDeletedAt IS NULL` |
| H-16 | **Missing CHECK on client_credits.reason** | Migration `0101` | Add `chk_credit_reason_valid` constraint |
| H-17 | **Missing CHECK on payment_group_members.role** | Migration `0101` | Add `chk_group_member_role_valid` constraint |
| H-18 | **Credit depletion race condition** | `ClientCreditRepository.ts:114-130` | Add WHERE clause to prevent over-use |

---

## MEDIUM Priority Issues (Fix Soon After Ship)

### Database
- M-DB-01: OFFSET pagination in DocumentRepository (use cursor-based)
- M-DB-02: Missing index on client_credits.expires_at
- M-DB-03: Missing index on content_blocks.soft_deleted_at
- M-DB-04: Missing updated_at triggers for new tables
- M-DB-05: Missing CHECK on client_credits.usedCents <= amount_cents

### Architecture
- M-ARCH-01: Inconsistent ID column types (text vs uuid)
- M-ARCH-02: blockUsage table missing workspaceId column
- M-ARCH-03: N+1 query pattern in AutoMatchEngine batch processing
- M-ARCH-04: Missing activity logging in payment services
- M-ARCH-05: ProposalGenerationService missing content library integration

### Security
- M-SEC-01: No rate limiting on payment review/allocate endpoints
- M-SEC-02: Domain normalization doesn't handle IDN/punycode
- M-SEC-03: OAuth tokens not validated for expiry before use
- M-SEC-04: Content block content not HTML sanitized
- M-SEC-05: Path traversal possible in DocumentSyncService file storage
- M-SEC-06: AI-generated proposal content not schema validated
- M-SEC-07: @anthropic-ai/sdk has moderate vulnerability (update to 0.96.0+)

### Code Quality
- M-CODE-01: console.log in GlobalCommandPalette.tsx
- M-CODE-02: Missing useEffect dependency in QuickCaptureModal
- M-CODE-03: Race condition in PaymentAllocationService (no lock)
- M-CODE-04: Magic number (7 days) in ReminderSchedulingService
- M-CODE-05: Unbounded query (1000 limit) in PaymentReviewService.getReviewStats
- M-CODE-06: Event handler recreated on every render in ContentBlockCard
- M-CODE-07: Unused state variables in CommandPaletteProvider

---

## Positive Findings

The review also identified well-implemented security controls:

1. **Authentication enforced** - All API routes use `requireApiAuth` middleware
2. **Workspace isolation** - Repositories scope queries by `workspaceId`
3. **Webhook signatures verified** - Stripe uses proper signature verification
4. **Input validation** - Request bodies validated with Zod schemas
5. **Parameterized queries** - Drizzle ORM prevents SQL injection
6. **TDD compliance** - 120 tests passing across all features
7. **Soft deletes** - Proper audit trail with 7-year retention
8. **BullMQ usage** - Correct patterns for async work

---

## Recommended Fix Order

### Phase 1: Pre-Deploy Critical (Estimate: 2-3 hours)
1. C-01: Add unique constraint for payment idempotency
2. C-02: Fix documents.client_id type to UUID
3. C-03: Add allocation amount CHECK constraint
4. H-05: Add workspace scoping to PaymentAllocationRepository
5. H-08: Add FOR UPDATE lock in PaymentAllocationService
6. H-10: Wrap QuickCaptureService in transaction

### Phase 2: High Priority (Estimate: 4-6 hours)
1. H-01: Integrate webhooks with PaymentIngestionService
2. H-02: Implement Revolut polling worker
3. H-04: Add ownership verification to document tracking
4. H-06, H-09, H-11: Fix all injection vectors (LIKE, SQL, Drive query)
5. H-07, H-12, H-13: Add input validation and null checks

### Phase 3: Medium Priority (Estimate: 1-2 days)
- Database indexes and constraints
- Rate limiting on payment endpoints
- Path traversal fix
- Activity logging
- Content library integration

---

## Files Requiring Changes

### Critical Path Files
```
open-seo-main/src/db/payment-schema.ts
open-seo-main/src/db/document-schema.ts
open-seo-main/drizzle/migrations/0101_payments_and_content_library.sql
open-seo-main/drizzle/migrations/0102_documents_and_drive.sql
open-seo-main/src/server/features/payments/repositories/PaymentAllocationRepository.ts
open-seo-main/src/server/features/payments/services/PaymentAllocationService.ts
open-seo-main/src/server/features/deals/services/QuickCaptureService.ts
```

### High Priority Files
```
open-seo-main/src/routes/api/webhooks/revolut.ts
open-seo-main/src/routes/api/webhooks/stripe.ts
open-seo-main/src/routes/api/documents/$documentId/track.ts
open-seo-main/src/server/features/payments/services/AutoMatchEngine.ts
open-seo-main/src/server/features/documents/services/GoogleDriveService.ts
open-seo-main/src/server/features/content-library/repositories/ContentBlockRepository.ts
open-seo-main/src/server/features/proposals/services/AIProposalGenerator.ts
open-seo-main/src/server/features/payments/services/PaymentReviewService.ts
```

---

*Review completed by 4 Opus subagents analyzing 50+ files across schema, service, repository, route, and component layers.*
