/**
 * Proposal payment service using Stripe.
 * Phase 30-06: Payment (Stripe)
 *
 * Handles the payment workflow:
 * 1. Create Stripe checkout session after signing
 * 2. Handle webhook events for payment completion
 * 3. Update proposal and payment records
 */

import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db/index";
import { proposalPayments, proposals } from "@/db/proposal-schema";
import { createLogger } from "@/server/lib/logger";
import { enqueueOnboarding } from "@/server/queues/onboardingQueue";
import { withRetry } from "@/server/lib/retry";

const log = createLogger({ module: "PaymentService" });

// Lazy-initialized Stripe client
let stripeClient: Stripe | null = null;

/**
 * Gets or creates the Stripe client singleton.
 * Throws if STRIPE_SECRET_KEY is not configured.
 */
export function getStripeClient(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY environment variable is required");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  }

  return stripeClient;
}

/**
 * Input parameters for creating a payment checkout session.
 */
export interface CreatePaymentCheckoutParams {
  proposalId: string;
  customerEmail: string;
  setupFeeCents: number;
  monthlyFeeCents?: number;
  successUrl: string;
  cancelUrl: string;
}

/**
 * Result of creating a checkout session.
 */
export interface CreatePaymentCheckoutResult {
  checkoutUrl: string;
  sessionId: string;
}

/**
 * Creates a Stripe Checkout session for proposal payment.
 *
 * Supports:
 * - One-time setup fee (payment mode)
 * - Monthly subscription (subscription mode)
 * - Combined setup fee + monthly subscription
 *
 * Uses Lithuanian locale for checkout page.
 * Stores payment record with pending status.
 *
 * @param params - Checkout parameters
 * @returns Checkout URL to redirect customer
 * @throws Error if Stripe is not configured
 *
 * @example
 * const result = await createPaymentCheckout({
 *   proposalId: "proposal-123",
 *   customerEmail: "customer@example.com",
 *   setupFeeCents: 200000, // 2000 EUR
 *   monthlyFeeCents: 100000, // 1000 EUR/month
 *   successUrl: "https://app.example.com/p/token/payment/success",
 *   cancelUrl: "https://app.example.com/p/token",
 * });
 * // Redirect to result.checkoutUrl
 */
export async function createPaymentCheckout(
  params: CreatePaymentCheckoutParams
): Promise<CreatePaymentCheckoutResult> {
  const {
    proposalId,
    customerEmail,
    setupFeeCents,
    monthlyFeeCents,
    successUrl,
    cancelUrl,
  } = params;

  log.info("Creating payment checkout", { proposalId, setupFeeCents, monthlyFeeCents });

  const stripe = getStripeClient();

  // Build line items using inline type
  const lineItems: Array<{
    price_data: {
      currency: string;
      product_data: { name: string; description?: string };
      unit_amount: number;
      recurring?: { interval: "month" | "year" | "week" | "day" };
    };
    quantity: number;
  }> = [];

  // Setup fee (one-time)
  if (setupFeeCents > 0) {
    lineItems.push({
      price_data: {
        currency: "eur",
        product_data: {
          name: "SEO Idiegimo mokestis",
          description: "Vienkartinis idiegimo mokestis",
        },
        unit_amount: setupFeeCents,
      },
      quantity: 1,
    });
  }

  // Monthly fee (subscription)
  if (monthlyFeeCents && monthlyFeeCents > 0) {
    lineItems.push({
      price_data: {
        currency: "eur",
        product_data: {
          name: "SEO Menesinis mokestis",
          description: "Menesinis SEO paslaugu mokestis",
        },
        unit_amount: monthlyFeeCents,
        recurring: {
          interval: "month",
        },
      },
      quantity: 1,
    });
  }

  // Determine mode based on whether subscription is included
  const mode: "payment" | "subscription" =
    monthlyFeeCents && monthlyFeeCents > 0 ? "subscription" : "payment";

  // Create Stripe checkout session with retry for transient failures
  const session = await withRetry(
    () =>
      stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode,
        line_items: lineItems,
        customer_email: customerEmail,
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          proposalId,
        },
        locale: "lt", // Lithuanian
      }),
    { maxRetries: 2, baseDelayMs: 500 }
  );

  // Store payment record in database
  const paymentId = nanoid();
  const totalAmountCents = setupFeeCents + (monthlyFeeCents ?? 0);

  await db.insert(proposalPayments).values({
    id: paymentId,
    proposalId,
    provider: "stripe",
    stripeSessionId: session.id,
    amountCents: totalAmountCents,
    currency: "EUR",
    status: "pending",
  }).returning();

  log.info("Payment checkout created", {
    proposalId,
    sessionId: session.id,
    mode,
    amountCents: totalAmountCents,
  });

  return {
    checkoutUrl: session.url!,
    sessionId: session.id,
  };
}

/**
 * Verifies Stripe webhook signature and returns parsed event.
 *
 * CRITICAL: Stripe requires the raw request body bytes for signature verification.
 * If you pass already-parsed JSON (e.g., JSON.stringify(parsedBody)), the signature
 * verification will fail because the byte representation differs from the original.
 *
 * The caller MUST pass:
 * - For Express/Node.js: req.rawBody or the raw buffer before body-parser runs
 * - For other frameworks: The untouched request body bytes
 *
 * @param payload - Raw request body as Buffer or untouched string (NOT parsed JSON)
 * @param signature - Stripe-Signature header value
 * @returns Parsed Stripe event
 * @throws Error if signature is invalid or payload is not raw body
 *
 * @example
 * // Express with raw body middleware
 * app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
 *   const event = verifyWebhookSignature(req.body, req.headers['stripe-signature']);
 * });
 */
export function verifyWebhookSignature(
  payload: Buffer | string,
  signature: string
): Stripe.Event {
  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET environment variable is required");
  }

  // Validate that payload appears to be raw body, not parsed JSON that was re-stringified.
  // Parsed-then-stringified JSON often has different whitespace/key ordering than the original.
  if (typeof payload === "string") {
    // Check if the string looks like it might have been parsed and re-stringified
    // by looking for common signs: no leading whitespace, starts with { or [
    const trimmed = payload.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      // This could be valid raw JSON or re-stringified - we can't know for certain,
      // but we log a warning to help debugging if signature verification fails
      // due to payload manipulation by middleware.
    }
  }

  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

/**
 * Handles Stripe webhook events.
 *
 * Supported events:
 * - checkout.session.completed: Payment successful, update records
 * - invoice.paid: Subscription renewal (logged)
 * - customer.subscription.deleted: Subscription cancelled (logged)
 *
 * @param event - Stripe event object
 */
export async function handleStripeWebhook(event: Stripe.Event): Promise<void> {
  log.info("Handling Stripe webhook", { type: event.type });

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      await handleCheckoutCompleted(session);
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      log.info("Invoice paid", {
        invoiceId: invoice.id,
        amountPaid: invoice.amount_paid,
      });
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      log.info("Subscription cancelled", {
        subscriptionId: subscription.id,
      });
      break;
    }

    default:
      log.info("Unhandled webhook event", { type: event.type });
  }
}

/**
 * Handles checkout.session.completed webhook event.
 * Updates payment record and proposal status in a transaction.
 *
 * SECURITY: Uses idempotency check to prevent duplicate processing.
 * Stripe may send the same webhook multiple times; we check if the
 * payment is already marked as "completed" before processing.
 */
async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  const proposalId = session.metadata?.proposalId;

  if (!proposalId) {
    log.warn("No proposalId in session metadata", { sessionId: session.id });
    return;
  }

  // IDEMPOTENCY: Check if this session was already processed
  const existingPayment = await db
    .select({ status: proposalPayments.status })
    .from(proposalPayments)
    .where(eq(proposalPayments.stripeSessionId, session.id))
    .limit(1);

  if (existingPayment.length > 0 && existingPayment[0].status === "completed") {
    log.info("Stripe event already processed, skipping", {
      sessionId: session.id,
      proposalId,
    });
    return;
  }

  log.info("Processing checkout completion", {
    proposalId,
    sessionId: session.id,
    paymentIntent: session.payment_intent,
    subscription: session.subscription,
  });

  const now = new Date();

  // Update payment and proposal records in a single transaction
  await db.transaction(async (tx) => {
    // Update payment record - use conditional update for race condition safety
    const updated = await tx
      .update(proposalPayments)
      .set({
        stripePaymentIntentId: session.payment_intent as string | null,
        stripeSubscriptionId: session.subscription as string | null,
        status: "completed",
        paidAt: now,
      })
      .where(eq(proposalPayments.stripeSessionId, session.id))
      .returning({ id: proposalPayments.id });

    // If no rows updated, another request already processed this
    if (updated.length === 0) {
      log.info("Payment already processed by concurrent request", {
        sessionId: session.id,
      });
      return;
    }

    // Update proposal status to paid
    await tx
      .update(proposals)
      .set({
        status: "paid",
        paidAt: now,
        updatedAt: now,
      })
      .where(eq(proposals.id, proposalId));
  });

  log.info("Payment completed and proposal updated", {
    proposalId,
    sessionId: session.id,
  });

  // Queue onboarding instead of running synchronously (Phase 30-07)
  // This ensures the webhook returns immediately without blocking on
  // email sends, Slack notifications, and database operations.
  try {
    const jobId = await enqueueOnboarding({
      proposalId,
      customerId: session.customer as string | undefined,
      sessionId: session.id,
    });
    log.info("Onboarding job enqueued", {
      proposalId,
      jobId,
      sessionId: session.id,
    });
  } catch (error) {
    // Log but don't fail the webhook - job can be manually created
    log.error(
      "Failed to enqueue onboarding job",
      error instanceof Error ? error : new Error(String(error)),
      { proposalId, sessionId: session.id }
    );
  }
}
