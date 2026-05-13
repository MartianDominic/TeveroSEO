/**
 * Tests for ProposalGenerationService
 * Phase 101-06: Tiered AI Proposal Generation
 *
 * Tests all 4 generation modes per D-03:
 * - FULL_AI: AI generates complete proposal
 * - AI_ASSISTED: AI expands user-provided details
 * - TEMPLATE_MANUAL: Template with package pricing, no AI
 * - BLANK: Empty structure, no AI
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: "proposal_1" }]),
  },
}));

vi.mock("./AIProposalGenerator", () => ({
  AIProposalGenerator: {
    generateFull: vi.fn(),
    expandContent: vi.fn(),
  },
}));

vi.mock("nanoid", () => ({
  nanoid: vi.fn((length?: number) => length === 32 ? "token_12345678901234567890123456" : "prop_123456"),
}));

import { ProposalGenerationService, ProposalGenerationMode } from "./ProposalGenerationService";
import { AIProposalGenerator } from "./AIProposalGenerator";
import { db } from "@/db";

describe("ProposalGenerationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ProposalGenerationMode enum", () => {
    it("should export all 4 generation modes", () => {
      expect(ProposalGenerationMode.FULL_AI).toBe("full_ai");
      expect(ProposalGenerationMode.AI_ASSISTED).toBe("ai_assisted");
      expect(ProposalGenerationMode.TEMPLATE_MANUAL).toBe("template_manual");
      expect(ProposalGenerationMode.BLANK).toBe("blank");
    });
  });

  describe("generate with FULL_AI mode", () => {
    it("should call AIProposalGenerator.generateFull and create proposal", async () => {
      const mockProspect = { id: "prospect_1", domain: "example.com", companyName: "Example Corp", workspaceId: "ws_1" };
      const mockTemplate = {
        id: "tmpl_1",
        packages: [{
          id: "pkg_premium",
          name: "Premium",
          setupFee: 500,
          monthlyFee: 1500,
          inclusions: ["SEO Audit", "Content"],
          description: "Full service"
        }]
      };
      const mockContent = {
        hero: { headline: "Grow Example Corp", subheadline: "SEO Strategy", trafficValue: 50000 },
        currentState: { traffic: 1000, keywords: 50, value: 5000, chartData: [] },
        opportunities: [{ keyword: "seo services", volume: 1000, difficulty: "medium", potential: 500 }],
        roi: { projectedTrafficGain: 5000, trafficValue: 25000, defaultConversionRate: 0.02, defaultAov: 100 },
        nextSteps: ["Review Proposal", "Schedule Call", "Begin Partnership"],
      };

      vi.mocked(db.where)
        .mockResolvedValueOnce([mockProspect] as any) // prospect lookup
        .mockResolvedValueOnce([mockTemplate] as any); // template lookup
      vi.mocked(AIProposalGenerator.generateFull).mockResolvedValue(mockContent as any);

      const result = await ProposalGenerationService.generate(
        {
          mode: ProposalGenerationMode.FULL_AI,
          data: { prospectId: "prospect_1", packageId: "pkg_premium" },
        },
        "ws_1",
        "user_1"
      );

      expect(AIProposalGenerator.generateFull).toHaveBeenCalledWith(
        expect.objectContaining({
          domain: "example.com",
          companyName: "Example Corp",
          packageName: "Premium",
        })
      );
      expect(result.mode).toBe(ProposalGenerationMode.FULL_AI);
      expect(result.aiGenerated).toBe(true);
      expect(db.insert).toHaveBeenCalled();
    });
  });

  describe("generate with AI_ASSISTED mode", () => {
    it("should call AIProposalGenerator.expandContent with partial content", async () => {
      const mockProspect = { id: "prospect_2", domain: "acme.com", companyName: "ACME", workspaceId: "ws_1" };
      const mockTemplate = {
        id: "tmpl_1",
        packages: [{
          id: "pkg_standard",
          name: "Standard",
          setupFee: 300,
          monthlyFee: 1000,
          inclusions: ["SEO Audit"],
          description: "Standard service"
        }]
      };
      const mockExpandedContent = {
        hero: { headline: "Custom Headline", subheadline: "AI expanded", trafficValue: 30000 },
        currentState: { traffic: 500, keywords: 25, value: 2500, chartData: [] },
        opportunities: [],
        roi: { projectedTrafficGain: 2500, trafficValue: 12500, defaultConversionRate: 0.02, defaultAov: 100 },
        nextSteps: ["Review", "Call", "Start"],
      };

      vi.mocked(db.where)
        .mockResolvedValueOnce([mockProspect] as any)
        .mockResolvedValueOnce([mockTemplate] as any);
      vi.mocked(AIProposalGenerator.expandContent).mockResolvedValue(mockExpandedContent as any);

      const result = await ProposalGenerationService.generate(
        {
          mode: ProposalGenerationMode.AI_ASSISTED,
          data: {
            prospectId: "prospect_2",
            packageId: "pkg_standard",
            partialContent: {
              headline: "Custom Headline",
              painPoints: ["Low traffic", "Poor rankings"],
            },
          },
        },
        "ws_1",
        "user_1"
      );

      expect(AIProposalGenerator.expandContent).toHaveBeenCalledWith(
        expect.objectContaining({
          domain: "acme.com",
          partialContent: expect.objectContaining({ headline: "Custom Headline" }),
        })
      );
      expect(result.aiGenerated).toBe(true);
    });
  });

  describe("generate with TEMPLATE_MANUAL mode", () => {
    it("should return template content without AI involvement", async () => {
      const mockProspect = { id: "prospect_3", domain: "manual.com", companyName: "Manual Corp", workspaceId: "ws_1" };
      const mockTemplate = {
        id: "tmpl_1",
        packages: [{
          id: "pkg_basic",
          name: "Basic",
          setupFee: 200,
          monthlyFee: 500,
          inclusions: ["Basic SEO"],
          description: "Basic service"
        }]
      };

      vi.mocked(db.where)
        .mockResolvedValueOnce([mockProspect] as any)
        .mockResolvedValueOnce([mockTemplate] as any);

      const result = await ProposalGenerationService.generate(
        {
          mode: ProposalGenerationMode.TEMPLATE_MANUAL,
          data: { prospectId: "prospect_3", templateId: "tmpl_1", packageId: "pkg_basic" },
        },
        "ws_1",
        "user_1"
      );

      expect(AIProposalGenerator.generateFull).not.toHaveBeenCalled();
      expect(AIProposalGenerator.expandContent).not.toHaveBeenCalled();
      expect(result.aiGenerated).toBe(false);
      expect(result.content.investment.monthlyFee).toBe(500);
    });
  });

  describe("generate with BLANK mode", () => {
    it("should return empty proposal structure without any AI calls", async () => {
      const result = await ProposalGenerationService.generate(
        {
          mode: ProposalGenerationMode.BLANK,
          data: { prospectId: "prospect_4" },
        },
        "ws_1",
        "user_1"
      );

      expect(AIProposalGenerator.generateFull).not.toHaveBeenCalled();
      expect(AIProposalGenerator.expandContent).not.toHaveBeenCalled();
      expect(result.aiGenerated).toBe(false);
      expect(result.content.hero.headline).toBe("");
      expect(result.content.investment.setupFee).toBe(0);
      expect(result.content.investment.monthlyFee).toBe(0);
    });
  });

  describe("error handling", () => {
    it("should throw error for unknown generation mode", async () => {
      await expect(
        ProposalGenerationService.generate(
          {
            mode: "invalid_mode" as any,
            data: { prospectId: "prospect_1" },
          },
          "ws_1",
          "user_1"
        )
      ).rejects.toThrow("Unknown generation mode");
    });

    it("should throw error when prospect not found in FULL_AI mode", async () => {
      vi.mocked(db.where).mockResolvedValueOnce([]);

      await expect(
        ProposalGenerationService.generate(
          {
            mode: ProposalGenerationMode.FULL_AI,
            data: { prospectId: "nonexistent", packageId: "pkg_1" },
          },
          "ws_1",
          "user_1"
        )
      ).rejects.toThrow("Prospect not found");
    });

    it("should throw error when package not found", async () => {
      const mockProspect = { id: "prospect_1", domain: "example.com", companyName: "Example Corp", workspaceId: "ws_1" };
      const mockTemplate = { id: "tmpl_1", packages: [] };

      vi.mocked(db.where)
        .mockResolvedValueOnce([mockProspect] as any)
        .mockResolvedValueOnce([mockTemplate] as any);

      await expect(
        ProposalGenerationService.generate(
          {
            mode: ProposalGenerationMode.FULL_AI,
            data: { prospectId: "prospect_1", packageId: "nonexistent_pkg" },
          },
          "ws_1",
          "user_1"
        )
      ).rejects.toThrow("Package not found");
    });
  });
});
