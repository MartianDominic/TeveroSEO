# Payment Testing Guide

Phase 54-05: Multi-Provider Payment Testing

## Overview

This guide covers testing payment flows with both Stripe and Revolut in development and sandbox environments.

## Test Environments

### Stripe Test Mode

Stripe automatically uses test mode when you use test API keys (starting with `sk_test_` and `pk_test_`).

**Test Dashboard:** https://dashboard.stripe.com/test

### Revolut Sandbox

Revolut provides a sandbox environment for testing. You need separate sandbox credentials.

**Sandbox Dashboard:** https://sandbox-business.revolut.com

## Test Card Numbers

### Stripe Test Cards

| Scenario | Card Number | Expiry | CVC |
|----------|-------------|--------|-----|
| Success | 4242 4242 4242 4242 | Any future date | Any 3 digits |
| Declined | 4000 0000 0000 0002 | Any future date | Any 3 digits |
| Insufficient Funds | 4000 0000 0000 9995 | Any future date | Any 3 digits |
| 3D Secure Required | 4000 0000 0000 3220 | Any future date | Any 3 digits |
| Processing Error | 4000 0000 0000 0119 | Any future date | Any 3 digits |

### Revolut Sandbox Cards

| Scenario | Card Number | Expiry | CVC |
|----------|-------------|--------|-----|
| Success | 4929 0000 0000 6 | Any future date | Any 3 digits |
| Declined | 4929 0000 0005 9 | Any future date | Any 3 digits |
| 3D Secure | 4929 0000 0000 1 | Any future date | Any 3 digits |
| Card Expired | 4929 0000 0000 2 | Past date | Any 3 digits |

**Note:** For 3D Secure tests, use code `123456` when prompted.

## Environment Setup

### 1. Configure Environment Variables

```bash
# .env.local

# Stripe (Test Mode)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Revolut (Sandbox)
REVOLUT_API_KEY=sand_sk_...
REVOLUT_PUBLIC_KEY=sand_pk_...
REVOLUT_WEBHOOK_SECRET=...

# Encryption key for credentials (generate with: openssl rand -base64 32)
PAYMENT_ENCRYPTION_KEY=your-32-byte-base64-key
```

### 2. Set Up Webhook Testing

#### Local Development with ngrok

```bash
# Install ngrok
brew install ngrok  # macOS
# or download from https://ngrok.com

# Start ngrok tunnel
ngrok http 3001

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
```

#### Configure Stripe Webhooks

1. Go to https://dashboard.stripe.com/test/webhooks
2. Click "Add endpoint"
3. Enter: `https://your-ngrok-url.ngrok.io/api/webhooks/stripe`
4. Select events:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
5. Copy the signing secret to `STRIPE_WEBHOOK_SECRET`

#### Configure Revolut Webhooks

1. Go to Revolut Business sandbox settings
2. Navigate to Developer > Webhooks
3. Add endpoint: `https://your-ngrok-url.ngrok.io/api/webhooks/revolut`
4. Enable events:
   - `ORDER_COMPLETED`
   - `ORDER_AUTHORISED`
5. Note: Revolut uses IP whitelist + HMAC signature verification

### 3. Revolut Sandbox Account Setup

1. Create sandbox account at https://sandbox-business.revolut.com
2. Enable Merchant API in Developer settings
3. Generate API key pair (public + secret)
4. Configure allowed domains (add localhost for dev)

## Testing Workflows

### Manual Payment Test

1. Create a test invoice via API or UI
2. Navigate to `/invoices/{id}/pay`
3. Select payment provider (if multiple enabled)
4. Complete payment with test card
5. Verify redirect to success page
6. Check invoice status in database

### Webhook Test

```bash
# Stripe CLI (recommended)
stripe listen --forward-to localhost:3001/api/webhooks/stripe

# Trigger test event
stripe trigger checkout.session.completed

# Manual webhook test
curl -X POST http://localhost:3001/api/webhooks/revolut \
  -H "Content-Type: application/json" \
  -H "Revolut-Signature: your-hmac-signature" \
  -d '{"event": "ORDER_COMPLETED", "order_id": "test-123"}'
```

### E2E Test Suite

```bash
# Run payment E2E tests
pnpm test:e2e e2e/payment-flow.spec.ts

# Run with UI
pnpm test:e2e --ui e2e/payment-flow.spec.ts

# Debug mode
pnpm test:e2e --debug e2e/payment-flow.spec.ts
```

## Common Issues

### 1. Webhook Signature Verification Fails

**Symptom:** 401 Unauthorized on webhook endpoint

**Solution:**
- Ensure you're using the correct webhook secret
- For Stripe, use the secret from the webhook endpoint, not your API secret
- For Revolut, verify the HMAC signature calculation matches

### 2. Checkout Widget Doesn't Load

**Symptom:** Blank or error state in checkout widget

**Solution:**
- Check browser console for CSP errors
- Verify public key is correct for the environment
- Ensure domains are whitelisted in Revolut settings

### 3. 3D Secure Popup Blocked

**Symptom:** 3DS authentication doesn't appear

**Solution:**
- Disable popup blockers for testing
- Use test cards that don't require 3DS
- Check that the popup is triggered from a user action

### 4. Currency Mismatch

**Symptom:** Payment fails with currency error

**Solution:**
- Ensure invoice currency matches workspace settings
- Revolut requires EUR accounts to pay in EUR
- Configure multi-currency if needed

### 5. Sandbox vs Production Mismatch

**Symptom:** "Invalid API key" errors

**Solution:**
- Verify environment variable prefix (sk_test_ vs sk_live_)
- Don't mix sandbox and production credentials
- Use separate .env files for each environment

## Verification Checklist

### Before Going Live

- [ ] All test cards produce expected results
- [ ] Webhooks update invoice status correctly
- [ ] Success page displays after payment
- [ ] Email notifications trigger (if enabled)
- [ ] Onboarding checklist activates after payment
- [ ] Refund flow works (if implemented)
- [ ] Error states handle gracefully
- [ ] Provider switching works correctly
- [ ] Apple Pay / Google Pay tested (if available)

### Production Readiness

- [ ] Switch to production API keys
- [ ] Update webhook URLs to production domain
- [ ] Remove test-only code paths
- [ ] Verify SSL certificate valid
- [ ] Test with real card (small amount)
- [ ] Monitor for errors in first 24 hours
