/**
 * Stripe Payment Provider
 * Phase 54-01: Multi-Provider Payments
 *
 * Implements PaymentProvider interface for Stripe.
 * Handles invoice creation, webhook verification, and status checks.
 */
import Stripe from "stripe";
import type {
  PaymentProvider,
  PaymentProviderType,
  PaymentSession,
  PaymentStatusResult,
  WebhookEvent,
  ProviderCredentials,
} from "../types";
import {
  PaymentSessionError,
  WebhookVerificationError,
} from "../types";
import type { InvoiceSelect } from "@/db/invoice-schema";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "StripeProvider" });

/**
 * Stripe API version.
 * Keep in sync with existing StripeService.
 */
const STRIPE_API_VERSION = "2026-03-25.dahlia" as const;

/**
 * Map Stripe invoice status to our PaymentStatus.
 */
function mapStripeStatus(
  stripeStatus: Stripe.Invoice.Status | null
): PaymentStatusResult["status"] {
  switch (stripeStatus) {
    case "paid":
      return "paid";
    case "void":
    case "uncollectible":
      return "cancelled";
    case "open":
      return "pending";
    case "draft":
      return "pending";
    default:
      return "pending";
  }
}

/**
 * StripeProvider implements PaymentProvider interface.
 */
export class StripeProvider implements PaymentProvider {
  readonly providerType: PaymentProviderType = "stripe";

  private readonly stripe: Stripe;
  private readonly webhookSecret?: string;

  constructor(credentials: ProviderCredentials) {
    if (!credentials.stripeSecretKey) {
      throw new Error("Stripe secret key is required");
    }

    this.stripe = new Stripe(credentials.stripeSecretKey, {
      apiVersion: STRIPE_API_VERSION,
    });

    this.webhookSecret = credentials.stripeWebhookSecret;

    log.debug("StripeProvider initialized");
  }

  /**
   * Create a Stripe invoice and return payment URL.
   */
  async createPaymentSession(invoice: InvoiceSelect): Promise<PaymentSession> {
    log.info("Creating Stripe payment session", {
      invoiceId: invoice.id,
      totalCents: invoice.totalCents,
    });

    try {
      // Get or create Stripe customer
      const customerEmail = await this.getCustomerEmail(invoice);
      const customerId = await this.getOrCreateCustomer(
        customerEmail,
        invoice.clientId,
        invoice.id
      );

      // Create draft invoice
      const stripeInvoice = await this.stripe.invoices.create({
        customer: customerId,
        currency: (invoice.currency ?? "EUR").toLowerCase(),
        metadata: {
          invoice_id: invoice.id,
          workspace_id: invoice.workspaceId,
          contract_id: invoice.contractId ?? "",
        },
        auto_advance: false,
        collection_method: "send_invoice",
        days_until_due: 14,
      });

      // Add line items
      for (const item of invoice.lineItems) {
        await this.stripe.invoiceItems.create({
          customer: customerId,
          invoice: stripeInvoice.id,
          description: item.description,
          amount: item.totalCents,
          currency: (invoice.currency ?? "EUR").toLowerCase(),
        });
      }

      // Finalize invoice to generate payment link
      const finalized = await this.stripe.invoices.finalizeInvoice(
        stripeInvoice.id
      );

      if (!finalized.hosted_invoice_url) {
        throw new PaymentSessionError(
          "Stripe did not return payment URL",
          "stripe"
        );
      }

      log.info("Stripe payment session created", {
        invoiceId: invoice.id,
        stripeInvoiceId: finalized.id,
        totalCents: finalized.amount_due,
      });

      return {
        provider: "stripe",
        externalId: finalized.id,
        paymentUrl: finalized.hosted_invoice_url,
        rawResponse: finalized,
      };
    } catch (error) {
      if (error instanceof PaymentSessionError) {
        throw error;
      }

      log.error(
        "Stripe payment session creation failed",
        error instanceof Error ? error : new Error(String(error))
      );

      throw new PaymentSessionError(
        "Failed to create Stripe payment session",
        "stripe",
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Verify Stripe webhook signature and parse event.
   */
  verifyWebhook(rawBody: Buffer, headers: Headers): WebhookEvent {
    if (!this.webhookSecret) {
      throw new WebhookVerificationError(
        "Stripe webhook secret not configured",
        "stripe"
      );
    }

    const signature = headers.get("stripe-signature");
    if (!signature) {
      throw new WebhookVerificationError(
        "Missing stripe-signature header",
        "stripe"
      );
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.webhookSecret
      );
    } catch (error) {
      log.error(
        "Stripe webhook verification failed",
        error instanceof Error ? error : new Error(String(error))
      );
      throw new WebhookVerificationError(
        "Invalid webhook signature",
        "stripe"
      );
    }

    // Extract invoice ID from event
    let orderId = "";
    let invoiceId: string | undefined;

    if (event.type.startsWith("invoice.")) {
      const invoice = event.data.object as Stripe.Invoice;
      orderId = invoice.id;
      invoiceId = invoice.metadata?.invoice_id;
    } else if (event.type.startsWith("payment_intent.")) {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      orderId = paymentIntent.id;
      invoiceId = paymentIntent.metadata?.invoice_id;
    }

    return {
      type: event.type,
      orderId,
      invoiceId,
      data: event.data.object,
      rawEvent: event,
    };
  }

  /**
   * Get payment status from Stripe.
   */
  async getPaymentStatus(externalId: string): Promise<PaymentStatusResult> {
    try {
      const invoice = await this.stripe.invoices.retrieve(externalId);

      return {
        status: mapStripeStatus(invoice.status),
        amountPaidCents: invoice.amount_paid,
        currency: invoice.currency?.toUpperCase(),
        paidAt: invoice.status_transitions?.paid_at
          ? new Date(invoice.status_transitions.paid_at * 1000)
          : undefined,
        rawResponse: invoice,
      };
    } catch (error) {
      log.error(
        "Failed to get Stripe payment status",
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  /**
   * Get customer email from invoice or client data.
   * For now, we use a placeholder - this will be enhanced in 54-02.
   */
  private async getCustomerEmail(invoice: InvoiceSelect): Promise<string> {
    // TODO: In 54-02, look up client email from clients table
    // For now, use invoice ID to create a unique placeholder
    return `invoice-${invoice.id}@placeholder.local`;
  }

  /**
   * Get or create a Stripe customer.
   */
  private async getOrCreateCustomer(
    email: string,
    clientId: string,
    invoiceId: string
  ): Promise<string> {
    // Search for existing customer with this client ID
    const existing = await this.stripe.customers.search({
      query: `metadata["client_id"]:"${clientId}"`,
    });

    if (existing.data.length > 0) {
      return existing.data[0].id;
    }

    // Create new customer
    const customer = await this.stripe.customers.create({
      email,
      metadata: {
        client_id: clientId,
        created_from_invoice: invoiceId,
      },
    });

    return customer.id;
  }
}
