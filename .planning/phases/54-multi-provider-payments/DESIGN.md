# Phase 54: Multi-Provider Payment System

## Overview

Extend Phase 48's Stripe-only payment integration to support multiple payment providers with workspace-level configuration. Agencies can choose which provider(s) their prospects/clients see during checkout.

## Goals

1. **Provider Abstraction** — Strategy pattern enabling plug-and-play payment providers
2. **Revolut Integration** — Full Revolut Merchant API integration parallel to Stripe
3. **Provider Selection** — Workspace settings control which provider(s) appear at checkout
4. **Unified Experience** — Same invoice flow regardless of provider chosen

## Architecture

### Payment Provider Strategy Pattern

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        PaymentProviderInterface                          │
├─────────────────────────────────────────────────────────────────────────┤
│  + createPaymentSession(invoice): PaymentSession                        │
│  + verifyWebhook(payload, signature): WebhookEvent                      │
│  + getPaymentStatus(externalId): PaymentStatus                          │
│  + refund(externalId, amountCents): RefundResult                        │
│  + getCustomerPortalUrl(customerId): string                             │
└─────────────────────────────────────────────────────────────────────────┘
                    ▲                              ▲
                    │                              │
        ┌───────────┴───────────┐      ┌──────────┴──────────┐
        │    StripeProvider     │      │   RevolutProvider   │
        │    (existing logic)   │      │   (new)             │
        └───────────────────────┘      └─────────────────────┘
```

### Data Flow

```
Invoice Created → Select Provider → Create Payment Session → Client Pays → Webhook → Invoice Paid
       │                │                    │                    │            │           │
       ▼                ▼                    ▼                    ▼            ▼           ▼
  invoice.id    workspace_payment    stripe: hosted_url     Stripe UI    /webhooks/   InvoiceService
                   _settings         revolut: checkout_url  Revolut UI    stripe/     .handlePayment
                                                                          revolut/     Success()
```

## Revolut Merchant API Integration

### Authentication
- **Sandbox**: `https://sandbox-merchant.revolut.com/api`
- **Production**: `https://merchant.revolut.com/api`
- **Auth**: `Authorization: Bearer <REVOLUT_SECRET_KEY>`
- **Version Header**: `Revolut-Api-Version: 2024-09-01`

### Create Order (Payment Session)
```typescript
POST /api/orders
{
  "amount": 250000,           // Minor units (cents)
  "currency": "EUR",
  "description": "SEO Services - Invoice INV-2026-ABC123",
  "capture_mode": "automatic",
  "customer": {
    "email": "client@example.com",
    "full_name": "Client Name"
  },
  "metadata": {
    "invoice_id": "inv_abc123",
    "workspace_id": "ws_xyz789"
  },
  "redirect_url": "https://app.tevero.lt/invoices/{invoiceId}/success"
}

Response:
{
  "id": "6516e61c-d279-a454-a837-bc52ce55ed49",
  "token": "0adc0e3c-ab44-4f33-bcc0-534ded7354ce",
  "state": "pending",
  "checkout_url": "https://checkout.revolut.com/payment-link/0adc0e3c-...",
  "amount": 250000,
  "currency": "EUR"
}
```

### Webhook Events
| Event | Trigger | Action |
|-------|---------|--------|
| `ORDER_COMPLETED` | Payment successful | Mark invoice paid, trigger onboarding |
| `ORDER_CANCELLED` | Payment cancelled | Log activity, no status change |
| `ORDER_PAYMENT_DECLINED` | Card declined | Log activity, notify client |

### Webhook Signature Verification
```typescript
// Headers: Revolut-Request-Timestamp, Revolut-Signature
// Signature format: v1=<hex_hmac_sha256>

const payload_to_sign = `v1.${timestamp}.${rawBody}`;
const expected = crypto
  .createHmac('sha256', webhookSecret)
  .update(payload_to_sign)
  .digest('hex');
const isValid = signature === `v1=${expected}`;
```

### Payment Methods Supported
- Cards (Visa, Mastercard, Amex)
- Apple Pay (via RevolutCheckout widget)
- Google Pay (via RevolutCheckout widget)
- Revolut Pay (one-click for Revolut users)
- Bank transfers (SEPA, Faster Payments)

## Database Schema Changes

### New Table: `workspace_payment_settings`
```sql
CREATE TABLE workspace_payment_settings (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL UNIQUE REFERENCES organization(id) ON DELETE CASCADE,
  
  -- Provider configuration
  enabled_providers TEXT[] NOT NULL DEFAULT ARRAY['stripe'],  -- ['stripe', 'revolut']
  default_provider TEXT NOT NULL DEFAULT 'stripe',
  allow_client_choice BOOLEAN NOT NULL DEFAULT false,         -- Let client pick provider
  
  -- Stripe credentials (encrypted)
  stripe_secret_key_encrypted TEXT,
  stripe_publishable_key TEXT,
  stripe_webhook_secret_encrypted TEXT,
  
  -- Revolut credentials (encrypted)
  revolut_secret_key_encrypted TEXT,
  revolut_public_key TEXT,
  revolut_webhook_secret_encrypted TEXT,
  revolut_merchant_id TEXT,
  
  -- Settings
  auto_send_invoice BOOLEAN NOT NULL DEFAULT true,
  payment_terms_days INTEGER NOT NULL DEFAULT 14,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_wps_workspace ON workspace_payment_settings(workspace_id);
```

### Invoice Schema Extensions
```sql
ALTER TABLE invoices ADD COLUMN payment_provider TEXT DEFAULT 'stripe';
ALTER TABLE invoices ADD COLUMN revolut_order_id TEXT;
ALTER TABLE invoices ADD COLUMN revolut_checkout_url TEXT;

CREATE INDEX ix_invoices_revolut ON invoices(revolut_order_id);

-- Constraint: exactly one provider's external ID must be set when sent
ALTER TABLE invoices ADD CONSTRAINT chk_provider_id CHECK (
  status = 'draft' OR 
  (payment_provider = 'stripe' AND stripe_invoice_id IS NOT NULL) OR
  (payment_provider = 'revolut' AND revolut_order_id IS NOT NULL)
);
```

## Service Layer

### PaymentProviderFactory
```typescript
// src/server/features/payments/PaymentProviderFactory.ts
export async function getProvider(
  workspaceId: string, 
  preferredProvider?: 'stripe' | 'revolut'
): Promise<PaymentProvider> {
  const settings = await getWorkspacePaymentSettings(workspaceId);
  
  const provider = preferredProvider 
    && settings.enabledProviders.includes(preferredProvider)
    ? preferredProvider
    : settings.defaultProvider;
  
  switch (provider) {
    case 'stripe':
      return new StripeProvider(settings.stripeSecretKey);
    case 'revolut':
      return new RevolutProvider(settings.revolutSecretKey);
    default:
      throw new AppError('INVALID_PROVIDER', `Unknown provider: ${provider}`);
  }
}
```

### RevolutProvider Implementation
```typescript
// src/server/features/payments/providers/RevolutProvider.ts
export class RevolutProvider implements PaymentProvider {
  private baseUrl: string;
  private secretKey: string;
  
  constructor(secretKey: string, sandbox = false) {
    this.secretKey = secretKey;
    this.baseUrl = sandbox
      ? 'https://sandbox-merchant.revolut.com/api'
      : 'https://merchant.revolut.com/api';
  }
  
  async createPaymentSession(invoice: InvoiceSelect): Promise<PaymentSession> {
    const response = await fetch(`${this.baseUrl}/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
        'Revolut-Api-Version': '2024-09-01',
      },
      body: JSON.stringify({
        amount: invoice.totalCents,
        currency: invoice.currency,
        description: `Invoice ${invoice.invoiceNumber}`,
        capture_mode: 'automatic',
        metadata: {
          invoice_id: invoice.id,
          workspace_id: invoice.workspaceId,
        },
        redirect_url: `${process.env.APP_URL}/invoices/${invoice.id}/success`,
      }),
    });
    
    const order = await response.json();
    
    return {
      provider: 'revolut',
      externalId: order.id,
      paymentUrl: order.checkout_url,
      token: order.token,
    };
  }
  
  verifyWebhook(rawBody: Buffer, headers: Headers): WebhookEvent {
    const timestamp = headers.get('Revolut-Request-Timestamp');
    const signature = headers.get('Revolut-Signature');
    
    const payloadToSign = `v1.${timestamp}.${rawBody.toString()}`;
    const expected = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payloadToSign)
      .digest('hex');
    
    if (signature !== `v1=${expected}`) {
      throw new AppError('FORBIDDEN', 'Invalid webhook signature');
    }
    
    const payload = JSON.parse(rawBody.toString());
    return {
      type: payload.event,
      orderId: payload.order_id,
      data: payload,
    };
  }
}
```

## UI Components

### Payment Settings Page
`/clients/[clientId]/settings/payments` or `/settings/payments` (workspace level)

```tsx
// Provider selection with visual cards
<PaymentProviderSettings>
  <ProviderCard 
    provider="stripe"
    logo="/logos/stripe.svg"
    features={['Cards', 'Apple Pay', 'Google Pay', 'Bank transfers']}
    connected={!!settings.stripeSecretKey}
    onConnect={handleStripeConnect}
  />
  <ProviderCard 
    provider="revolut"
    logo="/logos/revolut.svg"
    features={['Cards', 'Apple Pay', 'Google Pay', 'Revolut Pay', 'SEPA']}
    connected={!!settings.revolutSecretKey}
    onConnect={handleRevolutConnect}
  />
</PaymentProviderSettings>

<Switch 
  label="Let clients choose payment method"
  checked={settings.allowClientChoice}
  onChange={handleToggleClientChoice}
/>
```

### Invoice Payment Page (Client-Facing)
```tsx
// Show provider options if allowClientChoice is true
{settings.allowClientChoice && settings.enabledProviders.length > 1 ? (
  <PaymentMethodSelector
    providers={settings.enabledProviders}
    selected={selectedProvider}
    onSelect={setSelectedProvider}
  />
) : null}

{selectedProvider === 'revolut' ? (
  <RevolutCheckoutWidget
    publicKey={settings.revolutPublicKey}
    orderId={invoice.revolutOrderId}
    onSuccess={handlePaymentSuccess}
    onError={handlePaymentError}
  />
) : (
  <StripeCheckoutRedirect url={invoice.stripePaymentUrl} />
)}
```

### RevolutCheckoutWidget Component
```tsx
// src/components/payments/RevolutCheckoutWidget.tsx
'use client';

import { useEffect, useRef } from 'react';

interface Props {
  publicKey: string;
  orderId: string;
  onSuccess: () => void;
  onError: (error: Error) => void;
}

export function RevolutCheckoutWidget({ publicKey, orderId, onSuccess, onError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    async function initCheckout() {
      const RevolutCheckout = (await import('@revolut/checkout')).default;
      
      const instance = await RevolutCheckout({
        publicToken: publicKey,
        locale: 'en',
      });
      
      instance.payWithPopup({
        onSuccess: () => {
          onSuccess();
        },
        onError: (error) => {
          onError(new Error(error.message));
        },
        onCancel: () => {
          // User closed popup
        },
      });
    }
    
    initCheckout();
  }, [publicKey, orderId]);
  
  return <div ref={containerRef} id="revolut-checkout" />;
}
```

## Webhook Routes

### Stripe Webhook (Existing)
`POST /api/webhooks/stripe` — No changes needed

### Revolut Webhook (New)
```typescript
// src/routes/api/webhooks/revolut.ts
import { createAPIFileRoute } from '@tanstack/react-router';
import { RevolutProvider } from '@/server/features/payments/providers/RevolutProvider';
import { InvoiceService } from '@/server/features/invoices/services/InvoiceService';

export const Route = createAPIFileRoute('/api/webhooks/revolut')({
  POST: async ({ request }) => {
    const rawBody = await request.arrayBuffer();
    const headers = request.headers;
    
    // Verify signature
    const provider = new RevolutProvider(process.env.REVOLUT_SECRET_KEY!);
    const event = provider.verifyWebhook(Buffer.from(rawBody), headers);
    
    switch (event.type) {
      case 'ORDER_COMPLETED':
        await InvoiceService.handlePaymentSuccess(
          event.orderId,
          event.data.payments?.[0]?.id,
          'revolut'
        );
        break;
        
      case 'ORDER_CANCELLED':
      case 'ORDER_PAYMENT_DECLINED':
        // Log but don't change status
        break;
    }
    
    return new Response(null, { status: 204 });
  },
});
```

## Security Considerations

### Credential Storage
- All API keys encrypted at rest using AES-256-GCM
- Encryption key from `PAYMENT_ENCRYPTION_KEY` env var
- Keys never logged or exposed in responses

### Webhook Security
- Signature verification required for all webhooks
- Timestamp validation (5-minute tolerance) prevents replay attacks
- Idempotency keys prevent duplicate processing

### PCI Compliance
- No card data touches our servers
- Both providers are PCI-DSS Level 1 compliant
- Checkout flows use provider-hosted pages/widgets

## Environment Variables

```bash
# Stripe (existing)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Revolut (new)
REVOLUT_SECRET_KEY=sk_live_...
REVOLUT_PUBLIC_KEY=pk_live_...
REVOLUT_WEBHOOK_SECRET=wsk_...
REVOLUT_MERCHANT_ID=mer_...

# Encryption
PAYMENT_ENCRYPTION_KEY=<32-byte-hex>
```

## Success Criteria

1. **Provider Selection Works** — Workspace can enable/disable providers, set default
2. **Revolut Orders Created** — Invoice → Revolut order with checkout_url
3. **Revolut Webhooks Verified** — HMAC signature validation passes
4. **Payment Completes Flow** — ORDER_COMPLETED → invoice paid → onboarding triggered
5. **Client Choice UI** — When enabled, clients see provider selection at checkout
6. **Credentials Encrypted** — All API keys encrypted in database
7. **E2E Test Passes** — Sandbox: create invoice → pay via Revolut → verify status

## Test Plan

### Unit Tests
- [ ] RevolutProvider.createPaymentSession() returns valid checkout_url
- [ ] RevolutProvider.verifyWebhook() validates signatures correctly
- [ ] PaymentProviderFactory selects correct provider based on settings
- [ ] Credential encryption/decryption roundtrips correctly

### Integration Tests
- [ ] Create workspace payment settings with both providers
- [ ] Create invoice and send via Revolut
- [ ] Receive ORDER_COMPLETED webhook and verify invoice status
- [ ] Verify onboarding checklist created after payment

### E2E Tests (Sandbox)
- [ ] Full flow: proposal → contract → invoice → Revolut payment → onboarding
- [ ] Client choice UI shows both providers when enabled
- [ ] Webhook retry works after initial failure

## Estimated Effort

| Plan | Focus | Hours |
|------|-------|-------|
| 54-01 | Schema + Provider Abstraction | 6-8h |
| 54-02 | RevolutProvider Implementation | 8-10h |
| 54-03 | Webhook Handlers + InvoiceService Updates | 6-8h |
| 54-04 | Payment Settings UI + Client Choice | 8-10h |
| 54-05 | Checkout Widget + E2E Testing | 6-8h |
| **Total** | | **34-44h** |

## Dependencies

- Phase 48 complete (contract + invoice system exists)
- Revolut Business account with Merchant API access
- `@revolut/checkout` npm package for widget

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Revolut API changes | Pin to specific API version header |
| Webhook delivery failures | Implement retry logic, dead-letter logging |
| Credential exposure | Encryption at rest, audit logging |
| Provider-specific edge cases | Comprehensive test coverage per provider |
