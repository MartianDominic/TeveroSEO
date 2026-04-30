/**
 * Invoice lifecycle management service.
 * Phase 48: Contract & Payment
 *
 * Per D-06: Invoice created after contract signed.
 * Per D-07: Payment webhook updates invoice and contract status.
 */
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { invoices, type InvoiceLineItem, type InvoiceInsert, type InvoiceSelect } from "@/db/invoice-schema";
import { contracts } from "@/db/contract-schema";
import { proposals } from "@/db/proposal-schema";
import { InvoiceRepository } from "../../contracts/repositories/InvoiceRepository";
import { ActivityRepository } from "../../contracts/repositories/ActivityRepository";
import { StripeService } from "./StripeService";
import { AppError } from "@/server/lib/errors";
import { createLogger } from "@/server/lib/logger";
import { nanoid } from "nanoid";

const log = createLogger({ module: "InvoiceService" });

/**
 * Create invoice from signed contract.
 * Per D-06: Invoice created after contract signed.
 */
export async function createFromContract(
  contractId: string,
  workspaceId: string,
): Promise<InvoiceSelect> {
  // Get contract
  const [contract] = await db
    .select()
    .from(contracts)
    .where(and(
      eq(contracts.id, contractId),
      eq(contracts.workspaceId, workspaceId)
    ))
    .limit(1);

  if (!contract) {
    throw new AppError("NOT_FOUND", "Contract not found");
  }

  if (contract.status !== "signed") {
    throw new AppError("CONFLICT", `Cannot create invoice for contract in ${contract.status} status`);
  }

  // Get proposal for pricing
  let setupFeeCents = 250000; // Default 2500 EUR
  let monthlyFeeCents = 150000; // Default 1500 EUR
  let currency = "EUR";

  if (contract.proposalId) {
    const [proposal] = await db
      .select()
      .from(proposals)
      .where(eq(proposals.id, contract.proposalId))
      .limit(1);

    if (proposal) {
      setupFeeCents = proposal.setupFeeCents ?? setupFeeCents;
      monthlyFeeCents = proposal.monthlyFeeCents ?? monthlyFeeCents;
      currency = proposal.currency ?? currency;
    }
  }

  const lineItems: InvoiceLineItem[] = [];

  if (setupFeeCents > 0) {
    lineItems.push({
      id: nanoid(),
      description: "SEO Setup Fee / SEO pradinis mokestis",
      quantity: 1,
      unitPriceCents: setupFeeCents,
      totalCents: setupFeeCents,
    });
  }

  if (monthlyFeeCents > 0) {
    lineItems.push({
      id: nanoid(),
      description: "SEO Monthly Service / SEO mėnesinis mokestis",
      quantity: 1,
      unitPriceCents: monthlyFeeCents,
      totalCents: monthlyFeeCents,
    });
  }

  const subtotalCents = lineItems.reduce((sum, item) => sum + item.totalCents, 0);
  const taxCents = 0; // Tax handled by Stripe or separate logic
  const totalCents = subtotalCents + taxCents;

  // Generate invoice number
  const invoiceNumber = `INV-${new Date().getFullYear()}-${nanoid(6).toUpperCase()}`;

  const invoiceData: InvoiceInsert = {
    id: nanoid(),
    workspaceId: contract.workspaceId,
    clientId: contract.clientId!,
    contractId: contract.id,
    invoiceNumber,
    lineItems,
    subtotalCents,
    taxCents,
    totalCents,
    currency,
    status: "draft",
    dueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
  };

  const invoice = await InvoiceRepository.insertInvoice(invoiceData);

  // Log activity
  await ActivityRepository.insertActivity({
    id: nanoid(),
    workspaceId: contract.workspaceId,
    entityType: "invoice",
    entityId: invoice.id,
    activityType: "created",
    activityData: { contractId, totalCents },
  });

  log.info("Invoice created from contract", { invoiceId: invoice.id, contractId });
  return invoice;
}

/**
 * Send invoice to client via Stripe.
 */
export async function sendToClient(
  invoiceId: string,
  customerEmail: string,
  customerName: string,
): Promise<InvoiceSelect> {
  const invoice = await InvoiceRepository.getInvoiceById(invoiceId);

  if (!invoice) {
    throw new AppError("NOT_FOUND", "Invoice not found");
  }

  if (invoice.status !== "draft") {
    throw new AppError("CONFLICT", `Cannot send invoice in ${invoice.status} status`);
  }

  // Get or create Stripe customer
  const customerId = await StripeService.getOrCreateCustomer(
    customerEmail,
    customerName,
    invoice.clientId
  );

  // Create Stripe invoice
  const stripeResult = await StripeService.createInvoice({
    customerId,
    contractId: invoice.contractId!,
    setupFeeCents: invoice.lineItems.find((li: InvoiceLineItem) => li.description.includes("Setup"))?.totalCents || 0,
    monthlyFeeCents: invoice.lineItems.find((li: InvoiceLineItem) => li.description.includes("Monthly"))?.totalCents || 0,
    currency: invoice.currency || "EUR",
  });

  // Update invoice with Stripe details
  const updated = await InvoiceRepository.updateInvoiceStatus(
    invoiceId,
    "sent",
    {
      sentAt: new Date(),
      stripeInvoiceId: stripeResult.stripeInvoiceId,
      stripePaymentUrl: stripeResult.stripePaymentUrl,
    }
  );

  // Log activity
  await ActivityRepository.recordStatusChange(
    invoice.workspaceId,
    "invoice",
    invoiceId,
    "draft",
    "sent"
  );

  log.info("Invoice sent to client", { invoiceId, stripeInvoiceId: stripeResult.stripeInvoiceId });
  return updated!;
}

/**
 * Handle successful payment from Stripe webhook.
 * Per D-07: payment.succeeded → update contract status to "paid".
 */
export async function handlePaymentSuccess(
  stripeInvoiceId: string,
  stripePaymentIntentId: string,
): Promise<void> {
  const invoice = await InvoiceRepository.getInvoiceByStripeId(stripeInvoiceId);

  if (!invoice) {
    log.warn("Invoice not found for Stripe ID", { stripeInvoiceId });
    return; // Not our invoice
  }

  if (invoice.status === "paid") {
    log.info("Invoice already paid, skipping", { invoiceId: invoice.id });
    return; // Idempotent
  }

  // Update invoice to paid
  await InvoiceRepository.updateInvoiceStatus(
    invoice.id,
    "paid",
    {
      paidAt: new Date(),
      stripePaymentIntentId,
    }
  );

  // Update contract to executed (paid contracts are executed)
  if (invoice.contractId) {
    await db
      .update(contracts)
      .set({
        status: "executed",
        executedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(
        eq(contracts.id, invoice.contractId),
        eq(contracts.status, "signed")
      ));

    // Log contract status change
    await ActivityRepository.recordStatusChange(
      invoice.workspaceId,
      "contract",
      invoice.contractId,
      "signed",
      "executed"
    );
  }

  // Log invoice status change
  await ActivityRepository.recordStatusChange(
    invoice.workspaceId,
    "invoice",
    invoice.id,
    invoice.status,
    "paid"
  );

  log.info("Payment successful", { invoiceId: invoice.id, contractId: invoice.contractId });

  // Trigger onboarding checklist creation (Payment before onboarding requirement)
  if (invoice.contractId) {
    try {
      const { OnboardingService } = await import("../../onboarding/services/OnboardingService");
      await OnboardingService.createFromContract(invoice.contractId, invoice.workspaceId);
      log.info("Onboarding triggered", { contractId: invoice.contractId });
    } catch (error) {
      // Log but don't fail - onboarding can be created manually
      log.error("Failed to create onboarding checklist", error instanceof Error ? error : new Error(String(error)));
    }
  }
}

export const InvoiceService = {
  createFromContract,
  sendToClient,
  handlePaymentSuccess,
};
