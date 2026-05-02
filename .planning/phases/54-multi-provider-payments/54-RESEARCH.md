# Phase 54: Multi-Provider Payments - Research

**Completed:** 2026-04-30
**Source:** Revolut Developer Documentation (Context7), existing codebase analysis

## Revolut Merchant API Summary

### Authentication
- Sandbox: `https://sandbox-merchant.revolut.com/api`
- Production: `https://merchant.revolut.com/api`
- Header: `Authorization: Bearer <secret_key>`
- Version: `Revolut-Api-Version: 2024-09-01`

### Create Order
```
POST /api/orders
{
  "amount": 250000,        // Minor units (cents)
  "currency": "EUR",
  "description": "Invoice description",
  "capture_mode": "automatic",
  "customer": { "email": "...", "full_name": "..." },
  "metadata": { "invoice_id": "..." },
  "redirect_url": "https://..."
}

Response: { id, token, checkout_url, state: "pending" }
```

### Webhook Signature Verification
```
Headers: Revolut-Request-Timestamp, Revolut-Signature (v1=<hex>)
Payload: v1.{timestamp}.{rawBody}
Algorithm: HMAC-SHA256
Tolerance: 5 minutes for replay protection
```

### Events
| Event | Trigger | Action |
|-------|---------|--------|
| ORDER_COMPLETED | Payment successful | Mark invoice paid |
| ORDER_CANCELLED | User cancelled | Log activity |
| ORDER_PAYMENT_DECLINED | Card declined | Log, notify |

### Payment Methods
- Cards (Visa, Mastercard, Amex)
- Apple Pay, Google Pay (via RevolutCheckout widget)
- Revolut Pay (one-click for Revolut users)
- SEPA bank transfers

## Existing Infrastructure

### Current Stripe Flow
1. InvoiceService.sendToClient() calls StripeService.createInvoice()
2. Stripe returns hosted_invoice_url
3. Client pays via Stripe hosted page
4. Webhook /api/webhooks/stripe receives invoice.paid
5. InvoiceService.handlePaymentSuccess() updates invoice + contract

### Schema (invoice-schema.ts)
- stripeInvoiceId, stripePaymentIntentId, stripePaymentUrl columns exist
- Need parallel: revolutOrderId, revolutCheckoutUrl
- Need: payment_provider column to track which was used

## Design Decision: Strategy Pattern

```typescript
interface PaymentProvider {
  createPaymentSession(invoice): Promise<PaymentSession>;
  verifyWebhook(rawBody, headers): WebhookEvent;
  getPaymentStatus(externalId): Promise<PaymentStatus>;
}

// Factory selects based on workspace settings
const provider = await PaymentProviderFactory.getProvider(workspaceId, preferredProvider);
```

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Revolut API changes | Low | Medium | Pin API version header |
| Webhook failures | Medium | High | Retry logic, dead-letter logging |
| Credential exposure | Low | Critical | Encryption at rest, audit logging |

## Estimated Complexity
- Schema changes: Low
- Provider abstraction: Medium
- Revolut implementation: Medium
- UI changes: Medium
- Testing: Medium

**Total: 34-44 hours across 5 plans**
