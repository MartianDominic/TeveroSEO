/**
 * Payment Provider Types
 * Phase 54-01: Multi-Provider Payments
 *
 * Defines the PaymentProvider interface and related types.
 * All providers (Stripe, Revolut) implement this interface.
 */
import type { InvoiceSelect } from "@/db/invoice-schema";

/**
 * Supported payment providers.
 * Keep in sync with PAYMENT_PROVIDERS in workspace-payment-settings-schema.ts
 */
export type PaymentProviderType = "stripe" | "revolut";

/**
 * Payment session result from createPaymentSession.
 * Contains the external ID and checkout URL for the customer.
 */
export interface PaymentSession {
  /** Payment provider used */
  provider: PaymentProviderType;

  /** External ID from the provider (Stripe invoice ID, Revolut order ID) */
  externalId: string;

  /** URL for the customer to complete payment */
  paymentUrl: string;

  /** Optional token for additional verification */
  token?: string;

  /** Raw response data from provider (for debugging) */
  rawResponse?: unknown;
}

/**
 * Payment status from the provider.
 */
export type PaymentStatus =
  | "pending"
  | "processing"
  | "paid"
  | "failed"
  | "cancelled"
  | "refunded";

/**
 * Result from getPaymentStatus.
 */
export interface PaymentStatusResult {
  /** Current status of the payment */
  status: PaymentStatus;

  /** Amount paid in cents (if paid) */
  amountPaidCents?: number;

  /** Currency code (e.g., "EUR") */
  currency?: string;

  /** Timestamp when payment was completed (if paid) */
  paidAt?: Date;

  /** Error message (if failed) */
  errorMessage?: string;

  /** Raw response data from provider */
  rawResponse?: unknown;
}

/**
 * Normalized webhook event from any provider.
 */
export interface WebhookEvent {
  /** Event type (e.g., "payment.completed", "invoice.paid") */
  type: string;

  /** Order/Invoice ID from the provider */
  orderId: string;

  /** Our internal invoice ID (from metadata) */
  invoiceId?: string;

  /** Event-specific data */
  data: unknown;

  /** Raw event from provider */
  rawEvent: unknown;
}

/**
 * Credentials needed to initialize a provider.
 * Decrypted before passing to provider constructor.
 */
export interface ProviderCredentials {
  /** Stripe-specific */
  stripeSecretKey?: string;
  stripeWebhookSecret?: string;

  /** Revolut-specific */
  revolutApiKey?: string;
  revolutWebhookSecret?: string;
  revolutMerchantId?: string;
}

/**
 * PaymentProvider interface.
 * All payment providers must implement this interface.
 */
export interface PaymentProvider {
  /** Provider type identifier */
  readonly providerType: PaymentProviderType;

  /**
   * Create a payment session for an invoice.
   *
   * @param invoice - The invoice to create payment for
   * @returns PaymentSession with checkout URL
   * @throws Error if payment creation fails
   */
  createPaymentSession(invoice: InvoiceSelect): Promise<PaymentSession>;

  /**
   * Verify and parse a webhook event.
   *
   * @param rawBody - Raw request body as Buffer
   * @param headers - HTTP headers from the request
   * @returns Normalized WebhookEvent
   * @throws Error if verification fails
   */
  verifyWebhook(rawBody: Buffer, headers: Headers): WebhookEvent;

  /**
   * Get current payment status.
   *
   * @param externalId - Provider's payment/order ID
   * @returns Current payment status
   * @throws Error if status lookup fails
   */
  getPaymentStatus(externalId: string): Promise<PaymentStatusResult>;
}

/**
 * Options for PaymentProviderFactory.getProvider()
 */
export interface GetProviderOptions {
  /** Workspace ID to get provider for */
  workspaceId: string;

  /** Preferred provider (overrides workspace default) */
  preferredProvider?: PaymentProviderType;
}

/**
 * Error thrown when payment provider is not configured.
 */
export class PaymentProviderNotConfiguredError extends Error {
  constructor(
    public readonly provider: PaymentProviderType,
    public readonly workspaceId: string
  ) {
    super(`Payment provider ${provider} is not configured for workspace ${workspaceId}`);
    this.name = "PaymentProviderNotConfiguredError";
  }
}

/**
 * Error thrown when payment session creation fails.
 */
export class PaymentSessionError extends Error {
  constructor(
    message: string,
    public readonly provider: PaymentProviderType,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = "PaymentSessionError";
  }
}

/**
 * Error thrown when webhook verification fails.
 */
export class WebhookVerificationError extends Error {
  constructor(
    message: string,
    public readonly provider: PaymentProviderType
  ) {
    super(message);
    this.name = "WebhookVerificationError";
  }
}
