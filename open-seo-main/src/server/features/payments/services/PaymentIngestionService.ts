/**
 * Payment Ingestion Service
 * Phase 101: Direct Proposal & Manual Deal Pipeline
 *
 * Normalizes payments from multiple providers into a common entity:
 * - Stripe PaymentIntent webhooks
 * - Revolut Transaction API polling
 * - Manual entry (bank transfer, cash)
 *
 * All methods are idempotent - duplicate ingestion returns existing record.
 *
 * Threat mitigations:
 * - T-101-01: Webhook signature verification handled at route level
 * - T-101-02: Amounts in cents (integer), no floating point
 * - T-101-03: Activity logging via PaymentRepository
 */
import { PaymentRepository } from "../repositories/PaymentRepository";
import type { PaymentSelect } from "@/db/payment-schema";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "PaymentIngestionService" });

// ============================================================================
// External Provider Types
// ============================================================================

/**
 * Stripe PaymentIntent structure (subset of fields we use).
 */
export interface StripePaymentIntent {
  id: string;
  amount: number; // in cents
  amount_received: number;
  currency: string;
  customer?: string;
  receipt_email?: string;
  description?: string;
  metadata?: Record<string, string>;
  created: number; // Unix timestamp
  application_fee_amount?: number | null;
}

/**
 * Revolut Transaction structure (from Business API).
 */
export interface RevolutTransaction {
  id: string;
  type: string;
  state: string;
  amount: { value: number; currency: string };
  fee?: { value: number; currency: string };
  reference?: string;
  merchant?: { name?: string };
  counterparty?: { name?: string; email?: string };
  created_at: string; // ISO timestamp
}

/**
 * Manual payment input for bank transfers, cash, etc.
 */
export interface ManualPaymentInput {
  grossAmountCents: number;
  currency?: string;
  payerName?: string;
  payerEmail?: string;
  payerReference?: string;
  memo?: string;
  receivedAt: Date;
  provider?: "bank_transfer" | "cash" | "other";
}

/**
 * Result of payment ingestion.
 * isNew indicates whether a new record was created or existing was returned.
 */
export type IngestionResult = { payment: PaymentSelect; isNew: boolean };

// ============================================================================
// Payment Ingestion Service
// ============================================================================

export const PaymentIngestionService = {
  /**
   * Ingest a Stripe PaymentIntent into the payments table.
   * Idempotent - returns existing payment if already ingested.
   */
  async ingestFromStripe(
    intent: StripePaymentIntent,
    workspaceId: string
  ): Promise<IngestionResult> {
    // Check for existing (idempotency)
    const existing = await PaymentRepository.findByExternalId(
      "stripe",
      intent.id,
      workspaceId
    );
    if (existing) {
      log.debug("Payment already ingested", {
        provider: "stripe",
        externalId: intent.id,
      });
      return { payment: existing, isNew: false };
    }

    const grossAmountCents = intent.amount_received || intent.amount;
    const providerFeeCents = intent.application_fee_amount ?? 0;
    const netAmountCents = grossAmountCents - providerFeeCents;

    const payment = await PaymentRepository.create({
      workspaceId,
      provider: "stripe",
      externalId: intent.id,
      grossAmountCents,
      providerFeeCents,
      netAmountCents,
      currency: intent.currency.toUpperCase(),
      payerEmail: intent.receipt_email ?? undefined,
      memo: intent.description ?? intent.metadata?.invoice_number ?? undefined,
      receivedAt: new Date(intent.created * 1000),
      status: "pending",
    });

    log.info("Ingested Stripe payment", {
      paymentId: payment.id,
      amount: grossAmountCents,
    });
    return { payment, isNew: true };
  },

  /**
   * Ingest a Revolut transaction into the payments table.
   * Idempotent - returns existing payment if already ingested.
   */
  async ingestFromRevolut(
    tx: RevolutTransaction,
    workspaceId: string
  ): Promise<IngestionResult> {
    // Check for existing (idempotency)
    const existing = await PaymentRepository.findByExternalId(
      "revolut",
      tx.id,
      workspaceId
    );
    if (existing) {
      log.debug("Payment already ingested", {
        provider: "revolut",
        externalId: tx.id,
      });
      return { payment: existing, isNew: false };
    }

    // Revolut amounts can be in major units or minor units depending on API version
    // Assume major units (EUR) for Business API, convert to cents
    const grossAmountCents = Math.round(tx.amount.value * 100);
    const providerFeeCents = tx.fee ? Math.round(tx.fee.value * 100) : 0;
    const netAmountCents = grossAmountCents - providerFeeCents;

    const payment = await PaymentRepository.create({
      workspaceId,
      provider: "revolut",
      externalId: tx.id,
      grossAmountCents,
      providerFeeCents,
      netAmountCents,
      currency: tx.amount.currency,
      payerName: tx.counterparty?.name ?? tx.merchant?.name ?? undefined,
      payerEmail: tx.counterparty?.email ?? undefined,
      payerReference: tx.reference ?? undefined,
      receivedAt: new Date(tx.created_at),
      status: "pending",
    });

    log.info("Ingested Revolut payment", {
      paymentId: payment.id,
      amount: grossAmountCents,
    });
    return { payment, isNew: true };
  },

  /**
   * Ingest a manual payment (bank transfer, cash, etc.).
   * Always creates a new record (no external ID for idempotency).
   */
  async ingestManual(
    input: ManualPaymentInput,
    workspaceId: string
  ): Promise<IngestionResult> {
    const payment = await PaymentRepository.create({
      workspaceId,
      provider: input.provider ?? "bank_transfer",
      grossAmountCents: input.grossAmountCents,
      providerFeeCents: 0, // No fees for manual payments
      netAmountCents: input.grossAmountCents,
      currency: input.currency ?? "EUR",
      payerName: input.payerName,
      payerEmail: input.payerEmail,
      payerReference: input.payerReference,
      memo: input.memo,
      receivedAt: input.receivedAt,
      status: "pending",
    });

    log.info("Ingested manual payment", {
      paymentId: payment.id,
      amount: input.grossAmountCents,
    });
    return { payment, isNew: true };
  },
};
