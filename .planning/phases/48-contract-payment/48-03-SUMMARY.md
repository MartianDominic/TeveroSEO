---
phase: 48-contract-payment
plan: 03
subsystem: invoice-payment
tags: [stripe, invoices, payment-webhook, ui-components]
dependencies:
  requires: [contract-schema, ContractService, StripeService]
  provides: [InvoiceService, StripeWebhook, PaymentStatus]
  affects: [contract-lifecycle, payment-pipeline]
tech-stack:
  added: []
  patterns: [stripe-webhooks, idempotent-processing, badge-status-ui, TDD-cycle]
key-files:
  created:
    - open-seo-main/src/server/features/invoices/services/StripeService.ts
    - open-seo-main/src/server/features/invoices/services/StripeService.test.ts
    - open-seo-main/src/server/features/invoices/services/InvoiceService.ts
    - open-seo-main/src/server/features/invoices/services/InvoiceService.test.ts
    - open-seo-main/src/routes/api/webhooks/stripe.ts
    - open-seo-main/src/routes/api/invoices/$id.-payment-link.ts
    - apps/web/src/app/(shell)/prospects/[prospectId]/contracts/components/PaymentStatus.tsx
  modified:
    - open-seo-main/src/server/lib/runtime-env.ts
    - open-seo-main/src/server/features/contracts/services/ContractService.ts
    - apps/web/src/app/(shell)/prospects/[prospectId]/contracts/actions.ts
decisions:
  - id: D-48-03-01
    choice: Use TDD workflow for InvoiceService
    rationale: Complex business logic with multiple state transitions benefits from test-first approach
  - id: D-48-03-02
    choice: Contract transitions to executed (not paid) after payment
    rationale: executed status better represents active contract state per existing state machine
  - id: D-48-03-03
    choice: Use dynamic import for InvoiceService in ContractService
    rationale: Avoids circular dependency and keeps invoice creation non-blocking for signing flow
metrics:
  duration_seconds: 626
  tasks_completed: 4
  files_created: 7
  files_modified: 3
  tests_added: 17
  lines_added: 1400
completed_at: "2026-04-30T11:34:09Z"
---

# Phase 48 Plan 03: Invoice & Payment Integration Summary

Invoice generation from signed contracts with Stripe integration, webhook handling, and payment status UI.

## One-liner

Automatic invoice creation after contract signing, Stripe payment processing with webhook verification, and v6-compliant PaymentStatus UI component.

## What Was Built

### Services

**StripeService** - Stripe API integration
- `createInvoice(input)` - creates Stripe invoice with setup + monthly line items
- `verifyWebhook(rawBody, signature)` - validates webhook signatures using raw body
- `getOrCreateCustomer(email, name, clientId)` - reuses existing customers by metadata
- 9 tests covering success paths, error handling, and idempotency

**InvoiceService** - Invoice lifecycle management (TDD)
- `createFromContract(contractId, workspaceId)` - generates invoice from signed contract
- `sendToClient(invoiceId, email, name)` - creates Stripe invoice and updates status to sent
- `handlePaymentSuccess(stripeInvoiceId, paymentIntentId)` - processes payment webhook
- Calculates line items from proposal setupFeeCents and monthlyFeeCents
- Updates contract status to executed after payment
- Idempotent payment handling (skips if already paid)
- 8 tests (TDD: RED → GREEN)

### API Routes

**POST /api/webhooks/stripe** - Stripe webhook endpoint
- Signature verification using raw body (stripe.webhooks.constructEvent)
- Idempotent processing via `processWebhookIdempotently`
- Handles `invoice.payment_succeeded` → triggers InvoiceService.handlePaymentSuccess
- Logs `invoice.payment_failed` and `invoice.finalized` events
- Returns 400 for signature errors (no retry), 500 for processing errors (retry)

**GET /api/invoices/:id/payment-link** - Payment URL retrieval
- Requires authentication and workspace ownership
- Returns Stripe hosted_invoice_url for client payment
- 404 if invoice not found or payment link unavailable

### Frontend Components

**PaymentStatus** - Invoice status display (v6 design)
- Badge variants: outline (draft), secondary (sent), default (paid), destructive (overdue/cancelled)
- Icons: Clock, CreditCard, CheckCircle, AlertCircle
- Lithuanian labels: "Ruošiama", "Laukiama apmokėjimo", "Apmokėta", etc.
- Displays "Apmokėti" button with external link for unpaid invoices
- Shows paid date for completed payments
- Currency formatting via Intl.NumberFormat("lt-LT")

**contracts/actions.ts** - Added invoice integration
- `getInvoiceByContract(contractId)` - fetches invoice for contract
- `InvoiceSummary` interface with status, totalCents, stripePaymentUrl, paidAt

## Deviations from Plan

### Auto-fix (Rule 2)

**1. Added STRIPE_PUBLISHABLE_KEY to runtime-env.ts**
- Found during: Task 1
- Issue: Plan specified adding env vars but STRIPE_PUBLISHABLE_KEY was missing
- Fix: Added OPTIONAL_ENV_STRIPE constant with STRIPE_PUBLISHABLE_KEY
- Rationale: Publishable key needed for client-side Stripe components

**2. Fixed import path for InvoiceRepository**
- Found during: Task 2 (GREEN phase)
- Issue: TypeScript error - module not found at `../repositories/InvoiceRepository`
- Fix: Changed to `../../contracts/repositories/InvoiceRepository`
- Rationale: InvoiceRepository lives in contracts feature directory per Phase 45 structure

**3. Contract transitions to executed (not paid) after payment**
- Found during: Task 2 implementation
- Issue: Plan spec said "update contract status to paid" but contract schema doesn't have "paid" status
- Fix: Transition signed → executed after payment
- Rationale: Per contract-schema.ts, valid statuses are draft/sent/signed/executed/expired/cancelled; executed represents paid active contracts

**4. Used dynamic import for InvoiceService in ContractService**
- Found during: Task 2 integration
- Issue: Direct import would create circular dependency (ContractService → InvoiceService → db/contracts)
- Fix: Use `await import("../../invoices/services/InvoiceService")` with try/catch
- Rationale: Keeps invoice creation non-blocking; signing flow succeeds even if invoice creation fails

**5. Fixed Stripe API version**
- Found during: Task 3 TypeScript check
- Issue: Type error - "2024-12-18.acacia" not assignable to "2026-03-25.dahlia"
- Fix: Updated to Stripe API version "2026-03-25.dahlia"
- Rationale: Match installed stripe package version

**6. Fixed error logging format**
- Found during: Task 3 TypeScript check
- Issue: Logger expects Error object, not `{ error }` object literal
- Fix: Changed to `error instanceof Error ? error : new Error(String(error))`
- Rationale: Consistent with codebase logging patterns

TDD workflow followed for Task 2:
- RED: Created 8 failing tests for InvoiceService
- GREEN: Implemented InvoiceService to pass all tests
- REFACTOR: N/A (implementation clean from start)

## Key Architectural Patterns

**Automatic Invoice Creation on Signing**
```typescript
// ContractService.handleSigningComplete
try {
  const { InvoiceService } = await import("../../invoices/services/InvoiceService");
  await InvoiceService.createFromContract(contract.id, contract.workspaceId);
} catch (error) {
  log.error("Failed to create invoice from contract", error);
  // Don't fail the signing flow, invoice can be created manually
}
```

**Stripe Webhook Signature Verification**
```typescript
const rawBody = Buffer.from(await request.arrayBuffer());
const event = StripeService.verifyWebhook(rawBody, signature);
// Process event only after verification
```

**Idempotent Payment Processing**
```typescript
if (invoice.status === "paid") {
  log.info("Invoice already paid, skipping", { invoiceId: invoice.id });
  return; // Idempotent
}
// Update invoice and contract
```

**Line Item Calculation from Proposal**
```typescript
const lineItems: InvoiceLineItem[] = [];
if (setupFeeCents > 0) {
  lineItems.push({
    id: nanoid(),
    description: "SEO Setup Fee / SEO pradinis mokestis",
    quantity: 1,
    unitPriceCents: setupFeeCents,
    totalCents: setupFeeCents,
  });
}
```

## Testing Summary

| Test File | Tests | Coverage |
|-----------|-------|----------|
| StripeService.test.ts | 9 | createInvoice (4), verifyWebhook (3), getOrCreateCustomer (2) |
| InvoiceService.test.ts | 8 | createFromContract (3), sendToClient (2), handlePaymentSuccess (3) |

**Total:** 17 tests, all passing

**TDD Compliance:** InvoiceService followed RED → GREEN → REFACTOR cycle

## Integration Points

**Upstream (Inputs)**
- ContractService from Plan 48-01 (handleSigningComplete triggers invoice creation)
- InvoiceRepository from Phase 45 (CRUD operations)
- ActivityRepository from Phase 45 (status change logging)
- StripeService from this plan (invoice creation, webhook verification)

**Downstream (Outputs)**
- Invoice status "paid" triggers contract status "executed"
- PaymentStatus component consumed by contracts UI
- Stripe webhook updates flow to onboarding pipeline (future)

## Known Limitations

1. **No invoice list endpoint** - PaymentStatus component fetches invoice via getInvoiceByContract but there's no `/api/invoices` endpoint yet. Should add invoice listing API.

2. **Hardcoded invoice defaults** - If no proposal found, defaults to €2500 setup + €1500 monthly. Should fetch from workspace pricing settings.

3. **No invoice.payment_failed handling** - Webhook logs the event but doesn't update invoice status to "overdue" or send notifications.

4. **No customer portal link** - Clients can pay via hosted_invoice_url but can't manage payment methods or view history.

5. **No tax calculation** - Tax is hardcoded to 0 cents. Should integrate Stripe Tax or implement VAT rules.

6. **Manual invoice sending** - InvoiceService.sendToClient exists but no UI/API endpoint to trigger it. Invoices are created in draft status but not automatically sent.

## Security Considerations

**Mitigations Implemented:**
- T-48-11: Stripe webhook signature verification via stripe.webhooks.constructEvent (mitigated)
- T-48-12: Raw body used for signature verification before JSON parsing (mitigated)
- T-48-13: STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in env vars, never logged (mitigated)
- T-48-14: Stripe provides payment receipts; activity log records all status changes (mitigated)
- T-48-15: Amounts calculated from proposal fees (database), not user input (mitigated)

**Additional Security:**
- Idempotent webhook processing prevents duplicate payments
- Workspace scoping on all invoice queries
- Authentication required for payment link endpoint

## Next Steps (Post-Phase 48)

1. Add `/api/invoices` list endpoint with workspace filtering
2. Create invoice send UI in contracts page (trigger InvoiceService.sendToClient)
3. Implement invoice.payment_failed webhook handler (update status, send notification)
4. Add Stripe Customer Portal integration for payment method management
5. Integrate Stripe Tax for automated VAT calculation
6. Add invoice PDF generation for email attachments

## Self-Check: PASSED

**Files Created:**
- ✓ StripeService.ts exists
- ✓ StripeService.test.ts exists
- ✓ InvoiceService.ts exists
- ✓ InvoiceService.test.ts exists
- ✓ stripe.ts webhook handler exists
- ✓ payment-link.ts route exists
- ✓ PaymentStatus.tsx exists

**Commits:**
- ✓ 92ae6cc - feat(48-03): add StripeService for invoice creation and webhook verification
- ✓ 047baeb - feat(48-03): implement InvoiceService with contract integration (TDD)
- ✓ 86e89ed - feat(48-03): create Stripe webhook handler with idempotent processing
- ✓ aaedb71 - feat(48-03): create PaymentStatus UI component and payment link route

**Tests:**
- ✓ StripeService: 9/9 passing
- ✓ InvoiceService: 8/8 passing
- ✓ Total: 17/17 passing
- ✓ TDD cycle completed (RED → GREEN)

**TypeScript:**
- ✓ No compilation errors
- ✓ All imports resolved correctly
