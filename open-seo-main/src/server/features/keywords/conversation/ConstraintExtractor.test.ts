import { describe, it, expect, vi, beforeEach } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import type { Message } from "@anthropic-ai/sdk/resources/messages";
import {
  ConstraintExtractor,
  createConstraintExtractor,
  getDefaultExtractor,
} from "./ConstraintExtractor";

// Mock Anthropic SDK
vi.mock("@anthropic-ai/sdk", () => {
  const MockAnthropic = vi.fn();
  MockAnthropic.prototype.messages = {
    create: vi.fn(),
  };
  return { default: MockAnthropic };
});

describe("ConstraintExtractor", () => {
  const mockAnthropicResponse = (content: string): Message => ({
    id: "msg_test",
    type: "message",
    role: "assistant",
    content: [
      {
        type: "text",
        text: content,
      },
    ],
    model: "claude-sonnet-4-20250514",
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: {
      input_tokens: 100,
      output_tokens: 200,
    },
  });

  beforeEach(() => {
    // Set test API key
    process.env.ANTHROPIC_API_KEY = "test-api-key";

    // Clear all mocks
    vi.clearAllMocks();
  });

  describe("Lithuanian Conversations", () => {
    it("extracts local service B2B constraints (Case 1)", async () => {
      const case1Response = {
        constraints: {
          business: {
            type: "service",
            coreOffering: "automobilių plovykla",
            problemsSolved: ["nešvarūs automobiliai", "flotų priežiūra"],
            productCategories: ["plovimas", "detailing"],
          },
          geo: {
            scope: "city",
            includeCities: ["šiauliai"],
            excludeCities: [],
            nearMeAllowed: true,
            genericAllowed: false,
          },
          audience: {
            b2bOnly: true,
            b2cAllowed: false,
            industryFocus: ["automobilių parkai", "įmonių flotai"],
          },
          funnel: {
            primary: "bofu",
            fallbackOrder: ["mofu"],
            targetCount: 30,
          },
          priorities: [
            {
              category: "reguliari priežiūra",
              weightMultiplier: 1.5,
              reason: "Explicitly mentioned as important",
            },
            {
              category: "detailing paslaugos",
              weightMultiplier: 1.5,
              reason: "Explicitly mentioned as important",
            },
          ],
          negatives: {
            excludeTerms: [],
            excludeBrands: [],
            excludeIntents: [],
          },
          specialModes: {
            pSEODetection: false,
            sideKeywordDiscovery: false,
            competitorGaps: false,
          },
        },
        confidence: {
          overall: 0.9,
          business: 0.95,
          geo: 0.95,
          audience: 0.9,
          funnel: 0.85,
          priorities: 0.9,
          negatives: 0.5,
          specialModes: 0.5,
        },
        clarificationNeeded: [],
      };

      const mockCreate = vi
        .fn()
        .mockResolvedValue(
          mockAnthropicResponse(JSON.stringify(case1Response))
        );

      Anthropic.prototype.messages.create = mockCreate;

      const extractor = new ConstraintExtractor();
      const result = await extractor.extract(
        'Mes automobilių plovykla Šiauliuose. Norime pritraukti daugiau verslo klientų su automobilių parkais.'
      );

      expect(result.success).toBe(true);
      expect(result.constraints?.business.type).toBe("service");
      expect(result.constraints?.business.coreOffering).toBe("automobilių plovykla");
      expect(result.constraints?.geo.scope).toBe("city");
      expect(result.constraints?.geo.includeCities).toContain("šiauliai");
      expect(result.constraints?.audience.b2bOnly).toBe(true);
      expect(result.constraints?.funnel.primary).toBe("bofu");
      expect(result.confidence?.overall).toBeGreaterThanOrEqual(0.85);
    });

    it("extracts e-commerce national constraints (Case 2)", async () => {
      const case2Response = {
        constraints: {
          business: {
            type: "ecommerce",
            coreOffering: "natūrali kosmetika",
            problemsSolved: ["odos priežiūra", "natūralūs produktai"],
            productCategories: ["veido serumai", "šampūnai", "kosmetika"],
          },
          geo: {
            scope: "national",
            includeCities: [],
            excludeCities: [],
            nearMeAllowed: false,
            genericAllowed: true,
          },
          audience: {
            b2bOnly: false,
            b2cAllowed: true,
            industryFocus: [],
          },
          funnel: {
            primary: "mofu",
            fallbackOrder: ["bofu", "tofu"],
            targetCount: 30,
          },
          priorities: [
            {
              category: "veido serumai",
              weightMultiplier: 1.8,
              reason: "Explicitly mentioned as priority",
            },
            {
              category: "šampūnai",
              weightMultiplier: 1.7,
              reason: "Explicitly mentioned as priority",
            },
          ],
          negatives: {
            excludeTerms: [],
            excludeBrands: [],
            excludeIntents: [],
          },
          specialModes: {
            pSEODetection: false,
            sideKeywordDiscovery: false,
            competitorGaps: true,
          },
        },
        confidence: {
          overall: 0.88,
          business: 0.92,
          geo: 0.9,
          audience: 0.85,
          funnel: 0.8,
          priorities: 0.95,
          negatives: 0.5,
          specialModes: 0.7,
        },
        clarificationNeeded: [],
      };

      const mockCreate = vi
        .fn()
        .mockResolvedValue(
          mockAnthropicResponse(JSON.stringify(case2Response))
        );

      Anthropic.prototype.messages.create = mockCreate;

      const extractor = new ConstraintExtractor();
      const result = await extractor.extract(
        'Parduodame natūralią kosmetiką visoje Lietuvoje. Mūsų prioritetas - veido serumai ir šampūnai. Norime išsiskirti iš konkurentų.'
      );

      expect(result.success).toBe(true);
      expect(result.constraints?.business.type).toBe("ecommerce");
      expect(result.constraints?.geo.scope).toBe("national");
      expect(result.constraints?.geo.genericAllowed).toBe(true);
      expect(result.constraints?.priorities).toHaveLength(2);
      expect(result.constraints?.priorities[0].category).toBe("veido serumai");
      expect(result.constraints?.priorities[1].category).toBe("šampūnai");
      expect(result.constraints?.specialModes.competitorGaps).toBe(true);
    });

    it("extracts B2B services multi-city constraints (Case 3)", async () => {
      const case3Response = {
        constraints: {
          business: {
            type: "b2b_services",
            coreOffering: "IT paslaugos",
            problemsSolved: ["IT infrastruktūra", "technologiniai sprendimai"],
            productCategories: ["IT konsultacijos", "IT palaikymas"],
          },
          geo: {
            scope: "city",
            includeCities: ["vilnius", "kaunas"],
            excludeCities: [],
            nearMeAllowed: false,
            genericAllowed: false,
          },
          audience: {
            b2bOnly: true,
            b2cAllowed: false,
            industryFocus: ["enterprise", "didelės įmonės"],
          },
          funnel: {
            primary: "tofu",
            fallbackOrder: ["mofu", "bofu"],
            targetCount: 30,
          },
          priorities: [],
          negatives: {
            excludeTerms: ["smulkus verslas", "mažos įmonės"],
            excludeBrands: [],
            excludeIntents: ["diy", "self-service"],
          },
          specialModes: {
            pSEODetection: false,
            sideKeywordDiscovery: false,
            competitorGaps: false,
          },
        },
        confidence: {
          overall: 0.92,
          business: 0.95,
          geo: 0.95,
          audience: 0.95,
          funnel: 0.75,
          priorities: 0.5,
          negatives: 0.9,
          specialModes: 0.5,
        },
        clarificationNeeded: [],
      };

      const mockCreate = vi
        .fn()
        .mockResolvedValue(
          mockAnthropicResponse(JSON.stringify(case3Response))
        );

      Anthropic.prototype.messages.create = mockCreate;

      const extractor = new ConstraintExtractor();
      const result = await extractor.extract(
        'Teikiame IT paslaugas Vilniuje ir Kaune. Klientai - didelės įmonės. Nenorime smulkių verslų.'
      );

      expect(result.success).toBe(true);
      expect(result.constraints?.business.type).toBe("b2b_services");
      expect(result.constraints?.geo.includeCities).toContain("vilnius");
      expect(result.constraints?.geo.includeCities).toContain("kaunas");
      expect(result.constraints?.audience.b2bOnly).toBe(true);
      expect(result.constraints?.audience.industryFocus).toContain("enterprise");
      expect(result.constraints?.negatives.excludeTerms).toContain("smulkus verslas");
    });
  });

  describe("Business Type Detection", () => {
    it("identifies ecommerce from sales language", async () => {
      const response = {
        constraints: {
          business: {
            type: "ecommerce",
            coreOffering: "online store",
            problemsSolved: [],
            productCategories: [],
          },
          geo: { scope: "national", includeCities: [], excludeCities: [], nearMeAllowed: false, genericAllowed: true },
          audience: { b2bOnly: false, b2cAllowed: true, industryFocus: [] },
          funnel: { primary: "mofu", fallbackOrder: [], targetCount: 30 },
          priorities: [],
          negatives: { excludeTerms: [], excludeBrands: [], excludeIntents: [] },
          specialModes: { pSEODetection: false, sideKeywordDiscovery: false, competitorGaps: false },
        },
        confidence: { overall: 0.85, business: 0.9, geo: 0.8, audience: 0.8, funnel: 0.8, priorities: 0.5, negatives: 0.5, specialModes: 0.5 },
        clarificationNeeded: [],
      };

      const mockCreate = vi.fn().mockResolvedValue(mockAnthropicResponse(JSON.stringify(response)));
      Anthropic.prototype.messages.create = mockCreate;

      const extractor = new ConstraintExtractor();
      const result = await extractor.extract("We sell products online through our e-commerce website");

      expect(result.constraints?.business.type).toBe("ecommerce");
    });

    it("identifies service from service language", async () => {
      const response = {
        constraints: {
          business: {
            type: "service",
            coreOffering: "plumbing services",
            problemsSolved: [],
            productCategories: [],
          },
          geo: { scope: "city", includeCities: [], excludeCities: [], nearMeAllowed: true, genericAllowed: false },
          audience: { b2bOnly: false, b2cAllowed: true, industryFocus: [] },
          funnel: { primary: "bofu", fallbackOrder: [], targetCount: 30 },
          priorities: [],
          negatives: { excludeTerms: [], excludeBrands: [], excludeIntents: [] },
          specialModes: { pSEODetection: false, sideKeywordDiscovery: false, competitorGaps: false },
        },
        confidence: { overall: 0.9, business: 0.95, geo: 0.85, audience: 0.85, funnel: 0.85, priorities: 0.5, negatives: 0.5, specialModes: 0.5 },
        clarificationNeeded: [],
      };

      const mockCreate = vi.fn().mockResolvedValue(mockAnthropicResponse(JSON.stringify(response)));
      Anthropic.prototype.messages.create = mockCreate;

      const extractor = new ConstraintExtractor();
      const result = await extractor.extract("We provide professional plumbing services");

      expect(result.constraints?.business.type).toBe("service");
    });

    it("identifies saas from subscription language", async () => {
      const response = {
        constraints: {
          business: {
            type: "saas",
            coreOffering: "project management software",
            problemsSolved: [],
            productCategories: [],
          },
          geo: { scope: "national", includeCities: [], excludeCities: [], nearMeAllowed: false, genericAllowed: true },
          audience: { b2bOnly: true, b2cAllowed: false, industryFocus: [] },
          funnel: { primary: "mofu", fallbackOrder: [], targetCount: 30 },
          priorities: [],
          negatives: { excludeTerms: [], excludeBrands: [], excludeIntents: [] },
          specialModes: { pSEODetection: false, sideKeywordDiscovery: false, competitorGaps: false },
        },
        confidence: { overall: 0.88, business: 0.92, geo: 0.85, audience: 0.9, funnel: 0.85, priorities: 0.5, negatives: 0.5, specialModes: 0.5 },
        clarificationNeeded: [],
      };

      const mockCreate = vi.fn().mockResolvedValue(mockAnthropicResponse(JSON.stringify(response)));
      Anthropic.prototype.messages.create = mockCreate;

      const extractor = new ConstraintExtractor();
      const result = await extractor.extract("Our SaaS platform helps teams manage projects with monthly subscription");

      expect(result.constraints?.business.type).toBe("saas");
    });

    it("identifies local from location-specific language", async () => {
      const response = {
        constraints: {
          business: {
            type: "local",
            coreOffering: "coffee shop",
            problemsSolved: [],
            productCategories: [],
          },
          geo: { scope: "hyperlocal", includeCities: ["seattle"], excludeCities: [], nearMeAllowed: true, genericAllowed: false },
          audience: { b2bOnly: false, b2cAllowed: true, industryFocus: [] },
          funnel: { primary: "bofu", fallbackOrder: [], targetCount: 30 },
          priorities: [],
          negatives: { excludeTerms: [], excludeBrands: [], excludeIntents: [] },
          specialModes: { pSEODetection: false, sideKeywordDiscovery: false, competitorGaps: false },
        },
        confidence: { overall: 0.9, business: 0.95, geo: 0.95, audience: 0.85, funnel: 0.85, priorities: 0.5, negatives: 0.5, specialModes: 0.5 },
        clarificationNeeded: [],
      };

      const mockCreate = vi.fn().mockResolvedValue(mockAnthropicResponse(JSON.stringify(response)));
      Anthropic.prototype.messages.create = mockCreate;

      const extractor = new ConstraintExtractor();
      const result = await extractor.extract("We're a local coffee shop in downtown Seattle");

      expect(result.constraints?.business.type).toBe("local");
    });

    it("identifies b2b_services from B2B signals", async () => {
      const response = {
        constraints: {
          business: {
            type: "b2b_services",
            coreOffering: "accounting services",
            problemsSolved: [],
            productCategories: [],
          },
          geo: { scope: "regional", includeCities: [], excludeCities: [], nearMeAllowed: false, genericAllowed: true },
          audience: { b2bOnly: true, b2cAllowed: false, industryFocus: ["corporate"] },
          funnel: { primary: "mofu", fallbackOrder: [], targetCount: 30 },
          priorities: [],
          negatives: { excludeTerms: [], excludeBrands: [], excludeIntents: [] },
          specialModes: { pSEODetection: false, sideKeywordDiscovery: false, competitorGaps: false },
        },
        confidence: { overall: 0.9, business: 0.95, geo: 0.85, audience: 0.95, funnel: 0.85, priorities: 0.5, negatives: 0.5, specialModes: 0.5 },
        clarificationNeeded: [],
      };

      const mockCreate = vi.fn().mockResolvedValue(mockAnthropicResponse(JSON.stringify(response)));
      Anthropic.prototype.messages.create = mockCreate;

      const extractor = new ConstraintExtractor();
      const result = await extractor.extract("We provide accounting services for businesses and corporations");

      expect(result.constraints?.business.type).toBe("b2b_services");
    });
  });

  describe("Geographic Constraints", () => {
    it("extracts single city correctly", async () => {
      const response = {
        constraints: {
          business: { type: "service", coreOffering: "test", problemsSolved: [], productCategories: [] },
          geo: {
            scope: "city",
            includeCities: ["boston"],
            excludeCities: [],
            nearMeAllowed: true,
            genericAllowed: false,
          },
          audience: { b2bOnly: false, b2cAllowed: true, industryFocus: [] },
          funnel: { primary: "bofu", fallbackOrder: [], targetCount: 30 },
          priorities: [],
          negatives: { excludeTerms: [], excludeBrands: [], excludeIntents: [] },
          specialModes: { pSEODetection: false, sideKeywordDiscovery: false, competitorGaps: false },
        },
        confidence: { overall: 0.9, business: 0.9, geo: 0.95, audience: 0.85, funnel: 0.85, priorities: 0.5, negatives: 0.5, specialModes: 0.5 },
        clarificationNeeded: [],
      };

      const mockCreate = vi.fn().mockResolvedValue(mockAnthropicResponse(JSON.stringify(response)));
      Anthropic.prototype.messages.create = mockCreate;

      const extractor = new ConstraintExtractor();
      const result = await extractor.extract("We serve customers in Boston");

      expect(result.constraints?.geo.scope).toBe("city");
      expect(result.constraints?.geo.includeCities).toEqual(["boston"]);
    });

    it("extracts multiple cities", async () => {
      const response = {
        constraints: {
          business: { type: "service", coreOffering: "test", problemsSolved: [], productCategories: [] },
          geo: {
            scope: "city",
            includeCities: ["new york", "boston", "philadelphia"],
            excludeCities: [],
            nearMeAllowed: false,
            genericAllowed: false,
          },
          audience: { b2bOnly: false, b2cAllowed: true, industryFocus: [] },
          funnel: { primary: "bofu", fallbackOrder: [], targetCount: 30 },
          priorities: [],
          negatives: { excludeTerms: [], excludeBrands: [], excludeIntents: [] },
          specialModes: { pSEODetection: false, sideKeywordDiscovery: false, competitorGaps: false },
        },
        confidence: { overall: 0.9, business: 0.9, geo: 0.95, audience: 0.85, funnel: 0.85, priorities: 0.5, negatives: 0.5, specialModes: 0.5 },
        clarificationNeeded: [],
      };

      const mockCreate = vi.fn().mockResolvedValue(mockAnthropicResponse(JSON.stringify(response)));
      Anthropic.prototype.messages.create = mockCreate;

      const extractor = new ConstraintExtractor();
      const result = await extractor.extract("We operate in New York, Boston, and Philadelphia");

      expect(result.constraints?.geo.includeCities).toHaveLength(3);
      expect(result.constraints?.geo.includeCities).toContain("new york");
    });

    it("detects national scope", async () => {
      const response = {
        constraints: {
          business: { type: "ecommerce", coreOffering: "test", problemsSolved: [], productCategories: [] },
          geo: {
            scope: "national",
            includeCities: [],
            excludeCities: [],
            nearMeAllowed: false,
            genericAllowed: true,
          },
          audience: { b2bOnly: false, b2cAllowed: true, industryFocus: [] },
          funnel: { primary: "mofu", fallbackOrder: [], targetCount: 30 },
          priorities: [],
          negatives: { excludeTerms: [], excludeBrands: [], excludeIntents: [] },
          specialModes: { pSEODetection: false, sideKeywordDiscovery: false, competitorGaps: false },
        },
        confidence: { overall: 0.9, business: 0.9, geo: 0.95, audience: 0.85, funnel: 0.85, priorities: 0.5, negatives: 0.5, specialModes: 0.5 },
        clarificationNeeded: [],
      };

      const mockCreate = vi.fn().mockResolvedValue(mockAnthropicResponse(JSON.stringify(response)));
      Anthropic.prototype.messages.create = mockCreate;

      const extractor = new ConstraintExtractor();
      const result = await extractor.extract("We ship nationwide across the country");

      expect(result.constraints?.geo.scope).toBe("national");
      expect(result.constraints?.geo.genericAllowed).toBe(true);
    });

    it("handles near-me allowance", async () => {
      const response = {
        constraints: {
          business: { type: "local", coreOffering: "test", problemsSolved: [], productCategories: [] },
          geo: {
            scope: "hyperlocal",
            includeCities: ["denver"],
            excludeCities: [],
            nearMeAllowed: true,
            genericAllowed: false,
          },
          audience: { b2bOnly: false, b2cAllowed: true, industryFocus: [] },
          funnel: { primary: "bofu", fallbackOrder: [], targetCount: 30 },
          priorities: [],
          negatives: { excludeTerms: [], excludeBrands: [], excludeIntents: [] },
          specialModes: { pSEODetection: false, sideKeywordDiscovery: false, competitorGaps: false },
        },
        confidence: { overall: 0.9, business: 0.95, geo: 0.95, audience: 0.85, funnel: 0.85, priorities: 0.5, negatives: 0.5, specialModes: 0.5 },
        clarificationNeeded: [],
      };

      const mockCreate = vi.fn().mockResolvedValue(mockAnthropicResponse(JSON.stringify(response)));
      Anthropic.prototype.messages.create = mockCreate;

      const extractor = new ConstraintExtractor();
      const result = await extractor.extract("We serve local customers near our Denver location");

      expect(result.constraints?.geo.nearMeAllowed).toBe(true);
      expect(result.constraints?.geo.scope).toBe("hyperlocal");
    });
  });

  describe("Audience Detection", () => {
    it("detects B2B-only from explicit signals", async () => {
      const response = {
        constraints: {
          business: { type: "b2b_services", coreOffering: "test", problemsSolved: [], productCategories: [] },
          geo: { scope: "national", includeCities: [], excludeCities: [], nearMeAllowed: false, genericAllowed: true },
          audience: {
            b2bOnly: true,
            b2cAllowed: false,
            industryFocus: ["enterprise", "corporate"],
          },
          funnel: { primary: "mofu", fallbackOrder: [], targetCount: 30 },
          priorities: [],
          negatives: { excludeTerms: [], excludeBrands: [], excludeIntents: [] },
          specialModes: { pSEODetection: false, sideKeywordDiscovery: false, competitorGaps: false },
        },
        confidence: { overall: 0.92, business: 0.9, geo: 0.85, audience: 0.95, funnel: 0.85, priorities: 0.5, negatives: 0.5, specialModes: 0.5 },
        clarificationNeeded: [],
      };

      const mockCreate = vi.fn().mockResolvedValue(mockAnthropicResponse(JSON.stringify(response)));
      Anthropic.prototype.messages.create = mockCreate;

      const extractor = new ConstraintExtractor();
      const result = await extractor.extract("We only work with businesses and enterprises, no individual consumers");

      expect(result.constraints?.audience.b2bOnly).toBe(true);
      expect(result.constraints?.audience.b2cAllowed).toBe(false);
    });

    it("detects B2C from consumer language", async () => {
      const response = {
        constraints: {
          business: { type: "ecommerce", coreOffering: "test", problemsSolved: [], productCategories: [] },
          geo: { scope: "national", includeCities: [], excludeCities: [], nearMeAllowed: false, genericAllowed: true },
          audience: {
            b2bOnly: false,
            b2cAllowed: true,
            industryFocus: [],
          },
          funnel: { primary: "mofu", fallbackOrder: [], targetCount: 30 },
          priorities: [],
          negatives: { excludeTerms: [], excludeBrands: [], excludeIntents: [] },
          specialModes: { pSEODetection: false, sideKeywordDiscovery: false, competitorGaps: false },
        },
        confidence: { overall: 0.88, business: 0.9, geo: 0.85, audience: 0.9, funnel: 0.85, priorities: 0.5, negatives: 0.5, specialModes: 0.5 },
        clarificationNeeded: [],
      };

      const mockCreate = vi.fn().mockResolvedValue(mockAnthropicResponse(JSON.stringify(response)));
      Anthropic.prototype.messages.create = mockCreate;

      const extractor = new ConstraintExtractor();
      const result = await extractor.extract("We sell directly to consumers through our online store");

      expect(result.constraints?.audience.b2cAllowed).toBe(true);
    });

    it("detects mixed audience", async () => {
      const response = {
        constraints: {
          business: { type: "ecommerce", coreOffering: "test", problemsSolved: [], productCategories: [] },
          geo: { scope: "national", includeCities: [], excludeCities: [], nearMeAllowed: false, genericAllowed: true },
          audience: {
            b2bOnly: false,
            b2cAllowed: true,
            industryFocus: ["retail"],
          },
          funnel: { primary: "mofu", fallbackOrder: [], targetCount: 30 },
          priorities: [],
          negatives: { excludeTerms: [], excludeBrands: [], excludeIntents: [] },
          specialModes: { pSEODetection: false, sideKeywordDiscovery: false, competitorGaps: false },
        },
        confidence: { overall: 0.85, business: 0.9, geo: 0.85, audience: 0.8, funnel: 0.85, priorities: 0.5, negatives: 0.5, specialModes: 0.5 },
        clarificationNeeded: [],
      };

      const mockCreate = vi.fn().mockResolvedValue(mockAnthropicResponse(JSON.stringify(response)));
      Anthropic.prototype.messages.create = mockCreate;

      const extractor = new ConstraintExtractor();
      const result = await extractor.extract("We serve both individual customers and wholesale retail partners");

      expect(result.constraints?.audience.b2bOnly).toBe(false);
      expect(result.constraints?.audience.b2cAllowed).toBe(true);
    });
  });

  describe("Funnel Inference", () => {
    it("infers BOFU from purchase intent language", async () => {
      const response = {
        constraints: {
          business: { type: "service", coreOffering: "test", problemsSolved: [], productCategories: [] },
          geo: { scope: "city", includeCities: [], excludeCities: [], nearMeAllowed: true, genericAllowed: false },
          audience: { b2bOnly: false, b2cAllowed: true, industryFocus: [] },
          funnel: {
            primary: "bofu",
            fallbackOrder: ["mofu"],
            targetCount: 30,
          },
          priorities: [],
          negatives: { excludeTerms: [], excludeBrands: [], excludeIntents: [] },
          specialModes: { pSEODetection: false, sideKeywordDiscovery: false, competitorGaps: false },
        },
        confidence: { overall: 0.88, business: 0.9, geo: 0.85, audience: 0.85, funnel: 0.9, priorities: 0.5, negatives: 0.5, specialModes: 0.5 },
        clarificationNeeded: [],
      };

      const mockCreate = vi.fn().mockResolvedValue(mockAnthropicResponse(JSON.stringify(response)));
      Anthropic.prototype.messages.create = mockCreate;

      const extractor = new ConstraintExtractor();
      const result = await extractor.extract("We need customers ready to buy immediately, not just browsing");

      expect(result.constraints?.funnel.primary).toBe("bofu");
    });

    it("infers MOFU from comparison language", async () => {
      const response = {
        constraints: {
          business: { type: "saas", coreOffering: "test", problemsSolved: [], productCategories: [] },
          geo: { scope: "national", includeCities: [], excludeCities: [], nearMeAllowed: false, genericAllowed: true },
          audience: { b2bOnly: true, b2cAllowed: false, industryFocus: [] },
          funnel: {
            primary: "mofu",
            fallbackOrder: ["bofu", "tofu"],
            targetCount: 30,
          },
          priorities: [],
          negatives: { excludeTerms: [], excludeBrands: [], excludeIntents: [] },
          specialModes: { pSEODetection: false, sideKeywordDiscovery: false, competitorGaps: false },
        },
        confidence: { overall: 0.85, business: 0.9, geo: 0.85, audience: 0.9, funnel: 0.85, priorities: 0.5, negatives: 0.5, specialModes: 0.5 },
        clarificationNeeded: [],
      };

      const mockCreate = vi.fn().mockResolvedValue(mockAnthropicResponse(JSON.stringify(response)));
      Anthropic.prototype.messages.create = mockCreate;

      const extractor = new ConstraintExtractor();
      const result = await extractor.extract("People comparing different solutions and evaluating options");

      expect(result.constraints?.funnel.primary).toBe("mofu");
    });

    it("infers TOFU from informational language", async () => {
      const response = {
        constraints: {
          business: { type: "b2b_services", coreOffering: "test", problemsSolved: [], productCategories: [] },
          geo: { scope: "national", includeCities: [], excludeCities: [], nearMeAllowed: false, genericAllowed: true },
          audience: { b2bOnly: true, b2cAllowed: false, industryFocus: [] },
          funnel: {
            primary: "tofu",
            fallbackOrder: ["mofu", "bofu"],
            targetCount: 30,
          },
          priorities: [],
          negatives: { excludeTerms: [], excludeBrands: [], excludeIntents: [] },
          specialModes: { pSEODetection: false, sideKeywordDiscovery: false, competitorGaps: false },
        },
        confidence: { overall: 0.82, business: 0.9, geo: 0.85, audience: 0.9, funnel: 0.75, priorities: 0.5, negatives: 0.5, specialModes: 0.5 },
        clarificationNeeded: [],
      };

      const mockCreate = vi.fn().mockResolvedValue(mockAnthropicResponse(JSON.stringify(response)));
      Anthropic.prototype.messages.create = mockCreate;

      const extractor = new ConstraintExtractor();
      const result = await extractor.extract("We want to educate people about the problem and build awareness");

      expect(result.constraints?.funnel.primary).toBe("tofu");
    });
  });

  describe("Confidence Calibration", () => {
    it("high confidence for explicit statements", async () => {
      const response = {
        constraints: {
          business: { type: "service", coreOffering: "car wash", problemsSolved: [], productCategories: [] },
          geo: { scope: "city", includeCities: ["miami"], excludeCities: [], nearMeAllowed: true, genericAllowed: false },
          audience: { b2bOnly: false, b2cAllowed: true, industryFocus: [] },
          funnel: { primary: "bofu", fallbackOrder: [], targetCount: 30 },
          priorities: [],
          negatives: { excludeTerms: [], excludeBrands: [], excludeIntents: [] },
          specialModes: { pSEODetection: false, sideKeywordDiscovery: false, competitorGaps: false },
        },
        confidence: {
          overall: 0.95,
          business: 0.98,
          geo: 0.97,
          audience: 0.93,
          funnel: 0.92,
          priorities: 0.5,
          negatives: 0.5,
          specialModes: 0.5,
        },
        clarificationNeeded: [],
      };

      const mockCreate = vi.fn().mockResolvedValue(mockAnthropicResponse(JSON.stringify(response)));
      Anthropic.prototype.messages.create = mockCreate;

      const extractor = new ConstraintExtractor();
      const result = await extractor.extract("We are a car wash business located in Miami, Florida serving B2C customers");

      expect(result.confidence?.overall).toBeGreaterThanOrEqual(0.9);
      expect(result.confidence?.business).toBeGreaterThanOrEqual(0.9);
    });

    it("medium confidence for implications", async () => {
      const response = {
        constraints: {
          business: { type: "service", coreOffering: "consulting", problemsSolved: [], productCategories: [] },
          geo: { scope: "regional", includeCities: [], excludeCities: [], nearMeAllowed: false, genericAllowed: true },
          audience: { b2bOnly: true, b2cAllowed: false, industryFocus: [] },
          funnel: { primary: "mofu", fallbackOrder: [], targetCount: 30 },
          priorities: [],
          negatives: { excludeTerms: [], excludeBrands: [], excludeIntents: [] },
          specialModes: { pSEODetection: false, sideKeywordDiscovery: false, competitorGaps: false },
        },
        confidence: {
          overall: 0.75,
          business: 0.8,
          geo: 0.7,
          audience: 0.8,
          funnel: 0.7,
          priorities: 0.5,
          negatives: 0.5,
          specialModes: 0.5,
        },
        clarificationNeeded: ["Geographic targeting could be more specific"],
      };

      const mockCreate = vi.fn().mockResolvedValue(mockAnthropicResponse(JSON.stringify(response)));
      Anthropic.prototype.messages.create = mockCreate;

      const extractor = new ConstraintExtractor();
      const result = await extractor.extract("We help companies in the region improve their operations");

      expect(result.confidence?.overall).toBeGreaterThanOrEqual(0.7);
      expect(result.confidence?.overall).toBeLessThan(0.9);
    });

    it("low confidence for ambiguous input", async () => {
      const response = {
        constraints: {
          business: { type: "service", coreOffering: "business", problemsSolved: [], productCategories: [] },
          geo: { scope: "national", includeCities: [], excludeCities: [], nearMeAllowed: false, genericAllowed: true },
          audience: { b2bOnly: false, b2cAllowed: true, industryFocus: [] },
          funnel: { primary: "mofu", fallbackOrder: [], targetCount: 30 },
          priorities: [],
          negatives: { excludeTerms: [], excludeBrands: [], excludeIntents: [] },
          specialModes: { pSEODetection: false, sideKeywordDiscovery: false, competitorGaps: false },
        },
        confidence: {
          overall: 0.45,
          business: 0.5,
          geo: 0.4,
          audience: 0.4,
          funnel: 0.45,
          priorities: 0.3,
          negatives: 0.3,
          specialModes: 0.3,
        },
        clarificationNeeded: [
          "Business type unclear",
          "Geographic scope not specified",
          "Target audience not defined",
          "Funnel stage unclear",
        ],
      };

      const mockCreate = vi.fn().mockResolvedValue(mockAnthropicResponse(JSON.stringify(response)));
      Anthropic.prototype.messages.create = mockCreate;

      const extractor = new ConstraintExtractor();
      const result = await extractor.extract("We have a business");

      expect(result.confidence?.overall).toBeLessThan(0.5);
      expect(result.clarificationNeeded.length).toBeGreaterThan(0);
    });

    it("populates clarificationNeeded for low-confidence fields", async () => {
      const response = {
        constraints: {
          business: { type: "ecommerce", coreOffering: "products", problemsSolved: [], productCategories: [] },
          geo: { scope: "national", includeCities: [], excludeCities: [], nearMeAllowed: false, genericAllowed: true },
          audience: { b2bOnly: false, b2cAllowed: true, industryFocus: [] },
          funnel: { primary: "mofu", fallbackOrder: [], targetCount: 30 },
          priorities: [],
          negatives: { excludeTerms: [], excludeBrands: [], excludeIntents: [] },
          specialModes: { pSEODetection: false, sideKeywordDiscovery: false, competitorGaps: false },
        },
        confidence: {
          overall: 0.6,
          business: 0.75,
          geo: 0.4,
          audience: 0.45,
          funnel: 0.5,
          priorities: 0.3,
          negatives: 0.3,
          specialModes: 0.3,
        },
        clarificationNeeded: [
          "Geographic targeting unclear - please specify cities or regions",
          "Target audience unclear - B2B or B2C?",
          "Priority categories not specified",
        ],
      };

      const mockCreate = vi.fn().mockResolvedValue(mockAnthropicResponse(JSON.stringify(response)));
      Anthropic.prototype.messages.create = mockCreate;

      const extractor = new ConstraintExtractor();
      const result = await extractor.extract("We sell various products online");

      expect(result.clarificationNeeded).toHaveLength(3);
      expect(result.confidence?.geo).toBeLessThan(0.5);
      expect(result.confidence?.audience).toBeLessThan(0.5);
    });
  });

  describe("Edge Cases", () => {
    it("handles empty input gracefully", async () => {
      const extractor = new ConstraintExtractor();
      const result = await extractor.extract("");

      // Should still attempt extraction but likely with low confidence
      expect(result).toBeDefined();
    });

    it("handles very short input", async () => {
      const response = {
        constraints: {
          business: { type: "service", coreOffering: "unknown", problemsSolved: [], productCategories: [] },
          geo: { scope: "national", includeCities: [], excludeCities: [], nearMeAllowed: false, genericAllowed: true },
          audience: { b2bOnly: false, b2cAllowed: true, industryFocus: [] },
          funnel: { primary: "mofu", fallbackOrder: [], targetCount: 30 },
          priorities: [],
          negatives: { excludeTerms: [], excludeBrands: [], excludeIntents: [] },
          specialModes: { pSEODetection: false, sideKeywordDiscovery: false, competitorGaps: false },
        },
        confidence: {
          overall: 0.3,
          business: 0.4,
          geo: 0.3,
          audience: 0.3,
          funnel: 0.3,
          priorities: 0.2,
          negatives: 0.2,
          specialModes: 0.2,
        },
        clarificationNeeded: ["Need more information about the business"],
      };

      const mockCreate = vi.fn().mockResolvedValue(mockAnthropicResponse(JSON.stringify(response)));
      Anthropic.prototype.messages.create = mockCreate;

      const extractor = new ConstraintExtractor();
      const result = await extractor.extract("Sell stuff");

      expect(result.confidence?.overall).toBeLessThan(0.5);
      expect(result.clarificationNeeded.length).toBeGreaterThan(0);
    });

    it("handles contradictory signals", async () => {
      const response = {
        constraints: {
          business: { type: "ecommerce", coreOffering: "local shop online", problemsSolved: [], productCategories: [] },
          geo: { scope: "city", includeCities: ["austin"], excludeCities: [], nearMeAllowed: true, genericAllowed: true },
          audience: { b2bOnly: false, b2cAllowed: true, industryFocus: [] },
          funnel: { primary: "mofu", fallbackOrder: [], targetCount: 30 },
          priorities: [],
          negatives: { excludeTerms: [], excludeBrands: [], excludeIntents: [] },
          specialModes: { pSEODetection: false, sideKeywordDiscovery: false, competitorGaps: false },
        },
        confidence: {
          overall: 0.65,
          business: 0.7,
          geo: 0.6,
          audience: 0.7,
          funnel: 0.6,
          priorities: 0.5,
          negatives: 0.5,
          specialModes: 0.5,
        },
        clarificationNeeded: ["Business model unclear - both local and e-commerce signals"],
      };

      const mockCreate = vi.fn().mockResolvedValue(mockAnthropicResponse(JSON.stringify(response)));
      Anthropic.prototype.messages.create = mockCreate;

      const extractor = new ConstraintExtractor();
      const result = await extractor.extract("We're a local shop in Austin but also sell nationwide online");

      expect(result.success).toBe(true);
      expect(result.clarificationNeeded.length).toBeGreaterThan(0);
    });

    it("handles English conversation", async () => {
      const response = {
        constraints: {
          business: { type: "saas", coreOffering: "CRM software", problemsSolved: [], productCategories: [] },
          geo: { scope: "national", includeCities: [], excludeCities: [], nearMeAllowed: false, genericAllowed: true },
          audience: { b2bOnly: true, b2cAllowed: false, industryFocus: ["sales teams"] },
          funnel: { primary: "mofu", fallbackOrder: [], targetCount: 30 },
          priorities: [],
          negatives: { excludeTerms: [], excludeBrands: [], excludeIntents: [] },
          specialModes: { pSEODetection: false, sideKeywordDiscovery: false, competitorGaps: false },
        },
        confidence: { overall: 0.9, business: 0.95, geo: 0.85, audience: 0.9, funnel: 0.85, priorities: 0.5, negatives: 0.5, specialModes: 0.5 },
        clarificationNeeded: [],
      };

      const mockCreate = vi.fn().mockResolvedValue(mockAnthropicResponse(JSON.stringify(response)));
      Anthropic.prototype.messages.create = mockCreate;

      const extractor = new ConstraintExtractor();
      const result = await extractor.extract("We provide CRM software for sales teams across the United States");

      expect(result.success).toBe(true);
      expect(result.constraints?.business.type).toBe("saas");
    });

    it("handles mixed language", async () => {
      const response = {
        constraints: {
          business: { type: "service", coreOffering: "restoranas", problemsSolved: [], productCategories: [] },
          geo: { scope: "city", includeCities: ["vilnius"], excludeCities: [], nearMeAllowed: true, genericAllowed: false },
          audience: { b2bOnly: false, b2cAllowed: true, industryFocus: [] },
          funnel: { primary: "bofu", fallbackOrder: [], targetCount: 30 },
          priorities: [],
          negatives: { excludeTerms: [], excludeBrands: [], excludeIntents: [] },
          specialModes: { pSEODetection: false, sideKeywordDiscovery: false, competitorGaps: false },
        },
        confidence: { overall: 0.85, business: 0.9, geo: 0.9, audience: 0.8, funnel: 0.8, priorities: 0.5, negatives: 0.5, specialModes: 0.5 },
        clarificationNeeded: [],
      };

      const mockCreate = vi.fn().mockResolvedValue(mockAnthropicResponse(JSON.stringify(response)));
      Anthropic.prototype.messages.create = mockCreate;

      const extractor = new ConstraintExtractor();
      const result = await extractor.extract("Mes turime restoranas in Vilnius with traditional Lithuanian food");

      expect(result.success).toBe(true);
      expect(result.constraints?.geo.includeCities).toContain("vilnius");
    });
  });

  describe("Error Handling", () => {
    it("returns error for API failure", async () => {
      const mockCreate = vi.fn().mockRejectedValue(new Error("API rate limit exceeded"));
      Anthropic.prototype.messages.create = mockCreate;

      const extractor = new ConstraintExtractor();
      const result = await extractor.extract("Test conversation");

      expect(result.success).toBe(false);
      expect(result.constraints).toBeNull();
      expect(result.error).toContain("API rate limit exceeded");
    });

    it("returns error for invalid JSON response", async () => {
      const mockCreate = vi.fn().mockResolvedValue(mockAnthropicResponse("This is not JSON at all"));
      Anthropic.prototype.messages.create = mockCreate;

      const extractor = new ConstraintExtractor();
      const result = await extractor.extract("Test");

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("returns error for missing API key", () => {
      const originalKey = process.env.ANTHROPIC_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;

      expect(() => new ConstraintExtractor()).toThrow("ANTHROPIC_API_KEY");

      process.env.ANTHROPIC_API_KEY = originalKey;
    });

    it("handles DoS protection for oversized input", async () => {
      const extractor = new ConstraintExtractor();
      const veryLongConversation = "a".repeat(60000); // Exceeds 50k limit

      const result = await extractor.extract(veryLongConversation);

      expect(result.success).toBe(false);
      expect(result.error).toContain("too long");
    });
  });

  describe("Factory functions", () => {
    it("should create extractor with createConstraintExtractor", () => {
      const extractor = createConstraintExtractor({
        model: "claude-opus-4-20250514",
      });
      expect(extractor).toBeInstanceOf(ConstraintExtractor);
    });

    it("should return singleton with getDefaultExtractor", () => {
      const extractor1 = getDefaultExtractor();
      const extractor2 = getDefaultExtractor();

      expect(extractor1).toBe(extractor2);
    });
  });
});
