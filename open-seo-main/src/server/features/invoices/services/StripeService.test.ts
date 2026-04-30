import { describe, it, expect, vi, beforeEach } from "vitest";
import { StripeService } from "./StripeService";

// Mock Stripe
const mockInvoicesCreate = vi.fn();
const mockInvoicesFinalizeInvoice = vi.fn();
const mockInvoiceItemsCreate = vi.fn();
const mockCustomersSearch = vi.fn();
const mockCustomersCreate = vi.fn();
const mockWebhooksConstructEvent = vi.fn();

vi.mock("stripe", () => {
  return {
    default: class MockStripe {
      invoices = {
        create: mockInvoicesCreate,
        finalizeInvoice: mockInvoicesFinalizeInvoice,
      };
      invoiceItems = {
        create: mockInvoiceItemsCreate,
      };
      customers = {
        search: mockCustomersSearch,
        create: mockCustomersCreate,
      };
      webhooks = {
        constructEvent: mockWebhooksConstructEvent,
      };
    },
  };
});

// Mock runtime-env
vi.mock("@/server/lib/runtime-env", () => ({
  getRequiredEnvValue: vi.fn(),
}));

// Mock logger
vi.mock("@/server/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

describe("StripeService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_123";
  });

  describe("createInvoice", () => {
    it("should create Stripe invoice with setup and monthly line items", async () => {
      const draftInvoice = { id: "in_draft_123" };
      const finalizedInvoice = {
        id: "in_123",
        hosted_invoice_url: "https://invoice.stripe.com/i/abc",
        amount_due: 400000,
      };

      mockInvoicesCreate.mockResolvedValue(draftInvoice);
      mockInvoicesFinalizeInvoice.mockResolvedValue(finalizedInvoice);
      mockInvoiceItemsCreate.mockResolvedValue({ id: "ii_123" });

      const result = await StripeService.createInvoice({
        customerId: "cus_123",
        contractId: "contract_123",
        setupFeeCents: 250000,
        monthlyFeeCents: 150000,
        currency: "EUR",
      });

      expect(mockInvoicesCreate).toHaveBeenCalledWith({
        customer: "cus_123",
        currency: "eur",
        metadata: { contract_id: "contract_123" },
        auto_advance: false,
        collection_method: "send_invoice",
        days_until_due: 14,
      });

      expect(mockInvoiceItemsCreate).toHaveBeenCalledTimes(2);
      expect(mockInvoiceItemsCreate).toHaveBeenCalledWith({
        customer: "cus_123",
        invoice: "in_draft_123",
        description: "SEO Setup Fee / SEO pradinis mokestis",
        amount: 250000,
        currency: "eur",
      });
      expect(mockInvoiceItemsCreate).toHaveBeenCalledWith({
        customer: "cus_123",
        invoice: "in_draft_123",
        description: "SEO Monthly Service (First Month) / SEO mėnesinis mokestis (pirmas mėnuo)",
        amount: 150000,
        currency: "eur",
      });

      expect(mockInvoicesFinalizeInvoice).toHaveBeenCalledWith("in_draft_123");

      expect(result).toEqual({
        stripeInvoiceId: "in_123",
        stripePaymentUrl: "https://invoice.stripe.com/i/abc",
        totalCents: 400000,
      });
    });

    it("should skip zero-amount line items", async () => {
      const draftInvoice = { id: "in_draft_123" };
      const finalizedInvoice = {
        id: "in_123",
        hosted_invoice_url: "https://invoice.stripe.com/i/abc",
        amount_due: 150000,
      };

      mockInvoicesCreate.mockResolvedValue(draftInvoice);
      mockInvoicesFinalizeInvoice.mockResolvedValue(finalizedInvoice);
      mockInvoiceItemsCreate.mockResolvedValue({ id: "ii_123" });

      await StripeService.createInvoice({
        customerId: "cus_123",
        contractId: "contract_123",
        setupFeeCents: 0,
        monthlyFeeCents: 150000,
        currency: "EUR",
      });

      expect(mockInvoiceItemsCreate).toHaveBeenCalledTimes(1);
      expect(mockInvoiceItemsCreate).toHaveBeenCalledWith({
        customer: "cus_123",
        invoice: "in_draft_123",
        description: "SEO Monthly Service (First Month) / SEO mėnesinis mokestis (pirmas mėnuo)",
        amount: 150000,
        currency: "eur",
      });
    });

    it("should throw EXTERNAL_SERVICE_ERROR if Stripe fails", async () => {
      mockInvoicesCreate.mockRejectedValue(new Error("Stripe API error"));

      await expect(
        StripeService.createInvoice({
          customerId: "cus_123",
          contractId: "contract_123",
          setupFeeCents: 250000,
          monthlyFeeCents: 150000,
          currency: "EUR",
        })
      ).rejects.toThrow("Failed to create Stripe invoice");
    });

    it("should throw if hosted_invoice_url is missing", async () => {
      const draftInvoice = { id: "in_draft_123" };
      const finalizedInvoice = {
        id: "in_123",
        hosted_invoice_url: null,
        amount_due: 400000,
      };

      mockInvoicesCreate.mockResolvedValue(draftInvoice);
      mockInvoicesFinalizeInvoice.mockResolvedValue(finalizedInvoice);
      mockInvoiceItemsCreate.mockResolvedValue({ id: "ii_123" });

      await expect(
        StripeService.createInvoice({
          customerId: "cus_123",
          contractId: "contract_123",
          setupFeeCents: 250000,
          monthlyFeeCents: 150000,
          currency: "EUR",
        })
      ).rejects.toThrow("Stripe did not return payment URL");
    });
  });

  describe("verifyWebhook", () => {
    it("should verify webhook signature and return event", () => {
      const rawBody = Buffer.from('{"type":"invoice.payment_succeeded"}');
      const signature = "sig_123";
      const mockEvent = { id: "evt_123", type: "invoice.payment_succeeded", data: {} };

      mockWebhooksConstructEvent.mockReturnValue(mockEvent);

      const result = StripeService.verifyWebhook(rawBody, signature);

      expect(mockWebhooksConstructEvent).toHaveBeenCalledWith(
        rawBody,
        signature,
        "whsec_test_123"
      );
      expect(result).toEqual(mockEvent);
    });

    it("should throw FORBIDDEN on invalid signature", () => {
      const rawBody = Buffer.from('{"type":"invoice.payment_succeeded"}');
      const signature = "invalid_sig";

      mockWebhooksConstructEvent.mockImplementation(() => {
        throw new Error("Signature verification failed");
      });

      expect(() => {
        StripeService.verifyWebhook(rawBody, signature);
      }).toThrow("Invalid webhook signature");
    });

    it("should throw AUTH_CONFIG_MISSING if webhook secret not configured", () => {
      delete process.env.STRIPE_WEBHOOK_SECRET;

      const rawBody = Buffer.from('{"type":"invoice.payment_succeeded"}');
      const signature = "sig_123";

      expect(() => {
        StripeService.verifyWebhook(rawBody, signature);
      }).toThrow("STRIPE_WEBHOOK_SECRET not configured");
    });
  });

  describe("getOrCreateCustomer", () => {
    it("should return existing customer ID if found", async () => {
      mockCustomersSearch.mockResolvedValue({
        data: [{ id: "cus_existing_123" }],
      });

      const result = await StripeService.getOrCreateCustomer(
        "client@example.com",
        "Client Name",
        "client_uuid_123"
      );

      expect(mockCustomersSearch).toHaveBeenCalledWith({
        query: 'metadata["client_id"]:"client_uuid_123"',
      });
      expect(result).toBe("cus_existing_123");
      expect(mockCustomersCreate).not.toHaveBeenCalled();
    });

    it("should create new customer if not found", async () => {
      mockCustomersSearch.mockResolvedValue({
        data: [],
      });
      mockCustomersCreate.mockResolvedValue({
        id: "cus_new_123",
      });

      const result = await StripeService.getOrCreateCustomer(
        "client@example.com",
        "Client Name",
        "client_uuid_123"
      );

      expect(mockCustomersSearch).toHaveBeenCalledWith({
        query: 'metadata["client_id"]:"client_uuid_123"',
      });
      expect(mockCustomersCreate).toHaveBeenCalledWith({
        email: "client@example.com",
        name: "Client Name",
        metadata: { client_id: "client_uuid_123" },
      });
      expect(result).toBe("cus_new_123");
    });
  });
});
