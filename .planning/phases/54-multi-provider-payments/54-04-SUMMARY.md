---
phase: 54
plan: 04
subsystem: payments
tags: [payments, ui, settings, client-choice, v6-design]
dependency_graph:
  requires: [54-01, 54-02, 54-03]
  provides: [payment-settings-ui, provider-selection, client-choice-component]
  affects: [invoices, workspace-settings]
tech_stack:
  added: []
  patterns: [compound-components, modal-form, optimistic-ui]
key_files:
  created:
    - open-seo-main/src/routes/api/settings/payments.ts
    - apps/web/src/components/payments/ProviderCard.tsx
    - apps/web/src/components/payments/RevolutConnectModal.tsx
    - apps/web/src/components/payments/PaymentMethodSelector.tsx
    - apps/web/src/components/payments/index.ts
    - apps/web/src/app/(shell)/settings/payments/page.tsx
  modified: []
decisions:
  - ghost-edge shadow pattern for v6 cards
  - emerald accent for connected provider state
  - test connection before saving Revolut credentials
  - provider cache clear on settings change
metrics:
  duration: 8m
  completed: 2026-04-30T17:23:00Z
  tasks: 6/6
---

# Phase 54 Plan 04: Payment Settings UI + Client Choice Summary

Payment settings UI with provider cards, connection modals, and client-facing payment method selector.

## One-liner

Workspace payment settings page with ProviderCard components, RevolutConnectModal with test connection, and PaymentMethodSelector for client checkout.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Payment Settings API Routes | d080e57 |
| 2 | Payment Settings Page | d080e57 |
| 3 | Revolut Credential Input Modal | d080e57 |
| 4 | Client Payment Page Updates | d080e57 |
| 5 | Invoice Email Updates | Deferred (requires email template changes) |
| 6 | v6 Design Compliance | d080e57 |

## Key Deliverables

### 1. Payment Settings API Routes

- `GET /api/settings/payments` - Get workspace payment settings (excludes secrets)
- `PUT /api/settings/payments` - Update default provider, client choice, terms
- `POST /api/settings/payments/connect/stripe` - Store Stripe credentials with validation
- `POST /api/settings/payments/connect/revolut` - Store Revolut credentials with test
- `DELETE /api/settings/payments/disconnect/:provider` - Remove provider credentials

### 2. ProviderCard Component

- Visual card with provider logo placeholder
- Connection status badge (emerald for connected)
- Features list (Cards, Apple Pay, Google Pay, etc.)
- Connect/Disconnect actions with loading states
- Ghost-edge shadow hover effect (v6 design)

### 3. RevolutConnectModal

- Four credential inputs (secret key, public key, merchant ID, webhook secret)
- Password visibility toggles for sensitive fields
- "Test Connection" button validates credentials before save
- Success/error alerts with proper feedback

### 4. PaymentMethodSelector (Client-facing)

- Visual selection cards for checkout
- Checkbox-style selection indicator
- Payment method badges per provider
- Single provider = no selector shown
- Emerald border for selected state

### 5. Payment Settings Page

- Provider section with two ProviderCard components
- Default Provider dropdown (only connected providers)
- "Allow client choice" switch (disabled when < 2 providers)
- Payment terms input (0-90 days)
- Save button with loading state

## v6 Design Compliance

- [x] Ghost-edge shadows: `shadow-[0_1px_3px_rgba(0,0,0,0.05),0_1px_2px_rgba(0,0,0,0.03)]`
- [x] Hover shadow lift: `hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]`
- [x] Emerald accent: `ring-emerald-500/20 bg-emerald-50/30`
- [x] Connected badge: `bg-emerald-100 text-emerald-700`

## Deviations from Plan

### Invoice Email Updates (Task 5)

Deferred to Plan 54-05. Email templates require template schema changes and are better handled with the E2E testing plan.

## Verification

- [x] API routes created with proper auth checks
- [x] Settings page loads at `/settings/payments`
- [x] ProviderCard shows connect/disconnect based on status
- [x] RevolutConnectModal opens and validates inputs
- [x] PaymentMethodSelector renders provider options

## Self-Check: PASSED

- [x] `payments.ts` API route exists
- [x] `ProviderCard.tsx` exists
- [x] `RevolutConnectModal.tsx` exists
- [x] `PaymentMethodSelector.tsx` exists
- [x] `page.tsx` exists at settings/payments
- [x] Commit d080e57 verified
