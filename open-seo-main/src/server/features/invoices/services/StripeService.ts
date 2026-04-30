/**
 * Stripe API integration service.
 * Phase 48: Contract & Payment
 * Phase 54: Refactored to use StripeProvider internally
 *
 * This service is maintained for backwards compatibility.
 * New code should use PaymentProviderFactory instead.
 *
 * Handles invoice creation, payment links, and webhook verification.
 * Per D-05: Use Stripe for invoicing (already in stack).
 */
import Stripe from "stripe";
import { AppError } from "@/server/lib/errors";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "StripeService" });

/**
 * @deprecated Use PaymentProviderFactory.getProvider() instead.
 * This lazy-init pattern is kept for backwards compatibility.
 */
let stripeClient: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeClient) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new AppError("AUTH_CONFIG_MISSING", "STRIPE_SECRET_KEY not configured");
    }
    stripeClient = new Stripe(secretKey, { apiVersion: "2026-03-25.dahlia" });
  }
  return stripeClient;
}

export interface CreateStripeInvoiceInput {
  customerId: string;
  contractId: string;
  setupFeeCents: number;
  monthlyFeeCents: number;
  currency: string;
  daysUntilDue?: number;
}

export interface StripeInvoiceResult {
  stripeInvoiceId: string;
  stripePaymentUrl: string;
  totalCents: number;
}

/**
 * Create a Stripe invoice with setup and monthly line items.
 * Per D-08: Support both setup fee (one-time) and monthly recurring.
 */
export async function createInvoice(input: CreateStripeInvoiceInput): Promise<StripeInvoiceResult> {
  const stripe = getStripe();

  log.info("Creating Stripe invoice", { contractId: input.contractId, customerId: input.customerId });

  try {
    // Create draft invoice
    const invoice = await stripe.invoices.create({
      customer: input.customerId,
      currency: input.currency.toLowerCase(),
      metadata: {
        contract_id: input.contractId,
      },
      auto_advance: false, // Manual finalization
      collection_method: "send_invoice",
      days_until_due: input.daysUntilDue || 14,
    });

    // Add setup fee line item
    if (input.setupFeeCents > 0) {
      await stripe.invoiceItems.create({
        customer: input.customerId,
        invoice: invoice.id,
        description: "SEO Setup Fee / SEO pradinis mokestis",
        amount: input.setupFeeCents,
        currency: input.currency.toLowerCase(),
      });
    }

    // Add monthly fee line item
    if (input.monthlyFeeCents > 0) {
      await stripe.invoiceItems.create({
        customer: input.customerId,
        invoice: invoice.id,
        description: "SEO Monthly Service (First Month) / SEO mėnesinis mokestis (pirmas mėnuo)",
        amount: input.monthlyFeeCents,
        currency: input.currency.toLowerCase(),
      });
    }

    // Finalize invoice to generate payment link
    const finalized = await stripe.invoices.finalizeInvoice(invoice.id);

    if (!finalized.hosted_invoice_url) {
      throw new AppError("EXTERNAL_SERVICE_ERROR", "Stripe did not return payment URL");
    }

    log.info("Stripe invoice created", {
      stripeInvoiceId: finalized.id,
      totalCents: finalized.amount_due
    });

    return {
      stripeInvoiceId: finalized.id,
      stripePaymentUrl: finalized.hosted_invoice_url,
      totalCents: finalized.amount_due,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    log.error("Stripe invoice creation failed", error instanceof Error ? error : new Error(String(error)));
    throw new AppError("EXTERNAL_SERVICE_ERROR", "Failed to create Stripe invoice");
  }
}

/**
 * Verify Stripe webhook signature.
 * CRITICAL: Use raw body, not parsed JSON.
 */
export function verifyWebhook(rawBody: Buffer, signature: string): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new AppError("AUTH_CONFIG_MISSING", "STRIPE_WEBHOOK_SECRET not configured");
  }

  const stripe = getStripe();

  try {
    return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    log.error("Stripe webhook signature verification failed", error instanceof Error ? error : new Error(String(error)));
    throw new AppError("FORBIDDEN", "Invalid webhook signature");
  }
}

/**
 * Get or create Stripe customer for a client.
 * Reuses existing customer if one exists with matching metadata.
 */
export async function getOrCreateCustomer(
  email: string,
  name: string,
  clientId: string,
): Promise<string> {
  const stripe = getStripe();

  // Search for existing customer with this client ID
  const existing = await stripe.customers.search({
    query: `metadata["client_id"]:"${clientId}"`,
  });

  if (existing.data.length > 0) {
    return existing.data[0].id;
  }

  // Create new customer
  const customer = await stripe.customers.create({
    email,
    name,
    metadata: { client_id: clientId },
  });

  return customer.id;
}

/**
 * @deprecated Use PaymentProviderFactory.getProvider() for new code.
 * This namespace export is kept for backwards compatibility with
 * existing code that imports from StripeService.
 */
export const StripeService = {
  createInvoice,
  verifyWebhook,
  getOrCreateCustomer,
};
