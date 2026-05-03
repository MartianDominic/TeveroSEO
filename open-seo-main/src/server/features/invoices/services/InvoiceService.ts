/**
 * Invoice lifecycle management service.
 * Phase 48: Contract & Payment
 * Phase 55-05: Added localization support
 *
 * Per D-06: Invoice created after contract signed.
 * Per D-07: Payment webhook updates invoice and contract status.
 */
import { eq, and, ne } from "drizzle-orm";
import { db } from "@/db";
import { invoices, type InvoiceLineItem, type InvoiceInsert, type InvoiceSelect } from "@/db/invoice-schema";
import { contracts } from "@/db/contract-schema";
import { proposals } from "@/db/proposal-schema";
import { InvoiceRepository } from "../../contracts/repositories/InvoiceRepository";
import { ActivityRepository } from "../../contracts/repositories/ActivityRepository";
import { StripeService } from "./StripeService";
import { PaymentProviderFactory } from "../../payments/PaymentProviderFactory";
import type { PaymentProviderType } from "../../payments/types";
import { getLanguageResolutionService } from "@/server/services/LanguageResolutionService";
import { getTranslationService } from "@/server/services/translation/TranslationService";
import type { SupportedLocale } from "@/server/services/translation/types";
import { AppError } from "@/server/lib/errors";
import { createLogger } from "@/server/lib/logger";
import { nanoid } from "nanoid";

const log = createLogger({ module: "InvoiceService" });

/**
 * Invoice labels for localization.
 * Phase 55-05: Multi-language invoice support.
 */
export const INVOICE_LABELS = {
  en: {
    invoice: "Invoice",
    invoiceNumber: "Invoice Number",
    date: "Date",
    dueDate: "Due Date",
    billTo: "Bill To",
    description: "Description",
    quantity: "Quantity",
    unitPrice: "Unit Price",
    amount: "Amount",
    subtotal: "Subtotal",
    tax: "VAT",
    total: "Total",
    paymentTerms: "Payment Terms",
    bankDetails: "Bank Details",
    thankYou: "Thank you for your business!",
  },
  lt: {
    invoice: "Saskaita faktura",
    invoiceNumber: "Saskaitos numeris",
    date: "Data",
    dueDate: "Mokejimo terminas",
    billTo: "Moketojas",
    description: "Aprasymas",
    quantity: "Kiekis",
    unitPrice: "Vieneto kaina",
    amount: "Suma",
    subtotal: "Tarpine suma",
    tax: "PVM",
    total: "Is viso",
    paymentTerms: "Mokejimo salygos",
    bankDetails: "Banko rekvizitai",
    thankYou: "Dekojame uz bendradarbiavima!",
  },
} as const;

/**
 * Invoice labels type.
 */
export type InvoiceLabels = (typeof INVOICE_LABELS)[keyof typeof INVOICE_LABELS];

/**
 * Get invoice labels for a language.
 */
export function getInvoiceLabels(language: SupportedLocale): InvoiceLabels {
  return INVOICE_LABELS[language] ?? INVOICE_LABELS.en;
}

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
 * Send invoice to client via selected payment provider.
 * Phase 54-03: Updated to support multiple providers.
 *
 * @param invoiceId - Invoice to send
 * @param customerEmail - Customer email address
 * @param customerName - Customer display name
 * @param preferredProvider - Optional provider preference ('stripe' | 'revolut')
 */
export async function sendToClient(
  invoiceId: string,
  customerEmail: string,
  customerName: string,
  preferredProvider?: PaymentProviderType,
): Promise<InvoiceSelect> {
  const invoice = await InvoiceRepository.getInvoiceById(invoiceId);

  if (!invoice) {
    throw new AppError("NOT_FOUND", "Invoice not found");
  }

  if (invoice.status !== "draft") {
    throw new AppError("CONFLICT", `Cannot send invoice in ${invoice.status} status`);
  }

  // Get payment provider (uses workspace settings or falls back to env)
  const provider = await PaymentProviderFactory.getProvider({
    workspaceId: invoice.workspaceId,
    preferredProvider,
  });

  // Create payment session with selected provider
  const session = await provider.createPaymentSession(invoice);

  // Update invoice with provider-specific details
  const updateFields: Parameters<typeof InvoiceRepository.updateInvoiceStatus>[2] = {
    sentAt: new Date(),
  };

  if (session.provider === "stripe") {
    updateFields.stripeInvoiceId = session.externalId;
    updateFields.stripePaymentUrl = session.paymentUrl;
  }

  // Update invoice status and provider
  const updated = await InvoiceRepository.updateInvoiceStatusWithProvider(
    invoiceId,
    "sent",
    session.provider,
    session.provider === "revolut" ? session.externalId : undefined,
    session.provider === "revolut" ? session.paymentUrl : undefined,
    updateFields
  );

  // Log activity
  await ActivityRepository.recordStatusChange(
    invoice.workspaceId,
    "invoice",
    invoiceId,
    "draft",
    "sent"
  );

  log.info("Invoice sent to client", {
    invoiceId,
    provider: session.provider,
    externalId: session.externalId,
  });

  return updated!;
}

/**
 * Handle successful payment from webhook.
 * Phase 54-03: Updated to support multiple providers.
 * Phase 54-FIX: Added atomic update to prevent race conditions.
 * Per D-07: payment.succeeded → update contract status to "executed".
 *
 * @param externalId - Provider's invoice/order ID (stripeInvoiceId or revolutOrderId)
 * @param paymentId - Provider's payment ID (stripePaymentIntentId or revolut payment ID)
 * @param provider - Payment provider ('stripe' | 'revolut')
 * @returns Object indicating if payment was processed or already handled
 */
export async function handlePaymentSuccess(
  externalId: string,
  paymentId: string,
  provider: PaymentProviderType = "stripe",
): Promise<{ alreadyProcessed: boolean }> {
  // Look up invoice by provider-specific ID
  const invoice = provider === "revolut"
    ? await InvoiceRepository.getInvoiceByRevolutOrderId(externalId)
    : await InvoiceRepository.getInvoiceByStripeId(externalId);

  if (!invoice) {
    log.warn(`Invoice not found for ${provider} ID`, { externalId, provider });
    return { alreadyProcessed: false }; // Not our invoice
  }

  // ATOMIC UPDATE: Use WHERE clause to prevent race conditions
  // Two concurrent webhooks could both pass the status check before either updates,
  // so we use an atomic update that only succeeds if status is NOT already "paid"
  const [updated] = await db
    .update(invoices)
    .set({
      status: "paid",
      paidAt: new Date(),
      updatedAt: new Date(),
      ...(provider === "stripe" && { stripePaymentIntentId: paymentId }),
    })
    .where(and(
      eq(invoices.id, invoice.id),
      ne(invoices.status, "paid") // Only update if not already paid
    ))
    .returning();

  if (!updated) {
    // Invoice was already paid (race condition resolved)
    log.info("Invoice already paid (atomic check), skipping", { invoiceId: invoice.id });
    return { alreadyProcessed: true };
  }

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

  // Log invoice status change with provider info
  await ActivityRepository.insertActivity({
    id: nanoid(),
    workspaceId: invoice.workspaceId,
    entityType: "invoice",
    entityId: invoice.id,
    activityType: provider === "revolut" ? "revolut_payment_completed" : "paid",
    activityData: { provider, paymentId, externalId },
  });

  log.info("Payment successful", {
    invoiceId: invoice.id,
    contractId: invoice.contractId,
    provider,
  });

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

  // Phase 65: Convert prospect to client after successful payment
  // Look up the contract -> proposal -> prospect chain, then mark converted
  if (invoice.contractId) {
    try {
      const [contract] = await db
        .select()
        .from(contracts)
        .where(eq(contracts.id, invoice.contractId))
        .limit(1);

      // Get prospectId from the proposal (contracts link to proposals, not prospects directly)
      if (contract?.proposalId) {
        const [proposal] = await db
          .select()
          .from(proposals)
          .where(eq(proposals.id, contract.proposalId))
          .limit(1);

        if (proposal?.prospectId && invoice.clientId) {
          const { ProspectService } = await import("../../prospects/services/ProspectService");
          // Convert prospect to client - clientId comes from the invoice
          await ProspectService.markConverted(proposal.prospectId, invoice.clientId);
          log.info("Prospect converted to client", {
            prospectId: proposal.prospectId,
            clientId: invoice.clientId,
          });
        }
      }
    } catch (error) {
      // Log but don't fail - conversion can be done manually
      log.error("Failed to convert prospect to client", error instanceof Error ? error : new Error(String(error)));
    }
  }

  return { alreadyProcessed: false };
}

export const InvoiceService = {
  createFromContract,
  sendToClient,
  handlePaymentSuccess,
};
