/**
 * EmailService tests
 * Phase 46-47: Proposal System
 *
 * TDD RED → GREEN phase tests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ProposalSelect } from "@/db/proposal-schema";
import { AppError } from "@/server/lib/errors";

// Mock functions need to be hoisted
const { mockEmailsSend, mockRender } = vi.hoisted(() => ({
  mockEmailsSend: vi.fn(),
  mockRender: vi.fn(),
}));

// Mock Resend
vi.mock("resend", () => ({
  Resend: class MockResend {
    emails = {
      send: mockEmailsSend,
    };
  },
}));

// Mock React Email render
vi.mock("@react-email/render", () => ({
  render: mockRender,
}));

// Import after mocks
import { EmailService, sendProposalEmail } from "./EmailService";

describe("EmailService", () => {
  const mockProposal: ProposalSelect = {
    id: "prop123",
    prospectId: "prospect123",
    workspaceId: "workspace123",
    template: "standard",
    content: {
      hero: {
        headline: "Test Proposal",
        subheadline: "Test",
        trafficValue: 1000,
      },
      currentState: {
        traffic: 500,
        keywords: 50,
        value: 500,
        chartData: [],
      },
      opportunities: [],
      roi: {
        projectedTrafficGain: 100,
        trafficValue: 200,
        defaultConversionRate: 0.02,
        defaultAov: 150,
      },
      investment: {
        setupFee: 2500,
        monthlyFee: 1500,
        inclusions: ["SEO Audit"],
      },
      nextSteps: ["Accept proposal"],
    },
    brandConfig: null,
    setupFeeCents: 250000,
    monthlyFeeCents: 150000,
    currency: "EUR",
    status: "draft",
    token: "test-token-12345678901234567890",
    expiresAt: new Date("2026-06-01"),
    sentAt: null,
    firstViewedAt: null,
    acceptedAt: null,
    signedAt: null,
    paidAt: null,
    declinedReason: null,
    declinedNotes: null,
    createdAt: new Date("2026-04-30"),
    updatedAt: new Date("2026-04-30"),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Set environment variable for tests
    process.env.RESEND_API_KEY = "test-api-key";
    process.env.PUBLIC_URL = "https://app.tevero.io";

    // Reset mock default behavior
    mockRender.mockResolvedValue("<html>Test Email</html>");
  });

  describe("sendProposalEmail", () => {
    it("should send email successfully with valid proposal", async () => {
      mockEmailsSend.mockResolvedValue({
        data: { id: "email-123" },
        error: null,
      });

      const result = await sendProposalEmail({
        proposal: mockProposal,
        recipientEmail: "test@example.com",
        recipientName: "Test User",
        companyName: "Test Company",
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe("email-123");
      expect(mockEmailsSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "test@example.com",
          subject: "SEO pasiulymas: Test Company",
          html: expect.any(String),
        }),
      );
    });

    it("should throw AppError when RESEND_API_KEY is missing", async () => {
      delete process.env.RESEND_API_KEY;

      await expect(
        sendProposalEmail({
          proposal: mockProposal,
          recipientEmail: "test@example.com",
          recipientName: "Test User",
          companyName: "Test Company",
        }),
      ).rejects.toThrow(AppError);

      await expect(
        sendProposalEmail({
          proposal: mockProposal,
          recipientEmail: "test@example.com",
          recipientName: "Test User",
          companyName: "Test Company",
        }),
      ).rejects.toThrow("RESEND_API_KEY not configured");
    });

    it("should construct correct proposal URL with token", async () => {
      mockEmailsSend.mockResolvedValue({
        data: { id: "email-123" },
        error: null,
      });

      await sendProposalEmail({
        proposal: mockProposal,
        recipientEmail: "test@example.com",
        recipientName: "Test User",
        companyName: "Test Company",
      });

      // Verify that buildProposalUrl generates correct URL
      const expectedUrl = EmailService.buildProposalUrl(mockProposal.token);
      expect(expectedUrl).toBe(
        `https://app.tevero.io/proposals/${mockProposal.token}`
      );

      // Verify render was called (props are in React element, not directly accessible in test)
      expect(mockRender).toHaveBeenCalled();
    });

    it("should handle Resend API errors gracefully", async () => {
      // Mock returns error immediately (no retries needed for this test)
      mockEmailsSend
        .mockResolvedValueOnce({
          data: null,
          error: { message: "Invalid email address" },
        })
        .mockResolvedValueOnce({
          data: null,
          error: { message: "Invalid email address" },
        })
        .mockResolvedValueOnce({
          data: null,
          error: { message: "Invalid email address" },
        });

      const result = await sendProposalEmail({
        proposal: mockProposal,
        recipientEmail: "invalid-email",
        recipientName: "Test User",
        companyName: "Test Company",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid email address");
      expect(mockEmailsSend).toHaveBeenCalledTimes(3); // All 3 retries
    }, 10000); // Increase timeout for retry delays
  });

  describe("EmailService.buildProposalUrl", () => {
    it("should build correct URL from token", () => {
      const url = EmailService.buildProposalUrl("test-token-123");
      expect(url).toBe("https://app.tevero.io/proposals/test-token-123");
    });
  });
});
