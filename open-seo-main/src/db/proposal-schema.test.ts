/**
 * Tests for proposal schema types and validation.
 * Phase 30: Interactive Proposals - Schema & Builder
 *
 * TDD: Tests written FIRST before implementation.
 */
import { describe, it, expect } from "vitest";
import type {
  ProposalStatus,
  ProposalContent,
  BrandConfig,
  PaymentStatus,
  ProposalSelect,
  ProposalInsert,
  ProposalViewSelect,
  ProposalSignatureSelect,
  ProposalPaymentSelect,
} from "./proposal-schema";

describe("ProposalSchema Types", () => {
  describe("ProposalStatus", () => {
    it("should include all valid status values", () => {
      const validStatuses: ProposalStatus[] = [
        "draft",
        "sent",
        "viewed",
        "accepted",
        "signed",
        "paid",
        "onboarded",
        "expired",
        "declined",
      ];

      expect(validStatuses).toHaveLength(9);
      validStatuses.forEach((status) => {
        expect(status).toBeTruthy();
      });
    });

    it("should support state machine transitions", () => {
      // Valid transitions:
      // draft -> sent
      // sent -> viewed, expired, declined
      // viewed -> accepted, expired, declined
      // accepted -> signed, expired, declined
      // signed -> paid
      // paid -> onboarded
      const validTransitions: Record<ProposalStatus, ProposalStatus[]> = {
        draft: ["sent"],
        sent: ["viewed", "expired", "declined"],
        viewed: ["accepted", "expired", "declined"],
        accepted: ["signed", "expired", "declined"],
        signed: ["paid"],
        paid: ["onboarded"],
        onboarded: [],
        expired: [],
        declined: [],
      };

      expect(validTransitions.draft).toContain("sent");
      expect(validTransitions.sent).toContain("viewed");
      expect(validTransitions.viewed).toContain("accepted");
      expect(validTransitions.accepted).toContain("signed");
      expect(validTransitions.signed).toContain("paid");
      expect(validTransitions.paid).toContain("onboarded");
    });
  });

  describe("ProposalContent", () => {
    it("should accept valid proposal content", () => {
      const validContent: ProposalContent = {
        hero: {
          headline: "Grow Your Online Presence",
          subheadline: "SEO strategy tailored for your business",
          trafficValue: 15000,
        },
        currentState: {
          traffic: 500,
          keywords: 150,
          value: 2500,
          chartData: [
            { month: "Jan", traffic: 450 },
            { month: "Feb", traffic: 480 },
            { month: "Mar", traffic: 500 },
          ],
        },
        opportunities: [
          {
            keyword: "seo services",
            volume: 2400,
            difficulty: "medium",
            potential: 5000,
          },
          {
            keyword: "local seo",
            volume: 1200,
            difficulty: "easy",
            potential: 3500,
          },
        ],
        roi: {
          projectedTrafficGain: 2000,
          trafficValue: 10000,
          defaultConversionRate: 0.02,
          defaultAov: 150,
        },
        investment: {
          setupFee: 2500,
          monthlyFee: 1500,
          inclusions: [
            "Technical SEO audit",
            "Content optimization",
            "Monthly reporting",
          ],
        },
        nextSteps: [
          "Sign agreement",
          "Complete onboarding call",
          "Receive audit report",
        ],
      };

      expect(validContent.hero.headline).toBeTruthy();
      expect(validContent.opportunities).toHaveLength(2);
      expect(validContent.investment.inclusions).toHaveLength(3);
    });

    it("should handle opportunity difficulty levels", () => {
      const difficulties: Array<"easy" | "medium" | "hard"> = [
        "easy",
        "medium",
        "hard",
      ];

      difficulties.forEach((diff) => {
        expect(["easy", "medium", "hard"]).toContain(diff);
      });
    });
  });

  describe("BrandConfig", () => {
    it("should accept valid brand configuration", () => {
      const validConfig: BrandConfig = {
        logoUrl: "https://example.com/logo.png",
        primaryColor: "#2563eb",
        secondaryColor: "#1e40af",
        fontFamily: "Inter",
      };

      expect(validConfig.primaryColor).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(validConfig.secondaryColor).toMatch(/^#[0-9a-fA-F]{6}$/);
    });

    it("should allow null logoUrl", () => {
      const configWithoutLogo: BrandConfig = {
        logoUrl: null,
        primaryColor: "#2563eb",
        secondaryColor: "#1e40af",
        fontFamily: "Inter",
      };

      expect(configWithoutLogo.logoUrl).toBeNull();
    });
  });

  describe("PaymentStatus", () => {
    it("should include all valid payment status values", () => {
      const validStatuses: PaymentStatus[] = ["pending", "completed", "failed"];

      expect(validStatuses).toHaveLength(3);
      validStatuses.forEach((status) => {
        expect(status).toBeTruthy();
      });
    });
  });

  describe("Proposal table types", () => {
    it("should have required fields for insert", () => {
      // ProposalInsert should require at minimum:
      // - workspaceId
      // - content
      // - token
      const minimalInsert: ProposalInsert = {
        id: "proposal-123",
        workspaceId: "workspace-456",
        content: {
          hero: {
            headline: "Test",
            subheadline: "Test",
            trafficValue: 0,
          },
          currentState: {
            traffic: 0,
            keywords: 0,
            value: 0,
            chartData: [],
          },
          opportunities: [],
          roi: {
            projectedTrafficGain: 0,
            trafficValue: 0,
            defaultConversionRate: 0,
            defaultAov: 0,
          },
          investment: {
            setupFee: 0,
            monthlyFee: 0,
            inclusions: [],
          },
          nextSteps: [],
        },
        token: "unique-token-abc123",
      };

      expect(minimalInsert.workspaceId).toBeTruthy();
      expect(minimalInsert.content).toBeDefined();
      expect(minimalInsert.token).toBeTruthy();
    });

    it("should have optional prospectId for standalone proposals", () => {
      const withoutProspect: Partial<ProposalInsert> = {
        workspaceId: "workspace-456",
        prospectId: undefined,
      };

      expect(withoutProspect.prospectId).toBeUndefined();
    });
  });

  describe("ProposalView table types", () => {
    it("should track engagement metrics", () => {
      const view: ProposalViewSelect = {
        id: "view-123",
        proposalId: "proposal-456",
        viewedAt: new Date(),
        durationSeconds: 120,
        sectionsViewed: ["hero", "opportunities", "roi"],
        roiCalculatorUsed: true,
        deviceType: "desktop",
        ipHash: "abc123hash",
        createdAt: new Date(),
      };

      expect(view.durationSeconds).toBeGreaterThan(0);
      expect(view.sectionsViewed).toContain("roi");
      expect(view.roiCalculatorUsed).toBe(true);
    });
  });

  describe("ProposalSignature table types", () => {
    it("should support Dokobit integration fields", () => {
      const signature: ProposalSignatureSelect = {
        id: "sig-123",
        proposalId: "proposal-456",
        signerName: "John Doe",
        signerPersonalCodeHash: "hashedcode123",
        signingMethod: "smart_id",
        dokobitSessionId: "dokobit-session-xyz",
        signedPdfUrl: "https://storage.example.com/signed/proposal.pdf",
        signedAt: new Date(),
        createdAt: new Date(),
      };

      expect(signature.signingMethod).toMatch(/^(smart_id|mobile_id)$/);
      expect(signature.dokobitSessionId).toBeTruthy();
    });
  });

  describe("ProposalPayment table types", () => {
    it("should support Stripe integration fields", () => {
      const payment: ProposalPaymentSelect = {
        id: "pay-123",
        proposalId: "proposal-456",
        provider: "stripe",
        stripeSessionId: "cs_test_abc123",
        stripePaymentIntentId: "pi_test_def456",
        stripeSubscriptionId: "sub_test_ghi789",
        amountCents: 250000,
        currency: "EUR",
        status: "completed",
        paidAt: new Date(),
        createdAt: new Date(),
      };

      expect(payment.amountCents).toBe(250000);
      expect(payment.currency).toBe("EUR");
      expect(payment.provider).toBe("stripe");
    });
  });
});
