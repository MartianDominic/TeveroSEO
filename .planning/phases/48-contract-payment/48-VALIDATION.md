# Phase 48: Contract & Payment - Validation Strategy

**Phase:** 48-contract-payment
**Created:** 2026-04-30
**Source:** Extracted from 48-RESEARCH.md Validation Architecture section

## Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 |
| Config file | vitest.config.ts |
| Quick run command | `npm test` |
| Full suite command | `npm run test:ci` |

## Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| Payment before onboarding | Contract status must be "paid" before onboarding checklist creation | integration | `npm test src/server/features/contracts/services/ContractService.test.ts` | Wave 1 creates |
| Invoice payment webhook | invoice.payment_succeeded updates contract status to "paid" | unit | `npm test src/server/features/invoices/services/StripeService.test.ts` | Wave 3 creates |
| Dokobit webhook | Signed contract triggers invoice creation | integration | `npm test src/server/features/webhooks/dokobit-webhook.test.ts` | Wave 2 creates |
| State machine transitions | Invalid transitions throw CONFLICT error | unit | `npm test src/server/features/contracts/services/ContractService.test.ts` | Wave 1 creates |

## Sampling Rate

- **Per task commit:** `npm test` (quick subset of changed modules)
- **Per wave merge:** `npm run test:ci` (full suite with client tests)
- **Phase gate:** Full suite green before `/gsd-verify-work`

## Test Files Created by Plan

| Plan | Test Files |
|------|------------|
| 48-01 | `ContractService.test.ts`, `ContractPdfGenerator.test.ts`, `DokobitService.test.ts` |
| 48-02 | `dokobit-webhook.test.ts` (implicit via webhook-utils) |
| 48-03 | `StripeService.test.ts`, `InvoiceService.test.ts`, `stripe-webhook.test.ts` |
| 48-04 | `OnboardingService.test.ts` |

## Verification Commands

### Wave 1 (Plan 48-01)
```bash
cd open-seo-main && npm test -- --run src/server/features/contracts/services/
```

### Wave 2 (Plan 48-02)
```bash
cd open-seo-main && npm test -- --run src/server/features/contracts/
cd apps/web && npx tsc --noEmit
```

### Wave 3 (Plan 48-03)
```bash
cd open-seo-main && npm test -- --run src/server/features/invoices/
```

### Wave 4 (Plan 48-04)
```bash
cd open-seo-main && npm test -- --run src/server/features/onboarding/
```

### Full Phase Verification
```bash
cd open-seo-main && npm run test:ci
cd apps/web && npm run build
```

## Critical Assertions

1. **State Machine Integrity**
   - `canTransition("draft", "signed")` returns `false`
   - `canTransition("sent", "signed")` returns `true`
   - `canTransition("signed", "paid")` returns `true`
   - `canTransition("paid", "active")` returns `true`

2. **Payment Gate**
   - `OnboardingService.createFromContract()` throws when `contract.status !== "paid"`
   - Invoice creation only happens when `contract.status === "signed"`

3. **Webhook Security**
   - Dokobit webhook rejects non-whitelisted IPs
   - Stripe webhook rejects invalid signatures
   - Both webhooks process idempotently (duplicate events ignored)

4. **UI Verification**
   - ContractTable displays all contract statuses with correct badges
   - SignatureStatus shows signing progress
   - PaymentStatus shows invoice state and payment link

## End-to-End Flow Test

Manual verification required (Plan 48-04 checkpoint):

1. Create contract from accepted proposal
2. Send contract for signing (Dokobit)
3. Complete signing (webhook or manual)
4. Verify invoice created automatically
5. Complete payment (Stripe test card)
6. Verify onboarding checklist created
7. Verify contract status is "active"

## Coverage Targets

| Module | Target | Notes |
|--------|--------|-------|
| ContractService | 80%+ | State machine, lifecycle methods |
| InvoiceService | 80%+ | Stripe integration, webhook handling |
| OnboardingService | 80%+ | Payment gate enforcement |
| Webhook handlers | 70%+ | Security, idempotency |
| UI components | 60%+ | TypeScript compilation sufficient |
