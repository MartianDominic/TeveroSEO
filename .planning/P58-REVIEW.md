# Phase 58: Service Catalog & Extra Services - Code Review

**Review Status:** COMPLETE
**Reviewer:** Agent P58 (Opus 4.5)
**Date:** 2026-05-03
**Files Reviewed:** 18
**Issues Found:** Critical: 0, High: 3, Medium: 5, Low: 4

## Executive Summary

Phase 58 implements a solid service catalog system with good architectural patterns. Prices are correctly stored in cents (integer). The pricing calculation logic is sound with proper handling of monthly, one-time, and setup fees. Key integration points with P57 proposals, P59 agreements, and P60 payments are properly wired. However, several medium-priority issues exist around edge cases and potential race conditions.

## Pricing Analysis - GOOD

| Check | Status | Evidence |
|-------|--------|----------|
| Prices stored in cents (integer) | PASS | `basePriceCents: integer("base_price_cents")` in schema |
| Validation for negative prices | PASS | `z.number().int().min(0)` in API schemas |
| Max price validation | PASS | `MAX_PRICE_CENTS = 100_000_000` (1M EUR) enforced |
| Discount calculation | N/A | Discounts handled in P60, not P58 |
| Total calculations correct | PASS | `monthlyTotal += price * qty` pattern verified |
| Currency handling | PASS | `currency: text("currency").default("EUR")` with proper formatting |
| Tax handling | N/A | Not implemented in this phase (future work) |

**Pricing Calculation Verification (ServiceSummary.tsx:65-84):**
```typescript
// Correct: Uses customPriceCents OR falls back to basePriceCents
const price = selection.customPriceCents ?? service.basePriceCents ?? 0;
const setup = selection.customSetupCents ?? service.setupFeeCents ?? 0;
const qty = selection.quantity || 1;

// Correct: Multiplies by quantity, accumulates by type
if (service.pricingType === "monthly") {
  monthlyTotal += price * qty;
  setupTotal += setup * qty;
} else if (service.pricingType === "one_time") {
  oneTimeTotal += price * qty;
}
```

## High Priority Issues

### H-58-01: Seed function lacks idempotency key
- **File:** `open-seo-main/src/db/seeds/default-services.ts:246-257`
- **Issue:** `seedDefaultServices()` generates new UUIDs on every run. Uses `onConflictDoNothing()` but conflict target is unclear since IDs are always new.
- **Impact:** Running seed twice creates duplicate default services with different IDs.
- **Fix:** Use deterministic IDs based on service name hash, or check existence by `(workspaceId IS NULL AND name = ?)` before insert.

### H-58-02: Race condition in ensureDefaultServices
- **File:** `open-seo-main/src/server/features/services/services/ServiceCatalogService.ts:297-305`
- **Issue:** `ensureDefaultServices` checks count then seeds without locking. Two concurrent requests could both trigger seeding.
- **Impact:** Duplicate system templates if parallel API calls occur.
- **Fix:** Use `pg_advisory_lock` or upsert pattern with deterministic IDs.

```typescript
// Current (vulnerable):
const count = await ServiceRepository.countServicesForWorkspace(workspaceId);
if (count === 0) {
  await seedDefaultServices(db); // Race: another request may also seed
}
```

### H-58-03: Template deletion doesn't check active proposal usage
- **File:** `open-seo-main/src/server/features/services/services/ServiceCatalogService.ts:241-265`
- **Issue:** Soft-deleting a service template doesn't verify if it's used in active (non-signed) proposals.
- **Impact:** Users can delete templates that are referenced by pending proposals, causing confusion in proposal views.
- **Fix:** Either (a) prevent deletion if used in pending proposals, or (b) snapshot template data into proposalServices at selection time.

## Medium Priority Issues

### M-58-01: Missing locale parameter in ServiceLineItems category labels
- **File:** `apps/web/src/components/proposals/ServiceLineItems.tsx:164-179`
- **Issue:** Category labels are hardcoded in a local object rather than using i18n.
- **Impact:** Labels won't update if user changes locale without page refresh.
- **Fix:** Use `useTranslations("serviceCatalog.categories")` instead of hardcoded object.

### M-58-02: PriceEditModal allows editing for non-selected services
- **File:** `apps/web/src/components/proposals/ServiceSelector.tsx:227-236`
- **Issue:** Modal opens when `editingService && editingSelection` but modal trigger exists even when service not selected (line 121-129 in AddonCheckbox).
- **Impact:** Edit button appears only when selected (correct), but there's no explicit guard in modal rendering.
- **Fix:** Add explicit `selection.isIncluded` check before modal render.

### M-58-03: Missing error boundary around ServiceSelector
- **File:** `apps/web/src/components/proposals/ServiceSelector.tsx`
- **Issue:** If services array contains invalid data (null basePriceCents with monthly type), formatting could fail.
- **Impact:** Entire proposal builder could crash on malformed data.
- **Fix:** Add error boundary or defensive null checks in formatPrice.

### M-58-04: AgreementGenerationService silent failure for missing templates
- **File:** `open-seo-main/src/server/features/proposals/services/AgreementGenerationService.ts:163-167`
- **Issue:** When serviceTemplateId reference is orphaned (template deleted), innerJoin silently excludes the row.
- **Impact:** Services that were selected but whose template was deleted don't appear in agreement.
- **Fix:** Use leftJoin and show warning for orphaned services, or include service name snapshot in proposalServices.

### M-58-05: AgreementVariableService leftJoin may return null service names
- **File:** `open-seo-main/src/server/features/agreements/services/AgreementVariableService.ts:237-244`
- **Issue:** `leftJoin` with serviceTemplates can return `row.name` as null if template deleted.
- **Impact:** Agreement variables may show "Service" as fallback name.
- **Status:** Mitigated with `row.name ?? "Service"` fallback, but user should be warned.

## Low Priority Issues

### L-58-01: PackageSelector "recommended" badge is index-based
- **File:** `apps/web/src/components/proposals/PackageSelector.tsx:64`
- **Issue:** `recommendedIdx = Math.floor(packages.length / 2)` assumes packages are sorted by tier. If displayOrder changes, wrong package gets "recommended" badge.
- **Fix:** Add explicit `isRecommended` field to service template or determine by price tier.

### L-58-02: Missing displayOrder validation in reorder
- **File:** `open-seo-main/src/server/features/services/repositories/service.repository.ts:200-208`
- **Issue:** `updateDisplayOrder` doesn't validate that newOrder doesn't conflict with existing orders.
- **Impact:** Potential ordering collisions, though frontend sorts by multiple fields.
- **Fix:** Consider batch reorder endpoint that normalizes all orders.

### L-58-03: Icon validation is permissive
- **File:** API schema allows any string up to 50 chars for `icon` field.
- **Issue:** No validation that icon name exists in Lucide.
- **Impact:** Invalid icon names show fallback Package icon (acceptable behavior).
- **Fix:** Optional enhancement to validate against known Lucide icon list.

### L-58-04: Currency code validation is minimal
- **File:** `z.string().length(3)` in API schema.
- **Issue:** Accepts any 3-character string, not validated against ISO 4217.
- **Impact:** Intl.NumberFormat may fail with invalid currency codes.
- **Fix:** Add regex `z.string().regex(/^[A-Z]{3}$/)` or validate against ISO list.

## Integration Analysis

| Integration Point | Status | Notes |
|-------------------|--------|-------|
| P57 Proposals: Services appear in proposal builder | PASS | ServiceSelector integrated in builder page |
| P57 Proposals: Selections saved to proposalServices | PASS | PUT /api/proposals/:id/services verified |
| P59 Agreements: Service terms included | PASS | AgreementGenerationService.generateServiceTermsSections |
| P59 Agreements: Services variable resolution | PASS | AgreementVariableService.services.list/monthly/setup |
| P60 Payments: Price synced to invoice | NEEDS VERIFY | proposalServices prices should flow to invoice line items |
| Settings UI: CRUD operations work | PASS | actions.ts server actions verified |

## Data Flow Verification

```
1. ServiceTemplates (system/workspace)
   |
   v
2. ServiceSelector (proposal builder) --> stores --> proposalServices
   |
   v
3. ServicesSection (proposal view) <-- reads -- AgreementGenerationService.getResolvedServicesForProposal
   |
   v
4. AgreementGenerationService.generateServiceTermsSections --> includes in agreement
   |
   v
5. AgreementVariableService.loadContext --> resolves {{services.*}} variables
```

All flows verified as connected.

## Workspace Scoping Verification

| Check | Status | Evidence |
|-------|--------|----------|
| Services filtered by workspace | PASS | `or(eq(workspaceId, x), isNull(workspaceId))` |
| Cross-workspace access blocked | PASS | `updateService` checks `existing.workspaceId !== workspaceId` |
| System templates read-only | PASS | `deleteService` checks `workspaceId !== null` before soft delete |
| Authorization on CRUD | PASS | All routes use `requireApiAuth` extracting workspaceId from session |

## Security Checklist

| Threat | Mitigation | Status |
|--------|------------|--------|
| T-58-01: Spoofing (workspace from body) | workspaceId from auth context, not body | MITIGATED |
| T-58-02: Price tampering | Server-side validation with bounds | MITIGATED |
| T-58-03: System template deletion | Repository checks workspaceId != null | MITIGATED |
| T-58-04: Cross-workspace access | All queries filter by session workspaceId | MITIGATED |
| T-58-07: Price overflow | MAX_PRICE_CENTS = 100M (1M EUR) | MITIGATED |
| T-58-08: Proposal workspace check | Verified before service operations | MITIGATED |

## Recommendations

1. **Immediate (High):**
   - Fix seed idempotency: use deterministic IDs or name-based conflict resolution
   - Add advisory lock or transaction isolation for ensureDefaultServices
   - Snapshot service template data in proposalServices to handle template deletion

2. **Short-term (Medium):**
   - Use i18n for ServiceLineItems category labels
   - Add error boundary around ServiceSelector
   - Improve orphaned template handling in AgreementGenerationService

3. **Enhancement (Low):**
   - Add `isRecommended` field to service templates
   - Validate currency codes against ISO 4217
   - Consider batch reorder endpoint for displayOrder management

## Files Reviewed

- `open-seo-main/src/db/service-catalog-schema.ts`
- `open-seo-main/src/db/seeds/default-services.ts`
- `open-seo-main/src/server/features/services/repositories/service.repository.ts`
- `open-seo-main/src/server/features/services/services/ServiceCatalogService.ts`
- `open-seo-main/src/routes/api/services/index.ts`
- `open-seo-main/src/routes/api/services/$serviceId.ts`
- `open-seo-main/src/routes/api/services/$serviceId.duplicate.ts`
- `open-seo-main/src/routes/api/proposals/[id]/services.ts`
- `open-seo-main/src/server/features/proposals/services/AgreementGenerationService.ts`
- `open-seo-main/src/server/features/agreements/services/AgreementVariableService.ts`
- `apps/web/src/components/proposals/ServiceSelector.tsx`
- `apps/web/src/components/proposals/ServiceSummary.tsx`
- `apps/web/src/components/proposals/PriceEditModal.tsx`
- `apps/web/src/components/proposals/PackageSelector.tsx`
- `apps/web/src/components/proposals/AddonCheckbox.tsx`
- `apps/web/src/components/proposals/ServiceLineItems.tsx`
- `apps/web/src/app/proposals/[token]/components/ServicesSection.tsx`
- `apps/web/src/app/(shell)/settings/services/actions.ts`
