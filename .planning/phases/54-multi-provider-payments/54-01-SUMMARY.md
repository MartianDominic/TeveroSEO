---
phase: 54
plan: 01
subsystem: payments
tags: [payments, stripe, encryption, multi-provider, factory-pattern]
dependency_graph:
  requires: [48-payment-integration]
  provides: [payment-provider-interface, workspace-payment-settings, credential-encryption]
  affects: [invoices, contracts]
tech_stack:
  added: [aes-256-gcm]
  patterns: [factory-pattern, repository-pattern, interface-abstraction]
key_files:
  created:
    - open-seo-main/src/db/workspace-payment-settings-schema.ts
    - open-seo-main/drizzle/0054_multi_provider_payments.sql
    - open-seo-main/src/server/lib/encryption.ts
    - open-seo-main/src/server/lib/encryption.test.ts
    - open-seo-main/src/server/features/payments/types.ts
    - open-seo-main/src/server/features/payments/PaymentProviderFactory.ts
    - open-seo-main/src/server/features/payments/providers/StripeProvider.ts
    - open-seo-main/src/server/features/payments/repositories/WorkspacePaymentSettingsRepository.ts
    - open-seo-main/src/server/features/payments/index.ts
  modified:
    - open-seo-main/src/db/invoice-schema.ts
    - open-seo-main/src/db/schema.ts
    - open-seo-main/src/server/features/invoices/services/StripeService.ts
decisions:
  - AES-256-GCM for credential encryption with random IV per operation
  - Factory pattern with provider caching per workspace
  - Stripe env var fallback for backwards compatibility
  - StripeService kept as deprecated wrapper
metrics:
  duration: 8m
  completed: 2026-04-30T17:08:00Z
  tasks: 5/5
  tests: 19 passing
---

# Phase 54 Plan 01: Schema + Provider Abstraction Summary

Multi-provider payment foundation with encrypted credentials and StripeProvider implementing PaymentProvider interface.

## One-liner

AES-256-GCM encrypted workspace payment settings with PaymentProvider interface and StripeProvider implementation.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Database Schema | 05ee032 |
| 2 | Credential Encryption Utilities | 10bd4d7 |
| 3 | PaymentProvider Interface | 279194d |
| 4 | PaymentProviderFactory + Repository | c35d232 |
| 5 | StripeProvider Implementation | b881281 |

## Key Deliverables

### 1. Database Schema

- `workspace_payment_settings` table with encrypted credential columns
- Extended `invoices` table with `payment_provider`, `revolut_order_id`, `revolut_checkout_url`
- CHECK constraints for provider validation at DB level
- Migration file: `0054_multi_provider_payments.sql`

### 2. Credential Encryption

- `encryptCredential()` / `decryptCredential()` using AES-256-GCM
- Random 12-byte IV per encryption operation
- 16-byte auth tag for tamper detection
- `PAYMENT_ENCRYPTION_KEY` env var (base64 32-byte key)
- 19 unit tests passing

### 3. PaymentProvider Interface

```typescript
interface PaymentProvider {
  providerType: PaymentProviderType;
  createPaymentSession(invoice: InvoiceSelect): Promise<PaymentSession>;
  verifyWebhook(rawBody: Buffer, headers: Headers): WebhookEvent;
  getPaymentStatus(externalId: string): Promise<PaymentStatusResult>;
}
```

Custom error classes: `PaymentProviderNotConfiguredError`, `PaymentSessionError`, `WebhookVerificationError`.

### 4. PaymentProviderFactory

- `getProvider(options)` - Returns cached provider instance
- `getAvailableProviders(workspaceId)` - Lists enabled providers
- `clearProviderCache(workspaceId)` - Invalidates cache on config change
- Falls back to Stripe env vars if workspace settings not configured

### 5. WorkspacePaymentSettingsRepository

- `getByWorkspaceId()` - Returns decrypted settings
- `upsert()` - Encrypts credentials before storage
- `deleteByWorkspaceId()` - Removes workspace settings
- `isProviderEnabled()` - Quick check for provider availability

### 6. StripeProvider

- Implements `PaymentProvider` interface
- Creates Stripe invoices with line items
- Verifies webhook signatures
- Maps Stripe status to `PaymentStatus` enum
- Existing `StripeService` marked deprecated but kept for backwards compatibility

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- [x] Migration file created: `0054_multi_provider_payments.sql`
- [x] Encryption tests pass: 19/19
- [x] TypeScript compiles without errors in payments module
- [x] All 5 tasks completed and committed

## Dependencies for Next Plans

Plan 54-02 (Revolut Provider) can now:
- Implement `RevolutProvider` using the same `PaymentProvider` interface
- Use `WorkspacePaymentSettingsRepository` for credential retrieval
- Register with `PaymentProviderFactory`

## Self-Check: PASSED

- [x] `workspace-payment-settings-schema.ts` exists
- [x] `encryption.ts` exists
- [x] `types.ts` exists
- [x] `PaymentProviderFactory.ts` exists
- [x] `StripeProvider.ts` exists
- [x] All 5 commits verified in git log
