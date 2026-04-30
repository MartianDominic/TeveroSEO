---
phase: 54
plan: 2
subsystem: payments
tags: [revolut, payment-provider, api-client, webhooks]
dependency_graph:
  requires: [54-01]
  provides: [revolut-provider, revolut-client]
  affects: [payment-factory, invoice-payments]
tech_stack:
  added: []
  patterns: [factory-pattern, typed-api-client, hmac-verification]
key_files:
  created:
    - open-seo-main/src/server/features/payments/providers/RevolutProvider.ts
    - open-seo-main/src/server/features/payments/providers/revolut-client.ts
    - open-seo-main/src/server/features/payments/providers/RevolutProvider.test.ts
  modified: []
decisions:
  - "process.env.APP_URL for optional env var (no getRuntimeEnv function exists)"
  - "Sandbox detection via sk_sandbox_ key prefix"
  - "Timing-safe comparison with length check before crypto.timingSafeEqual"
metrics:
  duration: "15 minutes"
  completed: "2026-04-30T17:12:00Z"
---

# Phase 54 Plan 02: RevolutProvider Implementation Summary

Full Revolut Merchant API integration implementing PaymentProvider interface.

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1-4 | RevolutProvider + Client + Tests | cfe34c496 | 3 files created |

## Implementation Details

### RevolutProvider Class

- Constructor accepts `ProviderCredentials` with `revolutApiKey` and optional `revolutWebhookSecret`
- Auto-detects sandbox mode from `sk_sandbox_` key prefix
- Base URL switching between sandbox and production endpoints

### API Methods

1. **createPaymentSession(invoice)**: Creates Revolut order via POST /api/orders
   - Returns `PaymentSession` with `externalId`, `paymentUrl`, `token`
   - Includes invoice metadata for webhook correlation

2. **verifyWebhook(rawBody, headers)**: HMAC-SHA256 verification
   - Extracts `Revolut-Signature` and `Revolut-Request-Timestamp` headers
   - Computes signature: `v1.{timestamp}.{rawBody}`
   - Timing-safe comparison with length check

3. **getPaymentStatus(orderId)**: GET /api/orders/{orderId}
   - Maps Revolut states: pending, processing, authorised, completed, cancelled, failed
   - Extracts paid amount from captured payments array

### Revolut API Client

- Typed fetch wrapper with auth headers (`Authorization: Bearer {key}`)
- API version header: `Revolut-Api-Version: 2024-09-01`
- Rate limiting awareness (429 handling with `RevolutRateLimitError`)
- Full TypeScript types for `RevolutOrder`, `RevolutPayment`, `RevolutCustomer`

### Unit Tests

17 tests covering:
- Constructor validation (missing API key)
- Sandbox mode detection
- Payment session creation (success and failure)
- Webhook signature verification (valid, invalid, missing headers)
- Payment status mapping for all Revolut states
- Rate limit error handling

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- [x] RevolutProvider.ts exists
- [x] revolut-client.ts exists
- [x] RevolutProvider.test.ts exists
- [x] Commit cfe34c496 verified
- [x] 17 tests passing
