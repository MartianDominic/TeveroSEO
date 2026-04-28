/**
 * Tests for ProposalGeneratorService.
 * Phase 43-06: Proposal Generation
 *
 * Tests full proposal generation orchestration with awareness classification,
 * section generation, and database persistence.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock database
const mockProspect = {
  id: "prosp_test123",
  workspaceId: "ws_test",
  domain: "plaukucentras.lt",
  companyName: "Plauku Centras",
  notes: "Norime SEO paslaugas",
  source: "website_form",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockAnalysis = {
  id: "anal_test123",
  prospectId: "prosp_test123",
  analysisType: "deep_dive",
  status: "completed",
  competitorDomains: ["konkurentas.lt", "antras.lt"],
  domainMetrics: {
    domainRank: 25,
    organicTraffic: 500,
    organicKeywords: 120,
    backlinks: 50,
    referringDomains: 20,
  },
  organicKeywords: [
    { keyword: "plauku prieziura", position: 15, searchVolume: 500, cpc: 0.5 },
    { keyword: "plauku dziovintuvas", position: 22, searchVolume: 800, cpc: 1.2 },
  ],
  keywordGaps: [
    {
      keyword: "plauku formavimas",
      competitorDomain: "konkurentas.lt",
      competitorPosition: 3,
      searchVolume: 1200,
      cpc: 0.8,
      difficulty: 35,
      trafficPotential: 180,
    },
    {
      keyword: "plauku stiliai",
      competitorDomain: "konkurentas.lt",
      competitorPosition: 5,
      searchVolume: 900,
      cpc: 0.6,
      difficulty: 45,
      trafficPotential: 135,
    },
  ],
  scrapedContent: {
    businessInfo: {
      summary: "Plauku prieziuros ir kirpyklos paslaugos Vilniuje",
      products: ["kirpimas", "dazymas"],
      services: ["kirpykla", "grožio salonas"],
      brands: [],
      location: "Vilnius",
      targetMarket: "residential" as const,
      confidence: 0.85,
    },
    pages: [],
    businessLinks: null,
    totalCostCents: 0,
    scrapedAt: new Date().toISOString(),
  },
  costCents: 40,
  createdAt: new Date(),
  completedAt: new Date(),
};

// Default sections response
const defaultSectionsResponse = [
  {
    type: "executive_summary",
    content:
      "Plauku Centras turi galimybe pasiekti 2,500 organiniu lankytoju per menesi.",
    language: "lt",
    generatedAt: new Date().toISOString(),
  },
  {
    type: "investment",
    content: JSON.stringify({
      investment_section: {
        value_stack: { total_value: 3000 },
        cta: { primary_button: "Pradeti projekta" },
      },
    }),
    language: "lt",
    generatedAt: new Date().toISOString(),
  },
];

// Default classification response
const defaultClassificationResponse = {
  awarenessLevel: "solution-aware",
  confidence: 0.85,
  signalsDetected: ["SEO mention", "service inquiry"],
  hookStrategy: "Differentiate your methodology",
  recommendedApproach: {
    openingAngle: "Our unique approach",
    primaryCialdini: "authority",
    objectionsToAddress: ["cost", "timeline"],
  },
  reasoning: "Prospect mentioned SEO services",
};

// Create shared mock functions at module level
const mockClassify = vi.fn();
const mockQuickClassify = vi.fn();
const mockGenerateSections = vi.fn();
const mockGenerateSection = vi.fn();
const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();

// Mock modules - use factory that returns the shared mock functions
vi.mock("@/db", () => ({
  db: {
    select: () => mockDbSelect(),
    insert: () => mockDbInsert(),
  },
}));

vi.mock("@/db/proposal-schema", () => ({
  proposals: { id: "proposals" },
}));

vi.mock("@/db/prospect-schema", () => ({
  prospects: { id: "prospects" },
  prospectAnalyses: { id: "prospect_analyses" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  desc: vi.fn(),
}));

vi.mock("nanoid", () => ({
  nanoid: () => "mock_nanoid_12345",
}));

vi.mock("./AwarenessClassifier", () => ({
  awarenessClassifier: {
    classify: () => mockClassify(),
    quickClassify: () => mockQuickClassify(),
  },
}));

vi.mock("./SectionGenerator", () => ({
  sectionGenerator: {
    generateSections: (...args: unknown[]) => mockGenerateSections(...args),
    generateSection: (...args: unknown[]) => mockGenerateSection(...args),
  },
}));

// Import AFTER mocks are set up
import {
  ProposalGeneratorService,
  type GenerateProposalInput,
} from "./ProposalGeneratorService";

describe("ProposalGeneratorService", () => {
  let service: ProposalGeneratorService;

  beforeEach(() => {
    service = new ProposalGeneratorService();
    vi.clearAllMocks();

    // Set up default mock return values
    mockClassify.mockResolvedValue(defaultClassificationResponse);
    mockQuickClassify.mockReturnValue("solution-aware");
    mockGenerateSections.mockResolvedValue(defaultSectionsResponse);
    mockGenerateSection.mockResolvedValue({
      type: "executive_summary",
      content: "Regenerated content",
      language: "lt",
      generatedAt: new Date().toISOString(),
    });

    // Set up default db mock
    mockDbSelect.mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => [mockProspect]),
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => [mockAnalysis]),
          })),
        })),
      })),
    });
    mockDbInsert.mockReturnValue({
      values: vi.fn(() => Promise.resolve()),
    });
  });

  describe("generateProposal", () => {
    it("should generate proposal with correct scenario sections", async () => {
      const input: GenerateProposalInput = {
        prospectId: "prosp_test123",
        scenario: "focused",
        pricing: {
          setupFee: 500,
          monthlyFee: 800,
          contractMonths: 6,
        },
      };

      const result = await service.generateProposal(input);

      expect(result.proposalId).toContain("prop_");
      expect(result.scenario).toBe("focused");
      expect(result.sections).toHaveLength(2); // Mocked to return 2 sections
      expect(mockGenerateSections).toHaveBeenCalled();
    });

    it("should classify awareness level when not provided", async () => {
      const input: GenerateProposalInput = {
        prospectId: "prosp_test123",
        scenario: "full_audit",
        pricing: {
          setupFee: 500,
          monthlyFee: 800,
          contractMonths: 6,
        },
      };

      const result = await service.generateProposal(input);

      expect(mockClassify).toHaveBeenCalled();
      expect(result.awarenessLevel).toBe("solution-aware");
    });

    it("should use provided awareness level without classification", async () => {
      const input: GenerateProposalInput = {
        prospectId: "prosp_test123",
        scenario: "competitor_only",
        awarenessLevel: "most-aware",
        pricing: {
          setupFee: 500,
          monthlyFee: 800,
          contractMonths: 6,
        },
      };

      const result = await service.generateProposal(input);

      expect(mockClassify).not.toHaveBeenCalled();
      expect(result.awarenessLevel).toBe("most-aware");
    });

    it("should save proposal to database with correct structure", async () => {
      const input: GenerateProposalInput = {
        prospectId: "prosp_test123",
        scenario: "focused",
        pricing: {
          setupFee: 500,
          monthlyFee: 800,
          contractMonths: 6,
        },
        agencyInfo: {
          name: "Tevero",
          positioning: "Lithuanian SEO experts",
        },
      };

      await service.generateProposal(input);

      expect(mockDbInsert).toHaveBeenCalled();
    });

    it("should fallback to quick classify when AI fails", async () => {
      mockClassify.mockRejectedValueOnce(new Error("API error"));

      const input: GenerateProposalInput = {
        prospectId: "prosp_test123",
        scenario: "focused",
        pricing: {
          setupFee: 500,
          monthlyFee: 800,
          contractMonths: 6,
        },
      };

      const result = await service.generateProposal(input);

      expect(mockQuickClassify).toHaveBeenCalled();
      expect(result.awarenessLevel).toBe("solution-aware");
    });

    it("should include agency info in section input", async () => {
      const input: GenerateProposalInput = {
        prospectId: "prosp_test123",
        scenario: "focused",
        pricing: {
          setupFee: 500,
          monthlyFee: 800,
          contractMonths: 6,
        },
        agencyInfo: {
          name: "Tevero SEO",
          positioning: "Lithuanian market experts",
          differentiators: ["Local expertise", "AI-powered"],
          caseStudies: [{ client: "Client A", result: "+340% traffic" }],
        },
      };

      await service.generateProposal(input);

      const generateCall = mockGenerateSections.mock.calls[0];
      const sectionInput = generateCall[1];

      expect(sectionInput.agencyName).toBe("Tevero SEO");
      expect(sectionInput.differentiators).toContain("Local expertise");
    });
  });

  describe("regenerateSection", () => {
    it("should regenerate a single section", async () => {
      // Mock proposal lookup
      mockDbSelect
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(() => [
                {
                  id: "prop_test",
                  prospectId: "prosp_test123",
                  setupFeeCents: 50000,
                  monthlyFeeCents: 80000,
                },
              ]),
            })),
          })),
        })
        // Mock prospect lookup
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(() => [mockProspect]),
            })),
          })),
        });

      const result = await service.regenerateSection(
        "prop_test",
        "executive_summary"
      );

      expect(result.type).toBe("executive_summary");
      expect(result.content).toBe("Regenerated content");
      expect(mockGenerateSection).toHaveBeenCalledWith(
        "executive_summary",
        expect.objectContaining({
          domain: "plaukucentras.lt",
        })
      );
    });
  });

  describe("scenario configurations", () => {
    it("should use correct sections for focused scenario", async () => {
      const input: GenerateProposalInput = {
        prospectId: "prosp_test123",
        scenario: "focused",
        pricing: {
          setupFee: 150,
          monthlyFee: 0,
          contractMonths: 1,
        },
      };

      await service.generateProposal(input);

      const generateCall = mockGenerateSections.mock.calls[0];
      const sectionTypes = generateCall[0];

      expect(sectionTypes).toContain("executive_summary");
      expect(sectionTypes).toContain("keyword_analysis");
      expect(sectionTypes).toContain("investment");
      expect(sectionTypes).not.toContain("current_state"); // Only in full_audit
    });

    it("should use correct sections for full_audit scenario", async () => {
      const input: GenerateProposalInput = {
        prospectId: "prosp_test123",
        scenario: "full_audit",
        pricing: {
          setupFee: 800,
          monthlyFee: 0,
          contractMonths: 1,
        },
      };

      await service.generateProposal(input);

      const generateCall = mockGenerateSections.mock.calls[0];
      const sectionTypes = generateCall[0];

      expect(sectionTypes).toContain("current_state"); // Only in full_audit
      expect(sectionTypes).toContain("executive_summary");
    });

    it("should use correct sections for competitor_only scenario", async () => {
      const input: GenerateProposalInput = {
        prospectId: "prosp_test123",
        scenario: "competitor_only",
        pricing: {
          setupFee: 250,
          monthlyFee: 0,
          contractMonths: 1,
        },
      };

      await service.generateProposal(input);

      const generateCall = mockGenerateSections.mock.calls[0];
      const sectionTypes = generateCall[0];

      expect(sectionTypes).toContain("competitor_comparison");
      expect(sectionTypes).toContain("investment");
      expect(sectionTypes).not.toContain("keyword_analysis"); // Not in competitor_only
    });
  });
});
