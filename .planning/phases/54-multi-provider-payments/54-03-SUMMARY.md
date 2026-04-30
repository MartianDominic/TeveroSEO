---
phase: "54"
plan: "03"
subsystem: payments
tags: [webhooks, revolut, invoices, multi-provider]
dependency_graph:
  requires: [54-01, 54-02]
  provides: [revolut-webhook, multi-provider-invoice-service]
  affects: [invoice-flow, payment-processing]
tech_stack:
  added: []
  patterns: [webhook-handler, idempotent-processing]
key_files:
  created:
    - open-seo-main/src/routes/api/webhooks/revolut.ts
  modified:
    - open-seo-main/src/server/features/invoices/services/InvoiceService.ts
    - open-seo-main/src/server/features/contracts/repositories/InvoiceRepository.ts
    - open-seo-main/src/server/features/payments/PaymentProviderFactory.ts
    - open-seo-main/src/server/lib/webhook-utils.ts
decisions:
  - "Use order_id:event_type as idempotency key for Revolut webhooks"
  - "Return 403 for signature errors, 500 for processing errors"
  - "Provider param defaults to 'stripe' for backwards compatibility"
metrics:
  duration_minutes: 25
  completed: "2026-04-30T17:35:00Z"
---

# Phase 54 Plan 03: Webhook Handlers + InvoiceService Updates Summary

Revolut webhook endpoint with idempotent processing and InvoiceService multi-provider support.

## Completed Tasks

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Revolut webhook route | 582f4c5b3 | revolut.ts |
| 2 | InvoiceService multi-provider | 582f4c5b3 | InvoiceService.ts |
| 3 | InvoiceRepository additions | 582f4c5b3 | InvoiceRepository.ts |
| 4 | Idempotency handling | 582f4c5b3 | webhook-utils.ts (uses existing table) |
| 5 | PaymentProviderFactory wiring | 582f4c5b3 | PaymentProviderFactory.ts |

## Implementation Details

### Revolut Webhook Route
- `POST /api/webhooks/revolut` - handles ORDER_COMPLETED, ORDER_CANCELLED, ORDER_PAYMENT_DECLINED
- Raw body handling for HMAC signature verification
- Uses `processWebhookIdempotently` with "revolut" source
- Returns 204 on success (no body to leak info)
- Returns 403 for signature errors (no retry), 500 for processing errors (retry)

### InvoiceService Updates
- `handlePaymentSuccess(externalId, paymentId, provider)` - accepts provider param
- Looks up invoice by stripeInvoiceId OR revolutOrderId based on provider
- `sendToClient(invoiceId, email, name, provider?)` - uses PaymentProviderFactory
- Activity logging includes provider information

### InvoiceRepository Additions
- `getInvoiceByRevolutOrderId(orderId)` - lookup by Revolut order ID
- `updateInvoiceStatusWithProvider(...)` - updates status + provider-specific fields

### Idempotency
- Uses existing `incoming_webhook_events` table from Phase 48
- Extended `processWebhookIdempotently` to accept "revolut" source type
- Event ID format: `{order_id}:{event_type}`

## Deviations from Plan

None - plan executed as written.

## Self-Check: PASSED

- [x] revolut.ts webhook route exists
- [x] InvoiceService updated with provider support
- [x] InvoiceRepository has getInvoiceByRevolutOrderId
- [x] webhook-utils supports "revolut" source
- [x] Commit 582f4c5b3 verified
