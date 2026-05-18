/**
 * AutoMatchEngine - Confidence-based payment to invoice matching
 * Phase 101-02: Payment Reconciliation
 *
 * Implements D-02 priority cascade from CONTEXT.md:
 * 1. Invoice # in memo -> 100% confidence
 * 2. Exact amount + client email -> 95%
 * 3. Exact amount + date within 7 days -> 85%
 * 4. Fuzzy amount (+-EUR0.50) + client name -> 70%
 * 5. No match -> 0% (review queue)
 *
 * Payments with >= 90% confidence are auto-matched (status "matched").
 * Payments with < 90% confidence go to review queue (status "review").
 */
import { eq, and, gte, lte, ilike, desc, isNull, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { payments, type PaymentSelect, type MatchType, MATCH_TYPES } from "@/db/payment-schema";
import { invoices, type InvoiceSelect } from "@/db/invoice-schema";
import { clients, type ClientSelect } from "@/db/client-schema";
import { PaymentRepository } from "../repositories/PaymentRepository";
import { createLogger } from "@/server/lib/logger";
import { addDays, subDays } from "date-fns";

const log = createLogger({ module: "AutoMatchEngine" });

export interface MatchResult {
  invoiceId: string | null;
  confidence: number; // 0-100
  matchType: MatchType;
  suggestedInvoices?: Array<{
    id: string;
    invoiceNumber: string;
    totalCents: number;
    confidence: number;
  }>;
}

/** Auto-match threshold: payments >= this confidence are auto-matched */
const AUTO_MATCH_THRESHOLD = 90;

/** Fuzzy amount tolerance in cents (EUR 0.50) */
const FUZZY_AMOUNT_TOLERANCE_CENTS = 50;

/**
 * Escapes SQL LIKE pattern special characters to prevent injection.
 * Characters escaped: % (wildcard), _ (single char), \ (escape)
 *
 * H-09: SQL Pattern Injection Prevention
 */
function escapeLikePattern(input: string): string {
  return input.replace(/[%_\\]/g, "\\$&");
}

export const AutoMatchEngine = {
  /**
   * Attempt to auto-match a payment to an invoice.
   * Follows D-02 priority cascade from CONTEXT.md.
   *
   * @param payment - The payment to match
   * @returns MatchResult with invoiceId, confidence, matchType, and optional suggestions
   */
  async autoMatch(payment: PaymentSelect): Promise<MatchResult> {
    const { workspaceId, grossAmountCents, payerEmail, payerName, memo, receivedAt } = payment;

    // Priority 1: Invoice # in memo (100% confidence)
    if (memo) {
      const invoiceByMemo = await this.findInvoiceByMemo(memo, workspaceId);
      if (invoiceByMemo) {
        log.info("Matched by invoice memo", {
          paymentId: payment.id,
          invoiceId: invoiceByMemo.id,
          confidence: 100,
        });
        return {
          invoiceId: invoiceByMemo.id,
          confidence: 100,
          matchType: "invoice_memo",
        };
      }
    }

    // Priority 2: Exact amount + client email (95% confidence)
    if (payerEmail) {
      const invoiceByAmountEmail = await this.findInvoiceByAmountAndEmail(
        grossAmountCents,
        payerEmail,
        workspaceId
      );
      if (invoiceByAmountEmail) {
        log.info("Matched by amount + email", {
          paymentId: payment.id,
          invoiceId: invoiceByAmountEmail.id,
          confidence: 95,
        });
        return {
          invoiceId: invoiceByAmountEmail.id,
          confidence: 95,
          matchType: "exact_amount_email",
        };
      }
    }

    // Priority 3: Exact amount + date within 7 days (85% confidence)
    const invoiceByAmountDate = await this.findInvoiceByAmountAndDateRange(
      grossAmountCents,
      receivedAt,
      7,
      workspaceId
    );
    if (invoiceByAmountDate) {
      log.info("Matched by amount + date", {
        paymentId: payment.id,
        invoiceId: invoiceByAmountDate.id,
        confidence: 85,
      });
      return {
        invoiceId: invoiceByAmountDate.id,
        confidence: 85,
        matchType: "exact_amount_date",
      };
    }

    // Priority 4: Fuzzy amount + client name (70% confidence)
    if (payerName) {
      const invoiceByFuzzyAmountName = await this.findInvoiceByFuzzyAmountAndName(
        grossAmountCents,
        FUZZY_AMOUNT_TOLERANCE_CENTS,
        payerName,
        workspaceId
      );
      if (invoiceByFuzzyAmountName) {
        log.info("Matched by fuzzy amount + name", {
          paymentId: payment.id,
          invoiceId: invoiceByFuzzyAmountName.id,
          confidence: 70,
        });
        return {
          invoiceId: invoiceByFuzzyAmountName.id,
          confidence: 70,
          matchType: "fuzzy_amount_name",
        };
      }
    }

    // Priority 5: No match - return suggestions for review queue
    const suggestions = await this.findSuggestedMatches(payment);
    log.info("No auto-match found", {
      paymentId: payment.id,
      suggestionCount: suggestions.length,
    });
    return {
      invoiceId: null,
      confidence: 0,
      matchType: "none",
      suggestedInvoices: suggestions,
    };
  },

  /**
   * Process a payment through auto-match and update its status.
   * Payments >= 90% confidence are auto-matched; others go to review queue.
   *
   * @param paymentId - The payment ID to process
   * @param workspaceId - The workspace ID for tenant isolation
   * @returns MatchResult with the matching outcome
   */
  async processPayment(paymentId: string, workspaceId: string): Promise<MatchResult> {
    const payment = await PaymentRepository.findById(paymentId, workspaceId);
    if (!payment) {
      throw new Error(`Payment not found: ${paymentId}`);
    }

    const result = await this.autoMatch(payment);

    // Update payment status based on confidence
    const newStatus = result.confidence >= AUTO_MATCH_THRESHOLD ? "matched" : "review";
    await PaymentRepository.updateStatus(paymentId, workspaceId, newStatus, {
      matchedInvoiceId: result.invoiceId ?? undefined,
      confidence: result.confidence,
      matchType: result.matchType,
    });

    log.info("Payment processed", {
      paymentId,
      status: newStatus,
      confidence: result.confidence,
      matchType: result.matchType,
    });

    return result;
  },

  /**
   * Process multiple payments in batch with optimized queries.
   * Pre-fetches invoices and clients to avoid N+1 queries.
   *
   * M-ARCH-03: N+1 Query Pattern Prevention
   *
   * @param paymentIds - Array of payment IDs to process
   * @param workspaceId - The workspace ID for tenant isolation
   * @returns Map of payment ID to MatchResult
   */
  async processPaymentsBatch(
    paymentIds: string[],
    workspaceId: string
  ): Promise<Map<string, MatchResult>> {
    if (paymentIds.length === 0) {
      return new Map();
    }

    // Pre-fetch all payments in a single query
    const paymentsData = await db
      .select()
      .from(payments)
      .where(
        and(
          inArray(payments.id, paymentIds),
          eq(payments.workspaceId, workspaceId),
          eq(payments.status, "pending")
        )
      );

    if (paymentsData.length === 0) {
      return new Map();
    }

    // Pre-fetch all open invoices for workspace (for matching)
    const openInvoices = await db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.workspaceId, workspaceId),
          or(eq(invoices.status, "sent"), eq(invoices.status, "overdue"))
        )
      );

    // Pre-fetch clients with their emails
    const clientIds = [...new Set(openInvoices.map((i) => i.clientId))];
    const clientsData =
      clientIds.length > 0
        ? await db.select().from(clients).where(inArray(clients.id, clientIds))
        : [];

    // Build lookup maps for in-memory matching
    const clientMap = new Map(clientsData.map((c) => [c.id, c]));
    const invoicesByNumber = new Map<string, InvoiceSelect>();
    const invoicesByAmountEmail = new Map<string, InvoiceSelect[]>();

    for (const invoice of openInvoices) {
      // Index by invoice number (lowercase for case-insensitive matching)
      if (invoice.invoiceNumber) {
        invoicesByNumber.set(invoice.invoiceNumber.toLowerCase(), invoice);
      }

      // Index by amount + client email for exact matching
      const client = clientMap.get(invoice.clientId);
      if (client?.contactEmail) {
        const key = `${invoice.totalCents}:${client.contactEmail.toLowerCase()}`;
        const existing = invoicesByAmountEmail.get(key) ?? [];
        existing.push(invoice);
        invoicesByAmountEmail.set(key, existing);
      }
    }

    log.info("Batch processing initialized", {
      paymentCount: paymentsData.length,
      invoiceCount: openInvoices.length,
      clientCount: clientsData.length,
    });

    // Process each payment using in-memory lookups
    const results = new Map<string, MatchResult>();

    for (const payment of paymentsData) {
      const result = this.matchPaymentInMemory(
        payment,
        invoicesByNumber,
        invoicesByAmountEmail,
        clientMap,
        openInvoices
      );
      results.set(payment.id, result);

      // Update payment status based on confidence
      const newStatus =
        result.confidence >= AUTO_MATCH_THRESHOLD ? "matched" : "review";
      await PaymentRepository.updateStatus(payment.id, workspaceId, newStatus, {
        matchedInvoiceId: result.invoiceId ?? undefined,
        confidence: result.confidence,
        matchType: result.matchType,
      });
    }

    log.info("Batch processing complete", {
      processed: results.size,
      matched: [...results.values()].filter((r) => r.confidence >= AUTO_MATCH_THRESHOLD).length,
    });

    return results;
  },

  /**
   * Match a payment using pre-fetched in-memory data.
   * Follows the same priority cascade as autoMatch but without DB queries.
   */
  matchPaymentInMemory(
    payment: PaymentSelect,
    invoicesByNumber: Map<string, InvoiceSelect>,
    invoicesByAmountEmail: Map<string, InvoiceSelect[]>,
    clientMap: Map<string, ClientSelect>,
    allInvoices: InvoiceSelect[]
  ): MatchResult {
    const { grossAmountCents, payerEmail, payerName, memo } = payment;

    // Priority 1: Invoice # in memo (100% confidence)
    if (memo) {
      const patterns = [
        /INV[#-]?(\d+)/i,
        /#(\d+)/,
        /invoice\s*#?\s*(\d+)/i,
        /saskaita[#-]?\s*(\d+)/i,
      ];

      for (const pattern of patterns) {
        const match = memo.match(pattern);
        if (match) {
          const invoiceNumber = match[1];
          // Check for matching invoice number (case-insensitive)
          for (const [key, invoice] of invoicesByNumber) {
            if (key.includes(invoiceNumber.toLowerCase())) {
              return {
                invoiceId: invoice.id,
                confidence: 100,
                matchType: "invoice_memo",
              };
            }
          }
        }
      }
    }

    // Priority 2: Exact amount + client email (95% confidence)
    if (payerEmail) {
      const key = `${grossAmountCents}:${payerEmail.toLowerCase()}`;
      const matches = invoicesByAmountEmail.get(key);
      if (matches && matches.length === 1) {
        return {
          invoiceId: matches[0].id,
          confidence: 95,
          matchType: "exact_amount_email",
        };
      }
    }

    // Priority 3: Exact amount match (85% confidence)
    // Simplified for batch: check if unique exact amount match exists
    const exactAmountMatches = allInvoices.filter(
      (inv) => inv.totalCents === grossAmountCents
    );
    if (exactAmountMatches.length === 1) {
      return {
        invoiceId: exactAmountMatches[0].id,
        confidence: 85,
        matchType: "exact_amount_date",
      };
    }

    // Priority 4: Fuzzy amount + client name (70% confidence)
    if (payerName) {
      const minAmount = grossAmountCents - FUZZY_AMOUNT_TOLERANCE_CENTS;
      const maxAmount = grossAmountCents + FUZZY_AMOUNT_TOLERANCE_CENTS;
      const normalizedPayerName = payerName.toLowerCase();

      for (const invoice of allInvoices) {
        if (invoice.totalCents >= minAmount && invoice.totalCents <= maxAmount) {
          const client = clientMap.get(invoice.clientId);
          if (client?.name?.toLowerCase().includes(normalizedPayerName)) {
            return {
              invoiceId: invoice.id,
              confidence: 70,
              matchType: "fuzzy_amount_name",
            };
          }
        }
      }
    }

    // Priority 5: No match - return suggestions for review queue
    const suggestions = this.findSuggestedMatchesInMemory(payment, allInvoices);
    return {
      invoiceId: null,
      confidence: 0,
      matchType: "none",
      suggestedInvoices: suggestions,
    };
  },

  /**
   * Find suggested matches from in-memory invoice data.
   * Returns up to 5 invoices within 20% of payment amount.
   */
  findSuggestedMatchesInMemory(
    payment: PaymentSelect,
    allInvoices: InvoiceSelect[]
  ): Array<{ id: string; invoiceNumber: string; totalCents: number; confidence: number }> {
    const { grossAmountCents } = payment;
    const minAmount = Math.floor(grossAmountCents * 0.8);
    const maxAmount = Math.ceil(grossAmountCents * 1.2);

    return allInvoices
      .filter((inv) => inv.totalCents >= minAmount && inv.totalCents <= maxAmount)
      .slice(0, 5)
      .map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        totalCents: inv.totalCents,
        confidence: Math.max(
          0,
          Math.round(100 - (Math.abs(inv.totalCents - grossAmountCents) / grossAmountCents) * 100)
        ),
      }));
  },

  // --- Private helper methods ---

  /**
   * Find invoice by invoice number in memo.
   * Supports patterns: INV-042, #042, Invoice 042, Saskaita 042 (Lithuanian)
   */
  async findInvoiceByMemo(
    memo: string,
    workspaceId: string
  ): Promise<InvoiceSelect | null> {
    // Extract invoice number patterns
    const patterns = [
      /INV[#-]?(\d+)/i,
      /#(\d+)/,
      /invoice\s*#?\s*(\d+)/i,
      /saskaita[#-]?\s*(\d+)/i, // Lithuanian
    ];

    for (const pattern of patterns) {
      const match = memo.match(pattern);
      if (match) {
        const invoiceNumberPart = match[1]; // The captured numeric part
        // H-09: Escape SQL LIKE special characters to prevent injection
        const escapedPart = escapeLikePattern(invoiceNumberPart);
        const [invoice] = await db
          .select()
          .from(invoices)
          .where(
            and(
              eq(invoices.workspaceId, workspaceId),
              ilike(invoices.invoiceNumber, `%${escapedPart}%`),
              eq(invoices.status, "sent") // Only match unpaid invoices
            )
          )
          .limit(1);
        if (invoice) return invoice;
      }
    }
    return null;
  },

  /**
   * Find invoice by exact amount and client email.
   * Joins invoices with clients to match by email.
   */
  async findInvoiceByAmountAndEmail(
    amountCents: number,
    email: string,
    workspaceId: string
  ): Promise<InvoiceSelect | null> {
    const [result] = await db
      .select({ invoice: invoices })
      .from(invoices)
      .innerJoin(clients, eq(invoices.clientId, clients.id))
      .where(
        and(
          eq(invoices.workspaceId, workspaceId),
          eq(invoices.totalCents, amountCents),
          eq(invoices.status, "sent"),
          ilike(clients.contactEmail, email)
        )
      )
      .limit(1);
    return result?.invoice ?? null;
  },

  /**
   * Find invoice by exact amount and date within range.
   * Matches invoices sent within +/- dayRange days of payment date.
   */
  async findInvoiceByAmountAndDateRange(
    amountCents: number,
    paymentDate: Date,
    dayRange: number,
    workspaceId: string
  ): Promise<InvoiceSelect | null> {
    const startDate = subDays(paymentDate, dayRange);
    const endDate = addDays(paymentDate, dayRange);

    const [invoice] = await db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.workspaceId, workspaceId),
          eq(invoices.totalCents, amountCents),
          eq(invoices.status, "sent"),
          gte(invoices.sentAt, startDate),
          lte(invoices.sentAt, endDate)
        )
      )
      .orderBy(desc(invoices.sentAt)) // Most recent first
      .limit(1);
    return invoice ?? null;
  },

  /**
   * Find invoice by fuzzy amount and client name.
   * Matches invoices within +/- toleranceCents of payment amount
   * where client name contains the payer name.
   */
  async findInvoiceByFuzzyAmountAndName(
    amountCents: number,
    toleranceCents: number,
    name: string,
    workspaceId: string
  ): Promise<InvoiceSelect | null> {
    const minAmount = amountCents - toleranceCents;
    const maxAmount = amountCents + toleranceCents;
    // H-09: Escape SQL LIKE special characters to prevent injection
    const escapedName = escapeLikePattern(name);

    const [result] = await db
      .select({ invoice: invoices })
      .from(invoices)
      .innerJoin(clients, eq(invoices.clientId, clients.id))
      .where(
        and(
          eq(invoices.workspaceId, workspaceId),
          gte(invoices.totalCents, minAmount),
          lte(invoices.totalCents, maxAmount),
          eq(invoices.status, "sent"),
          ilike(clients.name, `%${escapedName}%`)
        )
      )
      .limit(1);
    return result?.invoice ?? null;
  },

  /**
   * Find suggested invoice matches for review queue.
   * Returns up to 5 unpaid invoices within 20% of payment amount.
   */
  async findSuggestedMatches(
    payment: PaymentSelect
  ): Promise<Array<{ id: string; invoiceNumber: string; totalCents: number; confidence: number }>> {
    const { workspaceId, grossAmountCents } = payment;

    // Find unpaid invoices within 20% of payment amount
    const minAmount = Math.floor(grossAmountCents * 0.8);
    const maxAmount = Math.ceil(grossAmountCents * 1.2);

    const candidates = await db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.workspaceId, workspaceId),
          eq(invoices.status, "sent"),
          gte(invoices.totalCents, minAmount),
          lte(invoices.totalCents, maxAmount)
        )
      )
      .orderBy(desc(invoices.sentAt))
      .limit(5);

    return candidates.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      totalCents: inv.totalCents,
      // Calculate suggestion confidence based on amount similarity
      confidence: Math.max(
        0,
        Math.round(100 - (Math.abs(inv.totalCents - grossAmountCents) / grossAmountCents) * 100)
      ),
    }));
  },
};
