# Phase 54: Multi-Provider Payments - Context

**Gathered:** 2026-04-30
**Status:** Ready for execution

<domain>
## Phase Boundary

Extend Phase 48's Stripe-only payment integration to support multiple providers (Stripe + Revolut). Agencies choose which provider(s) prospects/clients see at checkout.

</domain>

<decisions>
## Implementation Decisions

### Provider Architecture
- **D-01:** Strategy pattern with PaymentProvider interface
- **D-02:** PaymentProviderFactory selects provider based on workspace settings
- **D-03:** StripeProvider wraps existing StripeService logic
- **D-04:** RevolutProvider implements Revolut Merchant API

### Revolut Integration
- **D-05:** Use Revolut Merchant API (POST /api/orders → checkout_url)
- **D-06:** Webhook verification via HMAC-SHA256 with Revolut-Signature header
- **D-07:** Events: ORDER_COMPLETED triggers invoice paid flow
- **D-08:** Support cards, Apple Pay, Google Pay, Revolut Pay

### Multi-Tenant Settings
- **D-09:** workspace_payment_settings table stores per-workspace config
- **D-10:** Credentials encrypted at rest (AES-256-GCM)
- **D-11:** allowClientChoice flag enables client provider selection at checkout
- **D-12:** defaultProvider used when client choice disabled

### Schema Extensions
- **D-13:** invoices table: add payment_provider, revolut_order_id, revolut_checkout_url
- **D-14:** Constraint ensures exactly one provider's external ID set when sent

### Claude's Discretion
- Rate limiting implementation for Revolut API
- Error retry patterns for webhook failures
- UI component styling details
- Test data setup for sandbox

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

| File | What it provides |
|------|------------------|
| `.planning/phases/54-multi-provider-payments/DESIGN.md` | Full architecture, API details, schema |
| `open-seo-main/src/server/features/invoices/services/StripeService.ts` | Existing Stripe integration pattern |
| `open-seo-main/src/server/features/invoices/services/InvoiceService.ts` | Invoice lifecycle management |
| `open-seo-main/src/db/invoice-schema.ts` | Current invoice schema |

</canonical_refs>

<existing_patterns>
## Existing Patterns to Follow

- Stripe webhook verification in StripeService.verifyWebhook()
- Invoice status transitions in InvoiceService
- Activity logging via ActivityRepository
- Workspace-scoped data patterns (workspaceId filtering)

</existing_patterns>
