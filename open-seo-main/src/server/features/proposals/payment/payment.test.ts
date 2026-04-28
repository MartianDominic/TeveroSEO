/**
 * Tests for proposal payment service (Stripe).
 * Phase 30-06: Payment (Stripe)
 *
 * TDD: Tests written FIRST before implementation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Store original env
const originalEnv = process.env;

// Mock nanoid
vi.mock("nanoid", () => ({
  nanoid: () => "mock-payment-id",
}));

// Mock logger
vi.mock("@/server/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

// Mock Stripe client
const mockStripeCheckoutSessionsCreate = vi.fn();
const mockStripeWebhooksConstructEvent = vi.fn();

vi.mock("stripe", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      checkout: {
        sessions: {
          create: mockStripeCheckoutSessionsCreate,
        },
      },
      webhooks: {
        constructEvent: mockStripeWebhooksConstructEvent,
      },
    })),
  };
});

// Mock database
const mockInsertValues = vi.fn();
const mockUpdateSet = vi.fn();
const mockSelectResult = vi.fn();
const mockReturning = vi.fn();

// Create a transaction-aware mock that passes `tx` with the same API as `db`
const createDbMock = () => ({
  select: () => ({
    from: () => ({
      where: mockSelectResult,
    }),
  }),
  insert: () => ({
    values: mockInsertValues.mockReturnValue({
      returning: mockReturning,
    }),
  }),
  update: () => ({
    set: mockUpdateSet.mockReturnValue({
      where: () => ({
        returning: mockReturning,
      }),
    }),
  }),
});

vi.mock("@/db/index", () => ({
  db: {
    ...createDbMock(),
    transaction: vi.fn(async (callback: (tx: ReturnType<typeof createDbMock>) => Promise<unknown>) => {
      return callback(createDbMock());
    }),
  },
}));

// Mock ProposalService
vi.mock("../services/ProposalService", () => ({
  ProposalService: {
    findById: vi.fn(),
    findByToken: vi.fn(),
  },
}));

describe("PaymentService", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset modules and re-mock Stripe to ensure mock is always active
    vi.resetModules();
    vi.doMock("stripe", () => {
      return {
        default: vi.fn().mockImplementation(() => ({
          checkout: {
            sessions: {
              create: mockStripeCheckoutSessionsCreate,
            },
          },
          webhooks: {
            constructEvent: mockStripeWebhooksConstructEvent,
          },
        })),
      };
    });
    process.env = {
      ...originalEnv,
      STRIPE_SECRET_KEY: "sk_test_mock_key",
      STRIPE_WEBHOOK_SECRET: "whsec_test_mock",
      APP_URL: "https://app.example.com",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("createPaymentCheckout", () => {
    const mockProposal = {
      id: "proposal-123",
      prospectId: "prospect-456",
      workspaceId: "workspace-789",
      template: "standard",
      content: {
        hero: { headline: "Test Company", subheadline: "SEO", trafficValue: 1000 },
        currentState: { traffic: 100, keywords: 50, value: 500, chartData: [] },
        opportunities: [],
        roi: { projectedTrafficGain: 500, trafficValue: 2500, defaultConversionRate: 0.02, defaultAov: 100 },
        investment: { setupFee: 2000, monthlyFee: 1000, inclusions: [] },
        nextSteps: [],
      },
      setupFeeCents: 200000, // 2000 EUR
      monthlyFeeCents: 100000, // 1000 EUR
      currency: "EUR",
      status: "signed",
      token: "token-abc",
      brandConfig: null,
      expiresAt: null,
      sentAt: new Date(),
      firstViewedAt: new Date(),
      acceptedAt: new Date(),
      signedAt: new Date(),
      paidAt: null,
      declinedReason: null,
      declinedNotes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      views: [],
      signatures: [],
      payments: [],
    };

    it("should create a Stripe checkout session with setup fee only", async () => {
      const { ProposalService } = await import("../services/ProposalService");
      vi.mocked(ProposalService.findById).mockResolvedValue(mockProposal);

      mockStripeCheckoutSessionsCreate.mockResolvedValue({
        id: "cs_test_123",
        url: "https://checkout.stripe.com/pay/cs_test_123",
      });

      mockReturning.mockResolvedValue([{ id: "mock-payment-id" }]);

      const { createPaymentCheckout } = await import("./payment");

      const result = await createPaymentCheckout({
        proposalId: "proposal-123",
        customerEmail: "customer@example.com",
        setupFeeCents: 200000,
        successUrl: "https://app.example.com/p/token-abc/payment/success",
        cancelUrl: "https://app.example.com/p/token-abc?payment=cancelled",
      });

      expect(result.checkoutUrl).toBe("https://checkout.stripe.com/pay/cs_test_123");
      expect(mockStripeCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "payment",
          customer_email: "customer@example.com",
          locale: "lt",
          metadata: { proposalId: "proposal-123" },
          success_url: "https://app.example.com/p/token-abc/payment/success",
          cancel_url: "https://app.example.com/p/token-abc?payment=cancelled",
        })
      );
    });

    it("should create a Stripe checkout session with subscription for monthly fee", async () => {
      const { ProposalService } = await import("../services/ProposalService");
      vi.mocked(ProposalService.findById).mockResolvedValue(mockProposal);

      mockStripeCheckoutSessionsCreate.mockResolvedValue({
        id: "cs_test_sub_456",
        url: "https://checkout.stripe.com/pay/cs_test_sub_456",
      });

      mockReturning.mockResolvedValue([{ id: "mock-payment-id" }]);

      const { createPaymentCheckout } = await import("./payment");

      const result = await createPaymentCheckout({
        proposalId: "proposal-123",
        customerEmail: "customer@example.com",
        setupFeeCents: 200000,
        monthlyFeeCents: 100000,
        successUrl: "https://app.example.com/p/token-abc/payment/success",
        cancelUrl: "https://app.example.com/p/token-abc?payment=cancelled",
      });

      expect(result.checkoutUrl).toBe("https://checkout.stripe.com/pay/cs_test_sub_456");
      expect(mockStripeCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "subscription",
          locale: "lt",
        })
      );
    });

    it("should include line items for setup fee", async () => {
      const { ProposalService } = await import("../services/ProposalService");
      vi.mocked(ProposalService.findById).mockResolvedValue(mockProposal);

      mockStripeCheckoutSessionsCreate.mockResolvedValue({
        id: "cs_test_789",
        url: "https://checkout.stripe.com/pay/cs_test_789",
      });

      mockReturning.mockResolvedValue([{ id: "mock-payment-id" }]);

      const { createPaymentCheckout } = await import("./payment");

      await createPaymentCheckout({
        proposalId: "proposal-123",
        customerEmail: "customer@example.com",
        setupFeeCents: 200000,
        successUrl: "https://app.example.com/success",
        cancelUrl: "https://app.example.com/cancel",
      });

      const callArgs = mockStripeCheckoutSessionsCreate.mock.calls[0][0];
      expect(callArgs.line_items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            price_data: expect.objectContaining({
              currency: "eur",
              unit_amount: 200000,
              product_data: expect.objectContaining({
                name: expect.stringContaining("SEO"),
              }),
            }),
            quantity: 1,
          }),
        ])
      );
    });

    it("should include recurring line items for monthly fee subscription", async () => {
      const { ProposalService } = await import("../services/ProposalService");
      vi.mocked(ProposalService.findById).mockResolvedValue(mockProposal);

      mockStripeCheckoutSessionsCreate.mockResolvedValue({
        id: "cs_test_monthly",
        url: "https://checkout.stripe.com/pay/cs_test_monthly",
      });

      mockReturning.mockResolvedValue([{ id: "mock-payment-id" }]);

      const { createPaymentCheckout } = await import("./payment");

      await createPaymentCheckout({
        proposalId: "proposal-123",
        customerEmail: "customer@example.com",
        setupFeeCents: 0,
        monthlyFeeCents: 100000,
        successUrl: "https://app.example.com/success",
        cancelUrl: "https://app.example.com/cancel",
      });

      const callArgs = mockStripeCheckoutSessionsCreate.mock.calls[0][0];
      expect(callArgs.line_items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            price_data: expect.objectContaining({
              currency: "eur",
              unit_amount: 100000,
              recurring: {
                interval: "month",
              },
            }),
          }),
        ])
      );
    });

    it("should store payment record in database with pending status", async () => {
      const { ProposalService } = await import("../services/ProposalService");
      vi.mocked(ProposalService.findById).mockResolvedValue(mockProposal);

      mockStripeCheckoutSessionsCreate.mockResolvedValue({
        id: "cs_test_store",
        url: "https://checkout.stripe.com/pay/cs_test_store",
      });

      mockReturning.mockResolvedValue([{ id: "mock-payment-id" }]);

      const { createPaymentCheckout } = await import("./payment");

      await createPaymentCheckout({
        proposalId: "proposal-123",
        customerEmail: "customer@example.com",
        setupFeeCents: 200000,
        successUrl: "https://app.example.com/success",
        cancelUrl: "https://app.example.com/cancel",
      });

      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          proposalId: "proposal-123",
          provider: "stripe",
          stripeSessionId: "cs_test_store",
          amountCents: 200000,
          currency: "EUR",
          status: "pending",
        })
      );
    });

    it("should throw error if STRIPE_SECRET_KEY is not set", async () => {
      delete process.env.STRIPE_SECRET_KEY;

      const { createPaymentCheckout } = await import("./payment");

      await expect(
        createPaymentCheckout({
          proposalId: "proposal-123",
          customerEmail: "customer@example.com",
          setupFeeCents: 200000,
          successUrl: "https://app.example.com/success",
          cancelUrl: "https://app.example.com/cancel",
        })
      ).rejects.toThrow(/STRIPE_SECRET_KEY/);
    });
  });

  describe("handleStripeWebhook", () => {
    it("should handle checkout.session.completed event and update payment status", async () => {
      const mockEvent = {
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_completed",
            metadata: { proposalId: "proposal-123" },
            payment_intent: "pi_test_123",
            subscription: null,
          },
        },
      };

      mockReturning.mockResolvedValue([{ id: "updated" }]);
      mockSelectResult.mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: "proposal-123", status: "signed" }]) });

      const { handleStripeWebhook } = await import("./payment");

      await handleStripeWebhook(mockEvent as any);

      // Should update payment record
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          stripePaymentIntentId: "pi_test_123",
          status: "completed",
        })
      );
    });

    it("should update proposal status to paid after checkout completion", async () => {
      const mockEvent = {
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_paid",
            metadata: { proposalId: "proposal-456" },
            payment_intent: "pi_test_456",
            subscription: null,
          },
        },
      };

      mockReturning.mockResolvedValue([{ id: "updated" }]);
      mockSelectResult.mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: "proposal-456", status: "signed" }]) });

      const { handleStripeWebhook } = await import("./payment");

      await handleStripeWebhook(mockEvent as any);

      // Should update proposal status to paid
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "paid",
        })
      );
    });

    it("should handle subscription creation in checkout completion", async () => {
      const mockEvent = {
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_sub",
            metadata: { proposalId: "proposal-789" },
            payment_intent: null,
            subscription: "sub_test_789",
          },
        },
      };

      mockReturning.mockResolvedValue([{ id: "updated" }]);
      mockSelectResult.mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: "proposal-789", status: "signed" }]) });

      const { handleStripeWebhook } = await import("./payment");

      await handleStripeWebhook(mockEvent as any);

      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          stripeSubscriptionId: "sub_test_789",
          status: "completed",
        })
      );
    });

    it("should ignore events without proposalId in metadata", async () => {
      const mockEvent = {
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_no_meta",
            metadata: {},
            payment_intent: "pi_test",
          },
        },
      };

      const { handleStripeWebhook } = await import("./payment");

      await handleStripeWebhook(mockEvent as any);

      // Should not update anything
      expect(mockUpdateSet).not.toHaveBeenCalled();
    });

    it("should handle invoice.paid event for subscription renewals", async () => {
      const mockEvent = {
        type: "invoice.paid",
        data: {
          object: {
            id: "in_test_renewal",
            subscription: "sub_test_renewal",
            amount_paid: 100000,
          },
        },
      };

      const { handleStripeWebhook } = await import("./payment");

      // Should not throw - just log for now
      await expect(handleStripeWebhook(mockEvent as any)).resolves.not.toThrow();
    });
  });

  describe("verifyWebhookSignature", () => {
    it("should verify valid webhook signature with string payload", async () => {
      const payload = JSON.stringify({ type: "test" });
      const signature = "valid_signature";

      mockStripeWebhooksConstructEvent.mockReturnValue({
        type: "checkout.session.completed",
        data: { object: {} },
      });

      const { verifyWebhookSignature } = await import("./payment");

      const event = verifyWebhookSignature(payload, signature);

      expect(event).toBeDefined();
      expect(mockStripeWebhooksConstructEvent).toHaveBeenCalledWith(
        payload,
        signature,
        "whsec_test_mock"
      );
    });

    it("should verify valid webhook signature with Buffer payload (raw bytes)", async () => {
      // This is the critical test: Stripe requires raw bytes for signature verification.
      // The webhook handler must pass req.rawBody or Buffer, not parsed JSON.
      const rawPayload = Buffer.from('{"type":"checkout.session.completed","data":{}}', "utf8");
      const signature = "t=1234567890,v1=abc123,v0=def456";

      mockStripeWebhooksConstructEvent.mockReturnValue({
        type: "checkout.session.completed",
        data: { object: {} },
      });

      const { verifyWebhookSignature } = await import("./payment");

      const event = verifyWebhookSignature(rawPayload, signature);

      expect(event).toBeDefined();
      expect(mockStripeWebhooksConstructEvent).toHaveBeenCalledWith(
        rawPayload,
        signature,
        "whsec_test_mock"
      );
    });

    it("should throw on invalid signature", async () => {
      const payload = JSON.stringify({ type: "test" });
      const signature = "invalid_signature";

      mockStripeWebhooksConstructEvent.mockImplementation(() => {
        throw new Error("Invalid signature");
      });

      const { verifyWebhookSignature } = await import("./payment");

      expect(() => verifyWebhookSignature(payload, signature)).toThrow(/Invalid signature/);
    });

    it("should throw if STRIPE_WEBHOOK_SECRET is not set", async () => {
      delete process.env.STRIPE_WEBHOOK_SECRET;

      vi.resetModules();

      const { verifyWebhookSignature } = await import("./payment");

      expect(() => verifyWebhookSignature("payload", "signature")).toThrow(
        /STRIPE_WEBHOOK_SECRET/
      );
    });
  });

  describe("getStripeClient", () => {
    it("should return a configured Stripe client", async () => {
      const { getStripeClient } = await import("./payment");

      const client = getStripeClient();

      expect(client).toBeDefined();
      expect(client.checkout).toBeDefined();
    });

    it("should throw if STRIPE_SECRET_KEY is not set", async () => {
      delete process.env.STRIPE_SECRET_KEY;

      // Clear module cache to re-evaluate
      vi.resetModules();

      const { getStripeClient } = await import("./payment");

      expect(() => getStripeClient()).toThrow(/STRIPE_SECRET_KEY/);
    });
  });
});
