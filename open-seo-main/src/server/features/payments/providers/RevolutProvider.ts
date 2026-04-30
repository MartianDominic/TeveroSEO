/**
 * Revolut Payment Provider
 * Phase 54-02: RevolutProvider Implementation
 *
 * Implements PaymentProvider interface for Revolut Merchant API.
 * Handles order creation, webhook verification, and status checks.
 */
import * as crypto from "crypto";
import type {
  PaymentProvider,
  PaymentProviderType,
  PaymentSession,
  PaymentStatusResult,
  WebhookEvent,
  ProviderCredentials,
  PaymentStatus,
} from "../types";
import { PaymentSessionError, WebhookVerificationError } from "../types";
import type { InvoiceSelect } from "@/db/invoice-schema";
import { createLogger } from "@/server/lib/logger";
import {
  createRevolutClient,
  type RevolutClient,
  type RevolutOrderState,
} from "./revolut-client";
// Use process.env directly for optional APP_URL

const log = createLogger({ module: "RevolutProvider" });

/**
 * Map Revolut order state to our PaymentStatus.
 */
function mapRevolutStatus(state: RevolutOrderState): PaymentStatus {
  switch (state) {
    case "completed":
      return "paid";
    case "cancelled":
      return "cancelled";
    case "failed":
      return "failed";
    case "authorised":
    case "processing":
      return "processing";
    case "pending":
    default:
      return "pending";
  }
}

/**
 * RevolutProvider implements PaymentProvider interface.
 */
export class RevolutProvider implements PaymentProvider {
  readonly providerType: PaymentProviderType = "revolut";

  private readonly client: RevolutClient;
  private readonly webhookSecret?: string;
  private readonly sandbox: boolean;

  constructor(credentials: ProviderCredentials) {
    if (!credentials.revolutApiKey) {
      throw new Error("Revolut API key is required");
    }

    // Detect sandbox mode from key prefix or explicit setting
    this.sandbox = credentials.revolutApiKey.startsWith("sk_sandbox_");

    this.client = createRevolutClient({
      secretKey: credentials.revolutApiKey,
      sandbox: this.sandbox,
    });

    this.webhookSecret = credentials.revolutWebhookSecret;

    log.debug("RevolutProvider initialized", { sandbox: this.sandbox });
  }

  /**
   * Create a Revolut order and return payment URL.
   */
  async createPaymentSession(invoice: InvoiceSelect): Promise<PaymentSession> {
    log.info("Creating Revolut payment session", {
      invoiceId: invoice.id,
      totalCents: invoice.totalCents,
    });

    try {
      const appUrl = process.env.APP_URL ?? "https://app.tevero.lt";
      const currency = (invoice.currency ?? "EUR").toUpperCase();

      // Build customer info if available
      const customer = invoice.clientId
        ? {
            email: `invoice-${invoice.id}@placeholder.local`,
            full_name: `Client ${invoice.clientId}`,
          }
        : undefined;

      const order = await this.client.createOrder({
        amount: invoice.totalCents,
        currency,
        description: `Invoice ${invoice.invoiceNumber ?? invoice.id}`,
        capture_mode: "automatic",
        customer,
        metadata: {
          invoice_id: invoice.id,
          workspace_id: invoice.workspaceId,
          ...(invoice.contractId && { contract_id: invoice.contractId }),
        },
        redirect_url: `${appUrl}/invoices/${invoice.id}/success`,
      });

      log.info("Revolut payment session created", {
        invoiceId: invoice.id,
        revolutOrderId: order.id,
        checkoutUrl: order.checkout_url,
      });

      return {
        provider: "revolut",
        externalId: order.id,
        paymentUrl: order.checkout_url,
        token: order.token,
        rawResponse: order,
      };
    } catch (error) {
      if (error instanceof PaymentSessionError) {
        throw error;
      }

      log.error(
        "Revolut payment session creation failed",
        error instanceof Error ? error : new Error(String(error))
      );

      throw new PaymentSessionError(
        "Failed to create Revolut payment session",
        "revolut",
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Verify Revolut webhook signature and parse event.
   *
   * Revolut uses HMAC-SHA256 with format:
   * - Signature header: `Revolut-Signature` (format: `v1={signature}`)
   * - Timestamp header: `Revolut-Request-Timestamp`
   * - Payload to sign: `v1.{timestamp}.{rawBody}`
   */
  verifyWebhook(rawBody: Buffer, headers: Headers): WebhookEvent {
    if (!this.webhookSecret) {
      throw new WebhookVerificationError(
        "Revolut webhook secret not configured",
        "revolut"
      );
    }

    const signature = headers.get("Revolut-Signature");
    const timestamp = headers.get("Revolut-Request-Timestamp");

    if (!signature) {
      throw new WebhookVerificationError(
        "Missing Revolut-Signature header",
        "revolut"
      );
    }

    if (!timestamp) {
      throw new WebhookVerificationError(
        "Missing Revolut-Request-Timestamp header",
        "revolut"
      );
    }

    // Extract signature value (remove v1= prefix if present)
    const signatureValue = signature.startsWith("v1=")
      ? signature.slice(3)
      : signature;

    // Compute expected signature
    const payloadToSign = `v1.${timestamp}.${rawBody.toString("utf-8")}`;
    const expectedSignature = crypto
      .createHmac("sha256", this.webhookSecret)
      .update(payloadToSign)
      .digest("hex");

    // Timing-safe comparison (must handle different lengths safely)
    const signatureBuffer = Buffer.from(signatureValue);
    const expectedBuffer = Buffer.from(expectedSignature);

    // Check length first, then do timing-safe comparison
    const isValid =
      signatureBuffer.length === expectedBuffer.length &&
      crypto.timingSafeEqual(signatureBuffer, expectedBuffer);

    if (!isValid) {
      log.warn("Revolut webhook signature verification failed");
      throw new WebhookVerificationError(
        "Invalid webhook signature",
        "revolut"
      );
    }

    // Parse event payload
    let event: { event: string; order_id: string; merchant_order_ext_ref?: string };
    try {
      event = JSON.parse(rawBody.toString("utf-8"));
    } catch {
      throw new WebhookVerificationError(
        "Invalid webhook payload JSON",
        "revolut"
      );
    }

    log.debug("Revolut webhook verified", {
      eventType: event.event,
      orderId: event.order_id,
    });

    return {
      type: event.event,
      orderId: event.order_id,
      invoiceId: undefined, // Will be resolved by looking up the order metadata
      data: event,
      rawEvent: event,
    };
  }

  /**
   * Get payment status from Revolut.
   */
  async getPaymentStatus(externalId: string): Promise<PaymentStatusResult> {
    try {
      const order = await this.client.getOrder(externalId);

      // Calculate paid amount from completed payments
      const amountPaidCents = order.payments
        ?.filter((p) => p.state === "captured")
        .reduce((sum, p) => sum + p.amount, 0);

      // Get paid timestamp from first captured payment
      const capturedPayment = order.payments?.find((p) => p.state === "captured");
      const paidAt = capturedPayment
        ? new Date(capturedPayment.updated_at)
        : undefined;

      return {
        status: mapRevolutStatus(order.state),
        amountPaidCents: amountPaidCents ?? (order.state === "completed" ? order.amount : undefined),
        currency: order.currency,
        paidAt,
        rawResponse: order,
      };
    } catch (error) {
      log.error(
        "Failed to get Revolut payment status",
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }
}
